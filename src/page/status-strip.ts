import type { Findings } from '../contract/snapshot.ts';
import { formatHour } from './clock.ts';

const NO_COUNT = '-';

function find(root: HTMLElement, selector: string): HTMLElement {
  const found = root.querySelector<HTMLElement>(selector);
  if (found === null) throw new Error(`Status strip is missing ${selector}`);
  return found;
}

/** The ok, warning and critical counts and the clock in the page header. */
export class StatusStrip {
  private readonly ok: HTMLElement;
  private readonly warn: HTMLElement;
  private readonly crit: HTMLElement;
  private readonly clock: HTMLElement;

  constructor(root: HTMLElement) {
    this.ok = find(root, '[data-count="ok"]');
    this.warn = find(root, '[data-count="warn"]');
    this.crit = find(root, '[data-count="crit"]');
    this.clock = find(root, '[data-clock]');
  }

  update(findings: Findings, hour: number): void {
    this.set(this.ok, String(findings.ok));
    this.set(this.warn, String(findings.warn));
    this.set(this.crit, String(findings.crit));
    this.set(this.clock, formatHour(hour));
  }

  /** Blanks the counts, so a stale Snapshot's numbers are not shown as current. The clock keeps running. */
  clear(): void {
    this.set(this.ok, NO_COUNT);
    this.set(this.warn, NO_COUNT);
    this.set(this.crit, NO_COUNT);
  }

  /** Skips unchanged text, so the live region speaks only when something changes. */
  private set(target: HTMLElement, text: string): void {
    if (target.textContent !== text) target.textContent = text;
  }
}
