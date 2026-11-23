import type { SiteInstanceWorkload, Vm } from '../../contract/snapshot.ts';
import type { Casting, LabSubject, Theme } from '../../contract/theme.ts';
import { hashOf, pick } from '../shared/hash.ts';
import { POSTS, ROOKIES } from './avengers.ts';
import { clientStyle, visitorLook } from './looks.ts';
import { VM_BLURBS } from './rooms.ts';
import { watchHero } from './watch.ts';

/** An HTTP request, as the HQ sees it: a citizen. */
export const CITIZEN: Theme['visitor'] = {
  look: visitorLook,
  title: 'Citizen',
  blurb: `An HTTP request: a citizen in through the Cloudflare Tunnel, sent on by ${POSTS.greeter.name}.`,
};

function castVm(vm: Vm): Casting | null {
  switch (vm.role) {
    case 'data':
      return { part: 'keeper', look: POSTS.keeper.look, blurb: VM_BLURBS.data };
    case 'deploy':
      return { part: 'courier', look: POSTS.courier.look, blurb: VM_BLURBS.deploy };
    case 'ci':
      return {
        part: 'wrangler',
        look: POSTS.wrangler.look,
        blurb: `Autoscaler: ${POSTS.wrangler.name}, drilling the rookies. Manages the scale set on ${vm.name}: up to three single-use rookies.`,
      };
    case 'compute':
      return null;
  }
}

function castSite(vm: Vm, w: SiteInstanceWorkload, generation: number): Casting {
  const { hero, leader } = watchHero(vm, w, generation);
  const squad = `${clientStyle(w.client).name} squad`;
  const who = leader ? `${hero.name}, leading the ${squad}` : `${hero.name} of the ${squad}`;
  return {
    part: 'worker',
    look: hero.look,
    blurb: `${who}: ${w.site} (${w.siteType}), ${w.env}, a container on ${vm.name}`,
  };
}

const platformBlurb = (role: string, vm: Vm): string => `${role} Platform container on ${vm.name}.`;

function castPlatform(vm: Vm, name: string): Casting | null {
  const lower = name.toLowerCase();
  if (lower.startsWith('traefik')) {
    return {
      part: 'greeter',
      look: POSTS.greeter.look,
      blurb: platformBlurb(
        `${POSTS.greeter.name} at dispatch: Traefik. Sends every citizen to the right Avenger by Host header.`,
        vm,
      ),
    };
  }
  if (lower.startsWith('cloudflared')) {
    const [hawkeye, kate] = POSTS.guards;
    const second = lower.endsWith('2');
    const role = second
      ? `${kate.name}, the other ${hawkeye.name}: Cloudflare Tunnel replica.`
      : `${hawkeye.name} on the gate: Cloudflare Tunnel replica. No inbound ports: citizens come through the tunnel.`;
    return { part: 'guard', look: (second ? kate : hawkeye).look, blurb: platformBlurb(role, vm) };
  }
  if (lower.startsWith('gatus')) {
    return {
      part: 'checker',
      look: POSTS.checker.look,
      blurb: platformBlurb(`${POSTS.checker.name} on her rounds: Gatus. Takes every pulse, alerts nobody.`, vm),
    };
  }
  return null;
}

/** Who plays each VM and workload in the HQ (docs/design/hq-theme.md, section 14). */
export function castSubject(subject: LabSubject, generation: number): Casting | null {
  if (subject.kind === 'vm') return castVm(subject.vm);
  const { vm, workload } = subject;
  switch (workload.kind) {
    case 'site-instance':
      return castSite(vm, workload, generation);
    case 'platform':
      return castPlatform(vm, workload.name);
    case 'ci-pod': {
      const rookie = pick(ROOKIES, hashOf(workload.id));
      return {
        part: 'pod',
        look: rookie.look,
        blurb: `${rookie.name}, a rookie in the bay, on ${vm.name}. Suits up for one mission, then goes. No Docker, no LAN.`,
      };
    }
    case 'engine':
    case 'runner':
      return null;
  }
}
