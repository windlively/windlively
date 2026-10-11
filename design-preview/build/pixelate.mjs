#!/usr/bin/env node
// 无依赖管线：PNG 解码 → 3×3 块中心采样到 512×341 → 30 色量化 → 去噪 → RLE 矢量数据
// 产物：yard-vector.js（canvas 矩形批次可逐格绘制，替代位图底景）、yard-preview.png（×2 放大检查）
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = process.argv[2] || join(HERE, 'source.png');
const OUT_JS = join(HERE, 'yard-vector.js');
const OUT_PNG = join(HERE, 'yard-preview.png');

// ---------- PNG 解码（8bit, RGB/RGBA, 非隔行） ----------
function parsePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a png');
  let off = 8, w = 0, h = 0, bd = 0, ct = 0, inter = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bd = data[8]; ct = data[9]; inter = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (bd !== 8 || inter !== 0 || (ct !== 2 && ct !== 6)) {
    throw new Error(`unsupported png: bd=${bd} ct=${ct} interlace=${inter}`);
  }
  const ch = ct === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const px = Buffer.alloc(h * stride);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = px.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev[x];
      const c = x >= ch ? prev[x - ch] : 0;
      let v = line[x];
      if (f === 1) v = (v + a) & 255;
      else if (f === 2) v = (v + b) & 255;
      else if (f === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
      cur[x] = v;
    }
    prev = cur;
  }
  return { w, h, ch, px };
}

// ---------- 块中心采样：1536×1024 → 512×341 ----------
function downsample(img, GW, GH) {
  const fx = img.w / GW, fy = img.h / GH;
  if (fx < 1 || fy < 1 || Math.abs(fx - fy) > 0.2) throw new Error(`bad ratio ${fx}x${fy}`);
  const out = new Uint8Array(GW * GH * 3);
  for (let y = 0; y < GH; y++) {
    const sy = Math.min(img.h - 1, Math.floor(y * fy + fy / 2));
    for (let x = 0; x < GW; x++) {
      const sx = Math.min(img.w - 1, Math.floor(x * fx + fx / 2));
      const si = (sy * img.w + sx) * img.ch;
      const di = (y * GW + x) * 3;
      out[di] = img.px[si]; out[di + 1] = img.px[si + 1]; out[di + 2] = img.px[si + 2];
    }
  }
  return { w: GW, h: GH, rgb: out, fx };
}

// ---------- 中位切分 + k-means 微调 ----------
function medianCut(px, k) {
  const boxes = [px];
  const range = (box) => {
    let mn = [255, 255, 255], mx = [0, 0, 0];
    for (const p of box) for (let c = 0; c < 3; c++) { if (p[c] < mn[c]) mn[c] = p[c]; if (p[c] > mx[c]) mx[c] = p[c]; }
    let axis = 0, best = -1;
    for (let c = 0; c < 3; c++) { const r = mx[c] - mn[c]; if (r > best) { best = r; axis = c; } }
    return { axis, span: best };
  };
  while (boxes.length < k) {
    let bi = -1, bestScore = -1;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].length < 2) continue;
      const { span } = range(boxes[i]);
      const score = span * Math.sqrt(boxes[i].length);
      if (score > bestScore) { bestScore = score; bi = i; }
    }
    if (bi < 0) break;
    const box = boxes[bi];
    const { axis } = range(box);
    box.sort((a, b) => a[axis] - b[axis]);
    const mid = box.length >> 1;
    boxes.splice(bi, 1, box.slice(0, mid), box.slice(mid));
  }
  return boxes.map((box) => {
    let r = 0, g = 0, b = 0;
    for (const p of box) { r += p[0]; g += p[1]; b += p[2]; }
    const n = box.length;
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  });
}

function nearest(pal, r, g, b) {
  let bi = 0, bd = Infinity;
  for (let i = 0; i < pal.length; i++) {
    const dr = pal[i][0] - r, dg = pal[i][1] - g, db = pal[i][2] - b;
    const d = dr * dr + dg * dg + db * db;
    if (d < bd) { bd = d; bi = i; }
  }
  return bi;
}

function refine(pal, px, iters) {
  for (let it = 0; it < iters; it++) {
    const acc = pal.map(() => [0, 0, 0, 0]);
    for (const p of px) {
      const i = nearest(pal, p[0], p[1], p[2]);
      acc[i][0] += p[0]; acc[i][1] += p[1]; acc[i][2] += p[2]; acc[i][3]++;
    }
    pal = pal.map((c, i) => acc[i][3] ? [Math.round(acc[i][0] / acc[i][3]), Math.round(acc[i][1] / acc[i][3]), Math.round(acc[i][2] / acc[i][3])] : c);
  }
  return pal;
}

