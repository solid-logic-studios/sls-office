import { describe, expect, it } from 'vitest';
import type { Vm, VmRole, Workload } from '../../src/contract/snapshot.ts';
import type { Cue, LabSubject, Mood, Part, PlaceView, SceneStatus, StageView } from '../../src/contract/theme.ts';
import { boxesTheme } from '../../src/themes/boxes/index.ts';
import { RecordingPainter } from '../support/recording-painter.ts';

const CUES: Record<Cue, true> = {
  delivery: true,
  'new-arrival': true,
  'health-check': true,
  healthy: true,
  unhealthy: true,
  'old-one-out': true,
  'sent-home': true,
  'still-serving': true,
  'backup-start': true,
  'backup-locked': true,
  'backup-safe': true,
  'backup-failed': true,
  'pods-up': true,
  'pod-done': true,
  recovered: true,
  query: true,
  'query-answer': true,
  visitor: true,
  greet: true,
  'check-in-reply': true,
  'check-in-reply-busy': true,
  alarm: true,
};

const PARTS: Record<Part, true> = {
  worker: true,
  pod: true,
  greeter: true,
  guard: true,
  checker: true,
  keeper: true,
  courier: true,
  wrangler: true,
  founder: true,
};

const STATUSES: Record<Mood | SceneStatus, true> = {
  break: true,
  working: true,
  stressed: true,
  swamped: true,
  fainted: true,
  absent: true,
  'new-arrival': true,
  leaving: true,
  delivering: true,
  'backing-up': true,
  visiting: true,
};

function vm(role: VmRole, workloads: Workload[] = []): Vm {
  return { id: `vm-${role}`, role, name: `sls-${role}`, up: true, cpu: 20, mem: 30, workloads };
}

const SITE: Workload = {
  kind: 'site-instance',
  id: 'scrd-server-develop',
  client: 'scrd',
  site: 'server',
  env: 'develop',
  siteType: 'node-api',
  cpu: 10,
  mem: 20,
  health: 'healthy',
};

function service(kind: 'platform' | 'engine' | 'runner', name: string): Workload {
  return { kind, id: name, name, cpu: 1, mem: 1, health: 'healthy' };
}

const COMPUTE = vm('compute');
function workloadSubject(workload: Workload): LabSubject {
  return { kind: 'workload', vm: COMPUTE, workload };
}

const STAGE: StageView = {
  now: 1.5,
  hour: 13,
  host: null,
  vms: [vm('data'), COMPUTE, vm('deploy'), vm('ci')],
  findings: { ok: 3, warn: 1, crit: 0 },
  liftInUse: false,
  vaultOpen: false,
  openStores: new Set(),
  busyBreakSpots: new Set(),
};

describe('boxes theme words', () => {
  it('has a line for every cue', () => {
    for (const cue of Object.keys(CUES) as Cue[]) expect(boxesTheme.lines.cue[cue].length, cue).toBeGreaterThan(0);
  });

  it('has a status for every mood and scene status, and an offline label', () => {
    for (const key of Object.keys(STATUSES) as (Mood | SceneStatus)[]) {
      expect(boxesTheme.lines.status[key], key).not.toBe('');
    }
    expect(boxesTheme.lines.offline).toBe('OFFLINE');
  });

  it('has lines for every break spot kind it uses', () => {
    for (const spot of boxesTheme.layout.breakSpots) {
      expect(boxesTheme.lines.breakSpot[spot.kind]?.length, spot.kind).toBeGreaterThan(0);
    }
  });

  it('uses no em-dashes', () => {
    expect(JSON.stringify(boxesTheme.lines)).not.toContain('—');
  });
});

describe('boxes theme layout', () => {
  const { layout } = boxesTheme;
  const floor = layout.floors[0];

  it('has one floor 420 by 180', () => {
    expect(layout.floors).toHaveLength(1);
    expect([layout.width, layout.height]).toEqual([420, 180]);
  });

  it('gives every part at least one home, with the counts the Engine needs', () => {
    for (const part of Object.keys(PARTS) as Part[]) expect(layout.homes[part].length, part).toBeGreaterThan(0);
    expect(layout.homes.worker.length).toBeGreaterThanOrEqual(12);
    expect(layout.homes.pod.length).toBeGreaterThanOrEqual(3);
    expect(layout.homes.guard).toHaveLength(2);
    expect(layout.homes.founder).toHaveLength(2);
    expect(layout.breakSpots.length).toBeGreaterThanOrEqual(2);
    expect(layout.stores).toHaveLength(2);
  });

  it('keeps every seat and spot within the floor span', () => {
    expect(floor).toBeDefined();
    const xs = [
      ...Object.values(layout.homes).flatMap((places) => places.map((place) => place.seat.x)),
      ...layout.breakSpots.map((spot) => spot.x),
      ...layout.stores.map((spot) => spot.x),
      layout.vault.x,
      layout.podSpawn.x,
      layout.entrance.x,
    ];
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(floor?.minX ?? 0);
      expect(x).toBeLessThanOrEqual(floor?.maxX ?? 0);
    }
  });

  it('puts the entrance off the left edge and the vault near the right', () => {
    expect(layout.entrance.x).toBeLessThan(0);
    expect(layout.vault.x).toBeGreaterThan(layout.width - 30);
  });

  it('puts the four rooms side by side without overlap', () => {
    const rooms = [layout.rooms.data, layout.rooms.compute, layout.rooms.deploy, layout.rooms.ci];
    rooms.forEach((room, index) => {
      expect(room.blurb).not.toBe('');
      const next = rooms[index + 1];
      if (next) expect(room.x + room.w).toBeLessThanOrEqual(next.x);
    });
  });
});

