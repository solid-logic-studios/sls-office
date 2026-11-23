import type { Emblem, PersonLook, PixelGrid } from '../../contract/theme.ts';
import { DHRUV_LOOK as OFFICE_DHRUV_LOOK, PAUL_LOOK as OFFICE_PAUL_LOOK } from '../office/looks.ts';
import { CYAN } from './palette.ts';

/**
 * The Avengers, as the HQ's cast (issue #75; docs/design/hq-theme.md, section 14). Every hero is a
 * `PersonLook`: original pixel art from colour blocks and the costume pieces of the Theme contract.
 * `pnpm sheet` renders them all, pose by pose, which is how a look is judged.
 */
export interface Hero {
  name: string;
  look: PersonLook;
}

/* ------------------------------------------------------------------ palette */

/** A hero's red is crimson: the HQ keeps bright red for the alarm. */
const CRIMSON = '#b8242c';
const GOLD = '#e8b23a';
const WHITE = '#f4f7fa';
const SILVER = '#aeb6c0';
const STEEL_GREY = '#8d94a0';
const GUNMETAL = '#4a505c';
/** Black costumes are a blue-black, lighter than the sprite's ink, so they hold their shape on a dark wall. */
const BLACK = '#1c1c28';
const NAVY = '#2f5fb0';
const PURPLE = '#8e5cc9';
const LEATHER = '#6b4a2e';
const PALE_SKIN = '#f2c9a0';
const FAIR_SKIN = '#f6d7b8';
const TAN_SKIN = '#c68a5c';
const BROWN_SKIN = '#a06a44';
const DEEP_SKIN = '#7a4a2e';
const BLOND = '#e8c95a';
const DARK_HAIR = '#2a1d14';
const BLACK_HAIR = '#1a1a22';

const _ = null;

/** An emblem that starts `down` rows below the collar. */
function lowered(down: number, pixels: PixelGrid): PixelGrid {
  return [...Array.from({ length: down }, () => []), ...pixels];
}

/** A chest light: two by two, a row below the collar, with a halo. */
function reactor(light: string, glow: string): Emblem {
  return {
    pixels: lowered(1, [
      [light, light],
      [light, light],
    ]),
    glow,
  };
}

const ARC_REACTOR = reactor('#e6fbff', CYAN.bright);

/* ------------------------------------------------------- the signature six */

export const IRON_MAN: Hero = {
  name: 'Iron Man',
  look: {
    kind: 'person',
    skin: CRIMSON,
    hair: CRIMSON,
    hairStyle: 'bald',
    headgear: { kind: 'helmet', shell: CRIMSON, face: GOLD, eyes: '#e6fbff' },
    shirt: CRIMSON,
    sleeves: GOLD,
    gloves: CRIMSON,
    pants: GOLD,
    boots: CRIMSON,
    emblem: ARC_REACTOR,
  },
};

const R = CRIMSON;
const W = WHITE;

export const CAPTAIN_AMERICA: Hero = {
  name: 'Captain America',
  look: {
    kind: 'person',
    skin: PALE_SKIN,
    hair: BLOND,
    hairStyle: 'short',
    headgear: { kind: 'cowl', colour: NAVY, mark: WHITE },
    shirt: NAVY,
    gloves: CRIMSON,
    pants: '#274b8c',
    boots: CRIMSON,
    emblem: {
      pixels: [
        [_, _, _, W, W, _, _, _],
        [_, _, W, W, W, W, _, _],
        [_, _, _, W, W, _, _, _],
        [_, _, W, _, _, W, _, _],
        [R, W, R, W, W, R, W, R],
        [R, W, R, W, W, R, W, R],
        [R, W, R, W, W, R, W, R],
      ],
    },
    carry: { kind: 'shield', rim: CRIMSON, band: WHITE, boss: NAVY },
  },
};

const S = SILVER;

export const THOR: Hero = {
  name: 'Thor',
  look: {
    kind: 'person',
    skin: PALE_SKIN,
    hair: BLOND,
    hairStyle: 'long',
    shirt: '#2b3040',
    sleeves: PALE_SKIN,
    gloves: '#2b3040',
    pants: '#2b3040',
    boots: LEATHER,
    cape: CRIMSON,
    wide: true,
    emblem: {
      pixels: lowered(1, [
        [_, S, S, _, _, S, S, _],
        [_, _, _, _, _, _, _, _],
        [_, _, _, _, _, _, _, _],
        [_, S, S, _, _, S, S, _],
      ]),
    },
    carry: { kind: 'hammer', head: SILVER, haft: LEATHER },
  },
};

