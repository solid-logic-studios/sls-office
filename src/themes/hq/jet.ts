import type { Painter } from '../../contract/painter.ts';
import type { DecorFn, Hotspot, Prop, Rect, StageView, Tip } from '../../contract/theme.ts';
import { pen } from '../shared/pen.ts';
import { nightFactor, skyColour } from '../shared/sky.ts';
import { APRON, GROUND_Y, WIDTH } from './geometry.ts';
import { jarvisState } from './jarvis-state.ts';
import { disc, wave } from './kit.ts';
import { JET_RAMP_X } from './layout.ts';
import { ALARM, AMBER, CYAN, HULL, INK, LAMP, PAPER, ROOMS, STEEL, UNLIT } from './palette.ts';

/*
 * Slice 6: the apron, the jet, its contrail and the off-site bunker (docs/design/hq-theme.md, sections 6 and 11).
 *
 * The nightly backup is a jet run. The jet waits on its stand outside the hangar door with its hatch open
 * and its stair down at the keeper's loading spot (`JET_RAMP_X`). While the vault is open (`stage.vaultOpen`)
 * the stand is empty, a contrail climbs from the apron to the R2 bunker on the far ridge, the jet sits on the
 * bunker's pad and the bunker's beacon is lit. Then the jet is back on its stand.
 *
 * It all stands behind the walk line, so characters always pass in front of it: back layer, no Props.
 * Motion runs off `stage.now` at fixed speeds.
 */

/* ---------------------------------------------------------------- set pieces */

/** The top of the tarmac: wheels and feet rest on the row above it. */
const DECK_Y = GROUND_Y - 1;

/** The parked jet, nose to the right. Its hatch is over the keeper's loading spot. */
export const JET_STAND: Rect = { x: JET_RAMP_X - 20, y: DECK_Y - 32, w: 66, h: 32 };
/** The bunker on the far ridge: the blockhouse and its mast, with the beacon on top. */
export const BUNKER: Rect = { x: 628, y: 148, w: 30, h: 30 };
/** The bunker's landing pad, on the ridge beside it: the jet sits here while the backup is away. */
export const BUNKER_PAD: Rect = { x: 614, y: 171, w: 13, h: 7 };
/** The beacon lamp on the bunker's mast. */
export const BUNKER_BEACON: Rect = { x: 651, y: 148, w: 5, h: 4 };
/** The stand's guidance board, on a post past the jet's nose. */
export const STAND_BOARD: Rect = { x: 653, y: 213, w: 6, h: 30 };
/** The windsock at the apron's edge, by the hangar door. */
const WINDSOCK = { x: 572, top: 216 } as const;
/** The sky over the apron and the far ridge: the whole of the jet run's hover target. */
export const JET_AND_BUNKER: Rect = { x: 570, y: 146, w: WIDTH - 570, h: DECK_Y - 146 };

/** How much of the sky's colour lies over the far ridge and the bunker, so they read as a long way off. */
const HAZE = 0.36;

/* ----------------------------------------------------------------- the ridge */

/** The far ridge's skyline, left to right: a low rise behind the stand, then the bunker's mesa. */
const SKYLINE: readonly (readonly [x: number, y: number])[] = [
  [APRON[0], 234],
  [586, 231],
  [598, 225],
  [605, 212],
  [610, 190],
  [614, 178],
  [WIDTH, 178],
];

function skylineAt(x: number): number {
  for (let i = 1; i < SKYLINE.length; i++) {
    const [x1, y1] = SKYLINE[i] ?? [WIDTH, DECK_Y];
    const [x0, y0] = SKYLINE[i - 1] ?? [x1, y1];
    if (x <= x1) return Math.round(y0 + ((y1 - y0) * (x - x0)) / Math.max(1, x1 - x0));
  }
  return DECK_Y;
}

interface Shape extends Rect {
  colour: string;
}

