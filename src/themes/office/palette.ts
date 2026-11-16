/** Colours and body parts shared across the Office. Every value is a CSS colour. */

export const INK = '#1d1a26';
export const PAPER = '#f4f1e6';

export const SKINS = ['#f2c9a0', '#e0a878', '#c68a5c', '#a06a44', '#7a4a2e', '#f6d7b8'] as const;
export const HAIRS = ['#2a1d14', '#5a3a22', '#8a5a2c', '#c9a14a', '#b0452e', '#1a1a22', '#8c8c94'] as const;

/** Client colours for the clients the lab knows by name. */
export const CLIENT_COLOURS = {
  scrd: '#e0563f',
  bsra: '#3f8fd0',
  formsApi: '#9a68d0',
  labTest: '#4aa86b',
} as const;

/** For a client the table does not know: picked by a stable hash of its name. */
export const SPARE_CLIENT_COLOURS = ['#d98a3a', '#2fa7a0', '#c2548f', '#7a8fd6', '#8aa63a', '#b5683f'] as const;

export const PRODUCTION_SHIRT = '#2c3445';
export const PANTS = '#3a3f55';

export const ENV_PLATE = {
  production: { frame: '#8a6a1c', face: '#e2b84a' },
  staging: { frame: '#8d94a0', face: '#9fb2c6' },
  develop: { frame: '#8d94a0', face: '#eef2f4' },
} as const;
