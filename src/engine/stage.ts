import type { Painter } from '../contract/painter.ts';
import type { Findings, Host, Snapshot, Vm } from '../contract/snapshot.ts';
import type { Mood, StageView, Theme, Tip } from '../contract/theme.ts';
import { Banter } from './banter.ts';
import { BreakSpots } from './break-spots.ts';
import { Bubbles } from './bubbles.ts';
import { Cast } from './cast.ts';
import type { Character } from './characters/character.ts';
import { Founder } from './characters/founder.ts';
import { Effects } from './effects.ts';
import { LiftCar } from './lift-car.ts';
import type { EventBus } from './event-bus.ts';
import { MoodMachine, vitalsOf } from './mood.ts';
import type { Random } from './random.ts';
import { Director } from './scenes/director.ts';
import { SceneTriggers } from './scenes/triggers.ts';
import { SetPieces } from './set-pieces.ts';
import { PlaceNode, PropNode, type StageNode } from './stage-node.ts';
import { contains, severityOf } from './tips.ts';
import { Traffic } from './traffic.ts';
import type { Clock, World } from './world.ts';

const NO_FINDINGS: Findings = { ok: 0, warn: 0, crit: 0 };
const OFFLINE_SHADE = '#0c0c18';
const OFFLINE_ALPHA = 0.6;
const OFFLINE_INK = '#ff6b5e';
/** Drawn this far below the top of a down room, or halfway down a short one. */
const OFFLINE_DROP = 34;

/**
 * Everything one Theme puts on stage, and the one place that knows the draw order. The Engine
 * builds a new Stage when the Theme changes; the bus, the clock and the random source outlive it.
 */
export class Stage implements World {
  readonly cast: Cast;
  readonly effects: Effects;
  readonly bubbles: Bubbles;
  readonly breakSpots: BreakSpots;
  readonly setPieces = new SetPieces();
  host: Host | null = null;
  vms: readonly Vm[] = [];
  findings: Findings = NO_FINDINGS;

  private readonly liftCar: LiftCar;
  private readonly director = new Director();
  private readonly triggers: SceneTriggers;
  private readonly traffic: Traffic;
  private readonly banter: Banter;
  /** Places and props: the part of the depth-sorted list that never changes. */
  private readonly scenery: readonly StageNode[];
  /** Each VM's own mood, with or without a character. */
  private readonly vmMoods = new Map<string, MoodMachine>();

  constructor(
    readonly theme: Theme,
    readonly bus: EventBus,
    readonly random: Random,
    private readonly clock: Clock,
  ) {
    const locate = (id: string) => this.cast.locate(id);
    this.effects = new Effects(bus, random, locate);
    this.bubbles = new Bubbles(bus, clock, locate, theme.layout.width);
    this.breakSpots = new BreakSpots(theme.layout.breakSpots, random);
    this.cast = new Cast(this);
    this.liftCar = new LiftCar(theme.layout.floors);
    this.triggers = new SceneTriggers(this, this.director);
    this.traffic = new Traffic(this, this.director);
    this.banter = new Banter(this);
    this.scenery = [
      ...this.cast.homes.all().map((place) => new PlaceNode(place, this.cast.homes)),
      ...theme.decor.props.map((prop) => new PropNode(prop)),
    ];
    this.cast.seatFounders();
  }

  get now(): number {
    return this.clock.now;
  }

  /* ------------------------------------------------------------ snapshots */

  /** `announce` is false for the first Snapshot a Stage sees: everyone is simply there. */
  reconcile(snapshot: Snapshot, announce: boolean): void {
    this.host = snapshot.host;
    this.vms = snapshot.vms;
    this.findings = snapshot.host.findings;
    this.updateVmMoods();
    this.cast.reconcile(snapshot.vms, announce);
  }

  endSnapshot(): void {
    this.triggers.endSnapshot();
  }

  /* ---------------------------------------------------------------- frame */

