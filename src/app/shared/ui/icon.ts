import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/* 像素小人图标集：16 格，取 currentColor 描画 */
const ICONS: Record<string, string> = {
  'arrow-left':
    '<rect x="2" y="6" width="2" height="4"/><rect x="4" y="5" width="2" height="2"/><rect x="4" y="9" width="2" height="2"/><rect x="2" y="7" width="11" height="2"/>',
  camera:
    '<rect x="1" y="5" width="14" height="1"/><rect x="1" y="13" width="14" height="1"/><rect x="1" y="5" width="1" height="9"/><rect x="14" y="5" width="1" height="9"/><rect x="5" y="3" width="5" height="2"/><rect x="5" y="7" width="6" height="1"/><rect x="5" y="11" width="6" height="1"/><rect x="5" y="8" width="1" height="3"/><rect x="10" y="8" width="1" height="3"/>',
  image:
    '<rect x="1" y="3" width="14" height="1"/><rect x="1" y="12" width="14" height="1"/><rect x="1" y="3" width="1" height="10"/><rect x="14" y="3" width="1" height="10"/><rect x="3" y="6" width="2" height="2"/><rect x="4" y="8" width="2" height="1"/><rect x="6" y="10" width="2" height="1"/><rect x="8" y="8" width="2" height="1"/><rect x="9" y="9" width="2" height="1"/><rect x="11" y="7" width="2" height="1"/>',
  braces:
    '<rect x="5" y="3" width="1" height="10"/><rect x="4" y="3" width="1" height="2"/><rect x="4" y="11" width="1" height="2"/><rect x="3" y="5" width="1" height="1"/><rect x="3" y="10" width="1" height="1"/><rect x="6" y="7" width="1" height="2"/><rect x="10" y="3" width="1" height="10"/><rect x="11" y="3" width="1" height="2"/><rect x="11" y="11" width="1" height="2"/><rect x="12" y="5" width="1" height="1"/><rect x="12" y="10" width="1" height="1"/><rect x="9" y="7" width="1" height="2"/>',
  ruler:
    '<rect x="1" y="5" width="14" height="3"/><rect x="3" y="8" width="1" height="2"/><rect x="6" y="8" width="1" height="1"/><rect x="9" y="8" width="1" height="2"/><rect x="12" y="8" width="1" height="1"/><rect x="1" y="10" width="14" height="1"/>',
  monitor:
    '<rect x="1" y="3" width="14" height="1"/><rect x="1" y="11" width="14" height="1"/><rect x="1" y="3" width="1" height="9"/><rect x="14" y="3" width="1" height="9"/><rect x="7" y="12" width="2" height="1"/><rect x="5" y="13" width="6" height="1"/><rect x="4" y="6" width="2" height="2"/><rect x="6" y="8" width="1" height="1"/><rect x="4" y="9" width="2" height="1"/><rect x="10" y="6" width="2" height="1"/><rect x="11" y="7" width="1" height="2"/><rect x="10" y="9" width="2" height="1"/>',
  flask:
    '<rect x="6" y="2" width="4" height="2"/><rect x="5" y="1" width="6" height="1"/><rect x="5" y="4" width="6" height="1"/><rect x="4" y="5" width="8" height="1"/><rect x="3" y="6" width="10" height="1"/><rect x="2" y="7" width="12" height="1"/><rect x="2" y="8" width="12" height="2"/><rect x="1" y="10" width="14" height="1"/>',
  scan:
    '<rect x="2" y="2" width="5" height="2"/><rect x="2" y="2" width="2" height="5"/><rect x="9" y="2" width="5" height="2"/><rect x="12" y="2" width="2" height="5"/><rect x="2" y="12" width="5" height="2"/><rect x="2" y="9" width="2" height="5"/><rect x="9" y="12" width="5" height="2"/><rect x="12" y="9" width="2" height="5"/><rect x="6" y="7" width="4" height="2"/>',
  'file-text':
    '<rect x="3" y="1" width="9" height="1"/><rect x="3" y="14" width="9" height="1"/><rect x="3" y="1" width="1" height="14"/><rect x="11" y="1" width="1" height="14"/><rect x="5" y="4" width="5" height="1"/><rect x="5" y="7" width="5" height="1"/><rect x="5" y="10" width="3" height="1"/>',
  copy:
    '<rect x="2" y="5" width="1" height="9"/><rect x="2" y="13" width="9" height="1"/><rect x="10" y="5" width="1" height="9"/><rect x="5" y="1" width="1" height="10"/><rect x="5" y="1" width="8" height="1"/><rect x="12" y="1" width="1" height="10"/><rect x="5" y="10" width="8" height="1"/>',
  check:
    '<rect x="2" y="8" width="2" height="2"/><rect x="4" y="10" width="2" height="2"/><rect x="6" y="8" width="2" height="2"/><rect x="8" y="6" width="2" height="2"/><rect x="10" y="4" width="2" height="2"/><rect x="12" y="2" width="2" height="2"/>',
  close:
    '<rect x="3" y="3" width="2" height="2"/><rect x="11" y="3" width="2" height="2"/><rect x="5" y="5" width="2" height="2"/><rect x="9" y="5" width="2" height="2"/><rect x="7" y="7" width="2" height="2"/><rect x="5" y="9" width="2" height="2"/><rect x="9" y="9" width="2" height="2"/><rect x="3" y="11" width="2" height="2"/><rect x="11" y="11" width="2" height="2"/>',
  trash:
    '<rect x="6" y="1" width="4" height="1"/><rect x="2" y="2" width="12" height="2"/><rect x="4" y="4" width="1" height="10"/><rect x="11" y="4" width="1" height="10"/><rect x="4" y="14" width="8" height="1"/><rect x="7" y="6" width="1" height="6"/><rect x="9" y="6" width="1" height="6"/>',
  search:
    '<rect x="3" y="2" width="6" height="1"/><rect x="2" y="3" width="1" height="5"/><rect x="9" y="3" width="1" height="5"/><rect x="3" y="8" width="6" height="1"/><rect x="9" y="9" width="2" height="2"/><rect x="11" y="11" width="2" height="2"/>',
  refresh:
    '<rect x="3" y="3" width="9" height="1"/><rect x="2" y="4" width="2" height="1"/><rect x="11" y="4" width="2" height="6"/><rect x="3" y="12" width="9" height="1"/><rect x="3" y="9" width="2" height="3"/><rect x="4" y="1" width="2" height="2"/><rect x="12" y="12" width="2" height="2"/>',
  download:
    '<rect x="7" y="1" width="2" height="7"/><rect x="5" y="6" width="2" height="2"/><rect x="9" y="6" width="2" height="2"/><rect x="2" y="11" width="12" height="1"/><rect x="2" y="14" width="12" height="1"/><rect x="2" y="11" width="1" height="4"/><rect x="13" y="11" width="1" height="4"/>',
  sparkles:
    '<rect x="7" y="1" width="2" height="6"/><rect x="5" y="3" width="6" height="2"/><rect x="12" y="9" width="2" height="2"/><rect x="3" y="11" width="2" height="2"/>',
};

@Component({
  selector: 'app-icon',
  template: `<svg
    [attr.width]="size()"
    [attr.height]="size()"
    viewBox="0 0 16 16"
    shape-rendering="crispEdges"
    aria-hidden="true"
    [innerHTML]="markup()"
  ></svg>`,
  styles: `
    svg {
      display: block;
      fill: currentColor;
    }
  `,
})
export class Icon {
  readonly name = input.required<string>();
  readonly size = input(16);
  private readonly sanitizer = inject(DomSanitizer);
  readonly markup = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(ICONS[this.name()] ?? ''),
  );
}
