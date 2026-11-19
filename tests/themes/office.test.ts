import { describe, expect, it } from 'vitest';
import type {
  ServiceWorkload,
  Temps,
  SiteInstanceWorkload,
  Vm,
  VmRole,
  Workload,
} from '../../src/contract/snapshot.ts';
import type { Cue, LabSubject, Mood, Occupant, PersonLook, Place, Rect, StageView } from '../../src/contract/theme.ts';
import { PLAQUE, LAN_BOARD, REPLACE_NOTE } from '../../src/themes/office/boards.ts';
import { DOORWAYS, DOOR_HEIGHT } from '../../src/themes/office/doorways.ts';
import { officeTheme } from '../../src/themes/office/index.ts';
import { scoreAt } from '../../src/themes/office/scoreboard.ts';
import { TEMP_COLOURS, tempBand, type TempBand, type TempSensor } from '../../src/themes/office/temps.ts';
import { ROOF_SIGN } from '../../src/themes/office/shell.ts';
import type { PaintCall } from '../support/recording-painter.ts';
import { RecordingPainter } from '../support/recording-painter.ts';
import { expectSaneSound } from '../support/sane-sound.ts';

/* ------------------------------------------------------------------ helpers */

function site(over: Partial<SiteInstanceWorkload> = {}): SiteInstanceWorkload {
  return {
    kind: 'site-instance',
    id: 'scrd-server-develop',
    client: 'scrd',
    site: 'server',
    env: 'develop',
    siteType: 'node-api',
    cpu: 30,
    mem: 70,
    health: 'healthy',
    ...over,
  };
}

function service(kind: ServiceWorkload['kind'], name: string, over: Partial<ServiceWorkload> = {}): ServiceWorkload {
  return { kind, id: name, name, cpu: 10, mem: 20, health: 'healthy', ...over };
}

function vm(role: VmRole, workloads: Workload[] = [], over: Partial<Vm> = {}): Vm {
  return { id: role, role, name: `sls-${role}`, up: true, cpu: 20, mem: 60, workloads, ...over };
}

function stage(over: Partial<StageView> = {}): StageView {
  return {
    now: 12.3,
    hour: 12,
    host: { name: 'pve', cpu: 40, mem: 80, findings: { ok: 3, warn: 1, crit: 0 } },
    vms: [vm('data'), vm('compute', [site()])],
    findings: { ok: 3, warn: 2, crit: 1 },
    liftInUse: true,
    lift: { y: 242, doorsOpen: false, calls: new Set() },
    vaultOpen: true,
    openStores: new Set([0, 1]),
    busyBreakSpots: new Set([3, 6]),
    ...over,
  };
}

function occupant(mood: Mood, workload: Workload = site(), atSeat = true): Occupant {
  return { subject: { kind: 'workload', vm: vm('compute', [workload]), workload }, mood, atSeat };
}

const allPlaces = (): Place[] => Object.values(officeTheme.layout.homes).flat();

/** The blurb of one subject of every casting rule: each VM role, site instances, the platform services and a pod. */
function castBlurbs(): string[] {
  const compute = vm('compute');
  const onCompute = (workload: Workload): LabSubject => ({ kind: 'workload', vm: compute, workload });
  const subjects: LabSubject[] = [
    ...(['data', 'compute', 'deploy', 'ci'] as const).map((role): LabSubject => ({ kind: 'vm', vm: vm(role) })),
    onCompute(site({ client: 'scrd', env: 'production' })),
    onCompute(site({ client: 'scrd', env: 'develop' })),
    onCompute(site({ client: 'acme-co', env: 'production' })),
    onCompute(site({ client: 'acme-co', env: 'develop' })),
    onCompute(service('platform', 'traefik')),
    onCompute(service('platform', 'cloudflared-1')),
    onCompute(service('platform', 'gatus')),
    onCompute({ kind: 'ci-pod', id: 'pod-1', cpu: 90, mem: 40 }),
  ];
  return subjects.flatMap((subject) => officeTheme.cast(subject, 0)?.blurb ?? []);
}

