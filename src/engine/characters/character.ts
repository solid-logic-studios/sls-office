import { assertNever } from '../../assert-never.ts';
import type { Painter } from '../../contract/painter.ts';
import type { Cue, Look, Mood, Part, Place, SceneStatus, Spot, Subject, Tip } from '../../contract/theme.ts';
import { MoodMachine, vitalsOf, type Vitals } from '../mood.ts';
import { Walker } from '../route.ts';
import { boundsOf, drawLook, type Pose, type Trolley } from '../sprites.ts';
import type { StageNode } from '../stage-node.ts';
import { loadOf, severityOf } from '../tips.ts';
import type { World } from '../world.ts';

/** What a character does while standing still. Walking and fainting are worked out from its state. */
export type Activity = 'stand' | 'type' | 'idle';

export interface CharacterInit {
  /** Unique on the stage. */
  id: string;
  /** `null` for a passer-by who plays no part (a visitor). */
  part: Part | null;
  /** Tooltip title: the full workload id, the VM name or the founder's name. */
  title: string;
  blurb: string;
  look: Look;
  subject: Subject | null;
  home: Place | null;
  start: Spot;
}

/** Founders and visitors are always in. Any cpu between the break and stressed thresholds reads as working. */
const ALWAYS_IN: Vitals = { present: true, cpu: 50, mem: 0 };
const LANES = 4;
const PUFF_LIFT = 10;
/** Close enough to a spot to count as there; the walker lands exactly, a clamped target may not. */
const NEAR = 0.5;

/**
 * Someone on the stage. The base class owns what every character shares: walking (one `Walker`),
 * mood (one `MoodMachine`), coming and going with a puff, speaking through the bus, drawing through
 * the one sprite renderer, and its tooltip. Subclasses supply only their idle behaviour.
 */
export abstract class Character implements StageNode {
  readonly id: string;
  readonly part: Part | null;
  readonly title: string;
  readonly blurb: string;
  readonly look: Look;
  /** Refreshed from every Snapshot by the cast. */
  subject: Subject | null;
  home: Place | null;
  /** Shown in the tooltip in place of the mood. */
  sceneStatus: SceneStatus | null = null;
  trolley: Trolley | null = null;
  frantic = false;
  /** Set while a scene drives this character: it then takes no initiative of its own. */
  held = false;
  /** Its subject has left the lab; it goes once no scene needs it. */
  retiring = false;
  /** Off the stage for good; the cast drops it. */
  gone = false;

  protected abstract readonly speed: number;
  protected activity: Activity = 'stand';
  protected readonly walker: Walker;
  private readonly moods = new MoodMachine();
  private lastMood: Mood;
  private shown = true;
  private seatY: number | null = null;
  private facingOverride: 1 | -1 | null = null;
  private walkingOut = false;
  /** Offsets this character's animation so nobody blinks in step. */
  private readonly phase: number;

  constructor(
    protected readonly world: World,
    init: CharacterInit,
  ) {
    this.id = init.id;
    this.part = init.part;
    this.title = init.title;
    this.blurb = init.blurb;
    this.look = init.look;
    this.subject = init.subject;
    this.home = init.home;
    this.walker = new Walker(world.theme.layout, init.start, world.random.int(LANES), world.lift);
    this.phase = world.random.range(0, 50);
    this.lastMood = this.moods.mood;
  }

  /* ------------------------------------------------------------- state */

  get mood(): Mood {
    return this.lastMood;
  }

  get visible(): boolean {
    return this.shown && !this.gone;
  }

  /** In the Office, and not absent: a scene needs all of its actors present. */
  get present(): boolean {
    return this.lastMood !== 'absent' && !this.gone;
  }

  get x(): number {
    return this.walker.x;
  }

  get y(): number {
    if (this.lastMood === 'fainted') return this.walker.y;
    return this.seatY ?? this.walker.y;
  }

  get floor(): number {
    return this.walker.floor;
  }

  get baseY(): number {
    return this.y;
  }

  get moving(): boolean {
    return this.walker.moving;
  }

  get inLift(): boolean {
    return this.walker.inLift;
  }

  /** At a lift landing, waiting for the car. */
  get waitingForLift(): boolean {
    return this.walker.waitingForLift;
  }

  /** Pixels above the walk line it stands at. */
  get lane(): number {
    return this.walker.lane;
  }

  get seated(): boolean {
    return this.seatY !== null && !this.walker.moving;
  }

