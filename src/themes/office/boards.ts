import type { Rect } from '../../contract/theme.ts';

/**
 * Signs and set pieces that both the art and a hotspot need, so a moved board moves its hover target too.
 * The pixel font is 6 art px per character (7 bold), so every board is sized from its text.
 */

/** The brass plaque for the first client. Wider than the prototype so the bold line fits. */
export const PLAQUE: Rect = { x: 88, y: 159, w: 112, h: 28 };
export const CLOUD_OFFICE: Rect = { x: 572, y: 60, w: 88, h: 70 };
export const VAULT: Rect = { x: 586, y: 196, w: 62, h: 48 };
export const POSTGRES_CABINET: Rect = { x: 150, y: 74, w: 30, h: 46 };
export const MYSQL_CABINET: Rect = { x: 218, y: 74, w: 30, h: 46 };
export const HEALTHCHECKS: Rect = { x: 358, y: 158, w: 42, h: 36 };
export const SCOREBOARD: Rect = { x: 288, y: 158, w: 66, h: 30 };
export const SCRD_RACK: Rect = { x: 250, y: 159, w: 34, h: 44 };
export const DISCORD: Rect = { x: 18, y: 166, w: 16, h: 18 };
export const POSTER: Rect = { x: 478, y: 62, w: 28, h: 36 };
export const FRIDGE: Rect = { x: 382, y: 78, w: 16, h: 42 };
export const PUTTING_GREEN: Rect = { x: 400, y: 110, w: 42, h: 26 };
export const HOST_STRIP: Rect = { x: 8, y: 248, w: 560, h: 22 };

/** The LAN Saturday board: widened to the left, over the fridge, so 'LAN SAT' (42 px) fits. */
export const LAN_BOARD: Rect = { x: 388, y: 60, w: 52, h: 18 };
/** The sticky note on the basement strip. */
export const REPLACE_NOTE: Rect = { x: 392, y: 250, w: 64, h: 18 };
