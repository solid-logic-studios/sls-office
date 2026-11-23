import type { VmRole } from '../../contract/snapshot.ts';

/** Words for each VM, shared by its room tooltip and the character who stands for it. */
export const VM_BLURBS: Readonly<Record<VmRole, string>> = {
  ci: 'CI runner VM: the rookie bay. 6 vCPU, 14 GB. Up to three single-use rookies, minded by Muster.',
  data: 'Data VM: the archivist. 2 vCPU, 2 GB. PostgreSQL 16 and MySQL 8.4.',
  compute:
    'Compute host: the ops floor. 4 vCPU, 4 GB. Switchboard, the Tunnel Twins, Vitals and one hero per Site instance.',
  deploy: 'Deploy runner: the quartermaster. 4 vCPU, 4 GB. Builds images, deploys and seeds lab Site instances.',
};