/** The recorded calls from running every decor layer and every place's art. */
function paintEverything(view: StageView): RecordingPainter {
  const painter = new RecordingPainter();
  const { back, props, front } = officeTheme.decor;
  for (const fn of back) fn(painter, view);
  for (const prop of props) prop.draw(painter, view);
  for (const fn of front) fn(painter, view);
  const founder = officeTheme.founders[0];
  for (const place of allPlaces()) {
    place.art(painter, { place, occupant: null, stage: view });
    place.art(painter, { place, occupant: occupant('working'), stage: view });
    place.art(painter, { place, occupant: occupant('absent'), stage: view });
    if (founder) {
      const asFounder: Occupant = { subject: { kind: 'founder', founder }, mood: 'working', atSeat: true };
      place.art(painter, { place, occupant: asFounder, stage: view });
    }
  }
  return painter;
}

const NOON = stage();
const NIGHT = stage({ hour: 23, host: null, findings: { ok: 0, warn: 0, crit: 0 }, vaultOpen: false });

const hasDash = (text: string): boolean => /[–—]/.test(text);

type TextCall = Extract<PaintCall, { op: 'text' }>;

/** Left and right edge of a recorded text, from its anchor and alignment. */
function extent(call: TextCall, painter: RecordingPainter): readonly [number, number] {
  const width = painter.textWidth(call.text, call.style.bold);
  if (call.style.align === 'centre') return [call.x - width / 2, call.x + width / 2];
  if (call.style.align === 'right') return [call.x - width, call.x];
  return [call.x, call.x + width];
}

/* -------------------------------------------------------------------- tests */

describe('officeTheme words', () => {
  it('has no em-dash or en-dash anywhere it can say or draw', () => {
    const tips = [NOON, NIGHT].flatMap((view) => officeTheme.hotspots.map((h) => h.tip(view)));
    const said = JSON.stringify([
      officeTheme.name,
      officeTheme.lines,
      officeTheme.founders,
      officeTheme.visitor,
      officeTheme.legend,
      Object.values(officeTheme.layout.rooms).map((r) => r.blurb),
      tips,
      castBlurbs(),
    ]);
    expect(castBlurbs().length).toBeGreaterThan(8);
    expect(hasDash(said)).toBe(false);
    for (const view of [NOON, NIGHT]) {
      expect(paintEverything(view).texts.filter(hasDash)).toEqual([]);
    }
  });

  it('gives every cue and every break spot at least one non-empty line', () => {
    const cues = Object.keys({
      delivery: 1,
      'new-arrival': 1,
      'health-check': 1,
      healthy: 1,
      unhealthy: 1,
      'old-one-out': 1,
      'sent-home': 1,
      'still-serving': 1,
      'backup-start': 1,
      'backup-locked': 1,
      'backup-safe': 1,
      'backup-failed': 1,
      'pods-up': 1,
      'pod-done': 1,
      recovered: 1,
      query: 1,
      'query-answer': 1,
      visitor: 1,
      greet: 1,
      'check-in-reply': 1,
      'check-in-reply-busy': 1,
      alarm: 1,
    } satisfies Record<Cue, 1>);
    for (const cue of cues) {
      const lines = officeTheme.lines.cue[cue as Cue];
      expect(lines.length, cue).toBeGreaterThan(0);
      expect(
        lines.every((l) => l.length > 0),
        cue,
      ).toBe(true);
    }
    for (const spot of officeTheme.layout.breakSpots) {
      expect(officeTheme.lines.breakSpot[spot.kind]?.length, spot.kind).toBeGreaterThan(0);
    }
  });

  it('speaks in capitals, since the pixel font has no lower case', () => {
    const { mood, part, breakSpot, cue } = officeTheme.lines;
    const spoken = [mood, part, breakSpot, cue].flatMap((bank) => Object.values(bank).flat());
    const founders = officeTheme.founders.flatMap((f) => [...f.lines.idle, ...f.lines.checkIn, ...f.lines.alarm]);
    for (const line of [...spoken, ...founders]) expect(line).toBe(line.toUpperCase());
  });
});

