import type { Casting } from '../../contract/theme.ts';
import type { World } from '../world.ts';
import { Attendant } from './attendant.ts';
import type { Character, CharacterInit } from './character.ts';
import { Checker } from './checker.ts';
import { DeskWorker } from './desk-worker.ts';
import { Pod } from './pod.ts';

/** The one place that knows which class plays which part. */
export function createCharacter(world: World, part: Casting['part'], init: CharacterInit): Character {
  switch (part) {
    case 'worker':
      return new DeskWorker(world, init, true);
    case 'keeper':
    case 'greeter':
      return new DeskWorker(world, init, false);
    case 'guard':
    case 'courier':
    case 'wrangler':
      return new Attendant(world, init);
    case 'checker':
      return new Checker(world, init);
    case 'pod':
      return new Pod(world, init);
    default: {
      const unreachable: never = part;
      throw new Error(`Unknown part ${String(unreachable)}`);
    }
  }
}
