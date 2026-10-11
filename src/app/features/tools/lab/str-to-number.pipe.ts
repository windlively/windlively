import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'strToNumber',
})
export class StrToNumberPipe implements PipeTransform {
  transform(value: string): number | null {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
}