describe('officeTheme layout', () => {
  const { layout } = officeTheme;

  it('has 12 worker desks and 3 pod benches', () => {
    expect(layout.homes.worker).toHaveLength(12);
    expect(layout.homes.pod).toHaveLength(3);
    expect(layout.homes.founder).toHaveLength(2);
  });

  it('keeps every seat and break spot on its floor walk line', () => {
    for (const place of allPlaces()) {
      const floor = layout.floors[place.floor];
      expect(floor).toBeDefined();
      expect(place.seat.x).toBeGreaterThanOrEqual(floor?.minX ?? Infinity);
      expect(place.seat.x).toBeLessThanOrEqual(floor?.maxX ?? -Infinity);
    }
    for (const spot of [...layout.breakSpots, layout.vault, layout.entrance, layout.podSpawn, ...layout.stores]) {
      const floor = layout.floors[spot.floor];
      expect(spot.x).toBeGreaterThanOrEqual(floor?.minX ?? Infinity);
      expect(spot.x).toBeLessThanOrEqual(floor?.maxX ?? -Infinity);
    }
  });

  it('keeps every place on the stage', () => {
    for (const p of allPlaces()) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x + p.w).toBeLessThanOrEqual(layout.width);
      expect(p.baseY - p.h).toBeGreaterThanOrEqual(0);
      expect(p.baseY).toBeLessThanOrEqual(layout.height);
    }
  });

  it('opens a doorway of at least 26 px wherever a walk line crosses a wall', () => {
    const wallsByFloor: Record<number, number[]> = { 0: [442, 470], 1: [140, 270, 442, 470] };
    for (const [floor, xs] of Object.entries(wallsByFloor)) {
      for (const x of xs) {
        const door = DOORWAYS.find((d) => d.floor === Number(floor) && d.x === x);
        expect(door, `floor ${floor} wall at ${x}`).toBeDefined();
      }
    }
    expect(DOOR_HEIGHT).toBeGreaterThanOrEqual(26);
  });
});

describe('officeTheme cast', () => {
  const compute = vm('compute');
  const cast = (workload: Workload, generation = 0) =>
    officeTheme.cast({ kind: 'workload', vm: compute, workload }, generation);
  const person = (look: PersonLook | { kind: string } | undefined): PersonLook => {
    if (look?.kind !== 'person') throw new Error('expected a person look');
    return look as PersonLook;
  };

  it('casts the VMs by role', () => {
    const byRole = (role: VmRole) => officeTheme.cast({ kind: 'vm', vm: vm(role) }, 0);
    expect(byRole('data')?.part).toBe('keeper');
    expect(byRole('ci')?.part).toBe('wrangler');
    expect(person(byRole('ci')?.look).carry).toBe('tablet');
    expect(byRole('deploy')?.part).toBe('courier');
    expect(person(byRole('deploy')?.look).hairStyle).toBe('hardhat');
    expect(byRole('compute')).toBeNull();
  });

  it('casts a site instance as a worker in its client colour, with the full names in the blurb', () => {
    const casting = cast(site());
    expect(casting?.part).toBe('worker');
    expect(person(casting?.look).shirt).toBe('#e0563f');
    expect(casting?.blurb).toBe('SCRD server (node-api), develop, a container on sls-compute');
    expect(cast(site({ client: 'forms-api' }))?.blurb).toContain('Forms API');
  });

  it('gives an unknown client a stable colour, and production a tie and trim', () => {
    const a = person(cast(site({ client: 'acme-co' }))?.look);
    const b = person(cast(site({ client: 'acme-co', id: 'other' }))?.look);
    expect(a.shirt).toBe(b.shirt);
    expect(a.shirt).not.toBe('#e0563f');
    const prod = person(cast(site({ client: 'acme-co', env: 'production' }))?.look);
    expect(prod.tie).toBe(a.shirt);
    expect(prod.trim).toBeDefined();
    expect(prod.shirt).not.toBe(a.shirt);
    expect(a.tie).toBeUndefined();
  });

  it('changes the face but not the shirt when the workload is redeployed', () => {
    const looks = [0, 1, 2, 3, 4, 5].map((g) => person(cast(site(), g)?.look));
    expect(new Set(looks.map((l) => l.shirt)).size).toBe(1);
    expect(new Set(looks.map((l) => `${l.skin}/${l.hair}/${l.hairStyle}`)).size).toBeGreaterThan(1);
    expect(person(cast(site(), 3)?.look)).toEqual(person(cast(site(), 3)?.look));
  });

  it('casts the platform containers by name and leaves the rest without a character', () => {
    expect(cast(service('platform', 'traefik'))?.part).toBe('greeter');
    expect(person(cast(service('platform', 'traefik'))?.look).headset).toBe(true);
    const guard = cast(service('platform', 'cloudflared-1'));
    expect(guard?.part).toBe('guard');
    expect(person(guard?.look).cap).toBe('#f38020');
    const checker = cast(service('platform', 'gatus'));
    expect(checker?.part).toBe('checker');
    expect(person(checker?.look).glasses).toBe(true);
    expect(person(checker?.look).carry).toBe('clipboard');
    expect(cast(service('platform', 'watchtower'))).toBeNull();
    expect(cast(service('engine', 'postgres'))).toBeNull();
    expect(cast(service('runner', 'runner-1'))).toBeNull();
  });

  it('casts a CI pod as a pod, varied by its id', () => {
    const pod = cast({ kind: 'ci-pod', id: 'pod-1', cpu: 90, mem: 40 });
    expect(pod?.part).toBe('pod');
    expect(pod?.blurb).toContain('sls-compute');
  });

  it('shows the founders and the visitor as people with blurbs', () => {
    expect(officeTheme.founders.map((f) => f.name)).toEqual(['Paul', 'Dhruv']);
    expect(person(officeTheme.founders[0]?.look).wide).toBe(true);
    expect(person(officeTheme.founders[0]?.look).hairStyle).toBe('thin');
    expect(officeTheme.visitor.title).toBe('Visitor');
    expect(officeTheme.visitor.look(0.4).kind).toBe('person');
    expect(officeTheme.visitor.look(1).kind).toBe('person');
  });
});

