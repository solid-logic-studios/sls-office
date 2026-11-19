import type { Theme } from '../contract/theme.ts';
import { boxesTheme } from './boxes/index.ts';
import { officeTheme } from './office/index.ts';
import { towerTheme } from './tower/index.ts';

/** The Themes the page ships, in the order the theme switcher lists them. */
export const THEMES: readonly Theme[] = [officeTheme, towerTheme, boxesTheme];
