import type { DecorFn, Rect } from '../../contract/theme.ts';
import {
  DISPATCH_SIGN,
  EMBLEM,
  OPS_CLOCK,
  lensBeacon,
  paintDispatchSign,
  paintEmblem,
  paintGateField,
  paintOpsClock,
  paintRunnerLights,
} from '../hq/ground-deck.ts';
import { BUNKER_BACK } from '../hq/jet.ts';
import { GATE } from '../hq/shell.ts';
import {
  BREW_STATION,
  MYSQL_LOCKER,
  POSTGRES_LOCKER,
  PUNCHING_BAG,
  SUIT_UP_TUBE,
  TROPHY_SHELF,
  domeBeacon,
  paintBrewStation,
  paintLockers,
  paintPunchingBag,
  paintSuitUpTube,
  paintTrophyShelf,
} from '../hq/upper-deck.ts';
import { paintSky } from '../shared/sky.ts';
import { AXIS, FLOOR, INSIDE, PARTITION_X, SLOT, WIDTH, band } from './geometry.ts';
import { confine, landed, relocate, type Point } from './relocate.ts';

/**
 * The HQ's own set dressing in the Spire: the same art, frame for frame, in a narrower building. A
 * piece drawn at a fixed place on the HQ's stage is moved here with `relocate`, which runs just that
 * piece; a piece that takes its place (the beacons) is drawn where it hangs. Where a piece is taller
 * than a 35 px storey wall, the Spire shows the part that matters (or splices its top onto its foot)
 * and says so below.
 */

/** A relocated piece: the art, and where it now stands (its hover target). */
interface Piece {
  paint: DecorFn;
  rect: Rect;
}

function piece(art: readonly DecorFn[], from: Rect, to: Point): Piece {
  return { paint: relocate(art, from, to), rect: landed(from, to) };
}

/** A piece shown as two windows stacked: `head` at `to`, then `foot` straight under it. */
function spliced(art: readonly DecorFn[], head: Rect, foot: Rect, to: Point): Piece {
  const top = relocate(art, head, to);
  const bottom = relocate(art, foot, { x: to.x, y: to.y + head.h });
  return {
    paint: (painter, stage) => {
      top(painter, stage);
      bottom(painter, stage);
    },
    rect: { x: to.x, y: to.y, w: head.w, h: head.h + foot.h },
  };
}

const ceilOf = (floor: number): number => band(floor).ceil;

/* -------------------------------------------------------------------- roof */

/** The middle of the HQ's sky over the roof, where the sun crosses at midday. */
const ROOF_SKY = relocate([paintSky], { x: 224, y: 0, w: WIDTH, h: 40 }, { x: 0, y: 0 });

/** The far ridge and the R2 bunker, on the horizon behind the roof: the jet lands there with the backup. */
export const BUNKER = piece(BUNKER_BACK, { x: 610, y: 142, w: 50, h: 38 }, { x: 132, y: 0 });

/** The Nines' shield, on the roof's left. */
export const SHIELD = piece([paintEmblem], EMBLEM, { x: INSIDE.left + 8, y: 6 });

/* ----------------------------------------------------------- command deck */

const command = band(FLOOR.command);

/** The brew station stands on the deck, its foot on the console line, clear of the readout above it. */
export const BREW = piece([paintBrewStation], BREW_STATION, {
  x: INSIDE.left + 2,
  y: command.desk + 1 - BREW_STATION.h,
});

/** The trophy shelf hangs under the orb, between the founders' consoles. */
export const TROPHY = piece([paintTrophyShelf], TROPHY_SHELF, {
  x: AXIS - TROPHY_SHELF.w / 2,
  y: command.back - TROPHY_SHELF.h,
});

/* -------------------------------------------------------------- rookie bay */

const rookie = band(FLOOR.rookieBay);
const ROOKIE_WALL = rookie.back - rookie.ceil;
/** The tube's cap and the top of its glass, then the bottom of its glass and the pad. */
const TUBE_HEAD = 20;

/** The suit-up tube by the lift: its cap and upper glass spliced onto its foot, to fit the shorter storey. */
export const TUBE = spliced(
  [paintSuitUpTube],
  { ...SUIT_UP_TUBE, h: TUBE_HEAD },
  { ...SUIT_UP_TUBE, y: SUIT_UP_TUBE.y + SUIT_UP_TUBE.h - (ROOKIE_WALL - TUBE_HEAD), h: ROOKIE_WALL - TUBE_HEAD },
  { x: 170, y: rookie.ceil },
);