describe('officeTheme decor', () => {
  it.each([
    ['noon with a host', NOON],
    ['night without a host', NIGHT],
  ])('paints every layer and every place at %s', (_name, view) => {
    const painter = paintEverything(view);
    expect(painter.calls.length).toBeGreaterThan(500);
  });

  it('tints the building only after dark', () => {
    const [tint] = officeTheme.decor.front;
    const day = new RecordingPainter();
    const dark = new RecordingPainter();
    tint?.(day, NOON);
    tint?.(dark, NIGHT);
    expect(day.calls).toHaveLength(0);
    expect(dark.calls).toHaveLength(1);
  });

  it('puts the couch front in props, sorted at the couch base line', () => {
    expect(officeTheme.decor.props.map((p) => p.baseY)).toEqual([128]);
  });

  it('draws the host bars only when there is a host', () => {
    const withHost = paintEverything(
      stage({ host: { name: 'pve', cpu: 50, mem: 50, findings: { ok: 1, warn: 0, crit: 0 } } }),
    );
    const withoutHost = paintEverything(stage({ host: null }));
    expect(withHost.calls.length).toBeGreaterThan(withoutHost.calls.length);
  });

  it('keeps the scoreboard a pure function of time that alternates sports', () => {
    expect(scoreAt(31.4)).toEqual(scoreAt(31.4));
    const sports = new Set([0, 100, 200, 300].map((t) => scoreAt(t).sport));
    expect(sports).toEqual(new Set(['SQ', 'RB']));
    for (let t = 0; t < 400; t += 3) {
      const { sport, a, b } = scoreAt(t);
      expect(Math.max(a, b)).toBeLessThanOrEqual(sport === 'SQ' ? 13 : 17);
    }
  });
});

describe('officeTheme desks', () => {
  const [desk] = officeTheme.layout.homes.worker;
  const draw = (who: Occupant | null, view = NOON): RecordingPainter => {
    const painter = new RecordingPainter();
    if (!desk) throw new Error('no desk');
    desk.art(painter, { place: desk, occupant: who, stage: view });
    return painter;
  };

  it('shows SICK for an absent unhealthy occupant and BRB for one whose VM is down', () => {
    expect(draw(occupant('absent', site({ health: 'unhealthy' }))).texts).toContain('SICK');
    expect(draw(occupant('absent', site({ health: 'down' }))).texts).toContain('BRB');
    expect(draw(occupant('working')).texts).not.toContain('SICK');
    expect(draw(occupant('working')).texts).not.toContain('BRB');
  });

  it('tags the name plate with the first three letters of the site, and has no plate when empty', () => {
    expect(draw(occupant('working', site({ site: 'client' }))).texts).toEqual(['CLI']);
    expect(draw(null).texts).toEqual([]);
  });

  it('turns the monitor on only for someone at the seat who is not fainted or absent', () => {
    const lit = (who: Occupant): boolean =>
      draw(who).rects.some((r) => r.colour === '#6fb8f0' || r.colour === '#9fd8ff');
    expect(lit(occupant('working'))).toBe(true);
    expect(lit(occupant('working', site(), false))).toBe(false);
    expect(lit(occupant('fainted'))).toBe(false);
    expect(lit(occupant('absent'))).toBe(false);
  });
});

