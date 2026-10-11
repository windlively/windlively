#!/usr/bin/env node
// 元素精灵管线：从 source.png 的 512×341 量化网格里裁出各元素，
// 按背景色族泛洪去底（透明遮罩）→ 去噪 → 可选烘焙像素阴影 → RLE 矢量输出。
// 产物：yard-sprites.js（window.YARD_SPRITES）+ sprites-preview.png（接触表，供核对）
// 用法：node sprites.mjs [probe]
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, 'source.png');
const VEC = join(HERE, 'yard-vector.js');
const OUT_JS = join(HERE, 'yard-sprites.js');
const OUT_PNG = join(HERE, 'sprites-preview.png');
const DEBUG_PNG = join(HERE, 'debug-index.png');
const PROBE = process.argv[2] === 'probe';
const DEBUG = process.argv[2] === 'debug';

// ---------- PNG 编码 ----------
const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
const crc32 = (buf) => { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function writeRGB(path, w, h, rgbAt, scale) {
  const W = w * scale, H = h * scale;
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    const ry = (y / scale) | 0;
    raw[y * (W * 3 + 1)] = 0;
    for (let x = 0; x < W; x++) {
      const [r, g, b] = rgbAt((x / scale) | 0, ry);
      const o = y * (W * 3 + 1) + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  writeFileSync(path, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
}

const GW = 512, GH = 341;

// ---------- PNG 解码 ----------
function parsePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a png');
  let off = 8, w = 0, h = 0, bd = 0, ct = 0, inter = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; inter = data[12]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (bd !== 8 || inter !== 0 || (ct !== 2 && ct !== 6)) throw new Error(`unsupported png: bd=${bd} ct=${ct} interlace=${inter}`);
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

function downsample(img, gW, gH) {
  const fx = img.w / gW, fy = img.h / gH;
  const out = new Uint8Array(gW * gH * 3);
  for (let y = 0; y < gH; y++) {
    const sy = Math.min(img.h - 1, Math.floor(y * fy + fy / 2));
    for (let x = 0; x < gW; x++) {
      const sx = Math.min(img.w - 1, Math.floor(x * fx + fx / 2));
      const si = (sy * img.w + sx) * img.ch;
      const di = (y * gW + x) * 3;
      out[di] = img.px[si]; out[di + 1] = img.px[si + 1]; out[di + 2] = img.px[si + 2];
    }
  }
  return out;
}

const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
function nearest(pal, r, g, b) {
  let bi = 0, bd = Infinity;
  for (let i = 0; i < pal.length; i++) {
    const dr = pal[i][0] - r, dg = pal[i][1] - g, db = pal[i][2] - b;
    const d = dr * dr + dg * dg + db * db;
    if (d < bd) { bd = d; bi = i; }
  }
  return bi;
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

// ---------- 调色板 + 全图索引 ----------
const vecJs = readFileSync(VEC, 'utf8');
const VEC_OBJ = JSON.parse(vecJs.slice(vecJs.indexOf('{'), vecJs.lastIndexOf('}') + 1));
const PAL = VEC_OBJ.palette.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
// 原有 30 色。第 30 位起是后加的暖橙/粉色，只给声明了 palExtra 的精灵（小猫）使用，
// 其余精灵与底图仍按前 30 色量化，保证逐字节不变。
const PAL_BASE = PAL.slice(0, 30);

const img = parsePNG(readFileSync(SRC));
const rgb = downsample(img, GW, GH);
let IDX = new Uint8Array(GW * GH);
for (let i = 0, p = 0; i < rgb.length; i += 3, p++) IDX[p] = nearest(PAL_BASE, rgb[i], rgb[i + 1], rgb[i + 2]);
IDX = despeckle(IDX, GW, GH, 2);

// ---------- debug：索引调色板可视化（每个色号一个高饱和色 + 16px 网格） ----------
if (DEBUG) {
  const hueColor = (i) => {
    const h = ((i * 137.508) % 360) / 360, s = 0.9, v = 0.95;
    const c = v * s, x = c * (1 - Math.abs(((h * 6) % 2) - 1)), m = v - c;
    let r = 0, g = 0, b = 0;
    const seg = Math.floor(h * 6) % 6;
    if (seg === 0) { r = c; g = x; } else if (seg === 1) { r = x; g = c; }
    else if (seg === 2) { g = c; b = x; } else if (seg === 3) { g = x; b = c; }
    else if (seg === 4) { r = x; b = c; } else { r = c; b = x; }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  };
  const dbg = PAL.map((_, i) => hueColor(i));
  writeRGB(DEBUG_PNG, GW, GH, (x, y) => {
    if (x % 16 === 0 || y % 16 === 0) return [70, 70, 70];
    return dbg[IDX[y * GW + x]];
  }, 2);
  console.log(`wrote ${DEBUG_PNG}\nlegend:`);
  PAL.forEach((c, i) => console.log(`  ${i}  ${hex(c)}  →  dbg ${hex(dbg[i])}`));
  process.exit(0);
}

// ---------- 精灵定义（x/y/w/h 为 512×341 网格坐标；bg = 可被泛洪移除的色号） ----------
const DEFS = [
  // 柳枝垂帘：首屏顶部（背景=天空/日晕）
  { name: 'willow', x: 0, y: 0, w: 160, h: 148, bg: [28, 29, 27, 23, 26, 24, 15, 21] },
  // 案头小景：外部元素图（平底奶油色），自动背景族；擦掉烘进的热气（改为页面动态绘制）
  { name: 'desk', src: 'elem-desk.png', gw: 256, bgAuto: true, bgTol: 30, shadow: true, erase: [[14, 0, 52, 26]] },
  // 挂灯：外部元素图
  { name: 'lantern', src: 'elem-lantern.png', gw: 112, bgAuto: true, bgTol: 30 },
  // 竹：外部元素图
  { name: 'bamboo', src: 'elem-bamboo.png', gw: 120, bgAuto: true, bgTol: 30, shadow: true },
  // 花瓶：外部元素图
  { name: 'vase', src: 'elem-vase.png', gw: 112, bgAuto: true, bgTol: 30, shadow: true },
  // 池塘：外部元素图
  { name: 'pond', src: 'elem-pond.png', gw: 144, bgAuto: true, bgTol: 30 },
  // 猫：左栏画框头像（外部元素图，坐着的小橘猫；chibi 大头版，尺寸更小，可用后加暖色）
  { name: 'cat', src: 'elem-cat2.png', gw: 168, bgAuto: true, bgTol: 30, shadow: true, palExtra: true },
  // 矮凳：作品（背景=石径、地面；凳木为棕色系，保留）
  { name: 'stool', x: 316, y: 278, w: 128, h: 63, bg: [25, 21, 27, 16, 15, 19, 13, 29, 26, 22, 17, 18, 10, 8, 5, 4, 3, 6, 24], shadow: true },
  // 远山与湖：页脚上方（墙檐线收底，CSS 顶部渐隐）
  { name: 'mountains', x: 178, y: 82, w: 147, h: 88, bg: [] },
];

// ---------- 工具 ----------
function floodRemove(sprite) {
  const { w, h } = sprite;
  const bgSet = new Set(sprite.bg);
  const alpha = new Uint8Array(w * h).fill(1);
  // keepBox：矩形内的像素强制保留，并阻断泛洪（保护近底色的浅色内容）
  const blocked = new Uint8Array(w * h);
  for (const [x0, y0, x1, y1] of sprite.keep || []) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) blocked[y * w + x] = 1;
  }
  const q = [];
  const push = (x, y) => { const i = y * w + x; if (alpha[i] && !blocked[i] && bgSet.has(sprite.idx[i])) { alpha[i] = 0; q.push(i); } };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (q.length) {
    const i = q.pop();
    const x = i % w, y = (i / w) | 0;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  // 去残留斑点：背景色号像素若 ≥3 面透明则也去掉（2 轮）
  for (let pass = 0; pass < 2; pass++) {
    const src = alpha.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!src[i] || !bgSet.has(sprite.idx[i])) continue;
        let t = 0;
        if (x === 0 || !src[i - 1]) t++;
        if (x === w - 1 || !src[i + 1]) t++;
        if (y === 0 || !src[i - w]) t++;
        if (y === h - 1 || !src[i + w]) t++;
        if (t >= 3) alpha[i] = 0;
      }
    }
  }
  return alpha;
}

