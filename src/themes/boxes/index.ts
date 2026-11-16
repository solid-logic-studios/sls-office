/**
 * A throwaway Theme with no art: everything is a plain coloured box, on a layout of its own (one
 * floor, four rooms side by side). It exists to prove the Engine has no Office-specific code.
 */

import type { Painter } from '../../contract/painter.ts';
import type { VmRole, Workload } from '../../contract/snapshot.ts';
import type {
  BoxLook,
  Casting,
  DecorFn,
  LabSubject,
  Founder,
  Layout,
  LegendEntry,
  LineBank,
  Part,
  Place,
  PlaceArt,
  Room,
  Theme,
} from '../../contract/theme.ts';

type CastPart = Exclude<Part, 'founder'>;

const WIDTH = 420;
const HEIGHT = 180;
const WALK_Y = 150;
const FLOOR_TOP = 146;
const POST_BASE = 146;

const INK = '#2a2a33';
const PAPER = '#ece8dc';
const FLOOR = '#b9b09c';
const DESK = '#8a7a5a';
const BENCH = '#6a6a8a';

const PART_COLOURS: Readonly<Record<CastPart, string>> = {
  worker: '#4a90d9',
  pod: '#9ad0f5',
  greeter: '#e0a030',
  guard: '#e07030',
  checker: '#4aa86b',
  keeper: '#8a5ab0',
  courier: '#d0b020',
  wrangler: '#c05080',
};

const PART_LABELS: Readonly<Record<CastPart, string>> = {
  worker: 'Worker: site instance',
  pod: 'Pod: CI job',
  greeter: 'Greeter: Traefik',
  guard: 'Guard: cloudflared',
  checker: 'Checker: Gatus',
  keeper: 'Keeper: data VM',
  courier: 'Courier: deploy VM',
  wrangler: 'Wrangler: CI VM',
};

const ROLES: readonly VmRole[] = ['data', 'compute', 'deploy', 'ci'];

function box(colour: string, w = 8, h = 14): BoxLook {
  return { kind: 'box', colour, w, h };
}

/* ------------------------------------------------------------------- layout */

const ROOM_Y = 16;
const ROOM_H = 128;
const ROOM_W = 96;
const ROOM_STEP = 102;
const ROOM_X0 = 6;

function roomAt(index: number, role: VmRole): Room {
  return {
    x: ROOM_X0 + index * ROOM_STEP,
    y: ROOM_Y,
    w: ROOM_W,
    h: ROOM_H,
    blurb: `The ${role} room, one VM drawn as a box`,
  };
}

const ROOMS: Readonly<Record<VmRole, Room>> = {
  data: roomAt(0, 'data'),
  compute: roomAt(1, 'compute'),
  deploy: roomAt(2, 'deploy'),
  ci: roomAt(3, 'ci'),
};

const flat =
  (colour: string, w: number, h: number, x: number, baseY: number): PlaceArt =>
  (painter) =>
    painter.rect(colour, x, baseY - h, w, h);

const nothing: PlaceArt = () => {};

function desks(count: number, x0: number, step: number, w: number, h: number, colour: string): Place[] {
  return Array.from({ length: count }, (_, index) => {
    const x = x0 + index * step;
    return { x, w, h, baseY: POST_BASE, floor: 0, seat: { x: x + w / 2 }, art: flat(colour, w, h, x, POST_BASE) };
  });
}

/** A standing place draws nothing: the occupant is the only thing to see. */
function posts(count: number, x0: number): Place[] {
  return Array.from({ length: count }, (_, index) => {
    const x = x0 + index * 8;
    return { x, w: 6, h: 14, baseY: POST_BASE, floor: 0, seat: { x: x + 3 }, art: nothing };
  });
}

const LAYOUT: Layout = {
  width: WIDTH,
  height: HEIGHT,
  floors: [{ walkY: WALK_Y, minX: -10, maxX: 430 }],
  liftX: 210,
  entrance: { x: -10, floor: 0 },
  rooms: ROOMS,
  homes: {
    worker: desks(12, 6, 22, 16, 6, DESK),
    pod: desks(3, 272, 24, 18, 4, BENCH),
    greeter: posts(1, 346),
    guard: posts(2, 354),
    checker: posts(1, 370),
    keeper: posts(1, 378),
    courier: posts(1, 386),
    wrangler: posts(1, 394),
    founder: posts(2, 402),
  },
  breakSpots: [
    { x: 130, floor: 0, kind: 'couch' },
    { x: 160, floor: 0, kind: 'couch' },
    { x: 190, floor: 0, kind: 'cooler' },
  ],
  stores: [
    { x: 20, floor: 0 },
    { x: 50, floor: 0 },
  ],
  vault: { x: 405, floor: 0 },
  podSpawn: { x: 430, floor: 0 },
};

/* -------------------------------------------------------------------- words */