/** The ridge as columns, neighbours of the same height merged, each with a lit rim along its top. */
function ridgeShapes(): Shape[] {
  const shapes: Shape[] = [];
  let start = APRON[0];
  for (let x = APRON[0] + 1; x <= WIDTH; x++) {
    const top = skylineAt(start);
    if (x < WIDTH && skylineAt(x) === top) continue;
    shapes.push({ colour: HULL.light, x: start, y: top + 1, w: x - start, h: DECK_Y - top - 1 });
    shapes.push({ colour: HULL.trim, x: start, y: top, w: x - start, h: 1 });
    start = x;
  }
  // Strata in the rock face, so the mesa is not one flat wall.
  for (let y = 190; y < DECK_Y; y += 13) {
    let from = APRON[0];
    while (from < WIDTH && skylineAt(from) > y - 2) from++;
    shapes.push({ colour: HULL.base, x: from, y, w: WIDTH - from, h: 1 });
  }
  return shapes;
}

/** The blockhouse, dug into the mesa: a slab roof, a concrete face and a blast door. Its lights are painted later. */
const BLOCKHOUSE: readonly Shape[] = [
  { colour: STEEL.dark, x: BUNKER.x + 2, y: 164, w: BUNKER.w - 4, h: 14 },
  { colour: STEEL.base, x: BUNKER.x, y: 163, w: BUNKER.w, h: 2 },
  { colour: HULL.trim, x: BUNKER.x + 3, y: 176, w: BUNKER.w - 6, h: 2 },
  { colour: HULL.dark, x: 646, y: 168, w: 8, h: 10 },
  { colour: STEEL.dark, x: 647, y: 169, w: 6, h: 9 },
  { colour: STEEL.base, x: 653, y: 150, w: 1, h: 13 },
  { colour: STEEL.base, x: 650, y: 156, w: 7, h: 1 },
];

/** Everything far off, painted once in solid colours and then veiled with the sky's colour. */
const FAR: readonly Shape[] = [...ridgeShapes(), ...BLOCKHOUSE];

const paintFarRidge: DecorFn = (painter, { hour }) => {
  const { R } = pen(painter);
  for (const { colour, x, y, w, h } of FAR) R(colour, x, y, w, h);
  const veil = skyColour(hour, 1);
  painter.withAlpha(HAZE, () => {
    for (const { x, y, w, h } of FAR) R(veil, x, y, w, h);
  });
};

/* ---------------------------------------------------------------- the bunker */

type BeaconState = 'dark' | 'lit' | 'alarm';

/** All hands turns every beacon red; otherwise the bunker's beacon is lit while the jet is there. */
function beaconState(stage: StageView): BeaconState {
  if (stage.host === null) return 'dark';
  if (jarvisState(stage) === 'alarm') return 'alarm';
  return stage.vaultOpen ? 'lit' : 'dark';
}

const ALARM_BLINK_SECONDS = 0.8;

/** The bunker's sign, door lamp and beacon: these shine through the haze. */
const paintBunkerLights: DecorFn = (painter, stage) => {
  const { R, T } = pen(painter);
  const night = nightFactor(stage.hour);
  T('R2', BUNKER.x + 5, 175, night > 0.5 ? AMBER.glow : STEEL.shine);
  // The lamp over the blast door: on while the bunker is taking a delivery, else a dim standby.
  R(stage.vaultOpen ? LAMP.ok : night > 0.5 ? AMBER.rim : STEEL.base, 647, 166, 6, 1);
  const state = beaconState(stage);
  const { x, y } = BUNKER_BEACON;
  R(INK, x, y, 5, 4);
  if (state === 'dark') {
    R(UNLIT, x + 1, y + 1, 3, 2);
    return;
  }
  const on = state === 'lit' || stage.now % ALARM_BLINK_SECONDS < ALARM_BLINK_SECONDS / 2;
  const colour = state === 'alarm' ? ALARM.base : LAMP.ok;
  R(on ? colour : UNLIT, x + 1, y + 1, 3, 2);
  if (!on) return;
  const glow = 0.18 + 0.12 * wave(stage.now, 1.6) + 0.15 * night;
  painter.withAlpha(glow, () => disc(painter, colour, x + 2, y + 2, 3));
};

/* ------------------------------------------------------------------- the jet */

type Span = readonly [dy: number, from: number, to: number];

