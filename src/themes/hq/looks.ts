import type { HairStyle, PersonLook, BoxLook } from '../../contract/theme.ts';
import type { SiteEnv } from '../../contract/snapshot.ts';
import { PAUL_LOOK as OFFICE_PAUL_LOOK, clientStyle } from '../office/looks.ts';
import { HAIRS, SKINS } from '../office/palette.ts';
import { hashOf, pick } from '../shared/hash.ts';
import { AMBER, PAPER, STEEL } from './palette.ts';

/** The Office's clients, Dhruv and citizens carry over unchanged, so a client is one colour in every Theme. */
export { DHRUV_LOOK, clientStyle, visitorLook } from '../office/looks.ts';

/** The suit's legs: every sworn hero wears the same dark pants. */
const SUIT_PANTS = '#232a3d';
/** A veteran's suit: production heroes wear this with their client's colour on the chest. */
const VETERAN_SUIT = '#1d2740';
const GOLD = '#e2b84a';

/** The faces a hero or a rookie can wear. */
const FACE_STYLES = ['short', 'long', 'bun', 'spiky', 'short', 'long', 'bald'] as const satisfies readonly HairStyle[];
const ROOKIE_STYLES = ['spiky', 'short', 'long', 'bun'] as const satisfies readonly HairStyle[];

/**
 * The squad codenames. A hero's is picked by the hash of its workload id, so it survives a deploy: the
 * next mark is a new face under the same codename.
 */
export const CODENAMES = [
  'UPTIME',
  'FAILOVER',
  'HOTFIX',
  'ROLLOUT',
  'DEBOUNCE',
  'BACKOFF',
  'KEEPALIVE',
  'ROLLBACK',
  'HANDSHAKE',
  'HEARTBEAT',
  'LOADOUT',
  'WARMUP',
  'CUTOVER',
  'FALLBACK',
  'REDLINE',
  'GREENLIGHT',
] as const;

export function codename(workloadId: string): string {
  return pick(CODENAMES, hashOf(workloadId));
}

/** The features that change when a workload is replaced: skin, hair and hair style. */
function face(h: number): Pick<PersonLook, 'skin' | 'hair' | 'hairStyle'> {
  return { skin: pick(SKINS, h, 1), hair: pick(HAIRS, h, 2), hairStyle: pick(FACE_STYLES, h, 3) };
}

/**
 * A hero on watch: the suit in the squad (client) colour and always masked. Staging adds a steel collar;
 * production is a veteran in a dark suit with a gold collar and the client's colour as the chest stripe.
 * The face follows the generation, so a deploy brings the hero's next mark.
 */
export function workerLook(client: string, env: SiteEnv, workloadId: string, generation: number): PersonLook {
  const { colour } = clientStyle(client);
  const base: PersonLook = {
    kind: 'person',
    ...face(hashOf(`${workloadId}#${generation}`)),
    shirt: colour,
    pants: SUIT_PANTS,
    glasses: true,
  };
  if (env === 'production') return { ...base, shirt: VETERAN_SUIT, tie: colour, trim: GOLD };
  if (env === 'staging') return { ...base, trim: STEEL.shine };
  return base;
}

/** A rookie: a pale suit with a red stripe, and no mask yet. */
export function rookieLook(workloadId: string): PersonLook {
  const h = hashOf(workloadId);
  return {
    kind: 'person',
    skin: pick(SKINS, h, 1),
    hair: pick(HAIRS, h, 2),
    hairStyle: pick(ROOKIE_STYLES, h, 3),
    shirt: '#eef0ff',
    tie: '#e0563f',
    pants: '#566676',
  };
}

export const SWITCHBOARD_LOOK: PersonLook = {
  kind: 'person',
  skin: SKINS[1],
  hair: HAIRS[4],
  hairStyle: 'bun',
  shirt: '#37abc8',
  trim: PAPER,
  pants: SUIT_PANTS,
  glasses: true,
  headset: true,
};

/** A Tunnel Twin: skin and hair by the name, so Ping and Pong are not clones. */
export function tunnelTwinLook(name: string): PersonLook {
  const h = hashOf(name);
  return {
    kind: 'person',
    skin: pick(SKINS, h, 1),
    hair: pick(HAIRS, h, 2),
    hairStyle: 'cap',
    cap: '#f38020',
    shirt: '#f38020',
    pants: SUIT_PANTS,
    glasses: true,
    wide: true,
  };
}

export const VITALS_LOOK: PersonLook = {
  kind: 'person',
  skin: SKINS[2],
  hair: HAIRS[5],
  hairStyle: 'short',
  shirt: PAPER,
  tie: '#4aa86b',
  pants: '#2f6b47',
  glasses: true,
  carry: 'clipboard',
};

export const LEDGER_LOOK: PersonLook = {
  kind: 'person',
  skin: SKINS[5],
  hair: HAIRS[6],
  hairStyle: 'bun',
  shirt: '#7a5a8a',
  trim: GOLD,
  pants: '#3a3350',
  glasses: true,
};

export const PAYLOAD_LOOK: PersonLook = {
  kind: 'person',
  skin: SKINS[1],
  hair: HAIRS[1],
  hairStyle: 'hardhat',
  shirt: '#39424d',
  vest: '#f2c230',
  pants: SUIT_PANTS,
  glasses: true,
};

export const MUSTER_LOOK: PersonLook = {
  kind: 'person',
  skin: SKINS[4],
  hair: HAIRS[0],
  hairStyle: 'short',
  shirt: '#3b3350',
  tie: '#7df0c0',
  trim: '#7df0c0',
  pants: SUIT_PANTS,
  glasses: true,
  carry: 'tablet',
};

/** The Office's Paul with a gold collar; founders do not wear the mask. */
export const PAUL_LOOK: PersonLook = { ...OFFICE_PAUL_LOOK, trim: GOLD };

/** JARVIS out on the floor: a small amber remote. */
export const JARVIS_LOOK: BoxLook = { kind: 'box', colour: AMBER.glow, w: 8, h: 8 };