function mergeClose(pal, minDist) {
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < pal.length; i++) {
      for (let j = i + 1; j < pal.length; j++) {
        if (dist(pal[i], pal[j]) < minDist) {
          pal[i] = [(pal[i][0] + pal[j][0]) >> 1, (pal[i][1] + pal[j][1]) >> 1, (pal[i][2] + pal[j][2]) >> 1];
          pal.splice(j, 1);
          changed = true;
          break outer;
        }
      }
    }
  }
  return pal;
}

// ---------- 索引化 + 去噪 ----------
function toIndices(pal, px) {
  const out = new Uint8Array(px.length / 3);
  for (let i = 0, p = 0; i < px.length; i += 3, p++) out[p] = nearest(pal, px[i], px[i + 1], px[i + 2]);
  return out;
}

function despeckle(idx, w, h, passes) {
  for (let pass = 0; pass < passes; pass++) {
    const src = idx.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const counts = new Map();
        let same = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const v = src[ny * w + nx];
            if (v === src[i]) same++;
            counts.set(v, (counts.get(v) || 0) + 1);
          }
        }
        if (same <= 1) {
          let bestV = src[i], bestC = 0;
          for (const [v, c] of counts) if (c > bestC) { bestC = c; bestV = v; }
          if (bestC >= 4) idx[i] = bestV;
        }
      }
    }
  }
  return idx;
}

// ---------- PNG 编码（预览用，×2 最近邻放大） ----------
const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
function crc32(buf) { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function writePNG(path, w, h, rgbAt, scale) {
  const W = w * scale, H = h * scale;
  const stride = W * 3;
  const raw = Buffer.alloc((stride + 1) * H);
  for (let y = 0; y < H; y++) {
    const ry = (y / scale) | 0;
    raw[y * (stride + 1)] = 0;
    for (let x = 0; x < W; x++) {
      const [r, g, b] = rgbAt((x / scale) | 0, ry);
      const o = y * (stride + 1) + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
}

// ---------- 主流程 ----------
const GW = 512, GH = 341;
const img = parsePNG(readFileSync(SRC));
const small = downsample(img, GW, GH);
const pixels = [];
for (let i = 0; i < small.rgb.length; i += 3) pixels.push([small.rgb[i], small.rgb[i + 1], small.rgb[i + 2]]);

let pal = medianCut(pixels, 30);
pal = refine(pal, pixels, 4);
pal = mergeClose(pal, 10);
let idx = toIndices(pal, small.rgb);
idx = despeckle(idx, GW, GH, 2);
// 去噪后重打包调色板（可能有的颜色不再出现）
const used = new Set(idx);
const kept = [];
const remap = new Map();
for (let i = 0; i < pal.length; i++) if (used.has(i)) { remap.set(i, kept.length); kept.push(pal[i]); }
idx = idx.map((v) => remap.get(v));
pal = kept;

const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
const palette = pal.map(hex);

// RLE：每行 行程(数, 色号)，行程数用 2 位 base36，色号 1 位 base36
const rows = [];
let totalRuns = 0, maxRun = 0;
for (let y = 0; y < GH; y++) {
  let s = '', x = 0;
  while (x < GW) {
    const v = idx[y * GW + x];
    let n = 1;
    while (x + n < GW && idx[y * GW + x + n] === v) n++;
    s += (n - 1).toString(36).padStart(2, '0') + v.toString(36);
    totalRuns++; if (n > maxRun) maxRun = n;
    x += n;
  }
  rows.push(s);
}
const js = 'window.YARD_VECTOR=' + JSON.stringify({ w: GW, h: GH, palette, runs: rows }) + ';\n';
writeFileSync(OUT_JS, js);

// 预览 PNG：按色板取色、×2 放大
const rgbAt = (x, y) => pal[idx[y * GW + x]];
writePNG(OUT_PNG, GW, GH, rgbAt, 2);

console.log(`source: ${img.w}×${img.h} ch=${img.ch} → grid ${GW}×${GH} (block ${small.fx})`);
console.log(`palette: ${palette.length} colors ${palette.join(' ')}`);
console.log(`runs: ${totalRuns} (max ${maxRun}) · js: ${(Buffer.byteLength(js) / 1024).toFixed(1)} KB`);
console.log(`wrote ${OUT_JS} and ${OUT_PNG}`);
