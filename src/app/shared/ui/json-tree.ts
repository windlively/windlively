import { Component, computed, effect, input, signal } from '@angular/core';
import { CopyButton } from './copy-button';

type Kind = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

interface Row {
  path: string;
  label: string;
  depth: number;
  kind: Kind;
  text: string;
  title: string;
  expandable: boolean;
  expanded: boolean;
  count: number;
}

const MAX_LEN = 220;

function kindOf(value: unknown): Kind {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  switch (typeof value) {
    case 'object':
      return 'object';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    default:
      return 'string';
  }
}

function previewOf(value: unknown, kind: Kind): string {
  if (kind === 'object') return '{ … }';
  if (kind === 'array') return '[ … ]';
  if (kind === 'null') return 'null';
  if (kind === 'string') {
    const s = value as string;
    const shown = s.length > MAX_LEN ? s.slice(0, MAX_LEN) + '…' : s;
    return JSON.stringify(shown);
  }
  return String(value);
}

function childPath(base: string, key: string, isArray: boolean): string {
  if (isArray) return `${base}[${key}]`;
  return /^[A-Za-z_$][\w$]*$/.test(key) ? `${base}.${key}` : `${base}[${JSON.stringify(key)}]`;
}

@Component({
  selector: 'app-json-tree',
  imports: [CopyButton],
  template: `
    <div class="tree" role="tree">
      @for (row of rows(); track row.path) {
        <div
          class="row"
          role="treeitem"
          [attr.aria-expanded]="row.expandable ? row.expanded : null"
          [style.padding-left.px]="8 + row.depth * 16"
        >
          @if (row.expandable) {
            <button
              type="button"
              class="tgl"
              [attr.aria-label]="row.expanded ? '收起' : '展开'"
              (click)="toggle(row.path)"
            >
              <span class="caret" [class.on]="row.expanded"></span>
            </button>
          } @else {
            <span class="tgl-space"></span>
          }
          <span class="key">{{ row.label }}</span>
          <span class="colon">:</span>
          <span class="val" [class]="'k-' + row.kind" [title]="row.title">{{ row.text }}</span>
          @if (row.expandable) {
            <span class="count">{{ row.count }}</span>
          }
          <span class="spacer"></span>
          <app-copy-button [text]="row.path" [iconOnly]="true" label="复制路径" />
        </div>
      }
    </div>
  `,
  styles: `
    .tree {
      font-family: var(--mono);
      font-size: 12.5px;
      line-height: 1.5;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px 3px 0;
      min-height: 30px;
    }
    .row:hover {
      background: rgba(200, 214, 174, 0.3);
    }
    .tgl {
      width: 22px;
      height: 22px;
      flex: none;
      display: grid;
      place-items: center;
      border: 0;
      background: transparent;
      cursor: pointer;
      color: var(--muted);
    }
    .tgl:hover {
      color: var(--moss);
    }
    .caret {
      width: 0;
      height: 0;
      border-top: 5px solid transparent;
      border-bottom: 5px solid transparent;
      border-left: 7px solid currentColor;
      transition: transform 0.15s;
    }
    .caret.on {
      transform: rotate(90deg);
    }
    .tgl-space {
      width: 22px;
      flex: none;
    }
    .key {
      color: var(--ink);
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .colon {
      color: var(--muted);
    }
    .val {
      overflow-wrap: anywhere;
      min-width: 0;
    }
    .k-string {
      color: var(--code-str);
    }
    .k-number {
      color: var(--code-num);
    }
    .k-boolean {
      color: var(--code-bool);
    }
    .k-null {
      color: var(--muted);
      font-style: italic;
    }
    .count {
      color: var(--muted);
      font-size: 11px;
      flex: none;
    }
  `,
})
export class JsonTree {
  readonly data = input.required<unknown>();
  private readonly expanded = signal<ReadonlySet<string>>(new Set(['$']));
  readonly rows = computed(() => this.buildRows());

  constructor() {
    let previous: unknown;
    effect(() => {
      const data = this.data();
      if (data !== previous) {
        previous = data;
        this.expanded.set(new Set(['$']));
      }
    });
  }

  toggle(path: string): void {
    this.expanded.update((set) => {
      const next = new Set(set);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  expandAll(): void {
    this.expanded.set(new Set(this.collectPaths(this.data(), '$')));
  }

  collapseAll(): void {
    this.expanded.set(new Set(['$']));
  }

  private collectPaths(value: unknown, path: string, acc: string[] = []): string[] {
    const entries = this.entriesOf(value);
    if (!entries.length) return acc;
    acc.push(path);
    for (const [key, child] of entries) {
      this.collectPaths(child, childPath(path, key, Array.isArray(value)), acc);
    }
    return acc;
  }

  private entriesOf(value: unknown): readonly (readonly [string, unknown])[] {
    if (Array.isArray(value)) return value.map((v, i) => [String(i), v] as const);
    if (value !== null && typeof value === 'object') {
      return Object.entries(value as Record<string, unknown>);
    }
    return [];
  }

  private buildRows(): Row[] {
    const data = this.data();
    const expanded = this.expanded();
    const rows: Row[] = [];

    const walk = (value: unknown, label: string, path: string, depth: number): void => {
      const kind = kindOf(value);
      const entries = this.entriesOf(value);
      const expandable = entries.length > 0;
      const isOpen = expandable && expanded.has(path);
      const container = kind === 'object' || kind === 'array';
      rows.push({
        path,
        label,
        depth,
        kind,
        text: container
          ? expandable
            ? kind === 'object'
              ? '{ … }'
              : '[ … ]'
            : kind === 'object'
              ? '{}'
              : '[]'
          : previewOf(value, kind),
        title: kind === 'string' ? (value as string) : '',
        expandable,
        expanded: isOpen,
        count: entries.length,
      });
      if (isOpen) {
        const isArray = kind === 'array';
        for (const [key, child] of entries) {
          walk(child, isArray ? `[${key}]` : key, childPath(path, key, isArray), depth + 1);
        }
      }
    };

    walk(data, '$', '$', 0);
    return rows;
  }
}
