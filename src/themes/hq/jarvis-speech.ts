import type { StageView } from '../../contract/theme.ts';
import { JARVIS_LINES } from './jarvis-lines.ts';
import { jarvisState, type JarvisState } from './jarvis-state.ts';

/** How long each line holds the readout, and how fast it is typed out. */
export const LINE_SECONDS = 7;
export const TYPE_RATE = 16;

export interface Speech {
  state: JarvisState;
  /** The whole line. */
  text: string;
  /** How many of its characters are typed out so far. */
  shown: number;
  /** True while the line is still being typed: the orb's core flickers along with it. */
  speaking: boolean;
}

/**
 * What the readout shows this frame. A pure function of the stage: the lines for JARVIS's state take
 * turns, a new one every `LINE_SECONDS`, typed out at `TYPE_RATE` characters a second.
 */
export function jarvisSpeech(stage: StageView): Speech {
  const state = jarvisState(stage);
  const lines = JARVIS_LINES[state];
  const turn = Math.floor(stage.now / LINE_SECONDS);
  const text = lines[turn % lines.length] ?? lines[0];
  const shown = Math.min(text.length, Math.floor((stage.now % LINE_SECONDS) * TYPE_RATE));
  return { state, text, shown, speaking: shown < text.length };
}
