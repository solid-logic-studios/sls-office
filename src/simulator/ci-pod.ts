import type { CiPodWorkload } from '../contract/snapshot.ts';
import { type Cancel, noCancel } from './timeline.ts';
import { percent } from './util.ts';

/** A single-use CI pod on sls-ci. */
export class CiPod {
  /** Cancels the scheduled removal when the pod goes early. */
  cancelRemoval: Cancel = noCancel;

  constructor(
    readonly id: string,
    private readonly phase: number,
  ) {}

  workload(time: number): CiPodWorkload {
    return {
      kind: 'ci-pod',
      id: this.id,
      cpu: percent(60 + 25 * Math.sin(time * 1.9 + this.phase)),
      mem: percent(40 + 15 * Math.sin(time * 0.9 + this.phase)),
    };
  }
}
