import { AfterViewInit, Component, ElementRef, OnDestroy, viewChild } from '@angular/core';

// 右上角小景：溪流自远岸流向画外 + 一枝手绘垂柳；t 驱动水面高光
const SCENE_W = 288;
const SCENE_H = 186;
const Y_FAR = 122;
const Y_NEAR = 186;
const HALF_AT_BOTTOM = 112;
const HALF_AT_FAR = 58;

const SCENE_DAY = {
  sky: '#f7f2e6', farBank: '#b7c9a6', nearBank: '#c2d3b2', bankHi: '#d5e2c5',
  waterFar: '#d3e4dd', waterNear: '#93bcbd', ripple: '#bcd4d1',
  glint: '#eef6f2',
  bark: '#6b4a35', barkLt: '#83614b', barkDk: '#54392a', twig: '#7c5c41',
  leaf: '#7e9366', leafLt: '#93a878', leafHi: '#afbf83', leafDeep: '#5f7450',
};
const SCENE_NIGHT = {
  sky: '#202c2a', farBank: '#334038', nearBank: '#3a4a3d', bankHi: '#465744',
  waterFar: '#4e6366', waterNear: '#2f4045', ripple: '#405459',
  glint: '#9db6b0',
  bark: '#4a3a2e', barkLt: '#5a4738', barkDk: '#38291f', twig: '#54402f',
  leaf: '#576b4f', leafLt: '#64795a', leafHi: '#789063', leafDeep: '#475a41',
};

const waterHalf = (y: number) =>
  y >= Y_NEAR ? HALF_AT_BOTTOM
    : HALF_AT_FAR + (HALF_AT_BOTTOM - HALF_AT_FAR) * Math.pow((y - Y_FAR) / (Y_NEAR - Y_FAR), 1.15);
const inWater = (x: number, y: number) => y >= Y_FAR && Math.abs(x - SCENE_W / 2) < waterHalf(y) - 6;
const waterT = (y: number) => Math.max(0, Math.min(1, (y - Y_FAR) / (Y_NEAR - Y_FAR)));
const hexLerp = (a: string, b: string, k: number) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * k).toString(16).padStart(2, '0')).join('');
};

@Component({
  selector: 'app-yard-scene',
  template: '<canvas #cv aria-hidden="true"></canvas>',
  styles: `
    canvas { display: block; image-rendering: pixelated; }
  `,
})
export class YardScene implements AfterViewInit, OnDestroy {
  private readonly cv = viewChild.required<ElementRef<HTMLCanvasElement>>('cv');
  private ctx: CanvasRenderingContext2D | null = null;
  private raf = 0;
  private readonly reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  private readonly onVisibility = () => (document.hidden ? this.stop() : this.start());
  private readonly onResize = () => this.sync();

