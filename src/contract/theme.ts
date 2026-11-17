/**
 * Theme contract: what a Theme gives the Engine.
 *
 * A Theme supplies places, looks, words and set dressing. It never supplies behaviour: the Engine
 * owns moods, walking, scenes, bubbles and tooltips, and it must not import a Theme. A new Theme is
 * a new module that implements `Theme`; it needs no Engine change (ADR 0003).
 *
 * All coordinates are art pixels on a `layout.width` by `layout.height` stage, y growing downwards.
 * All on-screen text is Australian English with no em-dashes.
 */

import type { Findings, Host, Vm, VmRole, Workload } from './snapshot.ts';
import type { Painter } from './painter.ts';

/* ---------------------------------------------------------------- vocabulary */

/** A character's state, derived by the Engine from up/down, CPU, memory and health. */
export type Mood = 'break' | 'working' | 'stressed' | 'swamped' | 'fainted' | 'absent';

/**
 * The part a character plays. The Engine owns one behaviour per part; the Theme decides who plays it.
 * - `worker`: sits at a desk and takes a break when idle.
 * - `pod`: single use. Runs in, works flat out, vanishes.
 * - `greeter`: stays at the front desk and greets visitors.
 * - `guard`: stands at the entrance.
 * - `checker`: walks rounds of the workers, and runs the health check in a deploy.
 * - `keeper`: keeps the records, answers queries and does the vault run.
 * - `courier`: delivers the new worker in a deploy.
 * - `wrangler`: minds the pods.
 * - `founder`: wanders between a desk, the break spots and the workers.
 */
export type Part = 'worker' | 'pod' | 'greeter' | 'guard' | 'checker' | 'keeper' | 'courier' | 'wrangler' | 'founder';

/** A fixed moment in a scene where a character speaks. The Engine picks one line at random. */
export type Cue =
  | 'delivery'
  | 'new-arrival'
  | 'health-check'
  | 'healthy'
  | 'unhealthy'
  | 'old-one-out'
  | 'sent-home'
  | 'still-serving'
  | 'backup-start'
  | 'backup-locked'
  | 'backup-safe'
  | 'backup-failed'
  | 'pods-up'
  | 'pod-done'
  | 'recovered'
  | 'query'
  | 'query-answer'
  | 'visitor'
  | 'greet'
  | 'check-in-reply'
  | 'check-in-reply-busy'
  | 'alarm';

/** What a character is doing in a scene, shown as its tooltip status in place of its mood. */
export type SceneStatus = 'new-arrival' | 'leaving' | 'delivering' | 'backing-up' | 'visiting';

export type Severity = 'ok' | 'warn' | 'crit';

/* ------------------------------------------------------------------ geometry */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A point on a floor's walk line. */
export interface Spot {
  x: number;
  /** Index into `layout.floors`. */
  floor: number;
}

/**
 * One storey. Characters walk along `walkY` (the Engine lifts each one by a small lane offset for
 * depth) and never leave `minX` to `maxX`. The Theme paints a doorway wherever that span crosses a
 * wall, so nobody walks through one.
 */
export interface Floor {
  walkY: number;
  minX: number;
  maxX: number;
}

/* -------------------------------------------------------------------- places */

/** Who a character or place stands for. */
export type LabSubject = { kind: 'vm'; vm: Vm } | { kind: 'workload'; vm: Vm; workload: Workload };
export type Subject = LabSubject | { kind: 'founder'; founder: Founder };

export interface Occupant {
  subject: Subject;
  mood: Mood;
  /** True while the character is at this place, not away on a break, in transit or absent. */
  atSeat: boolean;
}

/** What a Theme can read while it paints: the lab state plus a few facts about the stage. */
export interface StageView {
  /** Seconds of animation time. Stops while the Office is paused. */
  now: number;
  /** Local time of day, 0 to 24. */
  hour: number;
  /** `null` until the first Snapshot arrives. */
  host: Host | null;
  vms: readonly Vm[];
  findings: Findings;
  liftInUse: boolean;
  vaultOpen: boolean;
  /** Indexes into `layout.stores` that the keeper has open right now. */
  openStores: ReadonlySet<number>;
  /** Indexes into `layout.breakSpots` whose taker has arrived. */
  busyBreakSpots: ReadonlySet<number>;
}