/** The fuselage, row by row from the top, relative to the stand: a tail cone, the body and a long nose. */
const FUSELAGE: readonly Span[] = [
  [15, 10, 51],
  [16, 8, 54],
  [17, 6, 57],
  [18, 5, 59],
  [19, 4, 61],
  [20, 4, 63],
  [21, 4, 65],
  [22, 5, 64],
  [23, 6, 60],
  [24, 8, 56],
];

/** The fin, swept back over the tail. */
const FIN: readonly Span[] = Array.from({ length: 14 }, (_, i) => {
  const dy = i + 1;
  return [dy, 2 + Math.round(dy * 0.2), 8 + Math.round(dy * 0.45)] as const;
});

/** The near wing, swept back and seen a little from above, low on the body. */
const WING: readonly Span[] = [
  [23, 36, 52],
  [24, 33, 50],
  [25, 30, 46],
  [26, 27, 42],
];

/** The engine, slung on the tail over the hatch. */
const NACELLE: readonly Span[] = [
  [11, 16, 28],
  [12, 15, 29],
  [13, 15, 29],
  [14, 16, 28],
];

const shade = (dy: number): string =>
  dy <= 15 ? STEEL.shine : dy <= 17 ? STEEL.light : dy <= 21 ? STEEL.base : STEEL.dark;

/** Paints a shape row by row, with an ink outline round it. */
function paintSpans(painter: Painter, spans: readonly Span[], colour: (dy: number) => string): void {
  const { R } = pen(painter);
  const { x, y } = JET_STAND;
  for (const [dy, from, to] of spans) R(INK, x + from - 1, y + dy - 1, to - from + 2, 3);
  for (const [dy, from, to] of spans) R(colour(dy), x + from, y + dy, to - from, 1);
}

/** The hatch over the loading spot, and the stair folded down from it. */
const HATCH = { from: 18, to: 23, top: 16 } as const;

function paintHatchAndStair(painter: Painter, night: number): void {
  const { R } = pen(painter);
  const { x, y } = JET_STAND;
  R(INK, x + HATCH.from - 1, y + HATCH.top - 1, HATCH.to - HATCH.from + 2, 25 - HATCH.top);
  R(AMBER.hot, x + HATCH.from, y + HATCH.top, HATCH.to - HATCH.from, 24 - HATCH.top);
  R(AMBER.glow, x + HATCH.from, y + 22, HATCH.to - HATCH.from, 2);
  // After dark the open hatch throws a pool of light on the tarmac under it.
  if (night > 0) painter.withAlpha(0.35 * night, () => R(AMBER.glow, x + 8, DECK_Y, 18, 1));
  // Four treads stepping down and back to the tarmac, with a rail along their outer edge.
  for (let step = 0; step < 4; step++) {
    const sx = x + HATCH.from - 2 - step * 2;
    const sy = y + 25 + step * 2;
    R(INK, sx - 1, sy, 7, 2);
    R(STEEL.light, sx, sy, 5, 1);
  }
  for (let i = 2; i < 10; i++) R(STEEL.shine, x + HATCH.from - i, y + 21 + i, 1, 1);
}

/** A leg and its wheel, with chocks either side while the jet is parked. */
function paintGear(painter: Painter, gx: number, wheels: number): void {
  const { R } = pen(painter);
  const { x, y } = JET_STAND;
  R(STEEL.light, x + gx, y + 25, 1, 4);
  const w = wheels * 3 + 1;
  const left = x + gx - Math.floor(w / 2);
  R(INK, left, DECK_Y - 3, w, 3);
  for (let i = 0; i < wheels; i++) R(STEEL.dark, left + 1 + i * 3, DECK_Y - 2, 1, 1);
  R(ROOMS.hangar.accent, left - 2, DECK_Y - 2, 2, 2);
  R(ROOMS.hangar.accent, left + w, DECK_Y - 2, 2, 2);
}

const STROBE_SECONDS = 1.3;

