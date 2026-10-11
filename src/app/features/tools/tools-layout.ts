import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-tools-layout',
  imports: [RouterOutlet],
  template: `<router-outlet />`,
  styles: `
    :host {
      display: block;
      width: min(var(--page-max), 100%);
      margin: 0 auto;
      padding: 26px 24px 14px;
      flex: 1;
    }
    @media (max-width: 599px) {
      :host {
        padding: 14px 16px 10px;
      }
    }
  `,
})
export class ToolsLayout {}
