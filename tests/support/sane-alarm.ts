import { expect } from 'vitest';
import type { SynthSound } from '../../src/contract/theme.ts';

/** Asserts an Alarm has at least one note and every value is in range. */
export function expectSaneAlarm(sound: SynthSound | undefined): void {
  expect(sound).toBeDefined();
  expect(sound?.notes.length).toBeGreaterThan(0);
  for (const note of sound?.notes ?? []) {
    expect(note.startHz).toBeGreaterThan(0);
    expect(note.endHz).toBeGreaterThan(0);
    expect(note.volume).toBeGreaterThan(0);
    expect(note.volume).toBeLessThanOrEqual(1);
    for (const seconds of [note.attack, note.sustain, note.decay, note.gap ?? 0]) {
      expect(seconds).toBeGreaterThanOrEqual(0);
    }
  }
}