export interface PlaceView {
  place: Place;
  /** `null` when nobody is assigned to the place. */
  occupant: Occupant | null;
  stage: StageView;
}

export type PlaceArt = (painter: Painter, view: PlaceView) => void;

/**
 * A piece of furniture one character calls home: a desk, a post, a pod bench.
 * The Engine depth-sorts places and characters by their base line, and treats the box from
 * `baseY - h` to `baseY` as the hover target for the occupant.
 */
export interface Place {
  x: number;
  w: number;
  h: number;
  baseY: number;
  floor: number;
  /** Where the occupant goes. With `y` it sits there (behind the furniture); without, it stands on the walk line. */
  seat: { x: number; y?: number };
  art: PlaceArt;
}

export interface Room extends Rect {
  /** Tooltip text for the VM this room stands for. */
  blurb: string;
}

export interface BreakSpot extends Spot {
  /** Key into `LineBank.breakSpot`. */
  kind: string;
  /** Set when the taker sits down here. */
  sitY?: number;
}

export interface Layout {
  width: number;
  height: number;
  /** Bottom storey first. */
  floors: readonly Floor[];
  /** The x of the lift that joins every floor. */
  liftX: number;
  /** Just off stage: visitors arrive from here and leavers go back to it. */
  entrance: Spot;
  /** Dimmed and marked offline while its VM is down; hovering it shows the VM. */
  rooms: Record<VmRole, Room>;
  /** Homes for each part, in the order characters are assigned. A character with no home left is not drawn. */
  homes: Record<Part, readonly Place[]>;
  breakSpots: readonly BreakSpot[];
  /** Where the keeper fetches records: one per `engine` workload, in Snapshot order. */
  stores: readonly Spot[];
  /** Where the keeper hands the backup over. */
  vault: Spot;
  /** Where a pod appears before it runs to its home. */
  podSpawn: Spot;
}

/* --------------------------------------------------------------------- looks */

export type HairStyle = 'short' | 'long' | 'bun' | 'spiky' | 'bald' | 'thin' | 'cap' | 'hardhat';

/** A person drawn by the Engine's one sprite renderer. Every colour is a CSS colour. */
export interface PersonLook {
  kind: 'person';
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  shirt: string;
  pants: string;
  tie?: string;
  trim?: string;
  vest?: string;
  /** Colour of the cap, for `hairStyle: 'cap'`. */
  cap?: string;
  glasses?: boolean;
  headset?: boolean;
  /** A broader build. */
  wide?: boolean;
  /** Something always in hand. */
  carry?: 'clipboard' | 'tablet';
}

/** A plain coloured box, for a Theme with no art. */
export interface BoxLook {
  kind: 'box';
  colour: string;
  w: number;
  h: number;
}

export type Look = PersonLook | BoxLook;

export interface Casting {
  part: Exclude<Part, 'founder'>;
  look: Look;
  /** Tooltip text: who this is in the lab. */
  blurb: string;
}

/** A person who is not in the Snapshot and is always in the Office. */
export interface Founder {
  id: string;
  name: string;
  blurb: string;
  look: Look;
  lines: {
    idle: readonly string[];
    /** Said to a worker on a check-in. */
    checkIn: readonly string[];
    /** Said while there is a critical finding. */
    alarm: readonly string[];
  };
}

/* --------------------------------------------------------------------- words */

export interface LineBank {
  /** Tooltip status for a character. */
  status: Record<Mood | SceneStatus, string>;
  /** Label drawn across a room whose VM is down. */
  offline: string;
  /** Idle chatter from workers, by mood. */
  mood: Partial<Record<Mood, readonly string[]>>;
  /** Idle chatter from everyone else, by part. */
  part: Partial<Record<Part, readonly string[]>>;
  /** Chatter at a break spot, by `BreakSpot.kind`. */
  breakSpot: Readonly<Record<string, readonly string[]>>;
  cue: Record<Cue, readonly string[]>;
}

/* ----------------------------------------------------------------- dressing */

