import type { Painter } from '../../contract/painter.ts';
import type { Temps } from '../../contract/snapshot.ts';
import type { DecorFn, StageView } from '../../contract/theme.ts';
import { indexesOf } from './break-spots.ts';
import { clamp, lerp, pen } from './pen.ts';
import { scoreAt } from './scoreboard.ts';
import { SENSOR_ORDER, TEMP_COLOURS, TEMP_SENSORS, readingOf } from './temps.ts';

/**
 * The animated set dressing: everything on the walls that moves or lights up. Each piece is a pure
 * function of the stage (`now`, `hour` and the lab state), so a paused Office holds still.
 */

const CONSOLE_LIGHTS = ['#e84f8a', '#7df0c0', '#f2c230'] as const;
const COUCH_SPOTS = indexesOf('couch');
const PUTT_SPOTS = indexesOf('putt');

const anyBusy = (stage: StageView, spots: readonly number[]): boolean => spots.some((i) => stage.busyBreakSpots.has(i));

/** Alternates every fifth of a second: the flash of a siren or a ringing phone. */
const flashing = (now: number): boolean => Math.floor(now * 5) % 2 === 1;

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Red when it is above 90, amber above 75, otherwise green. */
const loadColour = (v: number): string => (v > 90 ? '#ff6b5e' : v > 75 ? '#f0b840' : '#5fcf7a');

const paintPlant: DecorFn = (painter, { now }) => {
  const { R } = pen(painter);
  const sway = Math.sin(now * 1.2) > 0.3 ? 1 : 0;
  R('#3f9a52', 347 + sway, 100, 4, 12);
  R('#58b56a', 344 + sway, 103, 3, 7);
  R('#58b56a', 351 + sway, 104, 3, 6);
  R('#2f7f42', 348, 107, 2, 5);
};

/** The telly shows the game while somebody is on the couch, else a bouncing screensaver. */
const paintTelly: DecorFn = (painter, stage) => {
  const { R } = pen(painter);
  const t = stage.now;
  if (anyBusy(stage, COUCH_SPOTS)) {
    R('#2a6fb0', 514, 64, 36, 12);
    R('#3f9a52', 514, 76, 36, 8);
    R('#ffffff', 516 + ((t * 14) % 30), 72, 2, 2);
    R('#e0523f', 544 - ((t * 9) % 28), 70, 3, 3);
    R('#f2c230', 530, 66 + (flashing(t) ? 1 : 0), 2, 2);
  } else {
    R('#101826', 514, 64, 36, 20);
    R('#7df0c0', 516 + Math.abs(((t * 6) % 60) - 30), 66 + Math.abs(((t * 4) % 28) - 14), 4, 3);
  }
  for (let i = 0; i < CONSOLE_LIGHTS.length; i++) {
    R(CONSOLE_LIGHTS[(i + Math.floor(t * 2)) % CONSOLE_LIGHTS.length] ?? '#ffffff', 544 + i * 3, 104, 2, 1);
  }
};

const paintPuttingBall: DecorFn = (painter, stage) => {
  const { R } = pen(painter);
  const roll = anyBusy(stage, PUTT_SPOTS) ? (stage.now * 0.45) % 1 : 0;
  R('#ffffff', lerp(416, 434, clamp(roll * 1.6, 0, 1)), 128, 2, 2);
};

/** The keeper's open drawers: index 0 is PostgreSQL, 1 is MySQL. */
const paintDrawers: DecorFn = (painter, { openStores }) => {
  const { R } = pen(painter);
  if (openStores.has(0)) {
    R('#1c2b40', 151, 90, 28, 13);
    R('#8fb0d8', 151, 93, 28, 13);
    R('#f4f1e6', 156, 91, 18, 2);
  }
  if (openStores.has(1)) {
    R('#402c14', 219, 90, 28, 13);
    R('#e6b478', 219, 93, 28, 13);
    R('#f4f1e6', 224, 91, 18, 2);
  }
};

const paintScoreboard: DecorFn = (painter, { now }) => {
  const { R, T } = pen(painter);
  const { sport, a, b } = scoreAt(now);
  R('#16161d', 290, 160, 62, 26);
  T('SCRD LIVE', 321, 170, '#e0523f', 'centre');
  T(`${sport} ${a}-${b}`, 321, 181, '#f2c230', 'centre');
};

/** Healthchecks.io, the dead man's switch: a heartbeat while all is well, a flatline with blips when critical. */
const paintHealthchecks: DecorFn = (painter, { now, findings }) => {
  const { R } = pen(painter);
  const crit = findings.crit > 0;
  const spike = [0, -2, -7, 4, 0];
  R('#0f1a14', 360, 160, 38, 22);
  for (let x = 0; x < 34; x++) {
    const p = Math.floor(x + now * 22) % 34;
    const offset = crit ? (p % 9 === 0 ? -1 : 0) : p >= 10 && p < 15 ? (spike[p - 10] ?? 0) : 0;
    R(crit ? '#ff5a4a' : '#5fcf7a', 362 + x, 173 + offset, 1, 1);
  }
  R(crit ? (flashing(now) ? '#ff5a4a' : '#5a1f1a') : '#5fcf7a', 391, 162, 4, 3);
};

