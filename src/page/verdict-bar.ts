import { formatHour } from './clock.ts';
import type { Verdict } from './verdict.ts';

/** What the bar knows about the Snapshot feed. `live` is a fresh Snapshot; the rest never show counts. */
export type BarState =
  | { kind: 'loading' }
  | { kind: 'live'; verdict: Verdict }
  | { kind: 'stale'; lastHeard: Date | null }
  | { kind: 'no-signal'; lastGood: Date | null };

export type BarTone = 'ok' | 'warn' | 'crit' | 'neutral';

export interface BarView {
  headline: string;
  tone: BarTone;
  /** Blank when the numbers would be stale, missing or meaningless. */
  counts: readonly string[];
}

export const LOADING_TEXT = 'Waking the office…';

/** Read from the Date directly: going through a fractional hour can floor 14:02 down to 14:01. */
const clockTime = (when: Date): string =>
  `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`;
const plural = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? '' : 's'}`;

const HEADLINES = { ok: 'ALL CALM', watch: 'WATCH', trouble: 'TROUBLE' } as const;
const TONES = { ok: 'ok', watch: 'warn', trouble: 'crit' } as const;

function countsOf(verdict: Verdict): string[] {
  const counts = [
    `VMs ${verdict.vmsUp}/${verdict.vmsTotal}`,
    `Workloads ${verdict.workloadsHealthy}/${verdict.workloadsTotal}`,
    `${verdict.crit}C ${verdict.warn}W`,
  ];
  if (verdict.pods > 0) counts.push(plural(verdict.pods, 'pod'));
  return counts;
}

/** The bar's words and tone for each freshness state. Never hides trouble, even with no VMs reported. */
export function barView(state: BarState): BarView {
  switch (state.kind) {
    case 'loading':
      return { headline: LOADING_TEXT, tone: 'neutral', counts: [] };
    case 'stale':
      return {
        headline: state.lastHeard === null ? 'STALE' : `STALE, last heard ${clockTime(state.lastHeard)}`,
        tone: 'neutral',
        counts: [],
      };
    case 'no-signal':
      return {
        headline: state.lastGood === null ? 'NO SIGNAL' : `NO SIGNAL, last good ${clockTime(state.lastGood)}`,
        tone: 'neutral',
        counts: [],
      };
    case 'live': {
      const { verdict } = state;
      if (verdict.vmsTotal === 0 && verdict.level === 'ok') {
        return { headline: 'NO VMS REPORTED', tone: 'neutral', counts: [] };
      }
      return { headline: HEADLINES[verdict.level], tone: TONES[verdict.level], counts: countsOf(verdict) };
    }
  }
}

function find(root: HTMLElement, selector: string): HTMLElement {
  const found = root.querySelector<HTMLElement>(selector);
  if (found === null) throw new Error(`Verdict bar is missing ${selector}`);
  return found;
}

/** The sticky bar at the top of the compact page: a dot, the headline, the counts and the clock. */
export class VerdictBar {
  private readonly headline: HTMLElement;
  private readonly counts: HTMLElement;
  private readonly clock: HTMLElement;
  private countsKey = '';

  constructor(private readonly root: HTMLElement) {
    this.headline = find(root, '[data-headline]');
    this.counts = find(root, '[data-counts]');
    this.clock = find(root, '[data-bar-clock]');
  }

  render(state: BarState): void {
    const view = barView(state);
    this.root.dataset.tone = view.tone;
    this.set(this.headline, view.headline);
    const key = view.counts.join('|');
    if (key === this.countsKey) return;
    this.countsKey = key;
    this.counts.replaceChildren(
      ...view.counts.map((text) => {
        const span = document.createElement('span');
        span.textContent = text;
        return span;
      }),
    );
  }

  setClock(hour: number): void {
    this.set(this.clock, formatHour(hour));
  }

  private set(target: HTMLElement, text: string): void {
    if (target.textContent !== text) target.textContent = text;
  }
}