  get facing(): 1 | -1 {
    return this.facingOverride ?? this.walker.facing;
  }

  get exiting(): boolean {
    return this.walkingOut;
  }

  get pose(): Pose {
    if (this.lastMood === 'fainted') return 'faint';
    if (this.walker.moving) return this.walker.inLift || this.walker.waitingForLift ? 'stand' : 'walk';
    return this.activity;
  }

  get homeSpot(): Spot | null {
    return this.home === null ? null : { x: this.home.seat.x, floor: this.home.floor };
  }

  get atHome(): boolean {
    const spot = this.homeSpot;
    return spot !== null && !this.walker.moving && this.isAt(spot);
  }

  /* ---------------------------------------------------------- lifecycle */

  /** First placement: mood and visibility without fuss, then a puff if it is arriving mid-show. */
  settleIn(announce: boolean): void {
    this.refreshMood(false);
    this.sitAtHome();
    if (announce && this.visible) this.announceArrival();
  }

  /** Brings the mood up to date. A change of mood can hide or show the character, or bring it round. */
  refreshMood(announce = true): void {
    const mood = this.moods.update(this.vitals(), this.world.now);
    const was = this.lastMood;
    this.lastMood = mood;
    if (mood === was) return;
    if (mood === 'absent') this.hide(announce);
    else if (was === 'absent') this.show(announce);
    if (mood === 'fainted') this.walker.stop();
    else if (was === 'fainted' && mood !== 'absent') this.recover();
  }

  /** An OOM kill. */
  faint(): void {
    this.moods.faint(this.world.now);
    this.refreshMood();
  }

  /** Its subject has gone from the lab. */
  retire(): void {
    if (this.visible) this.retiring = true;
    else this.gone = true;
  }

  /** Pops into view where it stands. */
  appear(): void {
    this.world.effects.puff(this.x, this.y - PUFF_LIFT);
  }

  /** Pops out of view for good (quietly, if it was already out of view). */
  vanish(): void {
    if (this.visible) this.world.effects.puff(this.x, this.y - PUFF_LIFT);
    this.gone = true;
  }

  /** Off the stage for good (the cast is dropping it): it leaves the lift at once, so the car does not wait for it. */
  dispose(): void {
    this.walker.halt();
  }

  /** Walks off stage through the entrance, and is gone when it gets there. */
  walkOut(): void {
    this.walkingOut = true;
    this.sceneStatus = 'leaving';
    this.goTo(this.world.theme.layout.entrance);
  }

  hold(): void {
    this.held = true;
    this.onInterrupted();
  }

  release(): void {
    this.held = false;
    this.trolley = null;
    this.facingOverride = null;
    if (!this.walkingOut) this.sceneStatus = null;
    this.onRelease();
  }

  /* ----------------------------------------------------------- movement */

  goTo(spot: Spot, speed = this.speed): void {
    this.walker.goTo(spot, speed);
    this.seatY = null;
    this.facingOverride = null;
    // Whatever it was doing at its desk stops with the walk; the desk logic sets it again on arrival.
    this.activity = 'stand';
    this.frantic = false;
  }

  goHome(speed = this.speed): void {
    const spot = this.homeSpot;
    if (spot !== null) this.goTo(spot, speed);
  }

  teleport(spot: Spot): void {
    this.walker.teleport(spot);
    this.seatY = null;
  }

  /** Sits down if its home has a seat height; otherwise stands on the walk line. */
  sitAtHome(): void {
    this.seatY = this.home?.seat.y ?? null;
  }

  sitAt(y: number): void {
    this.seatY = y;
  }

  face(direction: 1 | -1): void {
    this.facingOverride = direction;
  }

  setActivity(activity: Activity, frantic = false): void {
    this.activity = activity;
    this.frantic = frantic;
  }

  isAt(spot: Spot): boolean {
    const floor = this.world.theme.layout.floors[spot.floor];
    const x = floor === undefined ? spot.x : Math.min(floor.maxX, Math.max(floor.minX, spot.x));
    return this.walker.floor === spot.floor && Math.abs(this.walker.x - x) < NEAR;
  }

  /* ------------------------------------------------------------- speech */

  say(text: string | undefined, force = false): void {
    if (text === undefined || !this.visible) return;
    this.world.bus.publish({ kind: 'speech', speakerId: this.id, text, force });
  }

