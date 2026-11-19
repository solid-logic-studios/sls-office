interface Focusable {
  focus(): void;
}

/** The slice of the DOM a Sheet touches, so it can be driven without a browser. */
export interface SheetParts {
  /** The dialog element, which takes focus on open. */
  root: Focusable & { hidden: boolean | string };
  closeButton: { addEventListener(type: 'click', listener: () => void): void };
  /** Whatever has focus now, to hand it back on close. */
  activeElement(): Focusable | null;
  doc: {
    addEventListener(type: 'keydown', listener: (event: { key: string }) => void): void;
  };
}

/**
 * A non-modal bottom sheet: focus moves to it on open and returns to whatever had it on close, and
 * the close button and Escape both close it. Opening while open keeps the first return target.
 */
export class Sheet {
  private returnTo: Focusable | null = null;

  constructor(
    private readonly parts: SheetParts,
    private readonly onToggle: (open: boolean) => void = () => {},
  ) {
    parts.closeButton.addEventListener('click', () => this.close());
    parts.doc.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isOpen) this.close();
    });
  }

  get isOpen(): boolean {
    return !this.parts.root.hidden;
  }

  open(): void {
    if (!this.isOpen) this.returnTo = this.parts.activeElement();
    this.parts.root.hidden = false;
    this.parts.root.focus();
    this.onToggle(true);
  }

  close(): void {
    if (!this.isOpen) return;
    this.parts.root.hidden = true;
    this.returnTo?.focus();
    this.returnTo = null;
    this.onToggle(false);
  }
}

/** Joins a Sheet to its elements in the page. */
export function sheetOf(root: HTMLElement, onToggle?: (open: boolean) => void): Sheet {
  const closeButton = root.querySelector<HTMLButtonElement>('[data-close]');
  if (closeButton === null) throw new Error('A sheet needs a [data-close] button');
  const activeElement = (): HTMLElement | null =>
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  return new Sheet({ root, closeButton, activeElement, doc: document }, onToggle);
}