describe('officeTheme signs', () => {
  const painter = new RecordingPainter();
  officeTheme.decor.back.forEach((fn) => fn(painter, NOON));
  const textCalls = painter.calls.filter((c): c is TextCall => c.op === 'text');

  it.each<[string, Rect, number]>([
    ['OUR FIRST CLIENT', PLAQUE, 2],
    ['SMP BUILDCRETE', PLAQUE, 2],
    ['SOLID LOGIC STUDIOS', ROOF_SIGN, 2],
    ['LAN SAT', LAN_BOARD, 2],
    ['REPLACE', REPLACE_NOTE, 0],
    ['JAN 2027', REPLACE_NOTE, 0],
  ])('fits %s inside its board', (text, board, inset) => {
    const call = textCalls.find((c) => c.text === text && c.y >= board.y && c.y <= board.y + board.h);
    expect(call, text).toBeDefined();
    if (!call) return;
    const [left, right] = extent(call, painter);
    expect(left).toBeGreaterThanOrEqual(board.x + inset);
    expect(right).toBeLessThanOrEqual(board.x + board.w - inset);
  });
});

function tipFor(title: string, view: StageView) {
  const tip = officeTheme.hotspots.map((h) => h.tip(view)).find((t) => t.title === title);
  if (!tip) throw new Error(`no hotspot titled ${title}`);
  return tip;
}

describe('tempBand', () => {
  it.each<[TempSensor, number, TempBand]>([
    ['cpu', 69, 'cool'],
    ['cpu', 70, 'warm'],
    ['cpu', 85, 'warm'],
    ['cpu', 86, 'hot'],
    ['chipset', 69, 'cool'],
    ['chipset', 70, 'warm'],
    ['chipset', 80, 'warm'],
    ['chipset', 81, 'hot'],
    ['nvme', 59, 'cool'],
    ['nvme', 60, 'warm'],
    ['nvme', 70, 'warm'],
    ['nvme', 71, 'hot'],
  ])('%s at %i is %s', (sensor, celsius, band) => {
    expect(tempBand(sensor, celsius)).toBe(band);
  });
});

describe('officeTheme host temperatures', () => {
  const hostWith = (temps?: Temps): StageView =>
    stage({
      host: { name: 'pve', cpu: 40, mem: 80, findings: { ok: 3, warn: 1, crit: 0 }, ...(temps ? { temps } : {}) },
    });

  const paintBack = (view: StageView): RecordingPainter => {
    const painter = new RecordingPainter();
    for (const paint of officeTheme.decor.back) paint(painter, view);
    return painter;
  };

  const textCalls = (painter: RecordingPainter, text: string) =>
    painter.calls.filter((c): c is Extract<PaintCall, { op: 'text' }> => c.op === 'text' && c.text === text);

  const ledCount = (painter: RecordingPainter): number =>
    painter.rects.filter((r) => r.y === 253 && r.w === 2 && r.x >= 464 && r.x < 568).length;

  it('draws each reading in its band colour', () => {
    const painter = paintBack(hostWith({ cpu: 71, chipset: 67, nvme: 56 }));
    expect(textCalls(painter, '71').map((c) => c.colour)).toEqual([TEMP_COLOURS.warm]);
    expect(textCalls(painter, '67').map((c) => c.colour)).toEqual([TEMP_COLOURS.cool]);
    expect(textCalls(painter, '56').map((c) => c.colour)).toEqual([TEMP_COLOURS.cool]);
    expect(textCalls(painter, 'PCH')).toHaveLength(1);
    expect(ledCount(painter)).toBe(5);
  });

  it('draws a hot reading in the hot colour', () => {
    const painter = paintBack(hostWith({ cpu: 90, chipset: 67, nvme: 56 }));
    expect(textCalls(painter, '90').map((c) => c.colour)).toEqual([TEMP_COLOURS.hot]);
  });

  it('draws -- for a null or missing reading and never 0', () => {
    const nulls = paintBack(hostWith({ cpu: null, chipset: null, nvme: null }));
    expect(textCalls(nulls, '--').map((c) => c.colour)).toEqual([
      TEMP_COLOURS.unknown,
      TEMP_COLOURS.unknown,
      TEMP_COLOURS.unknown,
    ]);
    expect(textCalls(nulls, '0')).toHaveLength(0);
    const partial = paintBack(hostWith({ cpu: 50 }));
    expect(textCalls(partial, '50')).toHaveLength(1);
    expect(textCalls(partial, '--')).toHaveLength(2);
    expect(textCalls(partial, '0')).toHaveLength(0);
  });

  it('rounds a stray non-integer reading so it fits its column', () => {
    const painter = paintBack(hostWith({ cpu: 71.6 }));
    expect(textCalls(painter, '72').map((c) => c.colour)).toEqual([TEMP_COLOURS.warm]);
  });

  it('draws no panel and keeps all 16 rack LED columns without temps', () => {
    const painter = paintBack(hostWith());
    expect(textCalls(painter, 'PCH')).toHaveLength(0);
    expect(textCalls(painter, '--')).toHaveLength(0);
    expect(ledCount(painter)).toBe(16);
  });

  it('spells the readings out in the host tooltip', () => {
    expect(tipFor('pve', hostWith({ cpu: 71, chipset: 67, nvme: 56 }))).toMatchObject({
      status: expect.stringContaining('CPU 71 °C, chipset 67 °C, NVMe 56 °C'),
      severity: 'warn',
    });
    expect(tipFor('pve', hostWith({ cpu: 71, chipset: null })).status).toContain('chipset unreadable, NVMe unreadable');
  });

  it('turns the host tooltip critical when a reading is hot, and leaves it alone without temps', () => {
    expect(tipFor('pve', hostWith({ cpu: 71, chipset: 67, nvme: 75 })).severity).toBe('crit');
    expect(tipFor('pve', hostWith())).toMatchObject({
      status: 'Running. NVMe SMART warning acknowledged',
      severity: 'warn',
    });
  });
});

