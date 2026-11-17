import type { Snapshot } from '../../contract/snapshot.ts';
import type { AmbientBed, Mood } from '../../contract/theme.ts';
import type { CharacterView } from '../../engine/engine.ts';
import type { AmbientMix } from './sound-output.ts';

/** How busy each mood sounds on the keyboard, 0 (nobody typing) to 1 (frantic). */
export const MOOD_BUSYNESS: Readonly<Record<Mood, number>> = {
  break: 0,
  working: 0.35,
  stressed: 0.7,
  swamped: 1,
  fainted: 0,
  absent: 0,
};

/** The parts whose keyboards make the clatter: the ones who do the lab's work. */
const TYPISTS: readonly CharacterView['part'][] = ['worker', 'pod'];

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;
}

/** How hard the lab is working, 0 to 1: the mean CPU of the VMs that are up. 0 when none are. */
export function labLoad(snapshot: Snapshot): number {
  return clamp01(mean(snapshot.vms.filter((vm) => vm.up).map((vm) => vm.cpu)) / 100);
}

/** How busy the workers are, 0 to 1: the mean mood weight of the visible workers and pods. 0 when there are none. */
export function busyness(characters: readonly CharacterView[]): number {
  return mean(
    characters
      .filter((character) => character.visible && TYPISTS.includes(character.part))
      .map((character) => MOOD_BUSYNESS[character.mood]),
  );
}

/** Where the bed's layers sit for a lab at `load` whose workers are `busy` (both 0 to 1). */
export function ambientMix(bed: AmbientBed, load: number, busy: number): AmbientMix {
  const { hum, clatter } = bed;
  return {
    room: bed.room.volume,
    hum: hum.idle + (hum.busy - hum.idle) * load,
    keysPerSecond: clatter.calm + (clatter.frantic - clatter.calm) * busy,
  };
}
