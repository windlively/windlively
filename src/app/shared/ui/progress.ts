import { Component, input } from '@angular/core';

@Component({
  selector: 'app-progress',
  template: `
    <div class="p" role="progressbar" [attr.aria-valuenow]="value()" aria-valuemin="0" aria-valuemax="100">
      <i [style.width.%]="value()"></i>
    </div>
  `,
  styles: `
    .p {
      height: 6px;
      background: var(--sage);
      overflow: hidden;
    }
    .p i {
      display: block;
      height: 100%;
      background: var(--moss);
      transition: width 0.15s;
    }
  `,
})
export class Progress {
  readonly value = input(0);
}
