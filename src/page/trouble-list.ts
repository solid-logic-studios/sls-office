import type { Issue } from './verdict.ts';

export const MAX_TROUBLE_ROWS = 3;

export interface TroubleRows {
  rows: readonly Issue[];
  /** How many more are hidden behind the "+N more" row; 0 when there is no such row. */
  more: number;
}

/** Critical before warning (Snapshot order within each), capped at three unless expanded. */
export function troubleRows(issues: readonly Issue[], expanded: boolean): TroubleRows {
  const ordered = [...issues].sort((a, b) => Number(b.severity === 'crit') - Number(a.severity === 'crit'));
  if (expanded || ordered.length <= MAX_TROUBLE_ROWS) return { rows: ordered, more: 0 };
  return { rows: ordered.slice(0, MAX_TROUBLE_ROWS), more: ordered.length - MAX_TROUBLE_ROWS };
}

/** The rows under the verdict bar. Hidden when there is nothing to list. */
export class TroubleList {
  private issues: readonly Issue[] = [];
  private expanded = false;
  private shown = '';

  constructor(
    private readonly root: HTMLElement,
    private readonly onSelect: (issue: Issue) => void,
  ) {}

  update(issues: readonly Issue[]): void {
    this.issues = issues;
    if (issues.length <= MAX_TROUBLE_ROWS) this.expanded = false;
    this.render();
  }

  private render(): void {
    const { rows, more } = troubleRows(this.issues, this.expanded);
    this.root.hidden = rows.length === 0;
    // Rebuilding every poll would drop a focused row, so an unchanged list is left alone.
    const key = JSON.stringify([rows.map((row) => [row.severity, row.text]), more, this.expanded]);
    if (key === this.shown) return;
    this.shown = key;
    const items = rows.map((issue) => this.row(issue));
    if (more > 0) items.push(this.toggle(`+${more} more`));
    else if (this.expanded) items.push(this.toggle('Show fewer'));
    this.root.replaceChildren(...items);
  }

  private row(issue: Issue): HTMLLIElement {
    const button = this.button('trow');
    button.dataset.severity = issue.severity;
    const dot = document.createElement('span');
    dot.className = 'tdot';
    dot.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.className = 'ttext';
    text.textContent = issue.text;
    button.append(dot, text);
    button.addEventListener('click', () => this.onSelect(issue));
    return this.item(button);
  }

  private toggle(label: string): HTMLLIElement {
    const button = this.button('trow more');
    button.textContent = label;
    button.addEventListener('click', () => {
      this.expanded = !this.expanded;
      this.render();
    });
    return this.item(button);
  }

  private button(className: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    return button;
  }

  private item(child: HTMLElement): HTMLLIElement {
    const item = document.createElement('li');
    item.append(child);
    return item;
  }
}