describe('boxes theme casting', () => {
  const cast = (subject: LabSubject) => boxesTheme.cast(subject, 0);

  it('casts site instances as workers and CI pods as pods', () => {
    expect(cast(workloadSubject(SITE))?.part).toBe('worker');
    expect(cast(workloadSubject({ kind: 'ci-pod', id: 'pod-1', cpu: 1, mem: 1 }))?.part).toBe('pod');
  });

  it('casts platform workloads by name, and leaves the others uncast', () => {
    expect(cast(workloadSubject(service('platform', 'traefik')))?.part).toBe('greeter');
    expect(cast(workloadSubject(service('platform', 'cloudflared-1')))?.part).toBe('guard');
    expect(cast(workloadSubject(service('platform', 'gatus')))?.part).toBe('checker');
    expect(cast(workloadSubject(service('platform', 'something-else')))).toBeNull();
    expect(cast(workloadSubject(service('engine', 'postgres')))).toBeNull();
    expect(cast(workloadSubject(service('runner', 'runner')))).toBeNull();
  });

  it('casts VMs by role', () => {
    expect(cast({ kind: 'vm', vm: vm('data') })?.part).toBe('keeper');
    expect(cast({ kind: 'vm', vm: vm('deploy') })?.part).toBe('courier');
    expect(cast({ kind: 'vm', vm: vm('ci') })?.part).toBe('wrangler');
    expect(cast({ kind: 'vm', vm: vm('compute') })).toBeNull();
  });

  it('colours by part and writes plain blurbs', () => {
    const worker = cast(workloadSubject(SITE));
    const keeper = cast({ kind: 'vm', vm: vm('data') });
    expect(worker?.look).not.toEqual(keeper?.look);
    expect(worker?.blurb).toContain(SITE.id);
    expect(keeper?.blurb).toContain('sls-data');
  });

  it('makes every look a box, founders and visitor included', () => {
    const looks = [
      cast(workloadSubject(SITE))?.look,
      cast({ kind: 'vm', vm: vm('ci') })?.look,
      ...boxesTheme.founders.map((founder) => founder.look),
      boxesTheme.visitor.look(0.5),
    ];
    expect(looks.length).toBeGreaterThan(0);
    for (const look of looks) expect(look?.kind).toBe('box');
  });

  it('has two founders with lines and one legend entry per part colour', () => {
    expect(boxesTheme.founders.map((founder) => founder.name)).toEqual(['Founder A', 'Founder B']);
    for (const founder of boxesTheme.founders) {
      expect(founder.lines.idle.length).toBeGreaterThan(0);
      expect(founder.lines.checkIn.length).toBeGreaterThan(0);
      expect(founder.lines.alarm.length).toBeGreaterThan(0);
    }
    expect(boxesTheme.legend).toHaveLength(8);
    expect(new Set(boxesTheme.legend.map((entry) => entry.colour)).size).toBe(8);
  });
});

describe('boxes theme art', () => {
  it('paints all the decor against a sample stage without throwing', () => {
    const painter = new RecordingPainter();
    for (const draw of [...boxesTheme.decor.back, ...boxesTheme.decor.front]) draw(painter, STAGE);
    for (const prop of boxesTheme.decor.props) prop.draw(painter, STAGE);
    expect(painter.rects.length).toBeGreaterThan(0);
    expect(painter.texts).toEqual(expect.arrayContaining(['DATA', 'COMPUTE', 'DEPLOY', 'CI']));
  });

  it('paints every place, empty and occupied, without throwing', () => {
    const occupied: PlaceView['occupant'] = {
      subject: { kind: 'vm', vm: vm('data') },
      mood: 'working',
      atSeat: true,
    };
    for (const places of Object.values(boxesTheme.layout.homes)) {
      for (const place of places) {
        for (const occupant of [null, occupied]) {
          expect(() => place.art(new RecordingPainter(), { place, occupant, stage: STAGE })).not.toThrow();
        }
      }
    }
  });
});
