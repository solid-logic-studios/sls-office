import type { SiteInstanceWorkload, Vm } from '../../contract/snapshot.ts';
import type { Casting, LabSubject } from '../../contract/theme.ts';
import {
  CHECKER_LOOK,
  COURIER_LOOK,
  GREETER_LOOK,
  KEEPER_LOOK,
  WRANGLER_LOOK,
  clientStyle,
  guardLook,
  podLook,
  workerLook,
} from './looks.ts';
import { VM_BLURBS } from './rooms.ts';

function castVm(vm: Vm): Casting | null {
  switch (vm.role) {
    case 'data':
      return { part: 'keeper', look: KEEPER_LOOK, blurb: VM_BLURBS.data };
    case 'deploy':
      return { part: 'courier', look: COURIER_LOOK, blurb: VM_BLURBS.deploy };
    case 'ci':
      return {
        part: 'wrangler',
        look: WRANGLER_LOOK,
        blurb: `Autoscaler. Manages the scale set on ${vm.name}: up to three single-use pods.`,
      };
    case 'compute':
      return null;
  }
}

function castSite(vm: Vm, w: SiteInstanceWorkload, generation: number): Casting {
  return {
    part: 'worker',
    look: workerLook(w.client, w.env, w.id, generation),
    blurb: `${clientStyle(w.client).name} ${w.site} (${w.siteType}), ${w.env}, a container on ${vm.name}`,
  };
}

const platformBlurb = (role: string, vm: Vm): string => `${role} Container in the platform project on ${vm.name}.`;

function castPlatform(vm: Vm, name: string): Casting | null {
  const lower = name.toLowerCase();
  if (lower.startsWith('traefik')) {
    return {
      part: 'greeter',
      look: GREETER_LOOK,
      blurb: platformBlurb('Traefik, the Receptionist. Routes every visitor to the right desk by Host header.', vm),
    };
  }
  if (lower.startsWith('cloudflared')) {
    const role = lower.endsWith('2')
      ? 'Cloudflare Tunnel replica, the second doorman.'
      : 'Cloudflare Tunnel replica, a doorman. No inbound ports: visitors come through the tunnel.';
    return { part: 'guard', look: guardLook(name), blurb: platformBlurb(role, vm) };
  }
  if (lower.startsWith('gatus')) {
    return {
      part: 'checker',
      look: CHECKER_LOOK,
      blurb: platformBlurb('Gatus, the lab dashboard. Does the rounds with a clipboard, alerts nobody.', vm),
    };
  }
  return null;
}

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
        look: podLook(workload.id),
        blurb: `An intern in the pool on ${vm.name}. Runs one job, then vanishes. No Docker, no LAN.`,
      };
    case 'engine':
    case 'runner':
      return null;
  }
}