  sayCue(cue: Cue, force = false): void {
    this.say(this.line(this.world.theme.lines.cue[cue]), force);
  }

  /** Something to say when nothing is happening, or `undefined` to keep quiet. */
  chatter(): string | undefined {
    return this.part === null ? undefined : this.line(this.world.theme.lines.part[this.part]);
  }

  /** A visitor has reached this character. */
  visited(): void {}

  /** A founder has asked this character how it is going. */
  checkedIn(): void {}

  /* -------------------------------------------------------------- frame */

  update(dt: number): void {
    this.refreshMood();
    // A rider who faints mid-ride stays in the car (stop() lets the ride finish) and the lift lets it off.
    if (!this.visible || this.lastMood === 'fainted') return;
    this.walker.step(dt);
    if (this.walkingOut) {
      if (!this.walker.moving) this.gone = true;
      return;
    }
    if (this.retiring && !this.held) {
      this.depart();
      return;
    }
    if (this.held) this.whileHeld();
    else this.behave();
    this.emitMoodEffects(dt);
  }

  draw(painter: Painter): void {
    drawLook(painter, this.look, {
      x: this.x,
      y: this.y,
      pose: this.pose,
      facing: this.facing,
      time: this.world.now + this.phase,
      frantic: this.frantic,
      talking: this.world.bubbles.has(this.id),
      seated: this.seated,
      inLift: this.walker.inLift,
      trolley: this.trolley,
    });
  }

  tipAt(x: number, y: number): Tip | null {
    if (!this.visible) return null;
    const { half, height } = boundsOf(this.look);
    const over = x >= this.x - half && x <= this.x + half && y >= this.y - height && y <= this.y + 1;
    return over ? this.tip() : null;
  }

  tip(): Tip {
    const status = this.world.theme.lines.status[this.sceneStatus ?? this.lastMood];
    const tip: Tip = { title: this.title, detail: this.blurb, status, severity: severityOf(this.lastMood) };
    const load = loadOf(this.subject);
    return load === null ? tip : { ...tip, ...load };
  }

  /* -------------------------------------------------------------- hooks */

  /** Idle behaviour, run each frame while no scene holds the character. */
  protected abstract behave(): void;

  /** Run each frame while a scene holds the character: by default it waits for the scene. */
  protected whileHeld(): void {}

  /** Something has taken the character away from what it was doing: a scene, an absence or a faint. */
  protected onInterrupted(): void {}

  protected onRelease(): void {}

  /** How it arrives mid-show: a puff at home. */
  protected announceArrival(): void {
    this.appear();
  }

  /** How it leaves once retired. */
  protected depart(): void {
    this.vanish();
  }

  protected line(lines: readonly string[] | undefined): string | undefined {
    return this.world.random.pick(lines);
  }

  /* ------------------------------------------------------------ private */

  private vitals(): Vitals {
    return this.subject === null || this.subject.kind === 'founder' ? ALWAYS_IN : vitalsOf(this.subject);
  }

  private hide(announce: boolean): void {
    if (announce && this.shown) this.world.effects.puff(this.x, this.y - PUFF_LIFT);
    this.walker.halt();
    this.shown = false;
    if (this.walkingOut) this.gone = true;
    this.onInterrupted();
  }

  private show(announce: boolean): void {
    this.shown = true;
    const spot = this.homeSpot;
    if (spot !== null) this.teleport(spot);
    this.sitAtHome();
    this.onInterrupted();
    if (announce) this.appear();
  }

  private recover(): void {
    this.sayCue('recovered', true);
    this.onInterrupted();
  }

  private emitMoodEffects(dt: number): void {
    const { effects, random } = this.world;
    switch (this.pose) {
      case 'type':
        if (random.chance(dt * (this.frantic ? 11 : 2.2))) effects.spark(this.x + random.range(-5, 5), this.y - 9);
        if (!this.frantic) return;
        if (random.chance(dt * 3)) effects.sweat(this.x + (random.chance(0.5) ? -6 : 5), this.y - 18);
        if (random.chance(dt * 1.6)) effects.steam(this.x + random.range(-3, 2), this.y - 25);
        return;
      case 'idle':
        if (this.lastMood === 'break' && this.seated && random.chance(dt * 0.25))
          effects.snooze(this.x + 4, this.y - 20);
        return;
      case 'stand':
      case 'walk':
      case 'faint':
        return;
      default:
        return assertNever(this.pose, 'pose');
    }
  }
}
