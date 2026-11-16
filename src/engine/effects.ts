import type { Painter } from '../contract/painter.ts';
import type { EventBus } from './event-bus.ts';
import type { Random } from './random.ts';

export const TICK_COLOUR = '#2fae4f';
export const CROSS_COLOUR = '#e0352b';
export const SWEAT_COLOUR = '#7fd0ff';
/** Just off white, so a sheet of paper is never mistaken for a puff. */
export const PAPER_COLOUR = '#fffffe';
const PUFF_COLOUR = '#ffffff';
const STEAM_COLOUR = '#e9eef2';
const SNOOZE_COLOUR = '#5a6fb0';
const PAPER_LINE_COLOUR = '#9aa5b5';
const SPARK_COLOURS: readonly string[] = ['#fff2a8', '#ffffff'];

/** Seconds a sheet of paper takes to fly between two characters. */
export const PAPER_SECONDS = 1.1;
/** How high a flying sheet arcs, in art pixels. */
const PAPER_ARC = 18;
/** Papers leave and land at about chest height. */
const PAPER_LIFT = 14;

export interface Point {
  x: number;
  y: number;
}

export type Mark = 'tick' | 'cross';

interface Drift {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  span: number;
}

type Particle =
  | (Drift & { kind: 'spark' | 'steam'; colour: string })
  | (Drift & { kind: 'sweat' | 'z' | Mark })
  | { kind: 'paper'; from: Point; to: Point; life: number; span: number };

const TICK_PIXELS: readonly (readonly [number, number])[] = [
  [0, 2],
  [1, 3],
  [2, 2],
  [3, 1],
  [4, 0],
];

/** The one effects system: puffs, sparks, sweat, steam, snores, ticks, crosses and flying paper. */
export class Effects {
  private particles: Particle[] = [];
  private readonly unsubscribe: () => void;

  /** `locate` finds a visible character by id, for the ends of a paper's flight. */
  constructor(
    bus: EventBus,
    private readonly random: Random,
    private readonly locate: (id: string) => Point | null,
  ) {
    this.unsubscribe = bus.subscribe('paper', (event) => this.paper(event.fromId, event.toId));
  }

  get count(): number {
    return this.particles.length;
  }

  /** A character popping in or out. */
  puff(x: number, y: number): void {
    const r = this.random;
    for (let i = 0; i < 9; i++) {
      const drift = { x: x + r.range(-3, 3), y: y + r.range(-3, 3), vx: r.range(-22, 22), vy: r.range(-22, 10) };
      this.particles.push({ kind: 'steam', colour: PUFF_COLOUR, ...drift, life: 0.5, span: 0.5 });
    }
  }

  mark(kind: Mark, x: number, y: number): void {
    this.particles.push({ kind, x, y, vx: 0, vy: -9, life: 1.3, span: 1.3 });
  }

  spark(x: number, y: number): void {
    const r = this.random;
    const colour = r.pick(SPARK_COLOURS) ?? PUFF_COLOUR;
    this.particles.push({
      kind: 'spark',
      colour,
      x,
      y,
      vx: r.range(-8, 8),
      vy: r.range(-26, -12),
      life: 0.35,
      span: 0.35,
    });
  }

  sweat(x: number, y: number): void {
    this.particles.push({ kind: 'sweat', x, y, vx: 0, vy: 18, life: 0.45, span: 0.45 });
  }

  steam(x: number, y: number): void {
    const vx = this.random.range(-3, 3);
    this.particles.push({ kind: 'steam', colour: STEAM_COLOUR, x, y, vx, vy: -12, life: 0.8, span: 0.8 });
  }

  snooze(x: number, y: number): void {
    this.particles.push({ kind: 'z', x, y, vx: 3, vy: -7, life: 1.4, span: 1.4 });
  }

  update(dt: number): void {
    for (const particle of this.particles) {
      particle.life -= dt;
      if (particle.kind === 'paper') continue;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
  }

  draw(painter: Painter): void {
    for (const particle of this.particles) drawParticle(painter, particle);
  }

  dispose(): void {
    this.unsubscribe();
  }

  private paper(fromId: string, toId: string): void {
    const from = this.locate(fromId);
    const to = this.locate(toId);
    if (from === null || to === null) return;
    this.particles.push({
      kind: 'paper',
      from: { x: from.x, y: from.y - PAPER_LIFT },
      to: { x: to.x, y: to.y - PAPER_LIFT },
      life: PAPER_SECONDS,
      span: PAPER_SECONDS,
    });
  }
}

function drawParticle(painter: Painter, particle: Particle): void {
  if (particle.kind === 'paper') {
    const progress = 1 - particle.life / particle.span;
    const x = Math.round(particle.from.x + (particle.to.x - particle.from.x) * progress);
    const y = Math.round(
      particle.from.y + (particle.to.y - particle.from.y) * progress - Math.sin(progress * Math.PI) * PAPER_ARC,
    );
    painter.rect(PAPER_COLOUR, x, y, 4, 3);
    painter.rect(PAPER_LINE_COLOUR, x + 1, y + 1, 2, 1);
    return;
  }
  const x = Math.round(particle.x);
  const y = Math.round(particle.y);
  switch (particle.kind) {
    case 'spark':
      painter.rect(particle.colour, x, y, 1, 1);
      return;
    case 'steam': {
      const alpha = Math.min(1, Math.max(0, particle.life / particle.span));
      const size = alpha > 0.5 ? 2 : 3;
      painter.withAlpha(alpha, () => painter.rect(particle.colour, x, y, size, size));
      return;
    }
    case 'sweat':
      painter.rect(SWEAT_COLOUR, x, y, 1, 2);
      return;
    case 'z':
      painter.text('Z', x, y, SNOOZE_COLOUR);
      return;
    case 'tick':
      for (const [dx, dy] of TICK_PIXELS) painter.rect(TICK_COLOUR, x + dx, y + dy, 1, 2);
      return;
    case 'cross':
      for (let i = 0; i < 5; i++) {
        painter.rect(CROSS_COLOUR, x + i, y + i, 1, 1);
        painter.rect(CROSS_COLOUR, x + 4 - i, y + i, 1, 1);
      }
      return;
    default: {
      const unreachable: never = particle;
      throw new Error(`Unknown particle ${String(unreachable)}`);
    }
  }
}
