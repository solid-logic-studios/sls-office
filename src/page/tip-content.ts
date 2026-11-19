import type { Severity, Tip } from '../contract/theme.ts';

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

function meter(label: string, value: number): HTMLElement {
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

/**
 * The body of a Tip: the full title (it wraps, never truncates), the detail, the CPU and MEM meters
 * and the status. The hover tooltip and the compact page's Detail sheet both render it.
 */
export function renderTip(tip: Tip): HTMLElement[] {
  const rows: [string, number | undefined][] = [
    ['CPU', tip.cpu],
    ['MEM', tip.mem],
  ];
  return [
    element('h3', 'tip-title', tip.title),
    element('p', 'tip-detail', tip.detail),
    ...rows.flatMap(([label, value]) => (value === undefined ? [] : [meter(label, value)])),
    element('div', `st ${tip.severity}`, tip.status),
  ];
}