export type DecorFn = (painter: Painter, stage: StageView) => void;

/** Set dressing that is depth-sorted with the places and characters by its base line (a couch, a pillar). */
export interface Prop {
  baseY: number;
  draw: DecorFn;
}

export interface Tip {
  title: string;
  detail: string;
  cpu?: number;
  mem?: number;
  status: string;
  severity: Severity;
}

/** A bit of set dressing that explains itself on hover. */
export interface Hotspot {
  rect: Rect;
  tip(stage: StageView): Tip;
}

export interface LegendEntry {
  colour: string;
  label: string;
}

/* --------------------------------------------------------------------- sound */

export type Wave = 'square' | 'triangle' | 'sawtooth' | 'sine' | 'noise';

/** One synthesised note. Times are in seconds, frequencies in Hz and volume is 0 to 1. */
export interface SynthNote {
  wave: Wave;
  /** The pitch at the start of the note; it glides to `endHz` over the note. */
  startHz: number;
  endHz: number;
  /** Seconds to rise to full volume. */
  attack: number;
  /** Seconds held at full volume. */
  sustain: number;
  /** Seconds to fade out. */
  decay: number;
  volume: number;
  /** Silence after this note before the next. */
  gap?: number;
}

/** A sound made from notes played one after another. No audio files (ADR 0004). */
export interface SynthSound {
  notes: readonly SynthNote[];
}

/**
 * The stage happenings that have a sound effect, one per bus event (and deploy or backup phase) worth
 * hearing. A rolled-back deploy and a failed backup are Alarms, not effects. The last four are easter eggs:
 * `snore` (a fainted character sleeping it off), `streak` (a milestone of days with no Alarm), `smoko` (morning
 * tea at 10:30) and `hatTrick` (three healthy deploys in a row).
 */
export type EffectName =
  | 'deployStarted'
  | 'deployHealthy'
  | 'paper'
  | 'visitor'
  | 'checkIn'
  | 'workloadAdded'
  | 'workloadRemoved'
  | 'backupStarted'
  | 'backupFinished'
  | 'snore'
  | 'streak'
  | 'smoko'
  | 'hatTrick';

/**
 * The continuous background of a busy lab (ADR 0004): room tone, a server hum that rises with load and
 * keyboard clatter that rises with the workers' moods. Volumes are 0 to 1.
 */
export interface AmbientBed {
  /** A steady low wash of noise, darkened by a low-pass filter. */
  room: { volume: number; lowpassHz: number };
  /** A drone at `hz` whose volume moves from `idle` (no load) to `busy` (every VM flat out). */
  hum: { wave: Exclude<Wave, 'noise'>; hz: number; idle: number; busy: number };
  /** Key presses: `key` plays at random, from `calm` to `frantic` presses a second as the workers get busier. */
  clatter: { key: SynthSound; calm: number; frantic: number };
}

/**
 * A pre-rendered Piper voice for a Voice (ADR 0004). The image renders each line a Voice can say once at
 * build time; a Voice without one is never rendered and always uses `speechSynthesis`.
 *
 * A clip is rendered at the model's own pace scaled by the Voice's `rate` (Piper's `length_scale` is the
 * model's default divided by `rate`). The Voice's `pitch` only steers `speechSynthesis`: Piper cannot shift
 * pitch, so the model (and speaker) chosen is the pitch.
 */
export interface PiperVoice {
  /** An entry in `voices/models.json`, for example `en_US-libritts-high`. */
  model: string;
  /** The speaker id in a multi-speaker model. Omit for a single-speaker model. */
  speaker?: number;
}

/**
 * How a character sounds when its lines are spoken (ADR 0004). `pitch` (0 to 2) and `rate` (0.5 to 2)
 * are relative to normal (1); the Soundboard nudges both a little per character, so two workers sound
 * related but distinct.
 */
export interface Voice {
  /** Stable name for this Voice, unique within the Theme. It keys the pre-rendered clips, so renaming one re-renders them. */
  id: string;
  pitch: number;
  rate: number;
  /** BCP 47 language the browser voice should match, for example `en-AU`. */
  lang: string;
  /** The Piper voice that renders this Voice's clips. Without it the Voice always uses `speechSynthesis`. */
  piper?: PiperVoice;
}

