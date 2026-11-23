import type { SiteEnv, SiteInstanceWorkload, Vm } from '../../contract/snapshot.ts';
import { hashOf } from '../shared/hash.ts';
import { RESERVES, SQUADS, type Hero } from './avengers.ts';

/** Who stands a watch station, and whether they lead the squad (docs/design/hq-theme.md, section 14.3). */
export interface Watch {
  hero: Hero;
  leader: boolean;
}

const ENV_ORDER: Readonly<Record<SiteEnv, number>> = { production: 0, staging: 1, develop: 2 };

/** A client's squad, leader first. A client the HQ does not know gets the reserves, started at the hash of its name. */
function squadOf(client: string): readonly Hero[] {
  if (client in SQUADS) return SQUADS[client as keyof typeof SQUADS];
  const start = hashOf(client) % RESERVES.length;
  return [...RESERVES.slice(start), ...RESERVES.slice(0, start)];
}

/** This instance's place among its client's Site instances on the VM: the most senior environment first. */
function rankOf(vm: Vm, w: SiteInstanceWorkload): { rank: number; seated: number } {
  const mates = vm.workloads
    .filter((other): other is SiteInstanceWorkload => other.kind === 'site-instance' && other.client === w.client)
    .map((other, order) => ({ other, order }))
    .sort((a, b) => ENV_ORDER[a.other.env] - ENV_ORDER[b.other.env] || a.order - b.order);
  const at = mates.findIndex(({ other }) => other.id === w.id);
  return { rank: at >= 0 ? at : hashOf(w.id), seated: mates.length };
}

/**
 * The hero on a Site instance's station: a squad per client, the leader on the client's most senior
 * environment. A deploy (`generation` over 0) is a shift change: a bench hero tags in.
 */
export function watchHero(vm: Vm, w: SiteInstanceWorkload, generation: number): Watch {
  const squad = squadOf(w.client);
  const { rank, seated } = rankOf(vm, w);
  const seatedHero = squad[rank % squad.length] ?? RESERVES[0];
  if (generation <= 0) return { hero: seatedHero, leader: seatedHero === squad[0] };
  // The relief is never the hero relieved, even for an instance its VM does not list.
  const unseated = squad.slice(seated).filter((hero) => hero !== seatedHero);
  const known = w.client in SQUADS;
  const bench: readonly Hero[] = known
    ? [...unseated, ...RESERVES]
    : unseated.length > 0
      ? unseated
      : squad.filter((hero) => hero !== seatedHero);
  const hero = bench[(hashOf(w.client) + rank + generation - 1) % bench.length] ?? RESERVES[0];
  return { hero, leader: false };
}
