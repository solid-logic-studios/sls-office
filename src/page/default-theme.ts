import type { Theme } from '../contract/theme.ts';

/** The Theme each kind of screen opens on when the address does not ask for one. */
export interface ThemeDefaults {
  readonly wide: Theme;
  readonly compact: Theme;
}

/**
 * Picks the Theme to start on. A known `?theme=` id always wins; a missing or unknown id falls to the
 * default for the screen (compact for a phone, else wide). Made once at load, so a rotation never swaps it.
 */
export function chooseTheme(
  themes: readonly Theme[],
  requestedId: string | null,
  compact: boolean,
  defaults: ThemeDefaults,
): Theme {
  const requested = requestedId === null ? undefined : themes.find((theme) => theme.id === requestedId);
  return requested ?? (compact ? defaults.compact : defaults.wide);
}
