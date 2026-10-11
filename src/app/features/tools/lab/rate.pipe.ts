import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'rate',
})
export class RatePipe implements PipeTransform {
  transform(value: number, rate?: number | string): number {
    return value * (rate ? Number(rate) : 1);
  }
}
