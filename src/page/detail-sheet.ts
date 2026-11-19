import type { Tip } from '../contract/theme.ts';
import { Sheet, sheetOf } from './sheet.ts';
import { renderTip } from './tip-content.ts';

const TITLE_ID = 'sheet-title';

/** The compact page's replacement for the hover tooltip: a Tip in a bottom sheet. Opening it again swaps the content. */
export class DetailSheet {
  private readonly sheet: Sheet;

  constructor(
    root: HTMLElement,
    private readonly body: HTMLElement,
  ) {
    this.sheet = sheetOf(root);
  }

  get isOpen(): boolean {
    return this.sheet.isOpen;
  }

  open(tip: Tip): void {
    const content = renderTip(tip);
    // The first node is the title; it names the dialog (aria-labelledby).
    content[0]?.setAttribute('id', TITLE_ID);
    this.body.replaceChildren(...content);
    this.sheet.open();
  }

  close(): void {
    this.sheet.close();
  }
}
