import type { SiteInstanceWorkload, Vm, VmRole } from '../../contract/snapshot.ts';
import type { Occupant, Place, PlaceArt, StageView } from '../../contract/theme.ts';
import { clamp, pen } from '../shared/pen.ts';
import { clientStyle } from './looks.ts';
import { ENV_PLATE, INK, PAPER } from './palette.ts';
import type { Pen } from '../shared/pen.ts';

/* ------------------------------------------------------------- shared furniture */

const vmOf = (stage: StageView, role: VmRole): Vm | undefined => stage.vms.find((vm) => vm.role === role);

/** Piles of paper grow with memory: none under 55%, one more for every 8 points, five at most. */
const paperPiles = (mem: number): number => clamp(Math.floor((mem - 55) / 8), 0, 5);

function siteWorkload(occupant: Occupant | null): SiteInstanceWorkload | null {
  const subject = occupant?.subject;
  return subject?.kind === 'workload' && subject.workload.kind === 'site-instance' ? subject.workload : null;
}

/** The bare desk: top, front and shadow. */
function deskBody({ R }: Pen, x: number, b: number, w: number): void {
  R('#7b5a3c', x, b - 9, w, 9);
  R('#684a30', x, b - 2, w, 2);
  R('#c9a777', x, b - 11, w, 2);
}

function monitor({ R }: Pen, now: number, mx: number, b: number, on: boolean): void {
  const flicker = Math.floor(now * 3 + mx) % 7 < 1;
  R('#2a2f3a', mx, b - 19, 9, 7);
  R(on ? (flicker ? '#9fd8ff' : '#6fb8f0') : '#161922', mx + 1, b - 18, 7, 5);
  if (on) R('#e4f4ff', mx + 2, b - 17 + (Math.floor(now * 2 + mx) % 3), 4, 1);
  R('#2a2f3a', mx + 3, b - 12, 3, 1);
}

/** A standing post has no furniture. */
export const postArt: PlaceArt = () => {};

/* ------------------------------------------------------------------ site desks */

function paintSiteNote({ R, T }: Pen, x: number, b: number, workload: SiteInstanceWorkload | null): void {
  // 'SICK' is 24 px wide and the desk is 24, so the note spills 2 px into the gap either side.
  R('#2a2533', x - 2, b - 21, 28, 9);
  R('#fff7c9', x - 1, b - 20, 26, 7);
  T(workload?.health === 'unhealthy' ? 'SICK' : 'BRB', x + 12, b - 14, '#c2352c', 'centre');
}

export const workerDeskArt: PlaceArt = (painter, { place, occupant, stage }) => {
  const pn = pen(painter);
  const { R, T } = pn;
  const { x, baseY: b, w } = place;
  const workload = siteWorkload(occupant);
  deskBody(pn, x, b, w);
  if (!occupant || !workload) {
    monitor(pn, stage.now, x + 1, b, false);
    return;
  }
  const away = occupant.mood === 'fainted' || occupant.mood === 'absent';
  R(clientStyle(workload.client).colour, x, b - 11, w, 1);
  monitor(pn, stage.now, x + 1, b, occupant.atSeat && !away);
  for (let i = 0; i < paperPiles(workload.mem); i++) {
    R(PAPER, x + 18, b - 12 - i * 2, 5, 1);
    R('#cfcab8', x + 18, b - 11 - i * 2, 5, 1);
  }
  const plate = ENV_PLATE[workload.env];
  R(plate.frame, x + 1, b - 8, 22, 7);
  R(plate.face, x + 2, b - 7, 20, 5);
  T(workload.site.slice(0, 3).toUpperCase(), x + 12, b - 2, INK, 'centre');
  if (occupant.mood === 'absent') paintSiteNote(pn, x, b, workload);
};

/* --------------------------------------------------------------- other furniture */

export const receptionDeskArt: PlaceArt = (painter, { place, stage }) => {
  const pn = pen(painter);
  const { R, T } = pn;
  const { x, baseY: b, w } = place;
  deskBody(pn, x, b, w);
  R('#3f8f9a', x, b - 11, w, 1);
  monitor(pn, stage.now, x + 3, b, vmOf(stage, 'compute')?.up ?? false);
  T('TRAEFIK', x + w / 2, b - 2, PAPER, 'centre');
  const ring = stage.findings.crit > 0 && Math.floor(stage.now * 10) % 2 === 1;
  const lift = ring ? 1 : 0;
  R('#2a2f3a', x + 34 + lift, b - 14, 7, 3);
  R('#4a5062', x + 33 + lift, b - 15, 9, 1);
  if (ring) {
    R('#f2c230', x + 31, b - 18, 1, 2);
    R('#f2c230', x + 44, b - 18, 1, 2);
    R('#f2c230', x + 37, b - 19, 2, 1);
  }
};

export const archiveDeskArt: PlaceArt = (painter, { place, stage }) => {
  const pn = pen(painter);
  const { R } = pn;
  const { x, baseY: b, w } = place;
  deskBody(pn, x, b, w);
  const data = vmOf(stage, 'data');
  monitor(pn, stage.now, x + 1, b, data?.up ?? false);
  R('#e2b84a', x + 19, b - 17, 3, 2);
  R('#39424d', x + 20, b - 15, 1, 4);
  const piles = data?.up ? paperPiles(data.mem) : 0;
  for (let i = 0; i < piles; i++) R(i % 2 ? '#cfcab8' : PAPER, x + 12, b - 12 - i, 6, 1);
};

export const founderDeskArt: PlaceArt = (painter, { place, occupant, stage }) => {
  const pn = pen(painter);
  const { R, T } = pn;
  const { x, baseY: b, w } = place;
  deskBody(pn, x, b, w);
  monitor(pn, stage.now, x + 2, b, true);
  R('#d9b24c', x + 21, b - 18, 7, 7);
  R('#bfe6fa', x + 22, b - 17, 5, 5);
  R('#e0a878', x + 22, b - 15, 1, 1);
  R('#e0a878', x + 26, b - 15, 1, 1);
  R('#e0a878', x + 24, b - 14, 1, 1);
  R('#e0563f', x + 22, b - 14, 1, 2);
  R('#3f8fd0', x + 26, b - 14, 1, 2);
  if (occupant?.subject.kind === 'founder')
    T(occupant.subject.founder.name.toUpperCase(), x + w / 2, b - 2, PAPER, 'centre');
};

export const podBenchArt: PlaceArt = (painter, { place, occupant }) => {
  const pn = pen(painter);
  const { R } = pn;
  const { x, baseY: b, w } = place;
  deskBody(pn, x, b, w);
  R('#8d94a0', x + 8, b - 16, 9, 5);
  R(occupant?.atSeat ? '#9fd8ff' : '#161922', x + 9, b - 15, 7, 3);
  R('#aab2ba', x + 7, b - 11, 11, 1);
};

/* ------------------------------------------------------------------ placements */

/** A character stands on the walk line here; the box is about the size of a person. */
export function standingPost(x: number, floor: number, walkY: number): Place {
  return { x: x - 6, w: 12, h: 22, baseY: walkY, floor, seat: { x }, art: postArt };
}
