import { describe, expect, it } from 'vitest';
import { CanvasPainter, type PaintContext } from '../../src/page/canvas-painter.ts';
import { textWidth } from '../../src/engine/pixel-font.ts';

interface Fill {
  colour: string;
  alpha: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Just enough of a 2D context to see what the painter asked for. */
class FakeContext implements PaintContext {
  fillStyle: PaintContext['fillStyle'] = '#000';
  globalAlpha = 1;
  readonly fills: Fill[] = [];
  readonly log: string[] = [];
  private depth = 0;

  fillRect(x: number, y: number, w: number, h: number): void {
    this.fills.push({ colour: String(this.fillStyle), alpha: this.globalAlpha, x, y, w, h });
  }
  clearRect(x: number, y: number, w: number, h: number): void {
    this.log.push(`clear ${x},${y},${w},${h}`);
  }
  save(): void {
    this.depth++;
    this.log.push('save');
  }
  restore(): void {
    this.depth--;
    this.log.push('restore');
  }
  beginPath(): void {
    this.log.push('beginPath');
  }
  rect(x: number, y: number, w: number, h: number): void {
    this.log.push(`rect ${x},${y},${w},${h}`);
  }
  clip(): void {
    this.log.push('clip');
  }
  get openSaves(): number {
    return this.depth;
  }
}

function setup(scale = 3): { context: FakeContext; painter: CanvasPainter } {
  const context = new FakeContext();
  return { context, painter: new CanvasPainter(context, scale) };
}

describe('CanvasPainter.rect', () => {
  it('rounds the position to whole art pixels and scales everything', () => {
    const { context, painter } = setup(3);
    painter.rect('#f00', 1.6, 2.4, 4, 5);
    expect(context.fills).toEqual([{ colour: '#f00', alpha: 1, x: 6, y: 6, w: 12, h: 15 }]);
  });
});

describe('CanvasPainter.text', () => {
  const leftEdge = (painter: CanvasPainter, context: FakeContext, align: 'left' | 'centre' | 'right'): number => {
    painter.text('AB', 50, 20, '#fff', { align });
    return Math.min(...context.fills.map((fill) => fill.x)) / 2;
  };

  it('puts the glyph rows above the baseline, in the colour, at scale', () => {
    const { context, painter } = setup(2);
    painter.text('I', 10, 20, '#abc');
    expect(context.fills.every((fill) => fill.colour === '#abc' && fill.h === 2)).toBe(true);
    const ys = context.fills.map((fill) => fill.y / 2);
    expect(Math.min(...ys)).toBe(13);
    expect(Math.max(...ys)).toBe(19);
  });

  it('honours left, centre and right alignment', () => {
    const width = textWidth('AB');
    // Both letters have ink in their first column, so the left edge is the origin.
    expect(leftEdge(...pair(), 'left')).toBe(50);
    expect(leftEdge(...pair(), 'centre')).toBe(50 - width / 2);
    expect(leftEdge(...pair(), 'right')).toBe(50 - width);
  });

  it('measures with the pixel font', () => {
    expect(setup().painter.textWidth('ABC', true)).toBe(textWidth('ABC', true));
  });
});

function pair(): [CanvasPainter, FakeContext] {
  const { painter, context } = setup(2);
  return [painter, context];
}

describe('CanvasPainter.withAlpha', () => {
  it('draws at the alpha and restores it afterwards', () => {
    const { context, painter } = setup();
    painter.withAlpha(0.5, () => painter.rect('#000', 0, 0, 1, 1));
    expect(context.fills[0]?.alpha).toBe(0.5);
    expect(context.globalAlpha).toBe(1);
  });

  it('multiplies nested alphas and unwinds each level', () => {
    const { context, painter } = setup();
    painter.withAlpha(0.5, () => {
      painter.withAlpha(0.5, () => painter.rect('#000', 0, 0, 1, 1));
      expect(context.globalAlpha).toBe(0.5);
    });
    expect(context.fills[0]?.alpha).toBe(0.25);
    expect(context.globalAlpha).toBe(1);
  });

  it('restores the alpha when the draw throws', () => {
    const { context, painter } = setup();
    expect(() =>
      painter.withAlpha(0.3, () => {
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(context.globalAlpha).toBe(1);
  });
});

describe('CanvasPainter.withClip', () => {
  it('saves, clips to the scaled rectangle, draws, then restores', () => {
    const { context, painter } = setup(4);
    painter.withClip(1, 2, 3, 5, () => context.log.push('draw'));
    expect(context.log).toEqual(['save', 'beginPath', 'rect 4,8,12,20', 'clip', 'draw', 'restore']);
  });

  it('restores when the draw throws', () => {
    const { context, painter } = setup();
    expect(() =>
      painter.withClip(0, 0, 1, 1, () => {
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(context.openSaves).toBe(0);
  });
});

describe('CanvasPainter.clear', () => {
  it('clears the whole scaled art area', () => {
    const { context, painter } = setup(2);
    painter.clear(10, 5);
    expect(context.log).toEqual(['clear 0,0,20,10']);
  });
});
