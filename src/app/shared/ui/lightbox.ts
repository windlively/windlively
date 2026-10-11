import { Component, ElementRef, HostListener, effect, input, output, viewChild } from '@angular/core';
import { Icon } from './icon';

@Component({
  selector: 'app-lightbox',
  imports: [Icon],
  template: `
    @if (src()) {
      <div class="mask" role="dialog" aria-modal="true" aria-label="图片预览" (click)="closed.emit()">
        <figure class="box" (click)="$event.stopPropagation()">
          <img [src]="src()" alt="图片预览" />
          <button #closeBtn type="button" class="btn btn-sm" (click)="closed.emit()">
            <app-icon name="close" [size]="14" /> 关闭
          </button>
        </figure>
      </div>
    }
  `,
  styles: `
    .mask {
      position: fixed;
      inset: 0;
      z-index: 80;
      display: grid;
      place-items: center;
      padding: 20px;
      background: rgba(36, 58, 50, 0.6);
    }
    .box {
      margin: 0;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 10px;
      max-width: min(92vw, 1100px);
    }
    img {
      max-width: 100%;
      max-height: 80vh;
      object-fit: contain;
      background: var(--card-hi);
      box-shadow: var(--sh5);
    }
  `,
})
export class Lightbox {
  readonly src = input<string | null>(null);
  readonly closed = output<void>();
  private readonly closeBtn = viewChild<ElementRef<HTMLButtonElement>>('closeBtn');

  constructor() {
    effect(() => {
      if (this.src()) setTimeout(() => this.closeBtn()?.nativeElement.focus());
    });
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.src()) this.closed.emit();
  }
}