const paintClock: DecorFn = (painter, { hour }) => {
  const { R, T } = pen(painter);
  R('#16161d', 404, 160, 34, 12);
  T(`${pad2(Math.floor(hour))}:${pad2(Math.floor((hour % 1) * 60))}`, 421, 169, '#7df0c0', 'centre');
};

/** The Discord siren: red and flashing on a critical finding, amber on warnings. */
const paintSiren: DecorFn = (painter, { now, findings }) => {
  const { R } = pen(painter);
  const crit = findings.crit > 0;
  const on = flashing(now);
  R(crit ? (on ? '#ff3b30' : '#8a1f1a') : findings.warn > 1 ? '#d39a1c' : '#6a727c', 23, 170, 6, 10);
  R('#ffffff', 24, 171, 1, 2);
  if (crit && on) painter.withAlpha(0.22, () => R('#ff3b30', 12, 160, 28, 28));
};

/** The ceiling light by the worn NVMe's crack flickers. */
const paintFlickeringLight: DecorFn = (painter, { now }) => {
  const { R } = pen(painter);
  R(Math.sin(now * 23) + Math.sin(now * 7.3) > 0.4 ? '#6a6858' : '#f6f2c8', 400, 151, 14, 2);
};

const paintLiftLamps: DecorFn = (painter, { liftInUse }) => {
  const { R } = pen(painter);
  const lamp = liftInUse ? '#f2c230' : '#5fcf7a';
  R(lamp, 456, 47, 4, 1);
  R(lamp, 456, 153, 4, 1);
};

const paintAntennaBeacon: DecorFn = (painter, { now }) => {
  if (Math.floor(now * 1.2) % 2 === 1) pen(painter).R('#ff3b30', 519, 8, 3, 3);
};

/** The host strip: CPU and memory bars (empty until the first Snapshot), disk and rack LEDs. */
const paintBasementHost: DecorFn = (painter, { now, host }) => {
  const { R } = pen(painter);
  const bar = (x: number, value: number): void => R(loadColour(value), x + 1, 256, Math.round((44 * value) / 100), 6);
  if (host) {
    bar(186, host.cpu);
    bar(264, host.mem);
  }
  R('#5fcf7a', 342, 257, 3, 3);
  R(Math.sin(now * 17) + Math.sin(now * 5.1) > 0.2 ? '#f0b840' : '#6a5514', 382, 257, 3, 3);
  // The temperature panel takes the right of the strip, so the rack LEDs shrink to make room for it.
  const temps = host?.temps;
  const leds = temps ? LEDS_BESIDE_TEMPS : 16;
  for (let i = 0; i < leds; i++) {
    R(Math.sin(now * 3 + i * 1.7) > 0 ? '#5fcf7a' : '#1f3a2a', 464 + i * 6, 253, 2, 2);
    R(Math.sin(now * 5 + i * 2.3) > 0.3 ? '#7fd0ff' : '#1f2f3f', 464 + i * 6, 259, 2, 2);
  }
  if (temps) paintTemps(painter, temps);
};

/** Left edge of the temperature panel's first column; each column after it is 22 px further right. */
const TEMPS_X = 496;
const TEMPS_PITCH = 22;
/** Rack LED columns (6 px apart from x 464) that still end left of `TEMPS_X`. */
const LEDS_BESIDE_TEMPS = 5;

function paintTemps(painter: Painter, temps: Temps): void {
  const { T } = pen(painter);
  SENSOR_ORDER.forEach((sensor, i) => {
    const x = TEMPS_X + i * TEMPS_PITCH;
    const reading = readingOf(temps, sensor);
    T(TEMP_SENSORS[sensor].label, x, 258, TEMP_COLOURS.unknown);
    if (reading) T(String(reading.celsius), x, 266, TEMP_COLOURS[reading.band]);
    else T('--', x, 266, TEMP_COLOURS.unknown);
  });
}

/** The R2 vault door: swung open while the keeper makes the backup run. */
const paintVaultDoor: DecorFn = (painter, { vaultOpen }) => {
  const { R } = pen(painter);
  if (vaultOpen) {
    R('#14141c', 606, 216, 22, 24);
    R('#5c6877', 610, 232, 7, 7);
    R('#5c6877', 619, 230, 7, 9);
    R('#e2b84a', 621, 233, 3, 3);
    R('#aab2ba', 628, 216, 4, 24);
    return;
  }
  R('#aab2ba', 606, 216, 22, 24);
  R('#c9d0d6', 606, 216, 22, 1);
  R('#5c636b', 606, 216, 1, 1);
  R('#5c636b', 627, 216, 1, 1);
  R('#5c636b', 614, 225, 6, 6);
  R('#aab2ba', 616, 227, 2, 2);
  R('#5c636b', 616, 221, 2, 14);
  R('#5c636b', 610, 227, 14, 2);
};

export const DRESSING: readonly DecorFn[] = [
  paintPlant,
  paintTelly,
  paintPuttingBall,
  paintDrawers,
  paintScoreboard,
  paintHealthchecks,
  paintClock,
  paintSiren,
  paintFlickeringLight,
  paintLiftLamps,
  paintAntennaBeacon,
  paintBasementHost,
  paintVaultDoor,
];
