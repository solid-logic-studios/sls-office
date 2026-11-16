import type { Painter } from '../contract/painter.ts';
import type { EventBus } from './event-bus.ts';
import type { Clock } from './world.ts';

export const BUBBLE_SECONDS = 2.6;
/** More than this at once is noise; a forced line is shown anyway. */
export const MAX_BUBBLES = 4;

const INK = '#1d1a26';
const PAPER = '#ffffff';
const HEIGHT = 10;
const ROW = 12;
const MARGIN = 2;
/** Above the head of someone standing, and of someone lying down. */
const ABOVE_STANDING = 36;
const ABOVE_LYING = 22;

/** Where a speaker is: `null` when it is not visible. */
export interface Anchor {
  x: number;
  y: number;
  lying: boolean;
}

interface Bubble {
  text: string;
  until: number;
}

interface Placed {
  x: number;
  y: number;
  w: number;
}

/** The one bubble system. It listens for `speech` on the bus; nobody calls it to speak. */
export class Bubbles {
  private readonly shown = new Map<string, Bubble>();
  private readonly unsubscribe: () => void;

  constructor(
    bus: EventBus,
    private readonly clock: Clock,
    private readonly locate: (id: string) => Anchor | null,
    private readonly stageWidth: number,
  ) {
    this.unsubscribe = bus.subscribe('speech', (event) => this.speak(event.speakerId, event.text, event.force));
  }

  get count(): number {
    return this.shown.size;
  }

  has(speakerId: string): boolean {
    return this.shown.has(speakerId);
  }

  /** The text over a speaker's head, or `null`. */
  textOf(speakerId: string): string | null {
    return this.shown.get(speakerId)?.text ?? null;
  }

  /** Drops bubbles that have run out, or whose speaker has gone from view. */
  update(): void {
    for (const [id, bubble] of this.shown) {
      if (bubble.until <= this.clock.now || this.locate(id) === null) this.shown.delete(id);
    }
  }

  draw(painter: Painter): void {
    const placed: Placed[] = [];
    for (const [id, bubble] of this.shown) {
      const anchor = this.locate(id);
      if (anchor !== null) placed.push(this.drawOne(painter, bubble.text, anchor, placed));
    }
  }

  dispose(): void {
    this.unsubscribe();
  }

  private speak(speakerId: string, text: string, force: boolean): void {
    if (this.locate(speakerId) === null) return;
    if (!force && (this.shown.size >= MAX_BUBBLES || this.shown.has(speakerId))) return;
    this.shown.set(speakerId, { text: text.toUpperCase(), until: this.clock.now + BUBBLE_SECONDS });
  }

  private drawOne(painter: Painter, text: string, anchor: Anchor, placed: readonly Placed[]): Placed {
    const w = painter.textWidth(text) + 6;
    const x = Math.min(Math.max(Math.round(anchor.x - w / 2), MARGIN), this.stageWidth - w - MARGIN);
    let y = Math.max(MARGIN, Math.round(anchor.y) - (anchor.lying ? ABOVE_LYING : ABOVE_STANDING));
    // Step up past any bubble already drawn in the way, a few rows at most.
    for (let i = 0; i < MAX_BUBBLES; i++) {
      const top = y;
      if (
        placed.some(
          (other) => x < other.x + other.w + 2 && x + w + 2 > other.x && top < other.y + ROW && top + ROW > other.y,
        )
      ) {
        y -= ROW;
      }
    }
    y = Math.max(MARGIN, y);

    painter.rect(INK, x - 1, y, w + 2, HEIGHT);
    painter.rect(INK, x, y - 1, w, HEIGHT + 2);
    painter.rect(PAPER, x, y, w, HEIGHT);
    const tail = Math.min(Math.max(Math.round(anchor.x), x + 3), x + w - 4);
    painter.rect(INK, tail - 1, y + HEIGHT + 1, 3, 1);
    painter.rect(INK, tail, y + HEIGHT + 2, 1, 1);
    painter.rect(PAPER, tail, y + HEIGHT, 1, 1);
    painter.text(text, x + 3, y + 9, INK);
    return { x, y, w };
  }
}