/** Who speaks how: a Voice per founder (by founder id), else per Part, else the default. */
export interface Voices {
  default: Voice;
  parts?: Partial<Record<Part, Voice>>;
  founders?: Readonly<Record<string, Voice>>;
}

/** Stock phrases an Announcement strings together. */
export type AnnouncementPhrase =
  | 'roomUp'
  | 'roomsUp'
  | 'roomDown'
  | 'roomsDown'
  | 'allCalm'
  | 'criticalFinding'
  | 'criticalFindings'
  | 'goodMorning'
  | 'lastDay'
  | 'deploy'
  | 'deploys'
  | 'rollback'
  | 'rollbacks'
  | 'fault'
  | 'faults'
  | 'backupsSafe'
  | 'backupFailed'
  | 'backupsFailed'
  | 'busiest'
  | 'calmest'
  | 'quietDay';

/**
 * The fixed words an Announcement is stitched from (ADR 0004), each pre-rendered per announcing Voice.
 * Lower case, as spoken.
 */
export interface Vocabulary {
  /** Number words from zero up: `numbers[3]` is 'three'. A number past the end is said in digits, by the fallback. */
  numbers: readonly string[];
  /** How the Office names each Part in an Announcement: the greeter as 'the gateway'. */
  parts: Readonly<Partial<Record<Part, string>>>;
  /** What follows a Part's name for each Mood: 'is swamped'. */
  moods: Readonly<Record<Mood, string>>;
  /** How the Office names each VM's room in an Announcement, by the VM's role: 'the c i room'. */
  rooms: Readonly<Record<VmRole, string>>;
  phrases: Readonly<Record<AnnouncementPhrase, string>>;
}

/** What a Theme sounds like. Data only; the page Soundboard plays it (ADR 0004). Grows in later phases. */
export interface Soundscape {
  /** The Voices its characters speak with. A Theme without them keeps its lines to bubbles. */
  voices?: Voices;
  /**
   * Words to say instead of a bubble line, keyed by the exact bubble text (as written in the line bank) with
   * the lower-case words as the value: `'GET /'` spoken as `'get slash'`. It changes only what is heard; the
   * bubble stays as written, and the clip key follows the spoken words, so an edit re-renders that clip.
   */
  spoken?: Readonly<Record<string, string>>;
  /** The words its Announcements are stitched from. A Theme without one makes no Announcements. */
  vocabulary?: Vocabulary;
  /** The ambient bed. A Theme without one has no background. */
  ambient?: AmbientBed;
  /** Stage effects, panned by where they happen. A happening without one stays silent. */
  effects?: Partial<Record<EffectName, SynthSound>>;
  /** Sounded when the lab breaks: an OOM kill, a VM down, a rolled-back deploy, a failed backup, a new critical finding. */
  alarm: SynthSound;
  /** Sounded softly every 10 minutes while a critical finding stays open, after the Alarm. */
  reminder: SynthSound;
  /** Sounded when a VM comes back up or the last critical finding closes. */
  allClear: SynthSound;
}

/* --------------------------------------------------------------------- theme */

export interface Theme {
  id: string;
  name: string;
  layout: Layout;
  /**
   * Who plays this VM or workload, or `null` when it has no character (a room, a filing cabinet).
   * `generation` counts how many times the workload has been replaced by a deploy; vary the
   * incidental features (face, hair) with it so the newcomer looks like somebody new.
   */
  cast(subject: LabSubject, generation: number): Casting | null;
  founders: readonly Founder[];
  /** A passing visitor to a worker. `seed` is 0 to 1. */
  visitor: { look(seed: number): Look; title: string; blurb: string };
  lines: LineBank;
  /**
   * `back` is painted first, then the places, characters and `props` sorted by base line, then
   * `front`, then the bubbles.
   */
  decor: { back: readonly DecorFn[]; props: readonly Prop[]; front: readonly DecorFn[] };
  hotspots: readonly Hotspot[];
  legend: readonly LegendEntry[];
  /** What this Theme sounds like. A Theme without one is silent. */
  soundscape?: Soundscape;
}