// ---------- PNG 编码（旧位置已移至文件顶部） ----------

function trim(sprite, alpha) {
  let x0 = sprite.w, y0 = sprite.h, x1 = -1, y1 = -1;
  for (let y = 0; y < sprite.h; y++) {
    for (let x = 0; x < sprite.w; x++) {
      if (alpha[y * sprite.w + x]) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) throw new Error(sprite.name + ': empty sprite');
  sprite.trimOff = { x: x0, y: y0 };
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const idx = new Uint8Array(w * h), a2 = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      idx[y * w + x] = sprite.idx[(y + y0) * sprite.w + (x + x0)];
      a2[y * w + x] = alpha[(y + y0) * sprite.w + (x + x0)];
    }
  }
  sprite.cut = { x: sprite.x + x0, y: sprite.y + y0 };
  sprite.w = w; sprite.h = h; sprite.idx = idx;
  return a2;
}

// RLE：行程数 2 位 base36，色号 1 位 base36；'z' = 透明
function rle(idx, alpha, w, h) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    let s = '', x = 0;
    while (x < w) {
      const v = alpha[y * w + x] ? idx[y * w + x] : 35;
      let n = 1;
      while (x + n < w) {
        const v2 = alpha[y * w + x + n] ? idx[y * w + x + n] : 35;
        if (v2 !== v) break;
        n++;
      }
      s += (n - 1).toString(36).padStart(2, '0') + v.toString(36);
      x += n;
    }
    rows.push(s);
  }
  return rows;
}

