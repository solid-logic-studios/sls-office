import type { DecorFn, Prop } from '../../contract/theme.ts';
import { pen } from '../shared/pen.ts';
import { nightFactor } from '../shared/sky.ts';

/** The couch front sorts by its base line, so walkers pass in front of it and sitters sit behind it. */
const paintCouchFront: DecorFn = (painter) => {
  const { R } = pen(painter);
  const [x, b, w] = [484, 128, 50];
  R('#9c3b35', x, b - 8, w, 8);
  R('#c24f44', x, b - 8, w, 2);
  R('#7e2e2a', x, b - 1, w, 1);
  R('#7e2e2a', x + 16, b - 6, 1, 5);
  R('#7e2e2a', x + 33, b - 6, 1, 5);
};

export const PROPS: readonly Prop[] = [{ baseY: 128, draw: paintCouchFront }];

/** A blue wash over the building after dark. */
export const paintNightTint: DecorFn = (painter, { hour }) => {
  const night = nightFactor(hour);
  if (night <= 0) return;
  painter.withAlpha(0.16 * night, () => painter.rect('#080a28', 8, 40, 560, 230));
};
