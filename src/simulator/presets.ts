import type { VmRole } from '../contract/snapshot.ts';
import type { PresetId } from './commands.ts';
import type { Load } from './guest-vm.ts';

export const PRESET_IDS: readonly PresetId[] = ['quiet', 'arvo', 'deploy', 'fire', 'backup'];

export const PRESET_NAMES: Record<PresetId, string> = {
  quiet: 'Quiet Sunday',
  arvo: 'Normal arvo',
  deploy: 'Deploy day',
  fire: "Everything's on fire",
  backup: '02:30 backup',
};

/** Target load per VM role for each preset. */
export const PRESET_LOADS: Record<PresetId, Record<VmRole, Load>> = {
  quiet: {
    data: { cpu: 4, mem: 34 },
    compute: { cpu: 5, mem: 40 },
    deploy: { cpu: 2, mem: 20 },
    ci: { cpu: 2, mem: 12 },
  },
  arvo: {
    data: { cpu: 30, mem: 55 },
    compute: { cpu: 45, mem: 60 },
    deploy: { cpu: 12, mem: 32 },
    ci: { cpu: 22, mem: 35 },
  },
  deploy: {
    data: { cpu: 45, mem: 60 },
    compute: { cpu: 62, mem: 66 },
    deploy: { cpu: 40, mem: 50 },
    ci: { cpu: 55, mem: 55 },
  },
  fire: {
    data: { cpu: 93, mem: 90 },
    compute: { cpu: 96, mem: 97 },
    deploy: { cpu: 90, mem: 86 },
    ci: { cpu: 96, mem: 92 },
  },
  backup: {
    data: { cpu: 12, mem: 40 },
    compute: { cpu: 6, mem: 42 },
    deploy: { cpu: 2, mem: 20 },
    ci: { cpu: 2, mem: 12 },
  },
};
