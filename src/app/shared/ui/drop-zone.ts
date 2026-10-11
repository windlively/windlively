import { Component, input, output, signal } from '@angular/core';
import { Icon } from './icon';

@Component({
  selector: 'app-drop-zone',
  imports: [Icon],
  template: `
    <button
      type="button"
      class="drop"
      [class.over]="over()"
      [disabled]="disabled()"
      (click)="picker.click()"
      (dragover)="onDragOver($event)"
      (dragleave)="over.set(false)"
      (drop)="onDrop($event)"
    >
      <span class="ico"><app-icon name="image" [size]="22" /></span>
      <b>{{ hint() }}</b>
      @if (sub()) {
        <span class="subtle sub">{{ sub() }}</span>
      }
    </button>
    <input #picker type="file" accept="image/*" hidden (change)="onPick($event)" />
  `,
  styles: `
    :host {
      display: block;
    }
    .drop {
      width: 100%;
      min-height: 150px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 18px;
      border: 1px dashed var(--sage-deep);
      background: var(--paper-2);
      color: var(--ink);
      font: inherit;
      cursor: pointer;
      transition:
        border-color 0.18s,
        background 0.18s;
    }
    .drop:hover:not([disabled]),
    .drop.over {
      border-color: var(--moss);
      background: var(--sage);
    }
    .drop[disabled] {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .ico {
      color: var(--moss);
    }
    b {
      font-weight: 600;
      font-size: 14px;
    }
    .sub {
      font-size: 12.5px;
    }
  `,
})
export class DropZone {
  readonly hint = input('拖拽图片到此处，或点击选择');
  readonly sub = input('');
  readonly disabled = input(false);
  readonly picked = output<File>();
  readonly over = signal(false);

  onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.picked.emit(file);
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.disabled()) this.over.set(true);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.over.set(false);
    if (this.disabled()) return;
    const file = event.dataTransfer?.files?.[0];
    if (file) this.picked.emit(file);
  }
}
