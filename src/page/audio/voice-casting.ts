import type { Voice, Voices } from '../../contract/theme.ts';
import type { CharacterView } from '../../engine/engine.ts';
import type { SpokenLine } from './speech-output.ts';

/** How far a character's own pitch strays from its Voice's, either way. */
export const PITCH_SPREAD = 0.12;
/** How far a character's own rate strays from its Voice's, either way. */
export const RATE_SPREAD = 0.08;

/**
 * Who speaks how: the founder's own Voice, else the Part's, else the Theme's default. A speaker the
 * Engine no longer lists (a visitor on its way out, say) gets the default.
 */
export function voiceFor(voices: Voices, character: Pick<CharacterView, 'id' | 'part'> | undefined): Voice {
  if (character === undefined) return voices.default;
  const { founders, parts } = voices;
  const founder = founders !== undefined && Object.hasOwn(founders, character.id) ? founders[character.id] : undefined;
  return founder ?? parts?.[character.part] ?? voices.default;
}

/** FNV-1a over the string's UTF-16 units, then a final mix so near-identical ids still spread widely. */
function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    value = Math.imul(value ^ text.charCodeAt(index), 0x01000193);
  }
  value ^= value >>> 16;
  value = Math.imul(value, 0x85ebca6b);
  value ^= value >>> 13;
  return value >>> 0;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/**
 * The line as this character says it: the Voice's pitch and rate nudged by a stable amount worked out
 * from the id, so the same character always sounds the same and two sharing a Part sound related but
 * distinct. The id keeps any `#n` generation suffix, so a newcomer after a deploy may sound different.
 */
export function spokenLine(text: string, voice: Voice, characterId: string): SpokenLine {
  const seed = hash(characterId);
  const pitchShift = ((seed & 0xffff) / 0xffff) * 2 - 1;
  const rateShift = ((seed >>> 16) / 0xffff) * 2 - 1;
  return {
    // Bubbles are written in capitals for the pixel font; spoken in capitals, some engines spell words out.
    text: text.toLowerCase(),
    voice,
    pitch: clamp(voice.pitch + pitchShift * PITCH_SPREAD, 0, 2),
    rate: clamp(voice.rate + rateShift * RATE_SPREAD, 0.5, 2),
  };
}
