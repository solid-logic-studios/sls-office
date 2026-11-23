import type { VmRole } from '../../contract/snapshot.ts';

/** Words for each VM, shared by its room tooltip and the character who stands for it. */
export const VM_BLURBS: Readonly<Record<VmRole, string>> = {
  ci: 'CI runner VM: the rookie bay. 6 vCPU, 14 GB. Up to three single-use rookies, minded by Captain America.',
  data: 'Data VM: Hulk in the archive vault. 2 vCPU, 2 GB. PostgreSQL 16 and MySQL 8.4.',
  compute:
    'Compute host: the ops floor. 4 vCPU, 4 GB. Nick Fury, the Hawkeyes, Black Widow and one Avenger per Site instance.',
  deploy: 'Deploy runner: Thor in the hangar. 4 vCPU, 4 GB. Builds images, deploys and seeds lab Site instances.',
};