const P = PURPLE;

export const HAWKEYE: Hero = {
  name: 'Hawkeye',
  look: {
    kind: 'person',
    skin: PALE_SKIN,
    hair: '#a8854a',
    hairStyle: 'short',
    shirt: '#2e2640',
    sleeves: PALE_SKIN,
    gloves: BLACK,
    pants: BLACK,
    emblem: {
      pixels: lowered(1, [
        [P, _, _, _, _, _, _, P],
        [P, P, _, _, _, _, P, P],
        [_, P, P, _, _, P, P, _],
        [_, _, P, P, P, P, _, _],
        [_, _, _, P, P, _, _, _],
      ]),
    },
    carry: { kind: 'bow', limbs: '#12101a', quiver: PURPLE },
  },
};

const WIDOW_RED = '#d9442a';

export const BLACK_WIDOW: Hero = {
  name: 'Black Widow',
  look: {
    kind: 'person',
    skin: FAIR_SKIN,
    hair: WIDOW_RED,
    hairStyle: 'long',
    shirt: BLACK,
    gloves: GOLD,
    pants: BLACK,
    emblem: {
      pixels: lowered(2, [
        [_, R, R, R, R, _],
        [_, _, R, R, _, _],
        [_, R, R, R, R, _],
        [],
        [GOLD, GOLD, GOLD, GOLD, GOLD, GOLD, GOLD, GOLD],
      ]),
    },
  },
};

const HULK_GREEN = '#5fae4a';
const HULK_SHADE = '#4a8f3a';

export const HULK: Hero = {
  name: 'Hulk',
  look: {
    kind: 'person',
    skin: HULK_GREEN,
    hair: '#16261a',
    hairStyle: 'short',
    shirt: HULK_GREEN,
    pants: '#6a3f96',
    boots: HULK_GREEN,
    wide: true,
    emblem: {
      pixels: lowered(2, [
        [_, _, _, HULK_SHADE, HULK_SHADE, _, _, _],
        [HULK_SHADE, HULK_SHADE, HULK_SHADE, _, _, HULK_SHADE, HULK_SHADE, HULK_SHADE],
        [],
        [_, _, _, HULK_SHADE, HULK_SHADE, _, _, _],
      ]),
    },
  },
};

/* ------------------------------------------------------- the rest of the HQ */

export const NICK_FURY: Hero = {
  name: 'Nick Fury',
  look: {
    kind: 'person',
    skin: '#8f5d3c',
    hair: BLACK_HAIR,
    hairStyle: 'bald',
    eyepatch: true,
    headset: true,
    shirt: '#2a2a3a',
    trim: '#5d6b82',
    sleeves: BLACK,
    gloves: BLACK,
    pants: '#2a2a3a',
    cape: BLACK,
  },
};

export const KATE_BISHOP: Hero = {
  name: 'Kate Bishop',
  look: {
    kind: 'person',
    skin: FAIR_SKIN,
    hair: DARK_HAIR,
    hairStyle: 'long',
    shirt: PURPLE,
    trim: '#c9a8f0',
    gloves: BLACK,
    pants: '#2e2640',
    carry: { kind: 'bow', limbs: '#12101a', quiver: '#c9a8f0' },
  },
};

/* ------------------------------------------------------------- the rookies */

const SPIDER_BLUE = '#2a4fa8';
const B = SPIDER_BLUE;
const K = BLACK;

export const SPIDER_MAN: Hero = {
  name: 'Spider-Man',
  look: {
    kind: 'person',
    skin: CRIMSON,
    hair: CRIMSON,
    hairStyle: 'bald',
    headgear: { kind: 'mask', colour: '#c8282e', eyes: WHITE },
    shirt: '#c8282e',
    gloves: '#c8282e',
    pants: SPIDER_BLUE,
    boots: '#c8282e',
    emblem: {
      pixels: lowered(1, [
        [_, _, _, K, K, _, _, _],
        [B, _, K, K, K, K, _, B],
        [B, B, _, K, K, _, B, B],
        [B, B, _, _, _, _, B, B],
        [B, B, _, _, _, _, B, B],
        [B, B, _, _, _, _, B, B],
      ]),
    },
  },
};