const LINES: LineBank = {
  status: {
    break: 'BREAK',
    working: 'WORKING',
    stressed: 'STRESSED',
    swamped: 'SWAMPED',
    fainted: 'FAINTED',
    absent: 'ABSENT',
    'new-arrival': 'NEW',
    leaving: 'LEAVING',
    delivering: 'DELIVERING',
    'backing-up': 'BACKING UP',
    visiting: 'VISITING',
  },
  offline: 'OFFLINE',
  mood: {
    working: ['WORKING'],
    stressed: ['BUSY'],
    swamped: ['TOO MUCH'],
    break: ['BREAK'],
  },
  part: {
    greeter: ['HELLO'],
    guard: ['HALT'],
    checker: ['CHECKING'],
    keeper: ['FILING'],
    courier: ['DELIVERY'],
    wrangler: ['PODS'],
    founder: ['HMM'],
  },
  breakSpot: {
    couch: ['SITTING'],
    cooler: ['WATER'],
  },
  cue: {
    delivery: ['DELIVERY'],
    'new-arrival': ['NEW BOX'],
    'health-check': ['CHECKING'],
    healthy: ['HEALTHY'],
    unhealthy: ['UNHEALTHY'],
    'old-one-out': ['OUT'],
    'sent-home': ['HOME'],
    'still-serving': ['SERVING'],
    'backup-start': ['BACKUP'],
    'backup-locked': ['LOCKED'],
    'backup-safe': ['SAFE'],
    'backup-failed': ['FAILED'],
    'pods-up': ['PODS UP'],
    'pod-done': ['DONE'],
    recovered: ['BACK'],
    query: ['QUERY'],
    'query-answer': ['ANSWER'],
    visitor: ['REQUEST'],
    greet: ['HELLO'],
    'check-in-reply': ['FINE'],
    'check-in-reply-busy': ['BUSY'],
    alarm: ['ALARM'],
  },
};

function founder(id: string, name: string, colour: string, idle: readonly string[]): Founder {
  return {
    id,
    name,
    blurb: 'A plain box standing in for a founder.',
    look: box(colour),
    lines: { idle, checkIn: ['HOW GOES IT?'], alarm: ['ALARM!', 'ALL HANDS'] },
  };
}

const FOUNDERS: readonly Founder[] = [
  founder('founder-a', 'Founder A', '#35507a', ['HMM']),
  founder('founder-b', 'Founder B', '#2f8f5b', ['HMM', 'OK']),
];

/* ------------------------------------------------------------------- casting */

function cast(subject: LabSubject): Casting | null {
  if (subject.kind === 'vm') {
    const { vm } = subject;
    const part = vmPart(vm.role);
    return part === null ? null : casting(part, `${vm.name}, VM`);
  }
  const { workload } = subject;
  const part = workloadPart(workload);
  return part === null ? null : casting(part, `${workload.id}, ${workload.kind}`);
}

function casting(part: CastPart, blurb: string): Casting {
  return { part, look: box(PART_COLOURS[part], part === 'pod' ? 6 : 8, part === 'pod' ? 10 : 14), blurb };
}

function vmPart(role: VmRole): CastPart | null {
  switch (role) {
    case 'data':
      return 'keeper';
    case 'deploy':
      return 'courier';
    case 'ci':
      return 'wrangler';
    case 'compute':
      return null;
  }
}

function workloadPart(workload: Workload): CastPart | null {
  switch (workload.kind) {
    case 'site-instance':
      return 'worker';
    case 'ci-pod':
      return 'pod';
    case 'platform':
      if (workload.name.startsWith('traefik')) return 'greeter';
      if (workload.name.startsWith('cloudflared')) return 'guard';
      if (workload.name.startsWith('gatus')) return 'checker';
      return null;
    case 'engine':
    case 'runner':
      return null;
  }
}

/* -------------------------------------------------------------------- decor */

function outline(painter: Painter, colour: string, x: number, y: number, w: number, h: number): void {
  painter.rect(colour, x, y, w, 1);
  painter.rect(colour, x, y + h - 1, w, 1);
  painter.rect(colour, x, y, 1, h);
  painter.rect(colour, x + w - 1, y, 1, h);
}

const background: DecorFn = (painter) => painter.rect(PAPER, 0, 0, WIDTH, HEIGHT);
const floor: DecorFn = (painter) => painter.rect(FLOOR, 0, FLOOR_TOP, WIDTH, HEIGHT - FLOOR_TOP);
const rooms: DecorFn = (painter) => {
  for (const role of ROLES) {
    const room = ROOMS[role];
    outline(painter, INK, room.x, room.y, room.w, room.h);
    painter.text(role.toUpperCase(), room.x + 4, room.y + 12, INK);
  }
};

const CAST_PARTS: readonly CastPart[] = [
  'worker',
  'pod',
  'greeter',
  'guard',
  'checker',
  'keeper',
  'courier',
  'wrangler',
];

const LEGEND: readonly LegendEntry[] = CAST_PARTS.map((part) => ({
  colour: PART_COLOURS[part],
  label: PART_LABELS[part],
}));

export const boxesTheme: Theme = {
  id: 'boxes',
  name: 'Boxes',
  layout: LAYOUT,
  cast,
  founders: FOUNDERS,
  visitor: {
    look: () => box('#9a9a9a', 5, 8),
    title: 'Visitor',
    blurb: 'A request, shown as a small grey box.',
  },
  lines: LINES,
  decor: { back: [background, floor, rooms], props: [], front: [] },
  hotspots: [],
  legend: LEGEND,
};
