import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { CopyButton } from '../../../shared/ui/copy-button';
import { DropZone } from '../../../shared/ui/drop-zone';
import { Icon } from '../../../shared/ui/icon';
import { Lightbox } from '../../../shared/ui/lightbox';
import { Progress } from '../../../shared/ui/progress';
import { TabItem, Tabs } from '../../../shared/ui/tabs';
import { Toast } from '../../../shared/ui/toast';
import { readAsDataUrl } from '../../../shared/ui/files';
import { ToolHead } from '../tool-head';

type OcrMode = 'basic' | 'handwriting';

interface OcrResponse {
  success: boolean;
  data: string | string[];
  msg?: string;
}

const MAX_SIZE = 5 * 1024 * 1024;

@Component({
  selector: 'app-ocr-tool',
  imports: [ToolHead, Tabs, DropZone, Progress, CopyButton, Lightbox, Icon],
  templateUrl: './ocr-tool.html',
  styleUrl: './ocr-tool.scss',
})
export class OcrTool {
  readonly tabs: readonly TabItem[] = [
    { id: 'basic', label: '印刷体识别' },
    { id: 'handwriting', label: '手写体识别' },
  ];

  readonly mode = signal<OcrMode>('basic');
  readonly preview = signal<string | null>(null);
  readonly fileName = signal('');
  readonly busy = signal(false);
  readonly progress = signal(0);
  readonly result = signal('');
  readonly lightboxSrc = signal<string | null>(null);
  readonly resultChars = computed(() => this.result().replace(/\s/g, '').length);

  private file: File | null = null;
  private readonly http = inject(HttpClient);
  private readonly toast = inject(Toast);

  onMode(id: string): void {
    this.mode.set(id as OcrMode);
    this.result.set('');
  }

  async onFile(file: File): Promise<void> {
    if (!file.type.startsWith('image/')) {
      this.toast.show('仅支持图片文件');
      return;
    }
    if (file.size > MAX_SIZE) {
      this.toast.show('图片需小于 5MB');
      return;
    }
    try {
      const dataUrl = await readAsDataUrl(file);
      this.file = file;
      this.fileName.set(file.name);
      this.preview.set(dataUrl);
      this.result.set('');
      this.progress.set(0);
    } catch {
      this.toast.show('图片读取失败，请重试');
    }
  }

  openPreview(): void {
    this.lightboxSrc.set(this.preview());
  }

  clear(): void {
    this.file = null;
    this.fileName.set('');
    this.preview.set(null);
    this.result.set('');
    this.progress.set(0);
  }

  async recognize(): Promise<void> {
    const file = this.file;
    if (!file || this.busy()) return;
    this.busy.set(true);
    this.progress.set(0);

    let dataUrl: string;
    try {
      dataUrl = await readAsDataUrl(file);
    } catch {
      this.toast.show('图片读取失败，请重试');
      this.busy.set(false);
      return;
    }

    const form = new FormData();
    form.append('image', dataUrl);
    const url = `/starry/ocr/general-${this.mode()}`;

    this.http
      .post<OcrResponse>(url, form, { reportProgress: true, observe: 'events', withCredentials: true })
      .subscribe({
        next: (event) => {
          if (event.type === HttpEventType.UploadProgress && event.total) {
            this.progress.set(Math.round((event.loaded / event.total) * 100));
          } else if (event.type === HttpEventType.Response) {
            const body = event.body;
            if (body?.success) {
              const data = body.data;
              this.result.set(Array.isArray(data) ? data.join('\n') : String(data ?? ''));
            } else {
              this.toast.show(body?.msg ?? '识别失败，请重试', 4000);
            }
          }
        },
        error: (err: HttpErrorResponse) => {
          if (err.status === 0) {
            this.toast.show('识别服务不可达，请检查网络后重试', 4000);
          } else if (err.status === 404 || err.status >= 500) {
            this.toast.show(`识别服务暂不可用（${err.status}），请稍后再试`, 4000);
          } else {
            this.toast.show(err.error?.msg ?? `识别失败（${err.status}）`, 4000);
          }
        },
        complete: () => this.busy.set(false),
      });
  }
}
