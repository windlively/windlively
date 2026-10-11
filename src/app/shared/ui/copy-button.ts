import { Component, inject, input, signal } from '@angular/core';
import { Icon } from './icon';
import { Toast } from './toast';
import { copyText } from './files';

@Component({
  selector: 'app-copy-button',
  imports: [Icon],
  template: `
    <button
      type="button"
      class="btn btn-sm"
      [class.btn-icon]="iconOnly()"
      [attr.aria-label]="label()"
      [title]="label()"
      (click)="copy()"
    >
      <app-icon name="copy" [size]="14" />
      @if (!iconOnly()) {
        <span class="lbl">{{ copied() ? '已复制' : label() }}</span>
      }
    </button>
  `,
  styles: `
    .lbl {
      min-width: 3em;
      text-align: left;
    }
  `,
})
export class CopyButton {
  readonly text = input('');
  readonly label = input('复制');
  readonly iconOnly = input(false);
  readonly copied = signal(false);
  private readonly toast = inject(Toast);

  async copy(): Promise<void> {
    const text = this.text();
    if (!text) return;
    try {
      await copyText(text);
      this.copied.set(true);
      this.toast.show('已复制');
      setTimeout(() => this.copied.set(false), 1500);
    } catch {
      this.toast.show('复制失败，请手动选择复制');
    }
  }
}