export const MS_MARVEL: Hero = {
  name: 'Ms Marvel',
  look: {
    kind: 'person',
    skin: TAN_SKIN,
    hair: DARK_HAIR,
    hairStyle: 'long',
    glasses: true,
    shirt: '#2f6fc0',
    trim: CRIMSON,
    sleeves: CRIMSON,
    gloves: GOLD,
    pants: CRIMSON,
    boots: '#2f6fc0',
    emblem: {
      pixels: lowered(2, [
        [_, _, GOLD, GOLD],
        [_, GOLD, GOLD, _],
        [GOLD, GOLD, GOLD, GOLD],
        [_, GOLD, GOLD, _],
        [GOLD, GOLD, _, _],
      ]),
    },
  },
};

const MILES_RED = '#e0362f';

export const MILES_MORALES: Hero = {
  name: 'Miles Morales',
  look: {
    kind: 'person',
    skin: BLACK,
    hair: BLACK,
    hairStyle: 'bald',
    headgear: { kind: 'mask', colour: BLACK, eyes: WHITE },
    shirt: BLACK,
    gloves: MILES_RED,
    pants: BLACK,
    boots: MILES_RED,
    emblem: {
      pixels: lowered(1, [
        [_, MILES_RED, _, _, MILES_RED, _],
        [_, _, MILES_RED, MILES_RED, _, _],
        [MILES_RED, MILES_RED, MILES_RED, MILES_RED, MILES_RED, MILES_RED],
        [_, _, MILES_RED, MILES_RED, _, _],
        [_, MILES_RED, _, _, MILES_RED, _],
      ]),
    },
  },
};

/* --------------------------------------------------- the watch: the squads */

export const SCARLET_WITCH: Hero = {
  name: 'Scarlet Witch',
  look: {
    kind: 'person',
    skin: FAIR_SKIN,
    hair: '#8a3a22',
    hairStyle: 'long',
    shirt: '#a81f3a',
    gloves: '#ff7a9a',
    pants: '#3a1a26',
    boots: '#a81f3a',
    cape: '#7a1428',
  },
};

export const ANT_MAN: Hero = {
  name: 'Ant-Man',
  look: {
    kind: 'person',
    skin: BLACK,
    hair: BLACK,
    hairStyle: 'bald',
    headgear: { kind: 'helmet', shell: SILVER, face: '#5d6b82', eyes: '#ff5a4a' },
    shirt: CRIMSON,
    sleeves: BLACK,
    gloves: CRIMSON,
    pants: BLACK,
    boots: CRIMSON,
    emblem: {
      pixels: [
        [K, _, _, _, _, _, _, K],
        [K, K, _, _, _, _, K, K],
        [K, K, _, S, S, _, K, K],
        [K, K, K, _, _, K, K, K],
        [K, K, K, _, _, K, K, K],
      ],
    },
  },
};

export const STAR_LORD: Hero = {
  name: 'Star-Lord',
  look: {
    kind: 'person',
    skin: PALE_SKIN,
    hair: '#8a5a2c',
    hairStyle: 'short',
    headset: true,
    shirt: '#7a2a2e',
    tie: '#6f7f96',
    pants: '#2f3a52',
    boots: LEATHER,
  },
};

const Y = GOLD;

export const CAPTAIN_MARVEL: Hero = {
  name: 'Captain Marvel',
  look: {
    kind: 'person',
    skin: PALE_SKIN,
    hair: BLOND,
    hairStyle: 'long',
    shirt: '#1f4fa0',
    gloves: CRIMSON,
    pants: '#1f4fa0',
    boots: CRIMSON,
    emblem: {
      pixels: [
        [R, R, R, R, R, R, R, R],
        [R, R, R, Y, Y, R, R, R],
        [_, Y, Y, Y, Y, Y, Y, _],
        [_, _, _, Y, Y, _, _, _],
      ],
    },
  },
};

