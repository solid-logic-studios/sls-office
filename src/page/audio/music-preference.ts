import type { MuteStorage } from './mute-preference.ts';

export const MUSIC_KEY = 'sls-office.music';

/**
 * Whether the music is switched on. It is off unless this browser saved "on". Storage may be missing or
 * may throw (private windows, blocked site data); either way it reads as off.
 */
export function initialMusic(storage: MuteStorage | null): boolean {
  try {
    return storage?.getItem(MUSIC_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Remembers the choice for this browser. A storage failure is ignored. */
export function saveMusic(storage: MuteStorage | null, on: boolean): void {
  try {
    storage?.setItem(MUSIC_KEY, String(on));
  } catch {
    // Not saved; the choice still holds for this page load.
  }
}
