import { Component, computed, signal, viewChild } from '@angular/core';
import { CopyButton } from '../../../shared/ui/copy-button';
import { Icon } from '../../../shared/ui/icon';
import { JsonTree } from '../../../shared/ui/json-tree';
import { ToolHead } from '../tool-head';

const SAMPLE = `{
  "yard": "清欢小院",
  "sections": ["工具箱", "手记", "作品"],
  "stats": {
    "tools": 6,
    "calm": true,
    "noise": null
  },
  "updated": "2026-10-11"
}`;

@Component({
  selector: 'app-json-viewer-tool',
  imports: [ToolHead, JsonTree, CopyButton, Icon],
  templateUrl: './json-viewer-tool.html',
  styleUrl: './json-viewer-tool.scss',
})
export class JsonViewerTool {
  readonly raw = signal('');
  readonly parsed = signal<unknown>(null);
  readonly error = signal('');
  readonly sizeLabel = computed(() => `${this.raw().length} 字符`);
  private readonly tree = viewChild(JsonTree);

  onInput(value: string): void {
    this.raw.set(value);
    const text = value.trim();
    if (!text) {
      this.parsed.set(null);
      this.error.set('');
      return;
    }
    try {
      this.parsed.set(JSON.parse(text));
      this.error.set('');
    } catch (err) {
      this.parsed.set(null);
      this.error.set(err instanceof Error ? err.message : '解析失败');
    }
  }

  format(): void {
    if (this.error() || this.parsed() === null) return;
    this.raw.set(JSON.stringify(this.parsed(), null, 2));
  }

  minify(): void {
    if (this.error() || this.parsed() === null) return;
    this.raw.set(JSON.stringify(this.parsed()));
  }

  loadSample(): void {
    this.raw.set(SAMPLE);
    this.onInput(SAMPLE);
  }

  clear(): void {
    this.raw.set('');
    this.parsed.set(null);
    this.error.set('');
  }

  expandAll(): void {
    this.tree()?.expandAll();
  }

  collapseAll(): void {
    this.tree()?.collapseAll();
  }
}