  update(dt: number): void {
    this.updateVmMoods();
    this.cast.update(dt);
    this.liftCar.update(this.cast.list().filter((character) => character.visible));
    this.director.update();
    this.traffic.update(dt);
    this.banter.update();
    this.effects.update(dt);
    this.bubbles.update();
  }

  /** Back decor; places, props and characters by base line; effects; offline rooms; front decor; bubbles. */
  draw(painter: Painter, hour: number): void {
    const view = this.view(hour);
    for (const decor of this.theme.decor.back) decor(painter, view);
    const nodes: StageNode[] = [...this.scenery, ...this.cast.list().filter((character) => character.visible)];
    nodes.sort((a, b) => a.baseY - b.baseY);
    for (const node of nodes) node.draw(painter, view);
    this.effects.draw(painter);
    this.drawOffline(painter);
    for (const decor of this.theme.decor.front) decor(painter, view);
    this.bubbles.draw(painter);
  }

  /** Front-most first: a character, then a place, then a hotspot, then a room. */
  tipAt(x: number, y: number, hour: number): Tip | null {
    const characters = [...this.cast.list()].sort((a, b) => b.baseY - a.baseY);
    for (const node of [...characters, ...this.scenery]) {
      const tip = node.tipAt(x, y);
      if (tip !== null) return tip;
    }
    const hotspot = this.theme.hotspots.find((spot) => contains(spot.rect, x, y));
    if (hotspot !== undefined) return hotspot.tip(this.view(hour));
    return this.roomTipAt(x, y);
  }

  vmMood(vm: Vm): Mood {
    return this.vmMoods.get(vm.id)?.mood ?? 'working';
  }

  characters(): readonly Character[] {
    return this.cast.list();
  }

  /** Sends the founder to the middle of the ground floor to speak. `false` for no such founder, or a busy one. */
  callStandup(founderId: string): boolean {
    const founder = this.cast.byId(founderId);
    const floor = this.theme.layout.floors[0];
    if (!(founder instanceof Founder) || floor === undefined) return false;
    return founder.callStandup({ x: (floor.minX + floor.maxX) / 2, floor: 0 });
  }

  dispose(): void {
    this.cast.dispose();
    this.effects.dispose();
    this.bubbles.dispose();
    this.triggers.dispose();
  }

  /* -------------------------------------------------------------- private */

  private view(hour: number): StageView {
    return {
      now: this.now,
      hour,
      host: this.host,
      vms: this.vms,
      findings: this.findings,
      liftInUse: this.liftCar.inUse,
      liftCarY: this.liftCar.y,
      vaultOpen: this.setPieces.vaultOpen,
      openStores: this.setPieces.openStores,
      busyBreakSpots: this.breakSpots.busy,
    };
  }

  private updateVmMoods(): void {
    for (const vm of this.vms) {
      const machine = this.vmMoods.get(vm.id) ?? new MoodMachine();
      machine.update(vitalsOf({ kind: 'vm', vm }), this.now);
      this.vmMoods.set(vm.id, machine);
    }
  }

  private drawOffline(painter: Painter): void {
    const blinkOn = Math.floor(this.now * 2) % 2 === 0;
    for (const vm of this.vms) {
      if (vm.up) continue;
      const room = this.theme.layout.rooms[vm.role];
      painter.withAlpha(OFFLINE_ALPHA, () => painter.rect(OFFLINE_SHADE, room.x, room.y, room.w, room.h));
      if (!blinkOn) continue;
      const y = room.y + Math.min(OFFLINE_DROP, Math.round(room.h / 2));
      painter.text(this.theme.lines.offline, room.x + room.w / 2, y, OFFLINE_INK, { align: 'centre', bold: true });
    }
  }

  private roomTipAt(x: number, y: number): Tip | null {
    for (const vm of this.vms) {
      const room = this.theme.layout.rooms[vm.role];
      if (!contains(room, x, y)) continue;
      const mood = this.vmMood(vm);
      return {
        title: vm.name,
        detail: room.blurb,
        cpu: vm.cpu,
        mem: vm.mem,
        status: this.theme.lines.status[mood],
        severity: severityOf(mood),
      };
    }
    return null;
  }
}
