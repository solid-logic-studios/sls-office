import { CanvasPainter } from './canvas-painter.ts';

/**
 * CSS pixels per art pixel the stage never goes below. Capitals are 7 art pixels tall, so they stay
 * at least 10.5 CSS pixels tall on a phone: about the capital height of 15 px body text.
 */
export const MIN_LEGIBLE_CSS_SCALE = 1.5;
const MIN_DEVICE_SCALE = 1;
const MAX_DEVICE_SCALE = 12;
/** Browsers report ratios such as 2.0000000298, which must not round a whole scale up or down a step. */
const ROUNDING_SLACK = 1e-6;

/**
 * Whole device pixels per art pixel, so the pixel art stays crisp at any device pixel ratio: the
 * largest scale that fits the width, but never below the legible floor (a narrow screen pans
 * instead of shrinking the text), plus `zoom` steps.
 */
export function stageScale(
  availableCssWidth: number,
  artWidth: number,
  devicePixelRatio: number,
  zoom: number,
): number {
  const fitting = Math.floor((availableCssWidth * devicePixelRatio) / artWidth + ROUNDING_SLACK);
  const legible = Math.ceil(MIN_LEGIBLE_CSS_SCALE * devicePixelRatio - ROUNDING_SLACK);
  return Math.min(MAX_DEVICE_SCALE, Math.max(MIN_DEVICE_SCALE, Math.max(fitting, legible) + zoom));
}

export interface StagePoint {
  /** Art pixels. */
  x: number;
  y: number;
  clientX: number;
  clientY: number;
}

export interface ArtSize {
  width: number;
  height: number;
}

/** Owns the canvas size: fits the art to the container, zooms, and reports where the pointer is in art pixels. */
export class StageCanvas {
  private zoom = 0;
  private scale = MIN_DEVICE_SCALE;
  private lastWidth = -1;
  private current: CanvasPainter;
  private readonly context: CanvasRenderingContext2D;
  private pointHandler: (point: StagePoint | null) => void = () => {};
  private tapHandler: (point: StagePoint) => void = () => {};

  constructor(
    private readonly container: HTMLElement,
    private readonly canvas: HTMLCanvasElement,
    private art: ArtSize,
  ) {
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('Canvas 2D is not available');
    this.context = context;
    this.current = new CanvasPainter(context, this.scale);
    canvas.style.imageRendering = 'pixelated';
    canvas.style.touchAction = 'pan-x pan-y';
    this.fit();
    new ResizeObserver(() => {
      if (container.clientWidth !== this.lastWidth) this.fit();
    }).observe(container);
    canvas.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'mouse') this.report(event);
    });
    canvas.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'mouse') this.report(event);
    });
    canvas.addEventListener('pointerleave', (event) => {
      if (event.pointerType === 'mouse') this.pointHandler(null);
    });
    // A click is a mouse click or a touch tap; browsers fire none after a pan or scroll, so those are not taps.
    canvas.addEventListener('click', (event) => this.tapHandler(this.pointOf(event)));
    container.addEventListener('scroll', () => this.pointHandler(null));
  }

  get painter(): CanvasPainter {
    return this.current;
  }

  /** Where the art area ends, for `painter.clear`. */
  get size(): ArtSize {
    return this.art;
  }

  zoomIn(): void {
    this.step(1);
  }

  zoomOut(): void {
    this.step(-1);
  }

  /** For a theme with a different art size. */
  resize(width: number, height: number): void {
    this.art = { width, height };
    this.fit();
  }

  onPoint(handler: (point: StagePoint | null) => void): void {
    this.pointHandler = handler;
  }

  /** Called with where a click or tap landed. A drag to pan is not one. */
  onTap(handler: (point: StagePoint) => void): void {
    this.tapHandler = handler;
  }

  /** Ignores a step that would not change the scale, so the zoom cannot wind up past a clamp. */
  private step(delta: number): void {
    const next = this.zoom + delta;
    if (this.scaleFor(next) === this.scaleFor(this.zoom)) return;
    this.zoom = next;
    this.fit();
  }

  private scaleFor(zoom: number): number {
    return stageScale(this.container.clientWidth, this.art.width, window.devicePixelRatio || 1, zoom);
  }

  private fit(): void {
    const dpr = window.devicePixelRatio || 1;
    this.lastWidth = this.container.clientWidth;
    this.scale = this.scaleFor(this.zoom);
    this.canvas.width = this.art.width * this.scale;
    this.canvas.height = this.art.height * this.scale;
    this.canvas.style.width = `${(this.art.width * this.scale) / dpr}px`;
    this.canvas.style.height = `${(this.art.height * this.scale) / dpr}px`;
    // Resizing a canvas resets its context, so smoothing is switched off again here.
    this.context.imageSmoothingEnabled = false;
    this.current = new CanvasPainter(this.context, this.scale);
  }

  private report(event: PointerEvent): void {
    this.pointHandler(this.pointOf(event));
  }

  private pointOf(event: MouseEvent): StagePoint {
    const box = this.canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) / box.width) * this.art.width,
      y: ((event.clientY - box.top) / box.height) * this.art.height,
      clientX: event.clientX,
      clientY: event.clientY,
    };
  }
}
