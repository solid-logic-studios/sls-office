import type { Painter } from '../../contract/painter.ts';
import type { Temps } from '../../contract/snapshot.ts';
import type { DecorFn } from '../../contract/theme.ts';
import { loadColour } from '../office/dressing.ts';
import { pen } from '../shared/pen.ts';
import { SENSOR_ORDER, TEMP_COLOURS, TEMP_SENSORS, readingOf } from '../shared/temps.ts';
import { PLANT_ROOM, VAULT } from './boards.ts';

/**
 * The basement: the host plant room (CPU and memory bars, then the temperature gauges, or rack
 * lights for an older collector that sends none) and the R2 vault, open while the keeper backs up.
 */

const LABEL = '#7f7a94';
const BAR = { w: 34, h: 6 } as const;
const ROW = { bars: PLANT_ROOM.y + 18, temps: PLANT_ROOM.y + 28 } as const;
/** Each gauge's label and reading: the label's x, then the reading's x. */
const GAUGES: readonly (readonly [number, number])[] = [
  [8, 28],
  [46, 66],
  [84, 110],
];

function paintTemps(painter: Painter, temps: Temps): void {
  const { T } = pen(painter);
  SENSOR_ORDER.forEach((sensor, i) => {
    const [labelX, valueX] = GAUGES[i] ?? [0, 0];
    const reading = readingOf(temps, sensor);
    T(TEMP_SENSORS[sensor].label, labelX, ROW.temps, LABEL);
    if (reading) T(String(reading.celsius), valueX, ROW.temps, TEMP_COLOURS[reading.band]);
    else T('--', valueX, ROW.temps, TEMP_COLOURS.unknown);
  });
}

export const paintPlantRoom: DecorFn = (painter, { now, host }) => {
  const { R, T } = pen(painter);
  T('OPTIPLEX', 34, PLANT_ROOM.y + 8, LABEL);
  for (const [label, x, value] of [
    ['CPU', 8, host?.cpu],
    ['MEM', 66, host?.mem],
  ] as const) {
    T(label, x, ROW.bars, LABEL);
    R('#14121c', x + 20, ROW.bars - BAR.h - 1, BAR.w, BAR.h + 2);
    if (value !== undefined)
      R(loadColour(value), x + 21, ROW.bars - BAR.h, Math.round(((BAR.w - 2) * value) / 100), BAR.h);
  }
  const temps = host?.temps;
  if (temps) {
    paintTemps(painter, temps);
    return;
  }
  for (let i = 0; i < 19; i++) {
    R(Math.sin(now * 3 + i * 1.7) > 0 ? '#5fcf7a' : '#1f3a2a', 8 + i * 6, ROW.temps - 6, 2, 2);
    R(Math.sin(now * 5 + i * 2.3) > 0.3 ? '#7fd0ff' : '#1f2f3f', 8 + i * 6, ROW.temps - 2, 2, 2);
  }
};

export const paintVault: DecorFn = (painter, { vaultOpen }) => {
  const { R, T } = pen(painter);
  const { x, y, w, h } = VAULT;
  R('#6f6c66', x, y, w, 3);
  R('#8d8a84', x, y + 3, w, h - 3);
  R('#7d7a74', x, y + h - 2, w, 2);
  T('R2', x + 4, y + 12, '#2a2533', 'left', true);
  const door = { x: x + w - 24, y: y + 6, w: 18, h: h - 8 };
  R('#5c5a55', door.x - 1, door.y - 1, door.w + 2, door.h + 1);
  if (vaultOpen) {
    R('#14141c', door.x, door.y, door.w, door.h);
    R('#5c6877', door.x + 2, door.y + door.h - 7, 6, 7);
    R('#e2b84a', door.x + 10, door.y + door.h - 6, 3, 3);
    R('#aab2ba', door.x + door.w, door.y, 3, door.h);
    return;
  }
  R('#aab2ba', door.x, door.y, door.w, door.h);
  R('#c9d0d6', door.x, door.y, door.w, 1);
  R('#5c636b', door.x + door.w / 2 - 3, door.y + door.h / 2 - 3, 6, 6);
  R('#aab2ba', door.x + door.w / 2 - 1, door.y + door.h / 2 - 1, 2, 2);
};
