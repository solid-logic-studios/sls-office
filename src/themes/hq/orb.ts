import type { Painter } from '../../contract/painter.ts';
import type { StageView } from '../../contract/theme.ts';
import { jarvisSpeech } from './jarvis-speech.ts';
import { podCount, type JarvisState } from './jarvis-state.ts';
import { TAU, disc, dot, orbitPoint, wave, type Orbit } from './kit.ts';
import { ALARM, AMBER, CYAN, ROOMS } from './palette.ts';

/**
 * The JARVIS orb: a glowing amber globe of filaments and drifting nodes with a ring around it. Original pixel art,
 * drawn from rectangles and animated from `stage.now` alone, so a paused HQ holds still.
 *
 * What JARVIS is attending to (`jarvisState`) sets its colour, pace and company:
 * - `idle`: a slow breath and a lazy ring.
 * - `deploy`: a second, counter-turning ring and packets streaming up off the top.
 * - `ci`: one satellite per running pod, circling in the rookies' teal.
 * - `backup`: a cyan ring and an uplink streaming out towards the jet apron.
 * - `alarm`: the whole orb turns red, pulses fast and throws spikes.
 * - `night`: dimmed to an ember, breathing slowly, most of its nodes dark.
 * - `waking`: an ember whose nodes assemble while the first Snapshot is awaited.
 * While the readout is typing a line, the white core flickers like a voice.
 */

/** Where the orb floats and how big it is. The same art serves the wide HQ and the phone Spire. */
export interface OrbSpec {
  cx: number;
  cy: number;
  r: number;
}

/** How far from its centre the orb ever paints, halo, rings and satellites included. */
export const orbReach = (r: number): number => r + 9;

interface OrbStyle {
  /** The sphere, outside in. */
  rim: string;
  body: string;
  glow: string;
  core: string;
  white: string;
  /** Nodes on the near side, and on the far side showing through. */
  node: string;
  shade: string;
  ring: string;
  halo: string;
  /** Seconds per breath. */
  breath: number;
  /** Radians a second the nodes drift round. */
  spin: number;
  /** Overall brightness, 0 to 1. */
  level: number;
  /** The share of the nodes that are lit, 0 to 1. */
  lattice: number;
  /** The nodes shake in place: the alarm. */
  jitter: boolean;
}

const CALM: OrbStyle = {
  rim: AMBER.rim,
  body: AMBER.base,
  glow: AMBER.glow,
  core: AMBER.hot,
  white: AMBER.white,
  node: AMBER.white,
  shade: AMBER.rim,
  ring: AMBER.hot,
  halo: AMBER.base,
  breath: 3.2,
  spin: 0.5,
  level: 1,
  lattice: 1,
  jitter: false,
};

const STYLES: Readonly<Record<JarvisState, OrbStyle>> = {
  idle: CALM,
  deploy: { ...CALM, ring: AMBER.white, breath: 1.2, spin: 1.6 },
  ci: { ...CALM, breath: 2, spin: 1 },
  backup: { ...CALM, ring: CYAN.bright, breath: 2.4, spin: 0.8 },
  night: { ...CALM, breath: 6, spin: 0.2, level: 0.6, lattice: 0.4 },
  waking: { ...CALM, body: AMBER.ember, glow: AMBER.rim, core: AMBER.base, white: AMBER.glow, breath: 2, level: 0.8 },
  alarm: {
    rim: ALARM.deep,
    body: ALARM.dark,
    glow: ALARM.base,
    core: ALARM.light,
    white: ALARM.white,
    node: ALARM.white,
    shade: ALARM.deep,
    ring: ALARM.light,
    halo: ALARM.base,
    breath: 0.7,
    spin: 2.4,
    level: 1,
    lattice: 1,
    jitter: true,
  },
};

/** Something small circling the orb: a ring's dot or a satellite. */
interface Mote {
  x: number;
  y: number;
  front: boolean;
  colour: string;
  size: number;
}

