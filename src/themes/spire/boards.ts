import type { Rect } from '../../contract/theme.ts';
import type { CoreSpec } from '../hq/core.ts';
import { READOUT_MIN_WIDTH, type ConsoleSpec } from '../hq/jarvis-console.ts';
import { AXIS, FLOOR, INSIDE, PARTITION_X, SHAFT, SHAFT_WALL, band } from './geometry.ts';

/**
 * Set pieces that both the art and a Hotspot need, so a moved piece moves its hover target too.
 * The pixel font is 6 art px a character (7 bold), so every board is sized from its text.
 */

const command = band(FLOOR.command);
const sublevel = band(FLOOR.sublevel);

/** The top of the roof deck: the projector stands on it, the orb floats over it. */
export const ROOF_DECK = 38;

/**
 * JARVIS on the roof: the orb floating over its projector in the open, and the readout across the
 * back wall of the command deck under it. The orb's reach (r + 9) just fits the roof band.
 */
export const JARVIS: ConsoleSpec = {
  orb: { cx: AXIS, cy: 19, r: 10 },
  pedestal: { x: AXIS - 12, y: ROOF_DECK - 8, w: 24, h: 9 },
  readout: { x: INSIDE.left + 2, y: command.ceil + 1, w: READOUT_MIN_WIDTH, h: 12 },
};

/** The orb's hover target: its whole reach, down to the foot of the projector. */
export const JARVIS_ORB: Rect = { x: AXIS - 19, y: 0, w: 39, h: JARVIS.pedestal.y + JARVIS.pedestal.h };

/** The power core fills the sub-level's back wall left of the jet silo. No tag, plate or relays: there is no room. */
export const CORE: CoreSpec = {
  chamber: { x: INSIDE.left, y: sublevel.ceil, w: 140, h: sublevel.back - sublevel.ceil },
  hub: { cx: AXIS, cy: sublevel.ceil + 17, r: 11 },
  banks: { x: INSIDE.left + 2, cpuY: sublevel.ceil + 4, memY: sublevel.ceil + 22, cells: 6 },
  drives: { ssdX: 117, nvmeX: 132, y: sublevel.ceil },
};

/** The jet silo beside the core: the Spire's vault. The jet stands in it nose up, and is away on a backup. */
export const SILO: Rect = { x: 150, y: sublevel.ceil, w: SHAFT_WALL - 2 - 150, h: sublevel.back - sublevel.ceil };

/** The three temperatures, along the sub-level's floor under the core: the baseline and where the strip starts. */
export const TEMP_STRIP = { x: INSIDE.left + 2, baseline: sublevel.walk } as const;

/** The motor room over the lift shaft, and the findings lamp on its roof. */
export const MOTOR_ROOM: Rect = { x: SHAFT.x, y: 24, w: SHAFT.w, h: ROOF_DECK - 24 };
export const FINDINGS_LAMP: Rect = { x: SHAFT.x + 1, y: 6, w: 16, h: 18 };

const gate = band(FLOOR.gate);

/** The holo pedestal by the gate: a slim stand with the lab's globe over it. */
export const HOLO_PEDESTAL: Rect = { x: PARTITION_X, y: gate.desk - 24, w: 20, h: 24 };

/** The couch by the gate, right up to the lift: three seats. Its back is set dressing; its front sorts by base line. */
export const COUCH = { x: 146, base: gate.desk, w: 40 } as const;
/** Everything the couch paints, back and front. */
export const COUCH_RECT: Rect = { x: COUCH.x, y: COUCH.base - 22, w: COUCH.w, h: 22 };

const hangar = band(FLOOR.hangar);

/** The hangar's gear rack beside Thor's post: a crate per Site instance, four to a shelf. */
export const GEAR_RACK: Rect = { x: 160, y: hangar.desk - 26, w: 26, h: 26 };

/** Where the "+N" overflow signs hang: high on the wall of the lower ops storey, and over the rookie benches. */
export const SITE_OVERFLOW: Rect = { x: 128, y: band(FLOOR.ops1).ceil + 4, w: 28, h: 11 };
export const POD_OVERFLOW: Rect = { x: 76, y: band(FLOOR.rookieBay).ceil + 4, w: 28, h: 11 };
