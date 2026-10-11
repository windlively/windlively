import { Directive, ElementRef, HostListener, inject } from '@angular/core';

@Directive({
  selector: '[appGlow]',
})
export class GlowDirective {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  @HostListener('mousemove', ['$event'])
  onMove(event: MouseEvent): void {
    const rect = this.el.nativeElement.getBoundingClientRect();
    this.el.nativeElement.style.setProperty('--gx', `${event.clientX - rect.left}px`);
    this.el.nativeElement.style.setProperty('--gy', `${event.clientY - rect.top}px`);
  }
}
