import { Component, ElementRef, computed, signal, viewChild } from '@angular/core';

interface SnapDay {
  d: string;
  c: number;
}

interface Snapshot {
  fetchedAt: string;
  from: string;
  to: string;
  total: number;
  days: SnapDay[];
}

interface Day {
  c: number;
  f: boolean;
  level: number;
  tip?: string;
}

interface Week {
  label: string;
  days: Day[];
}

type State = 'loading' | 'ok' | 'missing';

const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const level = (c: number) => (c === 0 ? 0 : c <= 2 ? 1 : c <= 5 ? 2 : c <= 9 ? 3 : 4);

function buildWeeks(days: SnapDay[]): { weeks: Week[]; total: number; best: number } {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const parsed = days.map((x) => ({ key: x.d, date: new Date(`${x.d}T00:00:00`), c: x.c }));
  const total = parsed.reduce((s, x) => s + x.c, 0);
  let streak = 0;
  let best = 0;
  for (const x of parsed) {
    streak = x.c > 0 ? streak + 1 : 0;
    if (streak > best) best = streak;
  }

  const weeks: Week[] = [];
  let cells: Day[] = [];
  const first = parsed[0]?.date;
  if (!first) return { weeks, total, best };
  const lead = (first.getDay() + 6) % 7;
  for (let i = 0; i < lead; i++) cells.push({ c: 0, f: true, level: 0 });
  for (const x of parsed) {
    const future = x.date > today;
    cells.push({
      c: x.c,
      f: future,
      level: future ? 0 : level(x.c),
      tip: future ? undefined : `${x.key} · ${x.c === 0 ? '无贡献' : x.c + ' 次贡献'}`,
    });
    if (cells.length === 7) {
      weeks.push({ label: '', days: cells });
      cells = [];
    }
  }
  if (cells.length) {
    while (cells.length < 7) cells.push({ c: 0, f: true, level: 0 });
    weeks.push({ label: '', days: cells });
  }

  const monday0 = new Date(first);
  monday0.setDate(monday0.getDate() - lead);
  let lastMonth = -1;
  let lastLabelW = -9;
  weeks.forEach((week, i) => {
    const monday = new Date(monday0);
    monday.setDate(monday.getDate() + i * 7);
    const month = monday.getMonth();
    if (month !== lastMonth) {
      lastMonth = month;
      if (i - lastLabelW >= 2) {
        week.label = MONTHS[month];
        lastLabelW = i;
      }
    }
  });

  return { weeks, total, best };
}

@Component({
  selector: 'app-activity-calendar',
  templateUrl: './activity-calendar.html',
  styleUrl: './activity-calendar.scss',
})
export class ActivityCalendar {
  readonly state = signal<State>('loading');
  readonly weeks = signal<readonly Week[]>([]);
  readonly total = signal(0);
  readonly best = signal(0);
  readonly updated = signal('');
  readonly gridLabel = computed(
    () => `过去一年 ${this.total()} 次贡献，最长连续 ${this.best()} 天（数据截至 ${this.updated()}，来源 GitHub）`,
  );

  private readonly tipEl = viewChild.required<ElementRef<HTMLElement>>('tip');
  readonly tipText = signal('');
  readonly tipVisible = signal(false);
  readonly tipLeft = signal(0);
  readonly tipTop = signal(0);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const resp = await fetch('content/activity.json', { headers: { accept: 'application/json' } });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const snapshot = (await resp.json()) as Snapshot;
      const built = buildWeeks(snapshot.days ?? []);
      this.weeks.set(built.weeks);
      this.total.set(built.total);
      this.best.set(built.best);
      this.updated.set(snapshot.to ?? '');
      this.state.set('ok');
    } catch {
      this.state.set('missing');
    }
  }

  onOver(event: MouseEvent): void {
    const cell = (event.target as HTMLElement).closest?.('.c[data-tip]') as HTMLElement | null;
    if (!cell?.dataset['tip']) {
      this.tipVisible.set(false);
      return;
    }
    this.tipText.set(cell.dataset['tip']);
    this.tipVisible.set(true);
    const el = this.tipEl().nativeElement;
    const r = cell.getBoundingClientRect();
    this.tipLeft.set(
      Math.min(window.innerWidth - el.offsetWidth - 8, Math.max(8, r.left + r.width / 2 - el.offsetWidth / 2)),
    );
    this.tipTop.set(Math.max(8, r.top - el.offsetHeight - 6));
  }

  hide(): void {
    this.tipVisible.set(false);
  }
}
