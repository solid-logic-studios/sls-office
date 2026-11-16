import type { Painter } from '../contract/painter.ts';
import type { Findings, Snapshot } from '../contract/snapshot.ts';
import type { Layout, Mood, Part, Theme, Tip } from '../contract/theme.ts';
import { EventBus } from './event-bus.ts';
import { LabLog } from './lab-log.ts';
import { Random, seededRandom, type RandomSource } from './random.ts';
import { SnapshotDiffer } from './snapshot-differ.ts';
import type { Pose } from './sprites.ts';
import { Stage } from './stage.ts';

export interface EngineOptions {
  /** The page passes `Math.random`; without one the Engine uses a fixed seed, so a run is repeatable. */
  random?: RandomSource;
}

/** A read-only look at one character, as `Engine.characters()` reports it. The tests read the cast through it. */
export interface CharacterView {
  id: string;
  part: Part;
  x: number;
  y: number;
  floor: number;
  mood: Mood;
  pose: Pose;
  visible: boolean;
  /** The tooltip status text. */
  status: string;
}

const DEFAULT_SEED = 0x51_0ff1ce;
/** Longer frames are played as several steps, so a scene never skips a beat. */
const MAX_STEP_SECONDS = 0.05;
const NO_FINDINGS: Findings = { ok: 0, warn: 0, crit: 0 };

/**
 * The Office's facade. The page feeds it Snapshots and frames and asks it to draw; everything else
 * (the cast, the scenes, the bubbles) lives behind it.
 */
export class Engine {
  readonly bus = new EventBus();
  private readonly random: Random;
  private readonly differ = new SnapshotDiffer();
  private readonly clock = { now: 0 };
  private readonly log: LabLog;
  private stage: Stage;
  private last: Snapshot | null = null;
  private hour = 12;

  constructor(theme: Theme, options: EngineOptions = {}) {
    this.random = new Random(options.random ?? seededRandom(DEFAULT_SEED));
    this.stage = new Stage(theme, this.bus, this.random, this.clock);
    this.log = new LabLog(this.bus, (id) => this.last?.vms.find((vm) => vm.id === id)?.name ?? id);
  }

  get theme(): Theme {
    return this.stage.theme;
  }

  /** Rebuilds the stage from the last Snapshot under the new Theme. Running scenes are dropped. */
  setTheme(theme: Theme): void {
    this.stage.dispose();
    this.stage = new Stage(theme, this.bus, this.random, this.clock);
    if (this.last !== null) this.stage.reconcile(this.last, false);
  }

  /** Reconciles the cast, then publishes what changed since the last Snapshot. */
  accept(snapshot: Snapshot): void {
    const first = this.last === null;
    this.last = snapshot;
    this.stage.reconcile(snapshot, !first);
    for (const event of this.differ.diff(snapshot)) this.bus.publish(event);
    this.log.endSnapshot();
    this.stage.endSnapshot();
  }

  /** Local time of day, 0 to 24. */
  setHour(hour: number): void {
    this.hour = hour;
  }

  /** Advances animation time by `dt` seconds. */
  update(dt: number): void {
    let left = Math.max(0, dt);
    while (left > 0) {
      const step = Math.min(left, MAX_STEP_SECONDS);
      this.clock.now += step;
      this.stage.update(step);
      left -= step;
    }
  }

  draw(painter: Painter): void {
    this.stage.draw(painter, this.hour);
  }

  tipAt(x: number, y: number): Tip | null {
    return this.stage.tipAt(x, y, this.hour);
  }

  get findings(): Findings {
    return this.last?.host.findings ?? NO_FINDINGS;
  }

  get layout(): Layout {
    return this.stage.theme.layout;
  }

  /** Everyone with a part; passing visitors are left out. */
  characters(): readonly CharacterView[] {
    const { status } = this.stage.theme.lines;
    return this.stage.characters().flatMap((character) =>
      character.part === null
        ? []
        : [
            {
              id: character.id,
              part: character.part,
              x: character.x,
              y: character.y,
              floor: character.floor,
              mood: character.mood,
              pose: character.pose,
              visible: character.visible,
              status: status[character.sceneStatus ?? character.mood],
            },
          ],
    );
  }

  /** One line per VM for screen readers. */
  roster(): string[] {
    const { status } = this.stage.theme.lines;
    return (this.last?.vms ?? []).map((vm) => {
      const cpu = vm.up ? `cpu ${Math.round(vm.cpu)}%` : 'cpu n/a';
      return `${vm.name}: ${status[this.stage.vmMood(vm)]}, ${cpu}`;
    });
  }
}