// 阴影蒙版：整体右移下移各 offset，1 位 RLE（'a'=有阴影, 'z'=无）
function shadowRLE(alpha, w, h, off) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    let s = '', x = 0;
    const has = (px, py) => px >= off && py >= off && px - off < w && py - off < h && alpha[(py - off) * w + (px - off)];
    while (x < w) {
      const v = has(x, y) ? 'a' : 'z';
      let n = 1;
      while (x + n < w && (has(x + n, y) ? 'a' : 'z') === v) n++;
      s += (n - 1).toString(36).padStart(2, '0') + v;
      x += n;
    }
    rows.push(s);
  }
  return rows;
}

// ---------- probe：打印每个矩形的边缘色号直方图 ----------
if (PROBE) {
  for (const d of DEFS) {
    const counts = new Map();
    const add = (x, y) => { const v = IDX[y * GW + x]; counts.set(v, (counts.get(v) || 0) + 1); };
    for (let x = d.x; x < d.x + d.w; x++) { for (let k = 0; k < 3; k++) { add(x, d.y + k); add(x, d.y + d.h - 1 - k); } }
    for (let y = d.y; y < d.y + d.h; y++) { for (let k = 0; k < 3; k++) { add(d.x + k, y); add(d.x + d.w - 1 - k, y); } }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
      .map(([i, c]) => `${i}(${hex(PAL[i])}×${c})`).join(' ');
    console.log(`\n== ${d.name} rect ${d.x},${d.y} ${d.w}×${d.h}\n  border: ${top}`);
  }
  process.exit(0);
}

