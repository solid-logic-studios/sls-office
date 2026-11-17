/** The part of `Storage` the mute preference needs, so tests can pass a fake. */
export type MuteStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const MUTE_KEY = 'sls-office.muted';

/** `?mute` (present, any value) forces a screen silent, whatever this browser saved. */
function forcedMute(query: URLSearchParams): boolean {
  return query.has('mute');
}

/**
 * Whether the Office starts muted. `?mute` wins over the saved choice; with nothing saved, sound is on.
 * Storage may be missing or may throw (private windows, blocked site data); either way it reads as
 * "not muted".
 */
export function initialMuted(query: URLSearchParams, storage: MuteStorage | null): boolean {
  if (forcedMute(query)) return true;
  try {
    return storage?.getItem(MUTE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Remembers the choice for this browser. Does nothing while `?mute` is in the URL, so a screen forced
 * silent never overwrites the saved choice. A storage failure is ignored.
 */
export function saveMuted(query: URLSearchParams, storage: MuteStorage | null, muted: boolean): void {
  if (forcedMute(query)) return;
  try {
    storage?.setItem(MUTE_KEY, String(muted));
  } catch {
    // Not saved; the choice still holds for this page load.
  }
}
