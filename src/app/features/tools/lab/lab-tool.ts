import { CurrencyPipe, DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { Icon } from '../../../shared/ui/icon';
import { TabItem, Tabs } from '../../../shared/ui/tabs';
import { ToolHead } from '../tool-head';
import { GlowDirective } from './glow.directive';
import { RatePipe } from './rate.pipe';
import { StrToNumberPipe } from './str-to-number.pipe';

interface Todo {
  id: number;
  text: string;
  done: boolean;
}

type Filter = 'all' | 'active' | 'done';
type Status = 'idle' | 'running' | 'done';

const SNIPPET_SIGNALS = [
  'const count = signal(0);',
  '',
  'const double = computed(() => count() * 2);',
  'const even = computed(() => count() % 2 === 0);',
  '',
  'effect(() => {',
  '  console.log(`count 变为 ${count()}`);',
  '});',
].join('\n');

const SNIPPET_FLOW = [
  '@if (showDetail()) {',
  '  <p>条件渲染的内容</p>',
  '}',
  '',
  '@switch (status()) {',
  "  @case ('running') { <span>执行中…</span> }",
  "  @case ('done') { <span>已完成</span> }",
  '}',
  '',
  "@for (t of visibleTodos(); track t.id) {",
  '  <li>{{ t.text }}</li>',
  '} @empty {',
  '  <li>没有符合条件的待办</li>',
  '}',
].join('\n');

const SNIPPET_DIRECTIVE = [
  '@Directive({ selector: \'[appGlow]\' })',
  'export class GlowDirective {',
  '  private readonly el = inject(ElementRef);',
  '',
  "  @HostListener('mousemove', ['$event'])",
  '  onMove(event: MouseEvent) {',
  '    const rect = this.el.nativeElement.getBoundingClientRect();',
  '    // 把光标位置写进 CSS 变量，(:before) 光斑跟随',
  "    this.el.nativeElement.style.setProperty('--gx', ...);",
  '  }',
  '}',
].join('\n');

const SNIPPET_PIPES = [
  '{{ now | date: \'yyyy-MM-dd HH:mm:ss\' }}',
  "{{ amount | number: '1.2-2' }}",
  "{{ amount | currency: 'CNY' : 'symbol' : '1.0-2' }}",
  "{{ 0.8567 | percent: '1.1-1' }}",
  '',
  '// 自定义管道',
  '{{ 42 | rate: 8 }}',
  '{{ raw | strToNumber }}',
].join('\n');

@Component({
  selector: 'app-lab-tool',
  imports: [
    ToolHead,
    Tabs,
    Icon,
    GlowDirective,
    RatePipe,
    StrToNumberPipe,
    DatePipe,
    DecimalPipe,
    CurrencyPipe,
    PercentPipe,
  ],
  templateUrl: './lab-tool.html',
  styleUrl: './lab-tool.scss',
})
export class LabTool {
  readonly tabs: readonly TabItem[] = [
    { id: 'signals', label: 'signals' },
    { id: 'flow', label: 'flow 语句' },
    { id: 'directives', label: '指令' },
    { id: 'pipes', label: '管道' },
  ];
  readonly tab = signal('signals');

  readonly count = signal(0);
  readonly double = computed(() => this.count() * 2);
  readonly even = computed(() => this.count() % 2 === 0);
  readonly log = signal<readonly string[]>([]);

  readonly showDetail = signal(false);
  readonly status = signal<Status>('idle');
  readonly todos = signal<readonly Todo[]>([
    { id: 1, text: '把今天的想法收进手记', done: false },
    { id: 2, text: '给工具箱加一把新尺子', done: true },
    { id: 3, text: '给小院浇水', done: false },
  ]);
  readonly filter = signal<Filter>('all');
  readonly visibleTodos = computed(() => {
    const filter = this.filter();
    if (filter === 'all') return this.todos();
    return this.todos().filter((t) => (filter === 'done' ? t.done : !t.done));
  });
  readonly remaining = computed(() => this.todos().filter((t) => !t.done).length);

  readonly now = signal(new Date());
  readonly amount = signal(12345.678);
  readonly rawNumber = signal('42');

  readonly snippetSignals = SNIPPET_SIGNALS;
  readonly snippetFlow = SNIPPET_FLOW;
  readonly snippetDirective = SNIPPET_DIRECTIVE;
  readonly snippetPipes = SNIPPET_PIPES;

  private seq = 3;

  constructor() {
    effect(() => {
      const value = this.count();
      this.log.update((lines) => [...lines.slice(-4), `count 变为 ${value}`]);
    });
    const interval = setInterval(() => this.now.set(new Date()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(interval));
  }

  inc(): void {
    this.count.update((v) => v + 1);
  }

  dec(): void {
    this.count.update((v) => v - 1);
  }

  resetCount(): void {
    this.count.set(0);
  }

  onStatus(event: Event): void {
    this.status.set((event.target as HTMLSelectElement).value as Status);
  }

  setFilter(filter: Filter): void {
    this.filter.set(filter);
  }

  setRawNumber(event: Event): void {
    this.rawNumber.set((event.target as HTMLInputElement).value);
  }

  addTodo(input: HTMLInputElement): void {
    const text = input.value.trim();
    if (!text) return;
    this.todos.update((list) => [...list, { id: ++this.seq, text, done: false }]);
    input.value = '';
  }

  toggleTodo(id: number): void {
    this.todos.update((list) => list.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  removeTodo(id: number): void {
    this.todos.update((list) => list.filter((t) => t.id !== id));
  }
}
