import { Component, computed, signal } from '@angular/core';
import { CopyButton } from '../../../shared/ui/copy-button';
import { TabItem, Tabs } from '../../../shared/ui/tabs';
import { ToolHead } from '../tool-head';
import { CATEGORIES, CategoryDef, formatNumber, fromBase, toBase } from './units';

interface ResultRow {
  unitName: string;
  symbol: string;
  value: string;
  isFrom: boolean;
}

@Component({
  selector: 'app-unit-convert-tool',
  imports: [ToolHead, Tabs, CopyButton],
  templateUrl: './unit-convert-tool.html',
  styleUrl: './unit-convert-tool.scss',
})
export class UnitConvertTool {
  readonly catTabs: readonly TabItem[] = CATEGORIES.map((c) => ({ id: c.id, label: c.name }));
  readonly activeCatId = signal(CATEGORIES[0].id);
  readonly category = computed<CategoryDef>(
    () => CATEGORIES.find((c) => c.id === this.activeCatId())!,
  );
  readonly fromUnitId = signal(CATEGORIES[0].defaultUnit);
  readonly inputValue = signal('1');

  readonly value = computed(() => Number.parseFloat(this.inputValue()));
  readonly invalid = computed(
    () => this.inputValue().trim() !== '' && !Number.isFinite(this.value()),
  );

  readonly rows = computed<ResultRow[]>(() => {
    const category = this.category();
    const from = this.fromUnitId();
    const value = this.value();
    if (!Number.isFinite(value)) {
      return category.units.map((u) => ({
        unitName: u.name,
        symbol: u.symbol,
        value: '—',
        isFrom: u.id === from,
      }));
    }
    const base = toBase(category, from, value);
    return category.units.map((u) => ({
      unitName: u.name,
      symbol: u.symbol,
      value: formatNumber(fromBase(category, u.id, base)),
      isFrom: u.id === from,
    }));
  });

  selectCategory(id: string): void {
    const category = CATEGORIES.find((c) => c.id === id);
    if (!category) return;
    this.activeCatId.set(id);
    if (!category.units.some((u) => u.id === this.fromUnitId())) {
      this.fromUnitId.set(category.defaultUnit);
    }
  }

  onValue(event: Event): void {
    this.inputValue.set((event.target as HTMLInputElement).value);
  }

  onFrom(event: Event): void {
    this.fromUnitId.set((event.target as HTMLSelectElement).value);
  }

  flipSign(): void {
    const raw = this.inputValue().trim();
    if (!raw) return;
    this.inputValue.set(raw.startsWith('-') ? raw.slice(1) : `-${raw}`);
  }
}
