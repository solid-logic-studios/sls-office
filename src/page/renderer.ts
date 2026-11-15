import type { Vm } from '../contract/snapshot.ts';
import { MOOD_LABELS, moodOf, type Mood } from './mood.ts';

/** Canvas width (CSS px) at or above which characters sit four across; below it, two across. */
export const WIDE_LAYOUT_MIN_WIDTH = 560;
const WIDE_COLUMNS = 4;
const NARROW_COLUMNS = 2;

/** Character art is drawn on a grid of "art pixels" and scaled by a whole number. */
const ART_WIDTH = 16;
const ART_HEIGHT = 18;
const MAX_SCALE = 8;
const CELL_PADDING = 12;
const TEXT_LINE_HEIGHT = 18;
const TEXT_LINES = 3;
const FONT = '14px ui-monospace, Menlo, Consolas, monospace';

const COLOURS = {
  desk: '#8b5e3c',
  deskDark: '#6b452b',
  skin: '#f1c27d',
  skinStressed: '#e5533d',
  hair: '#3b2a20',
  shirt: '#3f7fd1',
  shirtStressed: '#b8483a',
  chair: '#5a5f73',
  monitor: '#2b2f3a',
  screen: '#7fd6a2',
  mug: '#f4f4f4',
  steam: '#c9d3e0',
  sweat: '#6cc4f5',
  text: '#e8ecf3',
  textMuted: '#9aa5b8',
  cell: '#1f2330',
} as const;

const MOOD_COLOURS: Record<Mood, string> = {
  absent: '#7a8296',
  break: '#7fd6a2',
  working: '#8fb8f0',
  stressed: '#ff8a7a',
};

type Rect = readonly [x: number, y: number, w: number, h: number, colour: string];

function figure(mood: Mood): readonly Rect[] {
  const desk: Rect[] = [
    [0, 14, 16, 2, COLOURS.desk],
    [1, 16, 2, 2, COLOURS.deskDark],
    [13, 16, 2, 2, COLOURS.deskDark],
  ];
  const chair: Rect[] = [
    [3, 6, 1, 7, COLOURS.chair],
    [3, 12, 5, 1, COLOURS.chair],
  ];
  switch (mood) {
    case 'absent':
      return [...chair, ...desk];
    case 'break':
      return [
        ...chair,
        [5, 6, 4, 4, COLOURS.skin],
        [5, 5, 4, 1, COLOURS.hair],
        [4, 10, 6, 4, COLOURS.shirt],
        [10, 11, 3, 1, COLOURS.skin],
        [12, 9, 3, 4, COLOURS.mug],
        [13, 6, 1, 2, COLOURS.steam],
        ...desk,
      ];
    case 'working':
      return [
        [5, 2, 4, 4, COLOURS.skin],
        [5, 1, 4, 1, COLOURS.hair],
        [4, 6, 6, 6, COLOURS.shirt],
        [10, 9, 3, 1, COLOURS.skin],
        [11, 5, 4, 5, COLOURS.monitor],
        [12, 6, 2, 3, COLOURS.screen],
        ...desk,
      ];
    case 'stressed':
      return [
        [5, 2, 4, 4, COLOURS.skinStressed],
        [5, 1, 4, 1, COLOURS.hair],
        [4, 6, 6, 6, COLOURS.shirtStressed],
        [10, 9, 3, 1, COLOURS.skinStressed],
        [11, 5, 4, 5, COLOURS.monitor],
        [12, 6, 2, 3, COLOURS.screen],
        [3, 2, 1, 1, COLOURS.sweat],
        [10, 1, 1, 1, COLOURS.sweat],
        [2, 4, 1, 1, COLOURS.sweat],
        ...desk,
      ];
  }
}

export function columnsFor(width: number): number {
  return width >= WIDE_LAYOUT_MIN_WIDTH ? WIDE_COLUMNS : NARROW_COLUMNS;
}

/** Largest whole-number scale that fits the art inside a cell, at least 1. */
export function scaleFor(cellWidth: number): number {
  return Math.max(1, Math.min(MAX_SCALE, Math.floor((cellWidth - CELL_PADDING * 2) / ART_WIDTH)));
}

/** Draws one pixel character per VM on a single canvas that fills its container. */
export class Renderer {
  private readonly context: CanvasRenderingContext2D;
  private readonly observer: ResizeObserver;
  private vms: readonly Vm[] = [];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly container: HTMLElement,
  ) {
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('Canvas 2D is not available');
    this.context = context;
    this.canvas.style.imageRendering = 'pixelated';
    this.observer = new ResizeObserver(() => this.draw());
    this.observer.observe(container);
  }

  render(vms: readonly Vm[]): void {
    this.vms = vms;
    this.draw();
  }

  dispose(): void {
    this.observer.disconnect();
  }

  private draw(): void {
    const width = Math.floor(this.container.clientWidth);
    if (width === 0) return;
    const columns = columnsFor(width);
    const cellWidth = width / columns;
    const scale = scaleFor(cellWidth);
    const cellHeight = ART_HEIGHT * scale + TEXT_LINE_HEIGHT * TEXT_LINES + CELL_PADDING * 2;
    const rows = Math.max(1, Math.ceil(this.vms.length / columns));
    const height = rows * cellHeight;
    const ratio = window.devicePixelRatio || 1;

    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    const ctx = this.context;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.font = FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    this.vms.forEach((vm, index) => {
      const left = (index % columns) * cellWidth;
      const top = Math.floor(index / columns) * cellHeight;
      this.drawCell(vm, left, top, cellWidth, cellHeight, scale);
    });
  }

  private drawCell(vm: Vm, left: number, top: number, cellWidth: number, cellHeight: number, scale: number): void {
    const ctx = this.context;
    const mood = moodOf(vm);
    const inset = 4;
    ctx.fillStyle = COLOURS.cell;
    ctx.fillRect(left + inset, top + inset, cellWidth - inset * 2, cellHeight - inset * 2);

    const artLeft = Math.round(left + (cellWidth - ART_WIDTH * scale) / 2);
    const artTop = Math.round(top + CELL_PADDING);
    for (const [x, y, w, h, colour] of figure(mood)) {
      ctx.fillStyle = colour;
      ctx.fillRect(artLeft + x * scale, artTop + y * scale, w * scale, h * scale);
    }

    const centre = left + cellWidth / 2;
    const textTop = artTop + ART_HEIGHT * scale + TEXT_LINE_HEIGHT / 2;
    ctx.fillStyle = COLOURS.text;
    ctx.fillText(vm.name, centre, textTop, cellWidth - CELL_PADDING);
    ctx.fillStyle = MOOD_COLOURS[mood];
    ctx.fillText(MOOD_LABELS[mood], centre, textTop + TEXT_LINE_HEIGHT);
    ctx.fillStyle = COLOURS.textMuted;
    ctx.fillText(vm.up ? `cpu ${Math.round(vm.cpu)}%` : 'cpu n/a', centre, textTop + TEXT_LINE_HEIGHT * 2);
  }
}