/** The jet on its stand: graphite and steel with JARVIS's amber cheat line, the core's cyan in its engine. */
const paintParkedJet: DecorFn = (painter, stage) => {
  if (stage.vaultOpen) return;
  const { R } = pen(painter);
  const { x, y } = JET_STAND;
  const night = nightFactor(stage.hour);
  paintSpans(painter, FIN, (dy) => (dy <= 2 ? AMBER.glow : HULL.trim));
  paintSpans(painter, FUSELAGE, shade);
  // The engine on the tail, its intake to the front and a low cyan glow in its exhaust.
  paintSpans(painter, NACELLE, (dy) => (dy <= 11 ? STEEL.base : HULL.light));
  R(STEEL.shine, x + 28, y + 12, 1, 2);
  R(CYAN.base, x + 14, y + 12, 1, 2);
  // The cheat line, the canopy and a row of cabin windows.
  R(AMBER.base, x + 6, y + 19, 56, 1);
  R(INK, x + 47, y + 13, 9, 3);
  R(CYAN.deep, x + 48, y + 14, 8, 2);
  R(CYAN.deep, x + 54, y + 16, 4, 1);
  R(CYAN.bright, x + 50, y + 14, 2, 1);
  for (let wx = 28; wx <= 42; wx += 4) R(night > 0.5 ? AMBER.hot : CYAN.deep, x + wx, y + 17, 2, 1);
  paintSpans(painter, WING, () => HULL.trim);
  paintGear(painter, 40, 2);
  paintGear(painter, 57, 1);
  paintHatchAndStair(painter, night);
  // A green light on the wing tip, and a white strobe on the fin. Nothing on stage but the alarm is red.
  R(LAMP.ok, x + 27, y + 26, 2, 1);
  if (stage.now % STROBE_SECONDS < 0.15) {
    R(PAPER, x + 3, y, 2, 1);
    if (night > 0) painter.withAlpha(0.3 * night, () => disc(painter, PAPER, x + 4, y, 3));
  }
};

/* -------------------------------------------------------------- the jet away */

const CONTRAIL_FROM = { x: 576, y: 236 } as const;
const CONTRAIL_BEND = { x: 584, y: 170 } as const;
const CONTRAIL_TO = { x: BUNKER_PAD.x + 1, y: BUNKER_PAD.y + 3 } as const;
const CONTRAIL_PUFFS = 40;
/** Puffs a second that a bright pulse runs along the trail, towards the bunker. */
const CONTRAIL_FLOW = 14;

/** A point on the jet's path, a share `t` of the way from the apron to the bunker's pad. */
export function contrailAt(t: number): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: u * u * CONTRAIL_FROM.x + 2 * u * t * CONTRAIL_BEND.x + t * t * CONTRAIL_TO.x,
    y: u * u * CONTRAIL_FROM.y + 2 * u * t * CONTRAIL_BEND.y + t * t * CONTRAIL_TO.y,
  };
}

/** The trail from the apron to the bunker: thin and fresh at the bunker end, spreading and fading behind. */
const paintContrail: DecorFn = (painter, stage) => {
  if (!stage.vaultOpen) return;
  const { R } = pen(painter);
  const head = stage.now * CONTRAIL_FLOW;
  for (let i = 0; i <= CONTRAIL_PUFFS; i++) {
    const t = i / CONTRAIL_PUFFS;
    const { x, y } = contrailAt(t);
    const size = t < 0.45 ? 3 : 2;
    const pulse = (((i - head) % 8) + 8) % 8 < 1;
    painter.withAlpha(pulse ? 0.85 : 0.2 + 0.45 * t, () => R(CYAN.hot, x - 1, y - 1, size, size));
  }
};

/** The jet on the bunker's pad, small with distance, its strobe winking. */
const paintJetAtBunker: DecorFn = (painter, stage) => {
  if (!stage.vaultOpen) return;
  const { R } = pen(painter);
  const { x, y } = BUNKER_PAD;
  R(ROOMS.hangar.accent, x, y + 6, BUNKER_PAD.w, 1);
  R(INK, x + 1, y + 2, 11, 3);
  R(INK, x + 1, y, 3, 3);
  R(STEEL.light, x + 2, y + 3, 9, 1);
  R(STEEL.light, x + 2, y + 1, 1, 2);
  R(AMBER.base, x + 3, y + 4, 7, 1);
  R(CYAN.deep, x + 9, y + 2, 2, 1);
  R(INK, x + 4, y + 5, 1, 1);
  R(INK, x + 9, y + 5, 1, 1);
  if (stage.now % STROBE_SECONDS < 0.15) R(PAPER, x + 1, y, 1, 1);
};

