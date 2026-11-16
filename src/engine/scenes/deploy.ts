import type { DeployEvent } from '../../contract/snapshot.ts';
import type { Place } from '../../contract/theme.ts';
import type { Character } from '../characters/character.ts';
import type { World } from '../world.ts';
import { Scene, type Script } from './scene.ts';

export type Verdict = Exclude<DeployEvent['phase'], 'started'>;

/** The health check always shows for at least this long. */
export const HEALTH_CHECK_SECONDS = 2.2;
/** With no verdict by then, the newcomer gives up. */
export const VERDICT_TIMEOUT_SECONDS = 30;

/** Where the courier parks, the newcomer stands and the checker stands, relative to the seat. */
const COURIER_OFFSET = 20;
const NEWCOMER_OFFSET = 9;
const CHECKER_OFFSET = -6;
const MARK_LIFT = 30;
const LINE_GAP_SECONDS = 0.8;

interface DeployCrew {
  courier: Character;
  target: Character;
  checker: Character | null;
  desk: Place;
}

/**
 * A deploy: the courier wheels a newcomer to the target's desk, the checker runs the health check,
 * and the lab's verdict decides who stays. The verdict may arrive before the courier does, or with
 * no `started` at all.
 */
export class DeployScene extends Scene<DeployCrew> {
  private verdict: Verdict | null;
  private newcomer: Character | null = null;

  constructor(
    world: World,
    readonly subject: string,
    verdict: Verdict | null = null,
  ) {
    super(world);
    this.verdict = verdict;
  }

  get decided(): boolean {
    return this.verdict !== null;
  }

  decide(verdict: Verdict): void {
    this.verdict ??= verdict;
  }

  protected cast(): DeployCrew | null {
    const { cast } = this.world;
    const courier = cast.lead('courier');
    const target = cast.forWorkload(this.subject);
    if (courier === undefined || target === undefined || !target.present || target.retiring) return null;
    if (target.home === null) return null;
    const checker = cast.lead('checker') ?? null;
    return { courier, target, checker: checker?.held === true ? null : checker, desk: target.home };
  }

  protected members(crew: DeployCrew): readonly Character[] {
    return crew.checker === null ? [crew.courier, crew.target] : [crew.courier, crew.target, crew.checker];
  }

  protected *enter({ courier, target, desk }: DeployCrew): Script {
    courier.sceneStatus = 'delivering';
    courier.trolley = 'parcel';
    courier.sayCue('delivery', true);
    // A target on a break heads back to its desk.
    if (!target.atHome) target.goHome();
    yield* this.walk(courier, { x: desk.seat.x + COURIER_OFFSET, floor: desk.floor });
  }

  protected *act({ courier, checker, desk }: DeployCrew): Script {
    courier.trolley = null;
    courier.face(-1);
    const newcomer = this.world.cast.newcomer(this.subject, { x: desk.seat.x + NEWCOMER_OFFSET, floor: desk.floor });
    if (newcomer !== null) {
      this.newcomer = newcomer;
      this.hold(newcomer);
      newcomer.sceneStatus = 'new-arrival';
      if (desk.seat.y !== undefined) newcomer.sitAt(desk.seat.y);
      newcomer.setActivity('type');
      newcomer.appear();
      newcomer.sayCue('new-arrival', true);
    }
    if (checker !== null) {
      yield* this.walk(checker, { x: desk.seat.x + CHECKER_OFFSET, floor: desk.floor });
      checker.face(1);
      checker.sayCue('health-check', true);
    }
    const started = this.world.now;
    yield () => {
      const waited = this.world.now - started;
      return (waited >= HEALTH_CHECK_SECONDS && this.verdict !== null) || waited >= VERDICT_TIMEOUT_SECONDS;
    };
  }

  protected *resolve({ target, checker }: DeployCrew): Script {
    const newcomer = this.newcomer;
    switch (this.verdict) {
      case null:
        newcomer?.vanish();
        return;
      case 'healthy':
        checker?.sayCue('healthy', true);
        if (newcomer !== null) this.mark('tick', newcomer);
        if (newcomer === null) return;
        target.sayCue('old-one-out', true);
        this.world.cast.handover(target, newcomer);
        target.walkOut();
        newcomer.sceneStatus = null;
        newcomer.goHome();
        this.release(target);
        this.release(newcomer);
        return;
      case 'rolled-back':
        checker?.sayCue('unhealthy', true);
        if (newcomer === null) return;
        this.mark('cross', newcomer);
        yield* this.pause(LINE_GAP_SECONDS);
        newcomer.sayCue('sent-home', true);
        newcomer.walkOut();
        this.release(newcomer);
        yield* this.pause(LINE_GAP_SECONDS);
        target.sayCue('still-serving', true);
        return;
      default: {
        const unreachable: never = this.verdict;
        throw new Error(`Unknown verdict ${String(unreachable)}`);
      }
    }
  }

  protected override *exit({ courier, target, checker }: DeployCrew): Script {
    this.release(target);
    if (checker !== null) this.release(checker);
    yield* this.walkHome(courier);
  }

  protected override onAbort(): void {
    if (this.newcomer !== null && !this.newcomer.exiting) this.newcomer.vanish();
    this.world.bus.publish({ kind: 'log', text: `Deploy of ${this.subject} abandoned: a VM went down mid-deploy` });
  }

  private mark(kind: 'tick' | 'cross', over: Character): void {
    this.world.effects.mark(kind, over.x - 2, over.y - MARK_LIFT);
  }
}
