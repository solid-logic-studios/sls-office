import type { HairStyle, PersonLook } from '../../contract/theme.ts';
import type { SiteEnv } from '../../contract/snapshot.ts';
import { hashOf, pick } from '../shared/hash.ts';
import { CLIENT_COLOURS, HAIRS, PANTS, PAPER, PRODUCTION_SHIRT, SKINS, SPARE_CLIENT_COLOURS } from './palette.ts';

/** Display name and desk colour for the clients the lab knows. */
interface ClientStyle {
  name: string;
  colour: string;
}

const KNOWN_CLIENTS: ReadonlyMap<string, ClientStyle> = new Map([
  ['scrd', { name: 'SCRD', colour: CLIENT_COLOURS.scrd }],
  ['bsra', { name: 'BSRA', colour: CLIENT_COLOURS.bsra }],
  ['forms-api', { name: 'Forms API', colour: CLIENT_COLOURS.formsApi }],
  ['lab-test', { name: 'Lab Test', colour: CLIENT_COLOURS.labTest }],
]);

export function clientStyle(client: string): ClientStyle {
  return KNOWN_CLIENTS.get(client) ?? { name: client, colour: pick(SPARE_CLIENT_COLOURS, hashOf(client)) };
}

/** The hair styles a face can have. */
export const FACE_STYLES = [
  'short',
  'long',
  'bun',
  'spiky',
  'short',
  'long',
  'bald',
] as const satisfies readonly HairStyle[];
const POD_STYLES = ['spiky', 'short', 'long', 'bun'] as const satisfies readonly HairStyle[];

/** The features that change when a workload is replaced: skin, hair and hair style. */
export function face(h: number): Pick<PersonLook, 'skin' | 'hair' | 'hairStyle'> {
  return { skin: pick(SKINS, h, 1), hair: pick(HAIRS, h, 2), hairStyle: pick(FACE_STYLES, h, 3) };
}

/** A site-instance worker: client-coloured shirt; production wears dark with a tie and a light trim. */
export function workerLook(client: string, env: SiteEnv, workloadId: string, generation: number): PersonLook {
  const { colour } = clientStyle(client);
  const base: PersonLook = {
    kind: 'person',
    ...face(hashOf(`${workloadId}#${generation}`)),
    shirt: colour,
    pants: PANTS,
  };
  return env === 'production' ? { ...base, shirt: PRODUCTION_SHIRT, tie: colour, trim: PAPER } : base;
}

export function podLook(workloadId: string): PersonLook {
  const h = hashOf(workloadId);
  return {
    kind: 'person',
    skin: pick(SKINS, h, 1),
    hair: pick(HAIRS, h, 2),
    hairStyle: pick(POD_STYLES, h, 3),
    shirt: '#eef0ff',
    tie: '#e0563f',
    pants: '#566676',
  };
}

export const GREETER_LOOK: PersonLook = {
  kind: 'person',
  skin: SKINS[1],
  hair: HAIRS[4],
  hairStyle: 'bun',
  shirt: '#37abc8',
  pants: PANTS,
  headset: true,
};

export function guardLook(name: string): PersonLook {
  const h = hashOf(name);
  return {
    kind: 'person',
    skin: pick(SKINS, h, 1),
    hair: pick(HAIRS, h, 2),
    hairStyle: 'cap',
    cap: '#f38020',
    shirt: '#f38020',
    pants: '#2a2533',
  };
}

export const CHECKER_LOOK: PersonLook = {
  kind: 'person',
  skin: SKINS[2],
  hair: HAIRS[5],
  hairStyle: 'short',
  shirt: '#4aa86b',
  pants: PANTS,
  glasses: true,
  carry: 'clipboard',
};

export const KEEPER_LOOK: PersonLook = {
  kind: 'person',
  skin: SKINS[5],
  hair: HAIRS[6],
  hairStyle: 'bun',
  shirt: '#7a5a8a',
  pants: '#4a4f5c',
  glasses: true,
};

export const COURIER_LOOK: PersonLook = {
  kind: 'person',
  skin: SKINS[1],
  hair: HAIRS[1],
  hairStyle: 'hardhat',
  shirt: '#e07a2f',
  vest: '#f2c230',
  pants: '#39424d',
};

export const WRANGLER_LOOK: PersonLook = {
  kind: 'person',
  skin: SKINS[4],
  hair: HAIRS[0],
  hairStyle: 'short',
  shirt: '#3b3350',
  tie: '#7df0c0',
  pants: '#2a2533',
  carry: 'tablet',
};

export const PAUL_LOOK: PersonLook = {
  kind: 'person',
  skin: '#f0c5a0',
  hair: '#857a6c',
  hairStyle: 'thin',
  shirt: '#35507a',
  pants: '#4a4f5c',
  wide: true,
};

export const DHRUV_LOOK: PersonLook = {
  kind: 'person',
  skin: '#b07a4e',
  hair: '#17131a',
  hairStyle: 'short',
  shirt: '#2f8f5b',
  trim: '#f2c230',
  pants: PANTS,
};

/** A passer-by: grey clothes, face chosen by `seed` (0 to 1). */
export function visitorLook(seed: number): PersonLook {
  const i = Math.min(SKINS.length - 1, Math.max(0, Math.floor(seed * SKINS.length)));
  return {
    kind: 'person',
    skin: SKINS[i] ?? SKINS[0],
    hair: HAIRS[(i + 3) % HAIRS.length] ?? HAIRS[0],
    hairStyle: FACE_STYLES[i] ?? 'short',
    shirt: '#9aa5b5',
    pants: '#6a7484',
  };
}
