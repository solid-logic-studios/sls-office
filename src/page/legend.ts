import type { LegendEntry } from '../contract/theme.ts';

/** The "Who's who" card: a colour swatch and a label per entry. */
export function renderLegend(list: HTMLUListElement, entries: readonly LegendEntry[]): void {
  list.replaceChildren(
    ...entries.map((entry) => {
      const swatch = document.createElement('span');
      swatch.className = 'sw';
      swatch.style.background = entry.colour;
      swatch.setAttribute('aria-hidden', 'true');
      const item = document.createElement('li');
      item.append(swatch, entry.label);
      return item;
    }),
  );
}
