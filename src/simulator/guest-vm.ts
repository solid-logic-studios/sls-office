import type { VmRole } from '../contract/snapshot.ts';
import { clamp } from './util.ts';

export interface Load {
  cpu: number;
  mem: number;
}

export const NO_LOAD: Load = { cpu: 0, mem: 0 };

/** One lab VM: live cpu and mem chase the slider targets with a slow wobble. */
export class GuestVm {
  up = true;
  cpu: number;
  mem: number;
  targetCpu: number;
  targetMem: number;

  constructor(
    readonly id: string,
    readonly role: VmRole,
    load: Load,
    private readonly phase: number,
  ) {
    this.cpu = this.targetCpu = load.cpu;
    this.mem = this.targetMem = load.mem;
  }

  setLoad(cpu: number, mem: number): void {
    this.targetCpu = clamp(cpu, 0, 100);
    this.targetMem = clamp(mem, 0, 100);
  }

  setUp(up: boolean): void {
    this.up = up;
    if (!up) this.cpu = this.mem = 0;
  }

  /** `extra` is load from things running on the VM (a deploy, a backup, CI pods). */
  step(time: number, dt: number, extra: Load): void {
    if (!this.up) return;
    const wantCpu = clamp(this.targetCpu + Math.sin(time * 0.7 + this.phase) * 4 + extra.cpu, 1, 100);
    const wantMem = clamp(this.targetMem + Math.sin(time * 0.3 + this.phase) * 2 + extra.mem, 4, 100);
    const rate = Math.min(1, dt * 2);
    this.cpu += (wantCpu - this.cpu) * rate;
    this.mem += (wantMem - this.mem) * rate;
  }

  /** 0 ok, 1 warn, 2 crit. */
  severity(): 0 | 1 | 2 {
    if (!this.up) return 2;
    return this.cpu > 90 || this.mem > 90 ? 1 : 0;
  }
}
