import type { Room } from '../../contract/theme.ts';
import type { VmRole } from '../../contract/snapshot.ts';

/** Words for each VM, shared by its room tooltip and the character who stands for it. */
export const VM_BLURBS: Readonly<Record<VmRole, string>> = {
  ci: 'CI runner VM: the intern pool. 6 vCPU, 14 GB. Up to three single-use pods, managed by the Autoscaler.',
  data: 'Data VM: the Archivist. 2 vCPU, 2 GB. PostgreSQL 16 and MySQL 8.4.',
  compute:
    'Compute host: the open-plan floor. 4 vCPU, 4 GB. Traefik, cloudflared x2, Gatus and one container per Site instance.',
  deploy: 'Deploy runner: the Builder. 4 vCPU, 4 GB. Builds images, deploys and seeds lab Site instances.',
};

export const ROOMS: Readonly<Record<VmRole, Room>> = {
  ci: { x: 14, y: 44, w: 126, h: 92, blurb: VM_BLURBS.ci },
  data: { x: 144, y: 44, w: 126, h: 92, blurb: VM_BLURBS.data },
  compute: { x: 14, y: 150, w: 428, h: 94, blurb: VM_BLURBS.compute },
  deploy: { x: 474, y: 150, w: 88, h: 94, blurb: VM_BLURBS.deploy },
};
