import type { Severity, Tip } from '../contract/theme.ts';

const EDGE_PX = 6;
const CURSOR_GAP_PX = 14;
const WARN_ABOVE = 75;
const CRIT_ABOVE = 90;

function barSeverity(percent: number): Severity {
  if (percent > CRIT_ABOVE) return 'crit';
  if (percent > WARN_ABOVE) return 'warn';
  return 'ok';
}

function element(tag: string, className: string, text?: string): HTMLElement {
  const created = document.createElement(tag);
  created.className = className;
  if (text !== undefined) created.textContent = text;
  return created;
}

/** The hover and tap card. It shows the full title and wraps it; it never truncates. */
export class TooltipView {
  constructor(
    private readonly tip: HTMLElement,
    private readonly stage: HTMLElement,
  ) {}

  show(tip: Tip, at: { clientX: number; clientY: number }): void {
    this.tip.replaceChildren(
      element('h3', 'tip-title', tip.title),
      element('p', 'tip-detail', tip.detail),
      ...this.meters(tip),
      element('div', `st ${tip.severity}`, tip.status),
    );
    this.tip.hidden = false;
    this.place(at);
  }

  hide(): void {
    this.tip.hidden = true;
  }

  private meters(tip: Tip): HTMLElement[] {
    const rows: [string, number | undefined][] = [
      ['CPU', tip.cpu],
      ['MEM', tip.mem],
    ];
    return rows.flatMap(([label, value]) => (value === undefined ? [] : [this.meter(label, value)]));
  }

  private meter(label: string, value: number): HTMLElement {
    const percent = Math.min(100, Math.max(0, value));
    const fill = document.createElement('i');
    fill.style.width = `${percent}%`;
    fill.style.background = `var(--${barSeverity(value)})`;
    const bar = element('span', 'bar');
    bar.append(fill);
    const row = element('div', 'row');
    row.append(element('span', '', label), bar, element('span', '', `${Math.round(value)}%`));
    return row;
  }

  /** Above and to the right of the pointer, flipping to the left or below when it would leave the stage. */
  private place(at: { clientX: number; clientY: number }): void {
    const box = this.stage.getBoundingClientRect();
    const width = this.tip.offsetWidth;
    const height = this.tip.offsetHeight;
    const pointerX = at.clientX - box.left;
    const pointerY = at.clientY - box.top;
    let left = pointerX + CURSOR_GAP_PX;
    if (left + width > box.width - EDGE_PX) left = pointerX - width - CURSOR_GAP_PX;
    const above = pointerY - height - 12;
    this.tip.style.left = `${Math.min(Math.max(left, EDGE_PX), Math.max(EDGE_PX, box.width - width - EDGE_PX))}px`;
    this.tip.style.top = `${above < EDGE_PX ? pointerY + 16 : above}px`;
  }
}
