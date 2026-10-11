import { afterNextRender, Component, ElementRef, OnDestroy, inject, signal, viewChild } from '@angular/core';
import { CopyButton } from '../../../shared/ui/copy-button';
import { Icon } from '../../../shared/ui/icon';
import { Toast } from '../../../shared/ui/toast';
import { download } from '../../../shared/ui/files';
import { ToolHead } from '../tool-head';

interface MonacoEditor {
  getValue(): string;
  setValue(value: string): void;
  updateOptions(options: Record<string, unknown>): void;
  getModel(): unknown;
  onDidChangeModelContent(cb: () => void): void;
  onDidChangeCursorPosition(cb: (e: { position: { lineNumber: number; column: number } }) => void): void;
  dispose(): void;
}

interface MonacoLanguage {
  id: string;
  aliases?: string[];
  extensions?: string[];
}

interface MonacoApi {
  editor: {
    create(el: HTMLElement, options: Record<string, unknown>): MonacoEditor;
    setModelLanguage(model: unknown, languageId: string): void;
    setTheme(theme: string): void;
  };
  languages: {
    getLanguages(): MonacoLanguage[];
  };
}

declare global {
  interface Window {
    monaco?: MonacoApi;
    require?: {
      (deps: string[], cb: () => void, err?: (e: unknown) => void): void;
      config?: (options: unknown) => void;
    };
  }
}

const DEFAULT_CODE = [
  '// windlively · Monaco 编辑器',
  '// 选择语言与主题，或把内容导出到本地',
  '',
  'const greet = (name) => `你好，${name}！`;',
  '',
  "console.log(greet('小院'));",
].join('\n');

const THEMES = [
  { id: 'vs', label: 'vs（浅色）' },
  { id: 'vs-dark', label: 'vs-dark（深色）' },
];

let monacoPromise: Promise<MonacoApi> | null = null;

function loadMonaco(): Promise<MonacoApi> {
  monacoPromise ??= new Promise<MonacoApi>((resolve, reject) => {
    if (window.monaco) {
      resolve(window.monaco);
      return;
    }
    const base = new URL('monaco/vs/', document.baseURI).href;
    const script = document.createElement('script');
    script.src = `${base}loader.js`;
    script.onerror = () => reject(new Error('loader 加载失败'));
    script.onload = () => {
      const req = window.require;
      if (!req || typeof req.config !== 'function') {
        reject(new Error('AMD loader 未就绪'));
        return;
      }
      req.config({ paths: { vs: base.replace(/\/$/, '') } });
      req(
        ['vs/editor/editor.main'],
        () => {
          if (window.monaco) resolve(window.monaco);
          else reject(new Error('monaco 未初始化'));
        },
        (err: unknown) => reject(err instanceof Error ? err : new Error(String(err))),
      );
    };
    document.head.appendChild(script);
  });
  return monacoPromise;
}

@Component({
  selector: 'app-monaco-tool',
  imports: [ToolHead, CopyButton, Icon],
  templateUrl: './monaco-tool.html',
  styleUrl: './monaco-tool.scss',
})
export class MonacoTool implements OnDestroy {
  readonly content = signal(DEFAULT_CODE);
  readonly language = signal('javascript');
  readonly theme = signal('vs');
  readonly fontSize = signal(14);
  readonly wordWrap = signal(false);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly cursor = signal('1:1');
  readonly languages = signal<{ id: string; label: string }[]>([]);
  readonly themes = THEMES;

  private editor: MonacoEditor | null = null;
  private monaco: MonacoApi | null = null;
  private languageExts = new Map<string, string[]>();
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  private readonly toast = inject(Toast);

  constructor() {
    afterNextRender(() => void this.init());
  }

  ngOnDestroy(): void {
    this.editor?.dispose();
  }

  async init(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      const monaco = await loadMonaco();
      this.monaco = monaco;
      const languages = monaco.languages.getLanguages();
      for (const lang of languages) this.languageExts.set(lang.id, lang.extensions ?? []);
      this.languages.set(
        languages
          .map((l) => ({ id: l.id, label: l.aliases?.[0] ?? l.id }))
          .sort((a, b) => a.label.localeCompare(b.label, 'en')),
      );
      this.createEditor(monaco);
      this.loading.set(false);
    } catch {
      monacoPromise = null;
      this.loading.set(false);
      this.failed.set(true);
    }
  }

  onLanguage(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.language.set(id);
    if (this.editor && this.monaco) {
      this.monaco.editor.setModelLanguage(this.editor.getModel(), id);
    }
  }

  onTheme(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.theme.set(id);
    this.monaco?.editor.setTheme(id);
  }

  onFontSize(event: Event): void {
    const size = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(size) || size < 10 || size > 28) return;
    this.fontSize.set(size);
    this.editor?.updateOptions({ fontSize: size });
  }

  toggleWrap(): void {
    const next = !this.wordWrap();
    this.wordWrap.set(next);
    this.editor?.updateOptions({ wordWrap: next ? 'on' : 'off' });
  }

  exportFile(): void {
    const ext = this.languageExts.get(this.language())?.[0] ?? 'txt';
    const extName = ext.startsWith('.') ? ext.slice(1) : ext;
    download(this.content(), `${Date.now()}.${extName}`);
    this.toast.show('已导出到本地');
  }

  reset(): void {
    this.editor?.setValue(DEFAULT_CODE);
  }

  clear(): void {
    this.editor?.setValue('');
  }

  private createEditor(monaco: MonacoApi): void {
    const editor = monaco.editor.create(this.host().nativeElement, {
      value: this.content(),
      language: this.language(),
      theme: this.theme(),
      fontSize: this.fontSize(),
      wordWrap: this.wordWrap() ? 'on' : 'off',
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      formatOnType: true,
      formatOnPaste: true,
      acceptSuggestionOnEnter: 'on',
      automaticLayout: true,
      scrollBeyondLastLine: false,
    });
    editor.onDidChangeModelContent(() => this.content.set(editor.getValue()));
    editor.onDidChangeCursorPosition((e) =>
      this.cursor.set(`${e.position.lineNumber}:${e.position.column}`),
    );
    this.editor = editor;
  }
}