// ---------- 主流程 ----------
const out = { palette: VEC_OBJ.palette, sprites: {} };
const sheet = [];
for (const d of DEFS) {
  if (d.src) {
    // 外部元素图（平底单色背景）：缩放 → 共享调色板量化 → 自动背景族
    const im = parsePNG(readFileSync(join(HERE, d.src)));
    const gh2 = Math.round(d.gw * im.h / im.w);
    const rgb2 = downsample(im, d.gw, gh2);
    const cand = d.palExtra ? PAL : PAL_BASE;
    const lidx = new Uint8Array(d.gw * gh2);
    for (let i = 0, p = 0; i < rgb2.length; i += 3, p++) lidx[p] = nearest(cand, rgb2[i], rgb2[i + 1], rgb2[i + 2]);
    d.idx = lidx; d.w = d.gw; d.h = gh2; d.x = 0; d.y = 0;
    despeckle(d.idx, d.w, d.h, 2);
    if (d.bgAuto) {
      const counts = new Map();
      const note = (x, y) => counts.set(lidx[y * d.w + x], (counts.get(lidx[y * d.w + x]) || 0) + 1);
      for (let x = 0; x < d.w; x++) { note(x, 0); note(x, d.h - 1); }
      for (let y = 0; y < d.h; y++) { note(0, y); note(d.w - 1, y); }
      const primary = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const tol = d.bgTol || 42;
      const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      d.bg = cand.map((_, i) => i).filter((i) => dist(PAL[i], PAL[primary]) < tol);
      console.log(`${d.name}: auto bg primary=${primary}(${hex(PAL[primary])}) family=[${d.bg.join(',')}]`);
    }
  } else {
    d.idx = new Uint8Array(d.w * d.h);
    for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) d.idx[y * d.w + x] = IDX[(d.y + y) * GW + (d.x + x)];
  }
  const alpha = trim(d, floodRemove(d));
  for (const [x0, y0, x1, y1] of d.erase || []) {
    for (let y = Math.max(0, y0); y <= Math.min(d.h - 1, y1); y++)
      for (let x = Math.max(0, x0); x <= Math.min(d.w - 1, x1); x++) alpha[y * d.w + x] = 0;
  }
  const runs = rle(d.idx, alpha, d.w, d.h);
  const shadow = d.shadow ? shadowRLE(alpha, d.w, d.h, 2) : null;
  out.sprites[d.name] = { w: d.w, h: d.h, runs, ...(shadow ? { shadow } : {}) };
  console.log(`${d.name}: ${d.w}×${d.h} cut@${d.cut.x},${d.cut.y} runs=${runs.reduce((a, s) => a + s.length, 0) / 3}${shadow ? ' +shadow' : ''}`);
  sheet.push({ name: d.name, w: d.w, h: d.h, alpha, idx: d.idx, shadow: d.shadow });
}

const js = 'window.YARD_SPRITES=' + JSON.stringify(out) + ';\n';
writeFileSync(OUT_JS, js);
console.log(`js: ${(Buffer.byteLength(js) / 1024).toFixed(1)} KB`);

// ---------- 接触表：纸底 + 阴影 + 1px 边框，×2 ----------
const PAD = 10, COLS = 2;
const layout = [];
let cx = PAD, cy = PAD, rowMaxH = 0, accW = PAD;
for (const s of sheet) {
  layout.push({ s, x: cx, y: cy });
  cx += s.w + PAD;
  if (s.h > rowMaxH) rowMaxH = s.h;
  if (layout.length % COLS === 0) { accW = Math.max(accW, cx); cx = PAD; cy += rowMaxH + PAD; rowMaxH = 0; }
}
const SW = Math.max(accW, cx), SH = cy + rowMaxH + PAD;
const paper = [0xf7, 0xf3, 0xe8];
const shCol = [0xd8, 0xd7, 0xcc];
const canvas = new Uint8Array(SW * SH * 3);
for (let i = 0; i < SW * SH; i++) { canvas[i * 3] = paper[0]; canvas[i * 3 + 1] = paper[1]; canvas[i * 3 + 2] = paper[2]; }
const put = (x, y, c) => { if (x < 0 || y < 0 || x >= SW || y >= SH) return; const i = (y * SW + x) * 3; canvas[i] = c[0]; canvas[i + 1] = c[1]; canvas[i + 2] = c[2]; };
for (const { s, x: ox, y: oy } of layout) {
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    if (s.shadow && x >= 2 && y >= 2 && s.alpha[(y - 2) * s.w + (x - 2)]) put(ox + x, oy + y, shCol);
  }
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    if (s.alpha[y * s.w + x]) put(ox + x, oy + y, PAL[s.idx[y * s.w + x]]);
  }
  for (let x = -1; x <= s.w; x++) { put(ox + x, oy - 1, [0x9a, 0x9a, 0x8a]); put(ox + x, oy + s.h, [0x9a, 0x9a, 0x8a]); }
  for (let y = -1; y <= s.h; y++) { put(ox - 1, oy + y, [0x9a, 0x9a, 0x8a]); put(ox + s.w, oy + y, [0x9a, 0x9a, 0x8a]); }
  console.log(`sheet: ${s.name} @ ${ox},${oy} size ${s.w}×${s.h}`);
}
writeRGB(OUT_PNG, SW, SH, (x, y) => { const i = (y * SW + x) * 3; return [canvas[i], canvas[i + 1], canvas[i + 2]]; }, 2);
console.log(`wrote ${OUT_JS} and ${OUT_PNG} (${SW}×${SH})`);
