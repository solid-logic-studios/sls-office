import type { MuteStorage } from './mute-preference.ts';

export const VOLUME_KEY = 'sls-office.volume';

const FULL_VOLUME = 1;

/**
 * The master volume this browser saved, 0 to 1. With nothing saved, a value that is not a number in that
 * range, or storage that is missing or throws (private windows, blocked site data), it is full volume.
 */
export function initialVolume(storage: MuteStorage | null): number {
  try {
    const saved = storage?.getItem(VOLUME_KEY);
    if (saved === null || saved === undefined || saved.trim() === '') return FULL_VOLUME;
    const level = Number(saved);
    return level >= 0 && level <= FULL_VOLUME ? level : FULL_VOLUME;
  } catch {
    return FULL_VOLUME;
  }
}

/** Remembers the volume for this browser. A storage failure is ignored. */
export function saveVolume(storage: MuteStorage | null, level: number): void {
  try {
    storage?.setItem(VOLUME_KEY, String(level));
  } catch {
    // Not saved; the volume still holds for this page load.
  }
}