/** The golden angle: successive nodes land evenly over the sphere. */
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
/** The sphere leans towards the viewer, so the nodes drift in arcs, not straight lines. */
const LEAN = 0.4;
const SATELLITE = ROOMS.rookieBay.accent;
const MAX_SATELLITES = 5;
/** How long the nodes take to assemble while waking. */
const ASSEMBLE_SECONDS = 4;

/** A dotted ring: bright where it passes in front of the orb, dim behind, with a three-dot comet leading it. */
function ringMotes(orbit: Orbit, turn: number, style: OrbStyle): Mote[] {
  const dots = Math.round(orbit.radius * 2.2);
  return Array.from({ length: dots }, (_, k) => {
    const point = orbitPoint(orbit, (k / dots) * TAU + turn);
    const colour = k < 3 ? style.white : point.front ? style.ring : style.rim;
    return { ...point, colour, size: k === 0 ? 2 : 1 };
  });
}

/** One satellite per pod, each with a dot trailing it. */
function satelliteMotes(count: number, now: number, r: number): Mote[] {
  const orbit: Orbit = { radius: r + 7, squash: 0.42, tilt: 0.12 };
  return Array.from({ length: count }, (_, i) => now * 2.2 + (i * TAU) / count).flatMap((a) => [
    { ...orbitPoint(orbit, a - 0.3), colour: SATELLITE, size: 1 },
    { ...orbitPoint(orbit, a), colour: SATELLITE, size: 2 },
  ]);
}

function motesFor(state: JarvisState, style: OrbStyle, stage: StageView, r: number): Mote[] {
  const { now } = stage;
  const motes = ringMotes({ radius: r + 5, squash: 0.3, tilt: -0.38 }, now * style.spin * 1.5, style);
  if (state === 'deploy') motes.push(...ringMotes({ radius: r + 3, squash: 0.35, tilt: 0.6 }, -now * 3, style));
  if (state === 'ci') motes.push(...satelliteMotes(Math.min(MAX_SATELLITES, podCount(stage.vms)), now, r));
  return motes;
}

function paintMotes(painter: Painter, { cx, cy }: OrbSpec, motes: readonly Mote[], front: boolean): void {
  for (const mote of motes) {
    if (mote.front === front) dot(painter, mote.colour, cx + mote.x, cy + mote.y, mote.size);
  }
}

function paintHalo(painter: Painter, { cx, cy, r }: OrbSpec, colour: string, breath: number): void {
  painter.withAlpha(0.08 + 0.06 * breath, () => disc(painter, colour, cx, cy, r + 6));
  painter.withAlpha(0.14 + 0.1 * breath, () => disc(painter, colour, cx, cy, r + 3));
}

/** The sphere: a dark rim, the body, a glow sitting a touch up and left, and the hot core that breathes. */
function paintBody(painter: Painter, { cx, cy, r }: OrbSpec, style: OrbStyle, breath: number, voiced: boolean): void {
  disc(painter, style.rim, cx, cy, r);
  disc(painter, style.body, cx, cy, r - 1);
  disc(painter, style.glow, cx - 1, cy - 1, Math.round(r * 0.7));
  disc(painter, style.core, cx, cy, Math.round(r * (0.4 + 0.12 * breath)));
  disc(painter, style.white, cx, cy, Math.round(r * 0.18) + (voiced ? 1 : 0));
}

/** The nodes: points spread evenly over a leaning sphere that turns about its upright axis. */
function paintLattice(painter: Painter, { cx, cy, r }: OrbSpec, style: OrbStyle, now: number, share: number): void {
  const count = Math.round(r * 2.4);
  const lit = Math.ceil(count * share);
  for (const near of [false, true]) {
    for (let i = 0; i < count; i++) {
      if ((i * 7) % count >= lit) continue;
      const up = 1 - (2 * (i + 0.5)) / count;
      const band = Math.sqrt(1 - up * up);
      const a = i * GOLDEN + now * style.spin;
      const depth = up * Math.sin(LEAN) + band * Math.sin(a) * Math.cos(LEAN);
      if (depth > 0 !== near) continue;
      const y = up * Math.cos(LEAN) - band * Math.sin(a) * Math.sin(LEAN);
      const shake = style.jitter ? (Math.floor(now * 10 + i * 1.3) % 3) - 1 : 0;
      dot(painter, near ? style.node : style.shade, cx + band * Math.cos(a) * (r - 2) + shake, cy - y * (r - 2));
    }
  }
}

