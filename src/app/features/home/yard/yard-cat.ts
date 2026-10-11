import { AfterViewInit, Component, ElementRef, input, viewChild } from '@angular/core';
import { CAT_PALETTE, CAT_SPRITE } from './cat-sprite';

function decodeByColor(runs: readonly string[], size: number): number[][] {
  const byColor: number[][] = CAT_PALETTE.map(() => []);
  for (let y = 0; y < runs.length; y++) {
    const s = runs[y];
    let x = 0;
    for (let i = 0; i < s.length; i += 3) {
      const n = parseInt(s.slice(i, i + 2), 36) + 1;
      const ci = parseInt(s[i + 2], 36);
      if (ci !== 35) byColor[ci].push(x, y, n);
      x += n;
    }
  }
  return byColor;
}

function decodeMask(rows: readonly string[]): number[] {
  const out: number[] = [];
  for (let y = 0; y < rows.length; y++) {
    const s = rows[y];
    let x = 0;
    for (let i = 0; i < s.length; i += 3) {
      const n = parseInt(s.slice(i, i + 2), 36) + 1;
      if (s[i + 2] === 'a') out.push(x, y, n);
      x += n;
    }
  }
  return out;
}

@Component({
  selector: 'app-yard-cat',
  template: '<canvas #cv aria-hidden="true"></canvas>',
  host: { '[class.avatar-mode]': "mode() === 'avatar'" },
  styles: `
    :host {
      position: absolute;
      left: 50%;
      bottom: 14px;
      transform: translateX(-50%);
      line-height: 0;
      animation: breathe 4.6s ease-in-out infinite;
    }
    :host(.avatar-mode) {
      left: -3px;
      top: -2px;
      bottom: auto;
      transform: none;
      animation: none;
    }
    canvas { display: block; image-rendering: pixelated; }
    @keyframes breathe {
      0%, 100% { transform: translateX(-50%) translateY(0); }
      50% { transform: translateX(-50%) translateY(-1px); }
    }
    @media (prefers-reduced-motion: reduce) {
      :host { animation: none; }
    }
  `,
})
export class YardCat implements AfterViewInit {
  readonly mode = input<'rail' | 'avatar'>('rail');
  private readonly cv = viewChild.required<ElementRef<HTMLCanvasElement>>('cv');

  ngAfterViewInit(): void {
    const el = this.cv().nativeElement;
    const sp = CAT_SPRITE;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.style.width = sp.w + 'px';
    el.style.height = sp.h + 'px';
    el.width = Math.round(sp.w * dpr);
    el.height = Math.round(sp.h * dpr);
    const ctx = el.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    if (sp.shadow) {
      ctx.fillStyle = 'rgba(52,70,59,.16)';
      const m = decodeMask(sp.shadow);
      for (let i = 0; i < m.length; i += 3) ctx.fillRect(m[i], m[i + 1], m[i + 2], 1);
    }
    const byColor = decodeByColor(sp.runs, CAT_PALETTE.length);
    for (let ci = 0; ci < CAT_PALETTE.length; ci++) {
      ctx.fillStyle = CAT_PALETTE[ci];
      const a = byColor[ci];
      for (let i = 0; i < a.length; i += 3) ctx.fillRect(a[i], a[i + 1], a[i + 2], 1);
    }
  }
}