export const DOCTOR_STRANGE: Hero = {
  name: 'Doctor Strange',
  look: {
    kind: 'person',
    skin: PALE_SKIN,
    hair: DARK_HAIR,
    hairStyle: 'short',
    shirt: '#2a4a8c',
    pants: '#22335c',
    boots: LEATHER,
    cape: CRIMSON,
    emblem: {
      pixels: lowered(1, [[GOLD, GOLD]]),
      glow: '#5fcf7a',
    },
  },
};

export const WAR_MACHINE: Hero = {
  name: 'War Machine',
  look: {
    kind: 'person',
    skin: GUNMETAL,
    hair: GUNMETAL,
    hairStyle: 'bald',
    headgear: { kind: 'helmet', shell: '#5d6470', face: STEEL_GREY, eyes: '#ff5a4a' },
    shirt: GUNMETAL,
    sleeves: '#6b7280',
    gloves: GUNMETAL,
    pants: '#6b7280',
    boots: GUNMETAL,
    emblem: ARC_REACTOR,
  },
};

const V = '#c9a8f0';

export const BLACK_PANTHER: Hero = {
  name: 'Black Panther',
  look: {
    kind: 'person',
    skin: BLACK,
    hair: BLACK,
    hairStyle: 'bald',
    headgear: { kind: 'mask', colour: BLACK, eyes: '#d9e2ec' },
    shirt: BLACK,
    gloves: SILVER,
    pants: BLACK,
    boots: '#2e2640',
    emblem: {
      pixels: [
        [S, _, _, _, _, _, _, S],
        [_, S, _, _, _, _, S, _],
        [_, _, S, V, V, S, _, _],
        [],
        [_, V, _, _, _, _, V, _],
      ],
    },
  },
};

export const WINTER_SOLDIER: Hero = {
  name: 'Winter Soldier',
  look: {
    kind: 'person',
    skin: PALE_SKIN,
    hair: DARK_HAIR,
    hairStyle: 'long',
    shirt: '#232838',
    sleeves: SILVER,
    gloves: STEEL_GREY,
    pants: '#1a1e2a',
    emblem: { pixels: lowered(1, [[_, _, _, _, _, _, CRIMSON]]) },
  },
};

export const FALCON: Hero = {
  name: 'Falcon',
  look: {
    kind: 'person',
    skin: BROWN_SKIN,
    hair: BLACK_HAIR,
    hairStyle: 'short',
    glasses: true,
    shirt: CRIMSON,
    sleeves: STEEL_GREY,
    gloves: CRIMSON,
    pants: '#3a3f4a',
    boots: CRIMSON,
    cape: SILVER,
    emblem: {
      pixels: lowered(1, [
        [W, _, _, _, _, _, _, W],
        [W, W, _, _, _, _, W, W],
        [_, W, W, W, W, W, W, _],
      ]),
    },
  },
};

const VISION_GREEN = '#2f8f5b';

export const VISION: Hero = {
  name: 'Vision',
  look: {
    kind: 'person',
    skin: '#b02a3a',
    hair: VISION_GREEN,
    hairStyle: 'short',
    shirt: VISION_GREEN,
    gloves: GOLD,
    pants: VISION_GREEN,
    boots: GOLD,
    cape: GOLD,
    emblem: {
      pixels: lowered(1, [
        [_, _, Y, Y, _, _],
        [_, Y, _, _, Y, _],
        [Y, _, _, _, _, Y],
      ]),
    },
  },
};

export const GAMORA: Hero = {
  name: 'Gamora',
  look: {
    kind: 'person',
    skin: '#7cc47a',
    hair: '#6a1f4a',
    hairStyle: 'long',
    shirt: '#22222c',
    trim: '#5d6b82',
    sleeves: '#7cc47a',
    gloves: '#22222c',
    pants: '#22222c',
    boots: '#3a3f4a',
  },
};

const BARK = '#8a6442';
const LEAF = '#7fcf4a';