/** How many great circles are traced over the sphere. They turn with the nodes, so the orb reads as a globe. */
const MERIDIANS = 3;

/** The near half of each great circle, drawn faintly: the filaments the nodes hang on. */
function paintMeridians(painter: Painter, { cx, cy, r }: OrbSpec, style: OrbStyle, now: number): void {
  const reach = r - 2;
  const steps = Math.round(reach * 4);
  painter.withAlpha(0.45, () => {
    for (let m = 0; m < MERIDIANS; m++) {
      const turn = now * style.spin + (m * Math.PI) / MERIDIANS;
      for (let k = 0; k < steps; k++) {
        const along = (k / steps) * TAU;
        const [side, up] = [Math.sin(along), Math.cos(along)];
        const depth = up * Math.sin(LEAN) + side * Math.sin(turn) * Math.cos(LEAN);
        if (depth <= 0) continue;
        const y = up * Math.cos(LEAN) - side * Math.sin(turn) * Math.sin(LEAN);
        dot(painter, style.core, cx + side * Math.cos(turn) * reach, cy - y * reach);
      }
    }
  });
}

/** Packets streaming up off the top of the orb: a deploy on its way out. */
function paintPackets(painter: Painter, { cx, cy, r }: OrbSpec, now: number): void {
  for (let i = 0; i < 5; i++) {
    const rise = Math.floor((now * 14 + i * 3.7) % 8);
    painter.rect(AMBER.hot, cx - 6 + i * 3, cy - r - 1 - rise, 1, 2);
  }
}

/** Eight short rays that flare and shrink: the alarm. */
function paintSpikes(painter: Painter, { cx, cy, r }: OrbSpec, now: number): void {
  for (let k = 0; k < 8; k++) {
    const a = (k * TAU) / 8 + now * 0.6;
    const length = 2 + (Math.floor(now * 6 + k * 1.7) % 3);
    for (let d = 1; d <= length; d++) {
      dot(painter, ALARM.light, cx + Math.cos(a) * (r + 1 + d), cy + Math.sin(a) * (r + 1 + d));
    }
  }
}

/** Dots streaming out to the right, towards the jet apron: the backup leaving. */
function paintUplink(painter: Painter, { cx, cy, r }: OrbSpec, now: number): void {
  for (let i = 0; i < 4; i++) {
    const out = Math.floor((now * 18 + i * 1.75) % 7);
    painter.rect(CYAN.bright, cx + r + 2 + out, cy - 1 + (i % 2) * 2, 1, 1);
  }
}

export function paintOrb(painter: Painter, stage: StageView, orb: OrbSpec): void {
  const { state, speaking } = jarvisSpeech(stage);
  const style = STYLES[state];
  const { now } = stage;
  const breath = wave(now, style.breath);
  const voiced = speaking && Math.floor(now * 9) % 2 === 0;
  const share = state === 'waking' ? (now % ASSEMBLE_SECONDS) / ASSEMBLE_SECONDS : style.lattice;
  const motes = motesFor(state, style, stage, orb.r);
  painter.withAlpha(style.level, () => {
    paintHalo(painter, orb, style.halo, breath);
    paintMotes(painter, orb, motes, false);
    paintBody(painter, orb, style, breath, voiced);
    if (state !== 'waking') paintMeridians(painter, orb, style, now);
    paintLattice(painter, orb, style, now, share);
    paintMotes(painter, orb, motes, true);
    if (state === 'deploy') paintPackets(painter, orb, now);
    if (state === 'alarm') paintSpikes(painter, orb, now);
    if (state === 'backup') paintUplink(painter, orb, now);
  });
}
