import type { Rect } from '../../contract/theme.ts';
import { FLOOR, band, storeyTop } from './geometry.ts';

/** Set pieces that both the art and a Hotspot need, so a moved piece moves its hover target too. */

const data = band(FLOOR.storey3);
const basement = band(FLOOR.basement);

/** The keeper's two filing cabinets, either side of the keeper's desk: PostgreSQL, then MySQL. */
export const POSTGRES_CABINET: Rect = { x: 8, y: data.desk - 28, w: 22, h: 28 };
export const MYSQL_CABINET: Rect = { x: 70, y: data.desk - 28, w: 22, h: 28 };

/** The coffee counter on storey 5, where the founders take a break. */
export const COFFEE_COUNTER: Rect = { x: 120, y: band(FLOOR.storey5).desk - 16, w: 30, h: 16 };

/** The CI queue board on storey 4's back wall. */
export const CI_BOARD: Rect = { x: 128, y: band(FLOOR.storey4).ceil + 3, w: 54, h: 22 };

/** The deploy runner's build rack, beside the courier's post. */
export const RUNNER_RACK: Rect = { x: 164, y: data.ceil + 9, w: 20, h: data.desk - data.ceil - 9 };

/** The host plant room: the CPU and memory bars and the temperature gauges. */
export const PLANT_ROOM: Rect = { x: 6, y: basement.ceil, w: 122, h: basement.back - basement.ceil };
export const VAULT: Rect = { x: 134, y: basement.ceil + 5, w: 44, h: basement.back - basement.ceil - 5 };

/** The rooftop sign: 'SOLID LOGIC STUDIOS' is 133 px in bold, and the board's face is 146 px. */
export const ROOF_SIGN = { x: 24, y: 6, w: 150, h: 20, text: 'SOLID LOGIC STUDIOS' } as const;

/** The findings lamp on the lift's motor room, at the top right of the roof. */
export const FINDINGS_LAMP: Rect = { x: 186, y: 8, w: 20, h: 28 };

/** Where the "+N" overflow signs hang: high on the wall of storey 2, and beside the CI board on storey 4. */
export const SITE_OVERFLOW: Rect = { x: 156, y: storeyTop(FLOOR.storey2) + 7, w: 28, h: 11 };
export const POD_OVERFLOW: Rect = { x: CI_BOARD.x, y: storeyTop(FLOOR.storey4) + 28, w: 28, h: 11 };