  ngAfterViewInit(): void {
    this.sync();
    this.reduceMotion.addEventListener('change', this.onResize);
    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  ngOnDestroy(): void {
    this.stop();
    this.reduceMotion.removeEventListener('change', this.onResize);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  private sync(): void {
    const el = this.cv().nativeElement;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.style.width = SCENE_W + 'px';
    el.style.height = SCENE_H + 'px';
    el.width = SCENE_W * dpr;
    el.height = SCENE_H * dpr;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx = ctx;
    this.draw(0);
    this.start();
  }

  private start(): void {
    cancelAnimationFrame(this.raf);
    if (this.reduceMotion.matches || document.hidden) {
      this.draw(0);
      return;
    }
    this.raf = requestAnimationFrame((now) => this.frame(now));
  }

  private stop(): void {
    cancelAnimationFrame(this.raf);
  }

  private frame(now: number): void {
    this.draw(now / 1000);
    this.raf = requestAnimationFrame((ts) => this.frame(ts));
  }

  private draw(t: number): void {
    const c = this.ctx;
    if (!c) return;
    const night = document.body.classList.contains('night');
    const P = night ? SCENE_NIGHT : SCENE_DAY;
    const px = (x: number, y: number, w: number, h: number, col: string) => {
      c.fillStyle = col;
      c.fillRect(x, y, w, h);
    };
    c.clearRect(0, 0, SCENE_W, SCENE_H);

    /* 溪流：远岸在 Y_FAR，水面向观者张开（近处出水），岸坡分列左右 */
    px(0, 110, SCENE_W, 12, P.farBank);
    px(0, 110, SCENE_W, 2, P.bankHi);
    for (let y = Y_FAR; y < Y_NEAR; y++) {
      const hw = waterHalf(y);
      px(0, y, SCENE_W / 2 - hw, 1, P.nearBank);
      px(SCENE_W / 2 + hw, y, SCENE_W / 2 - hw, 1, P.nearBank);
      px(SCENE_W / 2 - hw, y, hw * 2, 1, hexLerp(P.waterFar, P.waterNear, waterT(y)));
      /* 横向波纹：斜着错开的短纹，越近越长，帮读“水从远处流来” */
      if (y % 4 !== 0) continue;
      const wt = waterT(y);
      const seed = ((y * 37) % 11) / 11;
      c.globalAlpha = 0.5 + wt * 0.3;
      px(SCENE_W / 2 - hw * (0.1 + seed * 0.5), y, Math.max(2, hw * (0.34 + wt * 0.4)), 1, P.ripple);
      if (wt > 0.35) px(SCENE_W / 2 + hw * (0.05 + seed * 0.3), y + 2, Math.max(3, hw * (0.3 + wt * 0.3)), 1, P.ripple);
      c.globalAlpha = 1;
    }
    /* 岸边草色点缀：贴着水沿错落（近处更密，帮读纵深） */
    const bankDots = [
      [46, 130, 3], [34, 140, 2], [22, 152, 3], [12, 164, 2], [6, 176, 4],
      [238, 131, 3], [250, 140, 2], [262, 152, 3], [272, 164, 2], [278, 176, 4], [282, 186, 4],
    ];
    for (const [x, y, w] of bankDots) px(x, y, w, 1, P.bankHi);

    /* 水面高光：越近越长、越快（缓慢向右漂移） */
    const glints = [
      [70, 128, 4, 0], [180, 134, 6, 3], [96, 143, 8, 1], [206, 149, 10, 4],
      [58, 160, 13, 2], [176, 166, 17, 0], [232, 175, 20, 3], [110, 179, 15, 1],
    ];
    for (const [x0, y, len, k] of glints) {
      if (!inWater(x0, y)) continue;
      const x = ((x0 + t * (5 + k * 2.2)) % (SCENE_W + len * 2)) - len;
      c.globalAlpha = 0.3 + waterT(y) * 0.25;
      px(Math.round(x), y, len, 1, P.glint);
      c.globalAlpha = 1;
    }

    const resample = (pts: number[][]) => {
      const out: number[][] = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[i + 1];
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        for (let j = 0; j <= n; j++) out.push([x0 + ((x1 - x0) * j) / n, y0 + ((y1 - y0) * j) / n]);
      }
      return out;
    };
    const widthAt = (wid: number[], i: number, n: number) => wid[0] + ((wid[1] - wid[0]) * i) / n;

    /* 柳树：干栽近岸（右岸），主枝向左斜伸过溪，枝上垂下细柳条 */
    const trunkPts = resample([
      [254, 186], [253, 178], [253, 168], [251, 156], [248, 142],
      [244, 126], [240, 110], [238, 96], [238, 84], [240, 74], [244, 66],
    ]);
    for (let i = 0; i < trunkPts.length; i++) {
      const [fx, fy] = trunkPts[i];
      const w = Math.max(1, Math.round(widthAt([11, 4], i, trunkPts.length - 1)));
      const x = Math.round(fx) - (w >> 1);
      px(x, Math.round(fy), w, 1, P.bark);
      px(x, Math.round(fy), 1, 1, P.barkDk);
      px(x + w - 1, Math.round(fy), 1, 1, P.barkLt);
      if (i % 7 === 4 && w > 3) px(x + 1 + (((i / 7) | 0) % 2), Math.round(fy), 1, 1, P.barkDk);
    }
    px(248, 182, 12, 4, P.bark);
    px(254, 180, 8, 4, P.bark);
    px(252, 184, 10, 3, P.barkDk);
    px(246, 186, 30, 2, P.bark);

    const limb = (pts: number[][], wid: number[]) => {
      const rs = resample(pts);
      for (let i = 0; i < rs.length; i++) {
        const w = Math.max(1, Math.round(widthAt(wid, i, rs.length - 1)));
        px(Math.round(rs[i][0]), Math.round(rs[i][1]), w, 1, P.twig);
      }
    };
    const main = [[244, 66], [230, 54], [210, 46], [186, 42], [160, 44], [134, 48], [110, 54], [88, 60], [70, 68]];
    limb(main, [3, 1]);
    limb([[244, 72], [254, 62], [262, 58]], [2, 1]);
    limb([[240, 90], [222, 78], [206, 68]], [2, 1]);
    limb([[234, 102], [214, 94], [192, 92]], [2, 1]);
    limb([[246, 128], [260, 116], [272, 110]], [2, 1]);

    const res = resample(main);
    const mainAt = (x: number) => {
      let best = 60;
      let bd = 1e9;
      for (const [rx, ry] of res) {
        const d = Math.abs(rx - x);
        if (d < bd) {
          bd = d;
          best = ry;
        }
      }
      return Math.round(best);
    };

    const catkin = (x0: number, drop: number, ph: number, curve: number) => {
      const yStart = mainAt(x0) + 1;
      const pal = [P.leafHi, P.leafLt, P.leaf, P.leafHi, P.leafDeep, P.leafLt];
      for (let i = 0; i < drop; i++) {
        const u = i / drop;
        const arc = Math.round(curve * u * u * 3);
        const sway = Math.abs(Math.sin(t * 0.85 + ph + i * 0.07)) > 0.78 ? 1 : 0;
        const x = x0 + arc + sway;
        const y = yStart + i;
        const col = i < 3 ? P.leafLt : i > drop - 6 ? P.leaf : pal[(i + ((ph * 3) | 0)) % pal.length];
        px(x, y, 1, 1, col);
        if (i > 2 && i < drop - 3 && i % 4 !== 3) px(x + 1, y, 1, 1, pal[(i * 2 + 1) % pal.length]);
        if (i > 5 && i < drop - 3 && i % 7 === 5) px(x, y + 1, 1, 1, pal[(i + 3) % pal.length]);
      }
    };
    const strands: number[][] = [
      [72, 30, 0.6, 1], [81, 46, 1.1, 1], [88, 34, 1.6, 1], [76, 22, 2.0, 0],
      [98, 44, 2.4, 1], [107, 50, 2.9, 0], [114, 38, 3.4, 1], [102, 26, 3.8, 0],
      [124, 46, 4.2, 1], [133, 54, 4.7, 1], [140, 40, 5.2, 0], [129, 28, 5.6, 0],
      [150, 48, 6.0, 1], [159, 58, 6.5, 1], [166, 42, 7.0, 0], [155, 30, 7.4, 0],
      [176, 50, 7.8, 1], [185, 60, 8.3, 0], [192, 44, 8.8, 0], [181, 32, 9.2, 1],
      [202, 52, 9.6, 0], [211, 56, 10.1, 0], [218, 40, 10.6, 1], [207, 30, 11.0, 0],
      [230, 36, 11.6, 0],
    ];
    for (const [x, d, ph, curve] of strands) catkin(x, d, ph, curve);
    for (const [x, y0, d, ph] of [[206, 70, 22, 3.2], [220, 83, 24, 6.8], [250, 104, 18, 2.2]]) {
      for (let i = 0; i < d; i++) {
        const sway = Math.abs(Math.sin(t * 0.85 + ph + i * 0.07)) > 0.78 ? 1 : 0;
        px(x + sway, y0 + i, 1, 1, i > d - 5 ? P.leaf : P.leafHi);
      }
    }

    /* 近水柳条在水面拉出淡影：越往下越淡（水越深） */
    for (const [x, d] of strands) {
      const yEnd = mainAt(x) + 1 + d;
      if (!inWater(x, yEnd)) continue;
      for (let i = 0, ry = yEnd + 2; i < 24 && ry < Y_NEAR; i++, ry++) {
        if (!inWater(x, ry)) break;
        c.globalAlpha = Math.max(0.05, 0.3 - i * 0.018);
        px(x, ry, 1, 1, P.leafDeep);
      }
    }
    c.globalAlpha = 1;
  }
}
