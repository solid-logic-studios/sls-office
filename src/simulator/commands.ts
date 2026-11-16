export type PresetId = 'quiet' | 'arvo' | 'deploy' | 'fire' | 'backup';

/** Every control-room action is one of these, so a session can be replayed. */
export type SimCommand =
  | { kind: 'preset'; preset: PresetId }
  | { kind: 'deploy'; outcome: 'healthy' | 'rolled-back' }
  | { kind: 'ci-burst' }
  | { kind: 'backup' }
  | { kind: 'oom' }
  | { kind: 'vm-down' }
  | { kind: 'set-load'; vmId: string; cpu: number; mem: number }
  | { kind: 'set-up'; vmId: string; up: boolean };

/** What the control room's sliders show: `cpu` and `mem` are the target load, not the live reading. */
export interface VmControl {
  id: string;
  name: string;
  cpu: number;
  mem: number;
  up: boolean;
}
