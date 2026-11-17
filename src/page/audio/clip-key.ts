import { spokenText } from './voice-casting.ts';

/**
 * Two independent 32-bit FNV-1a style passes over the string's UTF-16 units (different offsets and primes),
 * each finished with a mix so near-identical strings still spread widely.
 */
function pass(text: string, offset: number, prime: number): number {
  let value = offset;
  for (let index = 0; index < text.length; index++) {
    value = Math.imul(value ^ text.charCodeAt(index), prime);
  }
  value ^= value >>> 15;
  value = Math.imul(value, 0x2c1b3c6d);
  value ^= value >>> 12;
  return value >>> 0;
}

function hex32(value: number): string {
  return value.toString(16).padStart(8, '0');
}

/**
 * The name of a pre-rendered clip (ADR 0004): 16 lower-case hex characters hashed from the Voice's id and
 * the spoken text. The image build and the page both call this, so the two always agree. Only the Voice
 * and the words count: the per-character pitch and rate nudge never changes which clip is played.
 */
export function clipKey(voiceId: string, text: string): string {
  const keyed = `${voiceId}\n${spokenText(text)}`;
  return hex32(pass(keyed, 0x811c9dc5, 0x01000193)) + hex32(pass(keyed, 0x9747b28c, 0x01000197));
}
