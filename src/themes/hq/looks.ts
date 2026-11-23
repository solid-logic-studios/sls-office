import type { BoxLook } from '../../contract/theme.ts';
import { AMBER } from './palette.ts';

/** The Office's client colours and citizens carry over unchanged, so a client is one colour in every Theme. */
export { clientStyle, visitorLook } from '../office/looks.ts';

/** JARVIS out on the floor: a small amber remote. The heroes' looks are in `avengers.ts`. */
export const JARVIS_LOOK: BoxLook = { kind: 'box', colour: AMBER.glow, w: 8, h: 8 };
