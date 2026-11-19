import type { Tip } from '../contract/theme.ts';
import { renderTip } from './tip-content.ts';

const EDGE_PX = 6;
const CURSOR_GAP_PX = 14;

/** The hover and tap card. It shows the full title and wraps it; it never truncates. */
export class TooltipView {
  constructor(
    private readonly tip: HTMLElement,
    private readonly stage: HTMLElement,
  ) {}

  show(tip: Tip, at: { clientX: number; clientY: number }): void {
    this.tip.replaceChildren(...renderTip(tip));
    this.tip.hidden = false;
    this.place(at);
  }

  hide(): void {
    this.tip.hidden = true;
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
