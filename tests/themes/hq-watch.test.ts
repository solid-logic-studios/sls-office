import { describe, expect, it } from 'vitest';
import type { SiteEnv, SiteInstanceWorkload, Vm } from '../../src/contract/snapshot.ts';
import { RESERVES, SQUADS } from '../../src/themes/hq/avengers.ts';
import { watchHero } from '../../src/themes/hq/watch.ts';

function site(client: string, env: SiteEnv, id = `${client}-${env}`): SiteInstanceWorkload {
  return {
    kind: 'site-instance',
    id,
    client,
    site: 'server',
    env,
    siteType: 'node-api',
    cpu: 1,
    mem: 1,
    health: 'healthy',
  };
}

function computeWith(...workloads: SiteInstanceWorkload[]): Vm {
  return { id: 'c', role: 'compute', name: 'sls-compute', up: true, cpu: 1, mem: 1, workloads };
}

describe('the watch', () => {
  // Snapshot order is deliberately not seniority order.
  const scrd = [
    site('scrd', 'develop'),
    site('scrd', 'production'),
    site('scrd', 'staging'),
    site('scrd', 'develop', 'scrd-2'),
  ];
  const vm = computeWith(...scrd);

  it('seats the leader on the clients most senior environment, and the rest in order', () => {
    const seated = scrd.map((w) => watchHero(vm, w, 0));
    expect(seated[1]).toEqual({ hero: SQUADS.scrd[0], leader: true });
    expect(seated.map((s) => s.hero)).toEqual([SQUADS.scrd[2], SQUADS.scrd[0], SQUADS.scrd[1], SQUADS.scrd[3]]);
    expect(seated.filter((s) => s.leader)).toHaveLength(1);
  });

  it('has no twins while the squad has members for every instance', () => {
    for (const [client, squad] of Object.entries(SQUADS)) {
      const workloads = squad.map((_, i) => site(client, 'develop', `${client}-${i}`));
      const heroes = workloads.map((w) => watchHero(computeWith(...workloads), w, 0).hero);
      expect(new Set(heroes).size, client).toBe(squad.length);
    }
  });

  it('tags a different hero in on a deploy, never the one relieved or a leader', () => {
    for (const w of scrd) {
      const before = watchHero(vm, w, 0).hero;
      for (const generation of [1, 2, 3, 4]) {
        const relief = watchHero(vm, w, generation);
        expect(relief.hero, w.id).not.toBe(before);
        expect(relief.leader).toBe(false);
      }
    }
    // BSRA has three members: a relief is from the bench of reserves once all are seated.
    const bsra = [site('bsra', 'production'), site('bsra', 'staging'), site('bsra', 'develop')];
    const relief = watchHero(computeWith(...bsra), bsra[0] as SiteInstanceWorkload, 1).hero;
    expect(RESERVES).toContain(relief);
  });

  it('puts an unknown client on the reserves, and is stable for it', () => {
    const acme = [site('acme-co', 'production'), site('acme-co', 'staging'), site('acme-co', 'develop')];
    const acmeVm = computeWith(...acme);
    const heroes = acme.map((w) => watchHero(acmeVm, w, 0).hero);
    for (const hero of heroes) expect(RESERVES).toContain(hero);
    expect(new Set(heroes).size).toBe(RESERVES.length);
    expect(acme.map((w) => watchHero(acmeVm, w, 0).hero)).toEqual(heroes);
    const relief = watchHero(acmeVm, acme[0] as SiteInstanceWorkload, 1).hero;
    expect(RESERVES).toContain(relief);
  });

  it('seats an instance missing from its VM by the hash of its id', () => {
    const stray = site('scrd', 'develop', 'stray');
    const a = watchHero(computeWith(), stray, 0);
    // Its hash is far beyond the squad, so it sits from the reserves rather than doubling a squad member.
    expect(RESERVES).toContain(a.hero);
    expect(a.leader).toBe(false);
    expect(watchHero(computeWith(), stray, 0)).toEqual(a);
  });

  it.each(['constructor', '__proto__', 'toString'])('treats a client named %s as unknown', (client) => {
    const mates = [site(client, 'production'), site(client, 'staging')];
    const clientVm = computeWith(...mates);
    for (const w of mates) {
      for (const generation of [0, 1]) {
        const { hero, leader } = watchHero(clientVm, w, generation);
        expect(RESERVES, `${w.id} gen ${generation}`).toContain(hero);
        expect(Object.values(SQUADS).flat()).not.toContain(hero);
        if (generation > 0) expect(leader).toBe(false);
      }
    }
  });

  it('seats one leader and no second Iron Man among five SCRD instances', () => {
    const five = [
      site('scrd', 'production'),
      site('scrd', 'staging'),
      site('scrd', 'develop'),
      site('scrd', 'develop', 'scrd-2'),
      site('scrd', 'develop', 'scrd-3'),
    ];
    const seated = five.map((w) => watchHero(computeWith(...five), w, 0));
    expect(seated.filter((s) => s.leader)).toHaveLength(1);
    expect(seated.filter((s) => s.hero === SQUADS.scrd[0])).toHaveLength(1);
    expect(seated[4]?.hero).toBe(RESERVES[0]);
  });
});
