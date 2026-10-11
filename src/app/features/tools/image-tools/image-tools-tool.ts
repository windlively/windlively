import { Component, computed, effect, inject, signal } from '@angular/core';
import { CopyButton } from '../../../shared/ui/copy-button';
import { DropZone } from '../../../shared/ui/drop-zone';
import { Icon } from '../../../shared/ui/icon';
import { Lightbox } from '../../../shared/ui/lightbox';
import { TabItem, Tabs } from '../../../shared/ui/tabs';
import { Toast } from '../../../shared/ui/toast';
import {
  dataUrlBytes,
  dataUrlExt,
  dataUrlToBlob,
  download,
  formatBytes,
  loadImage,
  readAsDataUrl,
} from '../../../shared/ui/files';
import { ToolHead } from '../tool-head';

interface ImageInfo {
  name: string;
  size: number;
  type: string;
  width: number;
  height: number;
}

@Component({
  selector: 'app-image-tools-tool',
  imports: [ToolHead, Tabs, DropZone, CopyButton, Lightbox, Icon],
  templateUrl: './image-tools-tool.html',
  styleUrl: './image-tools-tool.scss',
})
export class ImageToolsTool {
  readonly tabs: readonly TabItem[] = [
    { id: 'base64', label: 'Base64 转码' },
    { id: 'convert', label: '格式转换' },
  ];
  readonly b64Tabs: readonly TabItem[] = [
    { id: 'encode', label: '图片 → Base64' },
    { id: 'decode', label: 'Base64 → 图片' },
  ];
  readonly targetTabs: readonly TabItem[] = [
    { id: 'image/webp', label: 'WebP' },
    { id: 'image/jpeg', label: 'JPEG' },
    { id: 'image/png', label: 'PNG' },
  ];

  readonly tab = signal<'base64' | 'convert'>('base64');
  readonly b64Mode = signal<'encode' | 'decode'>('encode');

  readonly dataUrl = signal('');
  readonly encodeInfo = signal<ImageInfo | null>(null);

  readonly decodeInput = signal('');
  readonly decodeSrc = signal('');
  readonly decodeInfo = signal<{ type: string; size: number } | null>(null);
  readonly decodeError = signal('');

  readonly sourceInfo = signal<ImageInfo | null>(null);
  readonly targetType = signal('image/webp');
  readonly quality = signal(0.92);
  readonly convertedSrc = signal('');
  readonly convertedSize = signal(0);
  readonly sizeDelta = computed(() => {
    const source = this.sourceInfo();
    const size = this.convertedSize();
    if (!source || !size) return '';
    const delta = ((size - source.size) / source.size) * 100;
    return `${delta >= 0 ? '+' : '-'}${Math.abs(delta).toFixed(1)}%`;
  });

  readonly lightboxSrc = signal<string | null>(null);

  private readonly source = signal<string | null>(null);
  private convertToken = 0;
  private readonly toast = inject(Toast);

  constructor() {
    effect(() => {
      const source = this.source();
      const type = this.targetType();
      const quality = this.quality();
      if (!source) {
        this.convertedSrc.set('');
        this.convertedSize.set(0);
        return;
      }
      const token = ++this.convertToken;
      void this.convert(source, type, quality, token);
    });
  }

  async onEncodeFile(file: File): Promise<void> {
    if (!this.checkImage(file)) return;
    try {
      const dataUrl = await readAsDataUrl(file);
      const img = await loadImage(dataUrl);
      this.dataUrl.set(dataUrl);
      this.encodeInfo.set({
        name: file.name,
        size: file.size,
        type: file.type,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    } catch {
      this.toast.show('图片读取失败，请重试');
    }
  }

  async onConvertFile(file: File): Promise<void> {
    if (!this.checkImage(file)) return;
    try {
      const dataUrl = await readAsDataUrl(file);
      const img = await loadImage(dataUrl);
      this.sourceInfo.set({
        name: file.name,
        size: file.size,
        type: file.type,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
      this.source.set(dataUrl);
    } catch {
      this.toast.show('图片读取失败，请重试');
    }
  }

  onDecodeInput(value: string): void {
    this.decodeInput.set(value);
    const text = value.trim();
    if (!text) {
      this.decodeSrc.set('');
      this.decodeInfo.set(null);
      this.decodeError.set('');
      return;
    }
    if (!/^data:image\/[a-z0-9.+-]+;base64,/i.test(text)) {
      this.decodeSrc.set('');
      this.decodeInfo.set(null);
      this.decodeError.set('需要 data:image/...;base64, 开头的完整 DataURL');
      return;
    }
    try {
      const blob = dataUrlToBlob(text);
      this.decodeSrc.set(text);
      this.decodeInfo.set({ type: blob.type, size: blob.size });
      this.decodeError.set('');
    } catch {
      this.decodeSrc.set('');
      this.decodeInfo.set(null);
      this.decodeError.set('Base64 内容无法解码，请检查是否完整');
    }
  }

  onTargetChange(id: string): void {
    this.targetType.set(id);
  }

  onQualityChange(event: Event): void {
    this.quality.set(Number((event.target as HTMLInputElement).value));
  }

  openEncodePreview(): void {
    this.lightboxSrc.set(this.dataUrl());
  }

  openConvertPreview(): void {
    this.lightboxSrc.set(this.convertedSrc());
  }

  downloadDecoded(): void {
    const src = this.decodeSrc();
    if (src) download(dataUrlToBlob(src), `decoded.${dataUrlExt(src)}`);
  }

  downloadConverted(): void {
    const src = this.convertedSrc();
    if (src) download(dataUrlToBlob(src), `converted.${dataUrlExt(src)}`);
  }

  formatBytes = formatBytes;

  private checkImage(file: File): boolean {
    if (!file.type.startsWith('image/')) {
      this.toast.show('仅支持图片文件');
      return false;
    }
    return true;
  }

  private async convert(dataUrl: string, type: string, quality: number, token: number): Promise<void> {
    try {
      const img = await loadImage(dataUrl);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas unavailable');
      ctx.drawImage(img, 0, 0);
      const out = canvas.toDataURL(type, quality);
      if (token !== this.convertToken) return;
      if (!out.startsWith(`data:${type}`)) {
        this.convertedSrc.set('');
        this.convertedSize.set(0);
        this.toast.show('当前浏览器不支持导出该格式', 4000);
        return;
      }
      this.convertedSrc.set(out);
      this.convertedSize.set(dataUrlBytes(out));
    } catch {
      if (token !== this.convertToken) return;
      this.convertedSrc.set('');
      this.convertedSize.set(0);
      this.toast.show('图片转换失败，请重试');
    }
  }
}
