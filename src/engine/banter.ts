import type { World } from './world.ts';

const FIRST_SECONDS = 3;
const MIN_GAP_SECONDS = 1.6;
const MAX_GAP_SECONDS = 3.4;

/** Now and then one idle character says something. What it says is up to the character. */
export class Banter {
  private next: number;

  constructor(private readonly world: World) {
    this.next = world.now + FIRST_SECONDS;
  }

  update(): void {
    const { now, random, cast, bubbles } = this.world;
    if (now < this.next) return;
    this.next = now + random.range(MIN_GAP_SECONDS, MAX_GAP_SECONDS);
    const speaker = random.pick(cast.list());
    if (speaker === undefined || !speaker.visible || speaker.held || speaker.exiting) return;
    if (speaker.mood === 'fainted' || bubbles.has(speaker.id)) return;
    speaker.say(speaker.chatter());
  }
}
