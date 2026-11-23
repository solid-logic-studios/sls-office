import type { VmRole } from '../../contract/snapshot.ts';
import { POSTS } from './avengers.ts';

/** Words for each VM, shared by its room tooltip and the character who stands for it. */
export const VM_BLURBS: Readonly<Record<VmRole, string>> = {
  ci: `CI runner VM: the rookie bay. 6 vCPU, 14 GB. Up to three single-use rookies, minded by ${POSTS.wrangler.name}.`,
  data: `Data VM: ${POSTS.keeper.name} in the archive vault. 2 vCPU, 2 GB. PostgreSQL 16 and MySQL 8.4.`,
  compute: `Compute host: the ops floor. 4 vCPU, 4 GB. ${POSTS.greeter.name}, the Hawkeyes, ${POSTS.checker.name} and one Avenger per Site instance.`,
  deploy: `Deploy runner: ${POSTS.courier.name} in the hangar. 4 vCPU, 4 GB. Builds images, deploys and seeds lab Site instances.`,
};
