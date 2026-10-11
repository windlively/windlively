import { Component, ElementRef, inject, input, output } from '@angular/core';

export interface TabItem {
  id: string;
  label: string;
}

@Component({
  selector: 'app-tabs',
  template: `
    <div class="bar" role="tablist" (keydown)="onKey($event)">
      @for (t of tabs(); track t.id) {
        <button
          type="button"
          role="tab"
          class="chip"
          [class.active]="t.id === value()"
          [attr.aria-selected]="t.id === value()"
          [tabindex]="t.id === value() ? 0 : -1"
          (click)="pick(t.id)"
        >
          {{ t.label }}
        </button>
      }
    </div>
  `,
  styles: `
    .bar {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
  `,
})
export class Tabs {
  readonly tabs = input.required<readonly TabItem[]>();
  readonly value = input('');
  readonly valueChange = output<string>();
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  pick(id: string): void {
    this.valueChange.emit(id);
  }

  onKey(event: KeyboardEvent): void {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const list = this.tabs();
    const idx = list.findIndex((t) => t.id === this.value());
    if (idx < 0) return;
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const next = list[(idx + delta + list.length) % list.length];
    this.valueChange.emit(next.id);
    const buttons = this.host.nativeElement.querySelectorAll<HTMLElement>('button[role="tab"]');
    buttons[list.indexOf(next)]?.focus();
  }
}
