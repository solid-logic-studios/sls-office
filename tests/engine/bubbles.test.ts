import { describe, expect, it } from 'vitest';
import { BUBBLE_SECONDS, Bubbles, MAX_BUBBLES, type Anchor } from '../../src/engine/bubbles.ts';
import { EventBus } from '../../src/engine/event-bus.ts';
import { RecordingPainter } from '../support/recording-painter.ts';

function rig(width = 400) {
  const bus = new EventBus();
  const clock = { now: 0 };
  const hidden = new Set<string>();
  const locate = (id: string): Anchor | null => (hidden.has(id) ? null : { x: 100, y: 100, lying: false });
  const bubbles = new Bubbles(bus, clock, locate, width);
  const say = (speakerId: string, text: string, force = false) =>
    bus.publish({ kind: 'speech', speakerId, text, force });
  return { bus, clock, hidden, bubbles, say };
}

describe('Bubbles', () => {
  it('shows speech from the bus, in capitals', () => {
    const { bubbles, say } = rig();
    say('a', 'hello');
    expect(bubbles.textOf('a')).toBe('HELLO');
  });

  it('shows at most four at once, unless forced', () => {
    const { bubbles, say } = rig();
    for (const id of ['a', 'b', 'c', 'd', 'e']) say(id, 'hi');
    expect(bubbles.count).toBe(MAX_BUBBLES);
    expect(bubbles.has('e')).toBe(false);
    say('e', 'urgent', true);
    expect(bubbles.count).toBe(MAX_BUBBLES + 1);
  });

  it('keeps the first line of a speaker unless the new one is forced', () => {
    const { bubbles, say } = rig();
    say('a', 'one');
    say('a', 'two');
    expect(bubbles.textOf('a')).toBe('ONE');
    say('a', 'three', true);
    expect(bubbles.textOf('a')).toBe('THREE');
  });

  it('expires after 2.6 s, or as soon as the speaker is out of view', () => {
    const { bubbles, clock, hidden, say } = rig();
    say('a', 'one');
    say('b', 'two');
    clock.now = BUBBLE_SECONDS - 0.1;
    hidden.add('b');
    bubbles.update();
    expect(bubbles.has('a')).toBe(true);
    expect(bubbles.has('b')).toBe(false);
    clock.now = BUBBLE_SECONDS;
    bubbles.update();
    expect(bubbles.has('a')).toBe(false);
  });

  it('ignores a speaker that is not in view', () => {
    const { bubbles, hidden, say } = rig();
    hidden.add('a');
    say('a', 'boo');
    expect(bubbles.count).toBe(0);
  });

  it('stacks bubbles that would overlap and keeps them on the stage', () => {
    const { bubbles, say } = rig(120);
    say('a', 'a very long line');
    say('b', 'another');
    const painter = new RecordingPainter();
    bubbles.draw(painter);
    const lines = painter.calls.flatMap((call) => (call.op === 'text' ? [call] : []));
    expect(lines.map((line) => line.text)).toEqual(['A VERY LONG LINE', 'ANOTHER']);
    const [first, second] = lines;
    expect(second?.y).toBe((first?.y ?? 0) - 12);
    const white = painter.rects.filter((rect) => rect.colour === '#ffffff' && rect.h === 10);
    for (const box of white) {
      expect(box.x).toBeGreaterThanOrEqual(2);
      expect(box.x + box.w).toBeLessThanOrEqual(118);
    }
  });

  it('stops listening once disposed', () => {
    const { bubbles, say } = rig();
    bubbles.dispose();
    say('a', 'hello');
    expect(bubbles.count).toBe(0);
  });
});
