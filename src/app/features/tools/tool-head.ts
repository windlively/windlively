import { Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Icon } from '../../shared/ui/icon';
import { TOOLS, ToolId, toolMeta } from './tools-meta';

@Component({
  selector: 'app-tool-head',
  imports: [Icon, RouterLink],
  template: `
    <header class="thead">
      <div class="top">
        <a class="back" routerLink="/"><app-icon name="arrow-left" [size]="14" /> 返回小院</a>
        <span class="kicker">TOOL · {{ meta().no }}</span>
      </div>
      <div class="ident">
        <span class="ico"><app-icon [name]="meta().icon" [size]="22" /></span>
        <div class="names">
          <h1>{{ meta().name }}</h1>
          <p class="subtle">{{ meta().desc }}</p>
        </div>
      </div>
      <nav class="switch" aria-label="切换工具">
        @for (t of tools; track t.id) {
          <a
            [routerLink]="t.path"
            [class.on]="t.id === toolId()"
            [attr.aria-current]="t.id === toolId() ? 'page' : null"
            >{{ t.name }}</a
          >
        }
      </nav>
      <label class="switch-select">
        <span class="subtle">工具</span>
        <select [value]="toolId()" (change)="go($event)" aria-label="切换工具">
          @for (t of tools; track t.id) {
            <option [value]="t.id" [selected]="t.id === toolId()">{{ t.no }} · {{ t.name }}</option>
          }
        </select>
      </label>
    </header>
  `,
  styles: `
    :host {
      display: block;
      margin: 0 0 14px;
    }
    .top {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .back {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: var(--muted);
      text-decoration: none;
    }
    .back:hover {
      color: var(--ink);
    }
    .kicker {
      font-family: var(--mono);
      font-size: 10.5px;
      letter-spacing: 0.15em;
      color: #a17c60;
    }
    .ident {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 12px 0 0;
    }
    .ico {
      width: 44px;
      height: 44px;
      display: grid;
      place-items: center;
      background: #e7eadb;
      color: #65755f;
      flex: none;
    }
    .names h1 {
      font-size: 20px;
      font-weight: 600;
    }
    .names p {
      margin: 2px 0 0;
      font-size: 12.5px;
    }
    .switch {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
      margin: 12px 0 0;
    }
    .switch a {
      padding: 6px 11px;
      font-size: 13px;
      color: var(--muted);
      text-decoration: none;
      border-bottom: 2px solid transparent;
    }
    .switch a:hover {
      color: var(--ink);
    }
    .switch a.on {
      color: var(--ink);
      border-bottom-color: var(--moss);
      font-weight: 600;
    }
    .switch-select {
      display: none;
      align-items: center;
      gap: 10px;
      margin: 12px 0 0;
      font-size: 13px;
    }
    .switch-select select {
      flex: 1;
      min-width: 0;
    }
    @media (max-width: 599px) {
      .switch {
        display: none;
      }
      .switch-select {
        display: flex;
      }
    }
  `,
})
export class ToolHead {
  readonly toolId = input.required<ToolId>();
  readonly tools = TOOLS;
  readonly meta = computed(() => toolMeta(this.toolId()));
  private readonly router = inject(Router);

  go(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as ToolId;
    void this.router.navigateByUrl(toolMeta(value).path);
  }
}