/* ----------------------------------------------------------------- the apron */

/** The windsock by the hangar door: orange and white, drooping and lifting with the breeze. */
const paintWindsock: DecorFn = (painter, { now }) => {
  const { R } = pen(painter);
  const { x, top } = WINDSOCK;
  R(STEEL.light, x, top, 1, DECK_Y - top);
  R(STEEL.dark, x - 1, DECK_Y - 2, 3, 2);
  const droop = 1 + 2 * wave(now, 5);
  for (let i = 0; i < 9; i++) {
    const h = i < 4 ? 3 : i < 7 ? 2 : 1;
    const band = Math.floor(i / 3) % 2 === 0 ? AMBER.base : PAPER;
    R(band, x + 1 + i, top + Math.round((i * droop) / 8), 1, h);
  }
};

/** Lamps set flush in the apron's front edge, between the painted dashes: dim by day, lit after dark. */
const EDGE_LIGHTS: readonly number[] = Array.from({ length: 7 }, (_, i) => APRON[0] + 14 + i * 12);

const paintEdgeLights: DecorFn = (painter, { hour }) => {
  const { R } = pen(painter);
  const night = nightFactor(hour);
  const colour = night > 0.5 ? CYAN.bright : CYAN.deep;
  for (const x of EDGE_LIGHTS) R(colour, x, GROUND_Y + 2, 2, 1);
  if (night > 0) {
    painter.withAlpha(0.2 * night, () => {
      for (const x of EDGE_LIGHTS) R(CYAN.bright, x - 1, GROUND_Y + 1, 4, 3);
    });
  }
};

/** The stand's guidance board: green with the jet on its stand, a slow amber blink while the stand waits for it. */
const paintStandBoard: DecorFn = (painter, stage) => {
  const { R } = pen(painter);
  const { x, y, w } = STAND_BOARD;
  R(STEEL.dark, x + 2, y + 8, 2, DECK_Y - y - 8);
  R(INK, x, y, w, 9);
  R(HULL.light, x + 1, y + 1, w - 2, 7);
  const waiting = stage.vaultOpen && wave(stage.now, 1.6) > 0.5;
  const parked = !stage.vaultOpen && stage.host !== null;
  R(parked ? LAMP.ok : UNLIT, x + 2, y + 2, 2, 2);
  R(waiting ? LAMP.warn : UNLIT, x + 2, y + 5, 2, 2);
};

/* ------------------------------------------------------------------ exports */

/** Painted in the back layer, after the structure, in this order: far to near. */
export const JET_BACK: readonly DecorFn[] = [
  paintFarRidge,
  paintBunkerLights,
  paintJetAtBunker,
  paintContrail,
  paintWindsock,
  paintStandBoard,
  paintParkedJet,
  paintEdgeLights,
];

/** The jet and the bunker stand behind the walk line, so nothing needs depth-sorting. */
export const JET_PROPS: readonly Prop[] = [];

const BUNKER_DETAIL =
  'The R2 bunker on the far ridge: the off-site Cloudflare R2 bucket. Each night at 02:30 the jet flies it the backup Ledger sealed in the strongroom. A 30-day bucket lock means no copy here can be changed or deleted before it ages out.';

/** The vault's honest status, as the Office's vault tip has it. The stage says whether a run is on, not how it ended. */
export const bunkerTip = ({ vaultOpen }: StageView): Tip => ({
  title: 'R2 bunker',
  detail: BUNKER_DETAIL,
  status: vaultOpen ? 'Backup in progress' : 'Locked',
  severity: 'ok',
});

export const JET_HOTSPOTS: readonly Hotspot[] = [{ rect: JET_AND_BUNKER, tip: bunkerTip }];