describe('officeTheme hotspots', () => {
  it('reads each cabinet from the data VM engine workloads, in order', () => {
    const engines = [
      service('engine', 'postgres', { cpu: 12, mem: 34 }),
      service('engine', 'mysql', { cpu: 56, mem: 78, health: 'unhealthy' }),
    ];
    const view = stage({ vms: [vm('data', engines)] });
    expect(tipFor('PostgreSQL 16', view)).toMatchObject({ cpu: 12, mem: 34, status: 'Healthy', severity: 'ok' });
    expect(tipFor('MySQL 8.4', view)).toMatchObject({ cpu: 56, mem: 78, status: 'Unhealthy', severity: 'crit' });
    const bare = tipFor('PostgreSQL 16', stage({ vms: [] }));
    expect(bare.cpu).toBeUndefined();
    expect(bare.mem).toBeUndefined();
  });

  it('reports the vault, the host strip and the alarm from the stage', () => {
    expect(tipFor('R2 vault', stage({ vaultOpen: true })).status).toBe('Backup in progress');
    expect(tipFor('R2 vault', stage({ vaultOpen: false })).status).toBe('Locked');
    expect(tipFor('pve', NOON)).toMatchObject({ cpu: 40, mem: 80 });
    expect(tipFor('Lab host', NIGHT).cpu).toBeUndefined();
    expect(tipFor('Discord alerts', NOON)).toMatchObject({ status: '1 critical', severity: 'crit' });
    expect(tipFor('Healthchecks.io', NIGHT)).toMatchObject({ status: 'Pinging', severity: 'ok' });
  });

  it('keeps every hotspot on the stage', () => {
    for (const { rect } of officeTheme.hotspots) {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.w).toBeLessThanOrEqual(officeTheme.layout.width);
      expect(rect.y + rect.h).toBeLessThanOrEqual(officeTheme.layout.height);
    }
  });
});

describe('the Office soundscape', () => {
  it('defines an Alarm, Reminder and All-clear of sane notes', () => {
    expectSaneSound(officeTheme.soundscape?.alarm);
    expectSaneSound(officeTheme.soundscape?.reminder);
    expectSaneSound(officeTheme.soundscape?.allClear);
  });

  it('sounds its three sounds differently', () => {
    const { alarm, reminder, allClear } = officeTheme.soundscape ?? {};
    expect(alarm).not.toEqual(reminder);
    expect(alarm).not.toEqual(allClear);
    expect(reminder).not.toEqual(allClear);
  });
});