/** The punching bag's lower chain and the bag, hanging from the rookie bay's ceiling. */
const BAG_FROM: Rect = {
  x: PUNCHING_BAG.x - 2,
  y: PUNCHING_BAG.y + PUNCHING_BAG.h - ROOKIE_WALL,
  w: 16,
  h: ROOKIE_WALL,
};
export const BAG = piece([paintPunchingBag], BAG_FROM, { x: 132, y: rookie.ceil });
/** Where the hero stands to hit the bag: as far left of its chain as the HQ's. */
// Two pixels in from the bag's left edge, as the HQ's hero stands (the chain hangs from its middle).
export const BAG_SPOT_X = BAG.rect.x + 2;

/* ------------------------------------------------------------ archive vault */

const hangar = band(FLOOR.hangar);
/** A locker's name board, top and lamp. */
const LOCKER_HEAD = 15;
/** Its bottom two drawers (the one Ledger pulls is the upper) and the plinth. */
const LOCKER_FOOT = 23;

/** A locker standing on the floor, its head spliced onto its foot to fit the shorter storey. */
const locker = (rect: Rect, x: number): Piece =>
  spliced(
    [paintLockers],
    { ...rect, h: LOCKER_HEAD },
    { ...rect, y: rect.y + rect.h - LOCKER_FOOT, h: LOCKER_FOOT },
    { x, y: hangar.desk - LOCKER_HEAD - LOCKER_FOOT },
  );

/** The two lockers either side of Ledger's desk, in store order: PostgreSQL, then MySQL. */
export const PGSQL = locker(POSTGRES_LOCKER, INSIDE.left + 2);
export const MYSQL = locker(MYSQL_LOCKER, PGSQL.rect.x + PGSQL.rect.w + SLOT);

/* -------------------------------------------------------------- the hangar */

/** The runner lights along the top of the hangar wall: the first five of the HQ's chase. */
export const RUNNER_LIGHTS = piece(
  [paintRunnerLights],
  { x: 477, y: 166, w: 30, h: 4 },
  { x: PARTITION_X + 4, y: hangar.ceil + 11 },
);

/* ---------------------------------------------------------------- the gate */

const gate = band(FLOOR.gate);
const GATE_AT: Point = { x: 0, y: gate.front - GATE.h };

/** The gate in the left wall: the HQ's sky through it, then its field. */
export const GATEWAY = piece([paintGateField], GATE, GATE_AT);
const GATE_SKY = relocate([paintSky], GATE, GATE_AT);

/** Switchboard's sign over the dispatch desk, and the ops clock beside it. */
export const DISPATCH = piece([paintDispatchSign], DISPATCH_SIGN, { x: 54, y: gate.ceil + 3 });
export const CLOCK = piece([paintOpsClock], OPS_CLOCK, { x: INSIDE.left + 4, y: gate.ceil + 2 });

/* --------------------------------------------------------------- beacons */

/** A beacon's spot: its bracket and dome under the ceiling, and room for its beam either side. */
const beaconSpot = (x: number, floor: number, h: number): Rect => ({ x: x - 12, y: ceilOf(floor), w: 25, h });

/** An upper deck beacon: its beam already stays inside its spot. */
function domeAt(x: number, floor: number): Piece {
  return { paint: domeBeacon(x, ceilOf(floor)), rect: beaconSpot(x, floor, 8) };
}

/** A ground deck beacon, its beam cut short to its spot: the Spire's rooms are too narrow for its full sweep. */
function lensAt(x: number, floor: number): Piece {
  const rect = beaconSpot(x, floor, 11);
  return { paint: confine(lensBeacon(x, ceilOf(floor) + 1), rect), rect };
}

/** The Spire's alarm beacons: one per storey below the command deck, bar the gate's. */
export const BEACONS: readonly Piece[] = [
  domeAt(157, FLOOR.rookieBay),
  domeAt(114, FLOOR.hangar),
  lensAt(172, FLOOR.ops2),
  lensAt(172, FLOOR.ops1),
];

/** A beacon's hover target: its dome and bracket. */
export const beaconHover = ({ x, y }: Rect): Rect => ({ x: x + 8, y: y + 1, w: 9, h: 9 });

/* ----------------------------------------------------------------- export */

/** The sky through the roof and the gate, painted first. */
export const SKY_BACK: readonly DecorFn[] = [ROOF_SKY, GATE_SKY];

/** The relocated dressing, painted over the structure. */
export const SET_BACK: readonly DecorFn[] = [
  BUNKER,
  SHIELD,
  BREW,
  TROPHY,
  TUBE,
  BAG,
  PGSQL,
  MYSQL,
  RUNNER_LIGHTS,
  GATEWAY,
  DISPATCH,
  CLOCK,
  ...BEACONS,
].map((p) => p.paint);
