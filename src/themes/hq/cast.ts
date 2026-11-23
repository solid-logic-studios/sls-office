import type { SiteInstanceWorkload, Vm } from '../../contract/snapshot.ts';
import type { Casting, LabSubject, Theme } from '../../contract/theme.ts';
import {
  LEDGER_LOOK,
  MUSTER_LOOK,
  PAYLOAD_LOOK,
  SWITCHBOARD_LOOK,
  VITALS_LOOK,
  clientStyle,
  codename,
  rookieLook,
  tunnelTwinLook,
  visitorLook,
  workerLook,
} from './looks.ts';
import { VM_BLURBS } from './rooms.ts';

/** An HTTP request, as the HQ sees it: a citizen. */
export const CITIZEN: Theme['visitor'] = {
  look: visitorLook,
  title: 'Citizen',
  blurb: 'An HTTP request: a citizen in through the Cloudflare Tunnel, sent on by Switchboard.',
};

function castVm(vm: Vm): Casting | null {
  switch (vm.role) {
    case 'data':
      return { part: 'keeper', look: LEDGER_LOOK, blurb: VM_BLURBS.data };
    case 'deploy':
      return { part: 'courier', look: PAYLOAD_LOOK, blurb: VM_BLURBS.deploy };
    case 'ci':
      return {
        part: 'wrangler',
        look: MUSTER_LOOK,
        blurb: `Autoscaler, the drill instructor. Manages the scale set on ${vm.name}: up to three single-use rookies.`,
      };
    case 'compute':
      return null;
  }
}

function castSite(vm: Vm, w: SiteInstanceWorkload, generation: number): Casting {
  return {
    part: 'worker',
    look: workerLook(w.client, w.env, w.id, generation),
    blurb: `${codename(w.id)} of the ${clientStyle(w.client).name} squad: ${w.site} (${w.siteType}), ${w.env}, a container on ${vm.name}`,
  };
}

const platformBlurb = (role: string, vm: Vm): string => `${role} Platform container on ${vm.name}.`;

function castPlatform(vm: Vm, name: string): Casting | null {
  const lower = name.toLowerCase();
  if (lower.startsWith('traefik')) {
    return {
      part: 'greeter',
      look: SWITCHBOARD_LOOK,
      blurb: platformBlurb('Switchboard, dispatch. Sends every citizen to the right hero by Host header.', vm),
    };
  }
  if (lower.startsWith('cloudflared')) {
    const role = lower.endsWith('2')
      ? 'Pong, the other Tunnel Twin. Cloudflare Tunnel replica.'
      : 'Ping, a Tunnel Twin. Cloudflare Tunnel replica. No inbound ports: citizens come through the tunnel.';
    return { part: 'guard', look: tunnelTwinLook(name), blurb: platformBlurb(role, vm) };
  }
  if (lower.startsWith('gatus')) {
    return {
      part: 'checker',
      look: VITALS_LOOK,
      blurb: platformBlurb('Vitals, the field medic. Does the rounds and takes every pulse, alerts nobody.', vm),
    };
  }
  return null;
}

/** Who plays each VM and workload in the HQ (docs/design/hq-theme.md, section 7). */
export function castSubject(subject: LabSubject, generation: number): Casting | null {
  if (subject.kind === 'vm') return castVm(subject.vm);
  const { vm, workload } = subject;
  switch (workload.kind) {
    case 'site-instance':
      return castSite(vm, workload, generation);
    case 'platform':
      return castPlatform(vm, workload.name);
    case 'ci-pod':
      return {
        part: 'pod',
        look: rookieLook(workload.id),
        blurb: `A rookie in the bay, on ${vm.name}. Suits up for one mission, then goes. No Docker, no LAN.`,
      };
    case 'engine':
    case 'runner':
      return null;
  }
}