export const GROOT: Hero = {
  name: 'Groot',
  look: {
    kind: 'person',
    skin: BARK,
    hair: LEATHER,
    hairStyle: 'spiky',
    shirt: '#7a5636',
    pants: LEATHER,
    emblem: {
      pixels: [
        [_, _, _, _, _, _, LEAF],
        [_, LEATHER, _, _, _, _, _, _],
        [_, LEATHER, _, _, _, LEATHER, _, _],
        [_, _, _, _, _, LEATHER, _, _],
        [_, _, LEAF, _, _, _, _, _],
      ],
    },
  },
};

export const MOON_KNIGHT: Hero = {
  name: 'Moon Knight',
  look: {
    kind: 'person',
    skin: '#e6e9ef',
    hair: '#e6e9ef',
    hairStyle: 'bald',
    headgear: { kind: 'mask', colour: '#e6e9ef', eyes: '#8fe0ff' },
    shirt: '#e6e9ef',
    pants: '#c5ccd6',
    boots: STEEL_GREY,
    cape: '#c5ccd6',
    emblem: {
      pixels: lowered(1, [
        [_, _, Y, Y, _],
        [_, Y, _, _, _],
        [_, Y, _, _, _],
        [_, _, Y, Y, _],
      ]),
    },
  },
};

export const NEBULA: Hero = {
  name: 'Nebula',
  look: {
    kind: 'person',
    skin: '#5a7fd0',
    hair: '#3a3f8a',
    hairStyle: 'bald',
    shirt: '#5a2a52',
    trim: '#3a3f8a',
    sleeves: STEEL_GREY,
    gloves: '#5a7fd0',
    pants: '#3a1f3a',
    boots: '#2a2533',
  },
};

export const VALKYRIE: Hero = {
  name: 'Valkyrie',
  look: {
    kind: 'person',
    skin: BROWN_SKIN,
    hair: BLACK_HAIR,
    hairStyle: 'bun',
    shirt: '#dfe5ee',
    trim: GOLD,
    sleeves: BLACK,
    gloves: '#dfe5ee',
    pants: BLACK,
    boots: '#dfe5ee',
    cape: '#3f8fd0',
  },
};

/* ---------------------------------------------------------------- founders */

/** Paul in the Stark role: the Office's Paul with the reactor on his chest. */
export const PAUL_LOOK: PersonLook = { ...OFFICE_PAUL_LOOK, emblem: ARC_REACTOR };

/** Dhruv in the Rhodes role: the Office's Dhruv, green and gold, with the same reactor. */
export const DHRUV_LOOK: PersonLook = { ...OFFICE_DHRUV_LOOK, emblem: ARC_REACTOR };

/* ------------------------------------------------------------------ rosters */

/** Who holds each Part (docs/design/hq-theme.md, section 14). The two guards are the two Tunnel replicas. */
export const POSTS = {
  greeter: NICK_FURY,
  guards: [HAWKEYE, KATE_BISHOP],
  checker: BLACK_WIDOW,
  courier: THOR,
  keeper: HULK,
  wrangler: CAPTAIN_AMERICA,
} as const;

export const ROOKIES = [SPIDER_MAN, MS_MARVEL, MILES_MORALES] as const;

/** A client's squad on the ops floor, leader first: the leader takes the client's most senior environment. */
export const SQUADS = {
  scrd: [IRON_MAN, SCARLET_WITCH, ANT_MAN, STAR_LORD],
  bsra: [CAPTAIN_MARVEL, DOCTOR_STRANGE, WAR_MACHINE],
  'forms-api': [BLACK_PANTHER, WINTER_SOLDIER, FALCON],
  'lab-test': [VISION, GAMORA, GROOT],
} as const;

/** The squad for a client the HQ does not know. */
export const RESERVES = [MOON_KNIGHT, NEBULA, VALKYRIE] as const;

/** Everyone, in the order of the look sheet. */
export const HEROES: readonly Hero[] = [
  IRON_MAN,
  CAPTAIN_AMERICA,
  THOR,
  HAWKEYE,
  BLACK_WIDOW,
  HULK,
  NICK_FURY,
  KATE_BISHOP,
  ...ROOKIES,
  ...SQUADS.scrd.slice(1),
  ...SQUADS.bsra,
  ...SQUADS['forms-api'],
  ...SQUADS['lab-test'],
  ...RESERVES,
  { name: 'Paul', look: PAUL_LOOK },
  { name: 'Dhruv', look: DHRUV_LOOK },
];
