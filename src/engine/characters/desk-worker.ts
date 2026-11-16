import { Character, type CharacterInit } from './character.ts';
import type { World } from '../world.ts';

type DeskState = 'desk' | 'to-break' | 'break' | 'to-desk';

/**
 * Works at a desk: types by mood, flat out when stressed, idles on a break. A site worker also takes
 * breaks at the break spots; the keeper and the greeter are the same character configured not to.
 */
export class DeskWorker extends Character {
  protected readonly speed = 34;
  private state: DeskState = 'desk';
  /** When it next thinks about taking a break. */
  private breakAt: number;
  private breakEnds = 0;
  private breakSpot: number | null = null;

  constructor(
    world: World,
    init: CharacterInit,
    private readonly takesBreaks: boolean,
  ) {
    super(world, init);
    this.breakAt = world.now + world.random.range(2, 9);
  }

  /** At its desk, well and free: the founders, the visitors and the queries look for these. */
  get available(): boolean {
    return (
      this.visible &&
      !this.held &&
      !this.retiring &&
      !this.exiting &&
      this.state === 'desk' &&
      this.atHome &&
      this.mood !== 'fainted'
    );
  }

  override checkedIn(): void {
    this.sayCue(this.mood === 'stressed' ? 'check-in-reply-busy' : 'check-in-reply');
  }

  override visited(): void {
    if (this.state === 'desk' && this.world.random.chance(0.2)) this.say(this.moodLine());
  }

  override chatter(): string | undefined {
    const { lines } = this.world.theme;
    switch (this.part) {
      case 'worker': {
        const spot = this.world.breakSpots.occupiedBy(this.id);
        return spot === null ? this.moodLine() : this.line(lines.breakSpot[spot.kind]);
      }
      case 'greeter':
        return this.world.findings.crit > 0 ? this.line(lines.cue.alarm) : super.chatter();
      default:
        return super.chatter();
    }
  }

  protected behave(): void {
    if (this.moving) return;
    switch (this.state) {
      case 'desk':
        this.work();
        return;
      case 'to-break':
        this.arriveAtBreak();
        return;
      case 'break':
        this.rest();
        return;
      case 'to-desk':
        this.state = 'desk';
        this.breakAt = this.world.now + this.world.random.range(5, 12);
        this.work();
        return;
      default: {
        const unreachable: never = this.state;
        throw new Error(`Unknown desk state ${String(unreachable)}`);
      }
    }
  }

  /** In a scene it still works whenever the scene leaves it at its desk; it just takes no breaks. */
  protected override whileHeld(): void {
    if (!this.atHome) return;
    this.sitAtHome();
    this.typeByMood();
  }

  protected override onHold(): void {
    this.backFromBreak();
  }

  protected override onRelease(): void {
    this.state = 'desk';
  }

  protected override onShow(): void {
    this.backFromBreak();
  }

  protected override onHide(): void {
    this.backFromBreak();
  }

  protected override onRecover(): void {
    this.backFromBreak();
  }

  private work(): void {
    if (!this.atHome) {
      this.goHome();
      this.state = 'to-desk';
      return;
    }
    this.sitAtHome();
    this.typeByMood();
    if (this.mood !== 'break' || !this.takesBreaks || this.world.now < this.breakAt) return;
    this.breakAt = this.world.now + this.world.random.range(5, 11);
    if (this.world.random.chance(0.65)) this.takeBreak();
  }

  private typeByMood(): void {
    switch (this.mood) {
      case 'break':
        this.setActivity('idle');
        return;
      case 'stressed':
        this.setActivity('type', true);
        return;
      case 'working':
      case 'swamped':
        this.setActivity('type');
        return;
      case 'fainted':
      case 'absent':
        return;
      default: {
        const unreachable: never = this.mood;
        throw new Error(`Unknown mood ${String(unreachable)}`);
      }
    }
  }

  private takeBreak(): void {
    const claim = this.world.breakSpots.claim(this.id);
    if (claim === null) return;
    this.breakSpot = claim.index;
    this.goTo(claim.spot);
    this.state = 'to-break';
  }

  private arriveAtBreak(): void {
    const index = this.breakSpot;
    const spot = index === null ? undefined : this.world.theme.layout.breakSpots[index];
    if (index === null || spot === undefined) {
      this.state = 'desk';
      return;
    }
    this.world.breakSpots.arrive(index);
    if (spot.sitY !== undefined) this.sitAt(spot.sitY);
    this.setActivity(spot.sitY === undefined ? 'stand' : 'idle');
    this.state = 'break';
    this.breakEnds = this.world.now + this.world.random.range(8, 18);
    if (this.world.random.chance(0.5)) this.say(this.line(this.world.theme.lines.breakSpot[spot.kind]));
  }

  private rest(): void {
    if (this.mood === 'break' && this.world.now < this.breakEnds) return;
    this.backFromBreak();
    this.goHome();
    this.state = 'to-desk';
  }

  /** Gives up any break spot; the desk logic walks it home. */
  private backFromBreak(): void {
    this.world.breakSpots.release(this.id);
    this.breakSpot = null;
    this.state = 'desk';
  }

  private moodLine(): string | undefined {
    return this.line(this.world.theme.lines.mood[this.mood]);
  }
}
