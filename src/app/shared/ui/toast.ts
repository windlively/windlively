import { Component, Injectable, inject, signal } from '@angular/core';

interface ToastItem {
  id: number;
  text: string;
}

@Injectable({ providedIn: 'root' })
export class Toast {
  private seq = 0;
  readonly items = signal<readonly ToastItem[]>([]);

  show(text: string, ms = 3200): void {
    const id = ++this.seq;
    this.items.update((list) => [...list, { id, text }]);
    setTimeout(() => this.dismiss(id), ms);
  }

  dismiss(id: number): void {
    this.items.update((list) => list.filter((t) => t.id !== id));
  }
}

@Component({
  selector: 'app-toasts',
  template: `
    <div class="stack" role="status" aria-live="polite">
      @for (t of toast.items(); track t.id) {
        <p class="toast" (click)="toast.dismiss(t.id)">{{ t.text }}</p>
      }
    </div>
  `,
  styles: `
    .stack {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 90;
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-width: min(320px, calc(100vw - 32px));
      pointer-events: none;
    }
    .toast {
      margin: 0;
      padding: 10px 14px;
      background: var(--card-hi);
      color: var(--ink);
      box-shadow: var(--sh5);
      font-size: 13px;
      line-height: 1.6;
      cursor: pointer;
      pointer-events: auto;
      animation: toastIn 0.18s var(--ease-out);
    }
    @keyframes toastIn {
      from {
        opacity: 0;
        transform: translateY(-6px);
      }
    }
  `,
})
export class Toasts {
  readonly toast = inject(Toast);
}
