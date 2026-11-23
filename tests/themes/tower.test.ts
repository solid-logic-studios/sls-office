import { describe, expect, it } from 'vitest';
import type { CiPodWorkload, SiteInstanceWorkload, Temps, Vm, VmRole, Workload } from '../../src/contract/snapshot.ts';
import type { Occupant, Place, Rect, Spot, StageView, Tip } from '../../src/contract/theme.ts';
import { stageScale } from '../../src/page/stage-canvas.ts';
import { THEMES } from '../../src/themes/index.ts';
import { officeTheme } from '../../src/themes/office/index.ts';
import { TEMP_COLOURS } from '../../src/themes/office/temps.ts';
import { FINDINGS_LAMP } from '../../src/themes/tower/boards.ts';
import { LAMP_COLOURS, findingsLamp, paintOverflow } from '../../src/themes/tower/dressing.ts';
import { FLOOR, STOREYS, band } from '../../src/themes/tower/geometry.ts';
import { CAR_TOP_OFFSET, carTopAt } from '../../src/themes/tower/lift.ts';
import { towerTheme } from '../../src/themes/tower/index.ts';
import { RecordingPainter } from '../support/recording-painter.ts';

/** A shut lift car standing at the walk line `y`. */
const carAt = (y: number): StageView['lift'] => ({ y, moving: false, doorsOpen: false, calls: new Set() });

/* ------------------------------------------------------------------ helpers */

function site(i = 0): SiteInstanceWorkload {
  return {
    kind: 'site-instance',
    id: `site-${i}`,
    client: 'scrd',
    site: 'server',
    env: 'develop',
    siteType: 'node-api',
    cpu: 30,
    mem: 70,
    health: 'healthy',
  };
}

const pod = (i = 0): CiPodWorkload => ({ kind: 'ci-pod', id: `pod-${i}`, cpu: 90, mem: 40 });

function vm(role: VmRole, workloads: Workload[] = [], over: Partial<Vm> = {}): Vm {
  return { id: role, role, name: `sls-${role}`, up: true, cpu: 20, mem: 60, workloads, ...over };
}

function stage(over: Partial<StageView> = {}): StageView {
  return {
    now: 12.3,
    hour: 12,
    host: {
      name: 'pve',
      cpu: 40,
      mem: 80,
      findings: { ok: 3, warn: 1, crit: 0 },
      temps: { cpu: 71, chipset: 67, nvme: 56 },
    },
    vms: [
      vm('data', [
        { kind: 'engine', id: 'postgres', name: 'postgres', cpu: 12, mem: 34, health: 'healthy' },
        { kind: 'engine', id: 'mysql', name: 'mysql', cpu: 56, mem: 78, health: 'unhealthy' },
      ]),
      vm('compute', [site()]),
      vm('deploy', [{ kind: 'runner', id: 'runner-1', name: 'runner-1', cpu: 40, mem: 30, health: 'healthy' }]),
      vm('ci', [pod()]),
    ],
    findings: { ok: 3, warn: 2, crit: 1 },
    liftInUse: true,
    lift: carAt(band(FLOOR.lobby).walk),
    vaultOpen: true,
    openStores: new Set([0, 1]),
    busyBreakSpots: new Set([0]),
    ...over,
  };
}

const { layout } = towerTheme;
const allPlaces = (): Place[] => Object.values(layout.homes).flat();

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const hitBox = (p: Place): Rect => ({ x: p.x, y: p.baseY - p.h, w: p.w, h: p.h });

function occupant(): Occupant {
  const workload = site();
  return { subject: { kind: 'workload', vm: vm('compute', [workload]), workload }, mood: 'working', atSeat: true };
}

/** Every decor layer, every place's art (empty, occupied, a founder) and every hotspot tip. */
function paintEverything(view: StageView): { painter: RecordingPainter; tips: Tip[] } {
  const painter = new RecordingPainter();
  const { back, props, front } = towerTheme.decor;
  for (const fn of back) fn(painter, view);
  for (const prop of props) prop.draw(painter, view);
  for (const fn of front) fn(painter, view);
  const founder = towerTheme.founders[0];
  for (const place of allPlaces()) {
    place.art(painter, { place, occupant: null, stage: view });
    place.art(painter, { place, occupant: occupant(), stage: view });
    if (founder) {
      const asFounder: Occupant = { subject: { kind: 'founder', founder }, mood: 'working', atSeat: true };
      place.art(painter, { place, occupant: asFounder, stage: view });
    }
  }
  return { painter, tips: towerTheme.hotspots.map((h) => h.tip(view)) };
}

const paintBack = (view: StageView): RecordingPainter => {
  const painter = new RecordingPainter();
  for (const fn of towerTheme.decor.back) fn(painter, view);
  return painter;
};

/* -------------------------------------------------------------------- tests */

describe('towerTheme', () => {
  it('is listed after the Office', () => {
    expect(THEMES.map((t) => t.id)).toEqual(['office', 'tower', 'hq', 'boxes']);
    expect(towerTheme.name).toBe('Tower');
  });

  it("reuses the Office's world", () => {
    expect(towerTheme.cast).toBe(officeTheme.cast);
    expect(towerTheme.founders).toBe(officeTheme.founders);
    expect(towerTheme.lines).toBe(officeTheme.lines);
    expect(towerTheme.soundscape).toBe(officeTheme.soundscape);
  });
});

describe('towerTheme layout', () => {
  it('is 212 px wide and about 400 tall, with seven storeys', () => {
    expect(layout.width).toBe(212);
    expect(layout.height).toBeGreaterThanOrEqual(380);
    expect(layout.height).toBeLessThanOrEqual(420);
    expect(layout.floors).toHaveLength(7);
  });

  it('stacks the storeys 52 px apart, bottom first', () => {
    for (let i = 1; i < layout.floors.length; i++) {
      expect((layout.floors[i - 1]?.walkY ?? 0) - (layout.floors[i]?.walkY ?? 0)).toBe(52);
    }
  });

  it('reaches the lift from every floor', () => {
    for (const floor of layout.floors) {
      expect(layout.liftX).toBeGreaterThanOrEqual(floor.minX);
      expect(layout.liftX).toBeLessThanOrEqual(floor.maxX);
    }
  });

  it('puts every Place and Spot on a declared floor and inside its span', () => {
    const spots: Spot[] = [
      ...allPlaces().map((p) => ({ x: p.seat.x, floor: p.floor })),
      ...layout.breakSpots,
      ...layout.stores,
      layout.vault,
      layout.podSpawn,
      layout.entrance,
    ];
    for (const spot of spots) {
      const floor = layout.floors[spot.floor];
      expect(floor, `floor ${spot.floor}`).toBeDefined();
      expect(spot.x).toBeGreaterThanOrEqual(floor?.minX ?? Infinity);
      expect(spot.x).toBeLessThanOrEqual(floor?.maxX ?? -Infinity);
    }
    for (const place of allPlaces()) {
      const floor = layout.floors[place.floor];
      expect(place.x).toBeGreaterThanOrEqual(0);
      expect(place.x + place.w).toBeLessThanOrEqual(layout.liftX);
      expect(place.baseY).toBeLessThanOrEqual(floor?.walkY ?? -Infinity);
      expect(place.baseY - place.h).toBeGreaterThan((floor?.walkY ?? Infinity) - 52);
    }
  });

  it('enters from off stage on the left of the lobby', () => {
    expect(layout.entrance).toEqual({ x: -12, floor: 1 });
  });

  it('has the homes the Office has', () => {
    const counts = Object.fromEntries(Object.entries(layout.homes).map(([part, places]) => [part, places.length]));
    expect(counts).toEqual({
      worker: 12,
      pod: 3,
      greeter: 1,
      guard: 2,
      checker: 1,
      keeper: 1,
      courier: 1,
      wrangler: 1,
      founder: 2,
    });
    expect(layout.homes.worker.filter((p) => p.floor === 2)).toHaveLength(6);
    expect(layout.homes.worker.filter((p) => p.floor === 3)).toHaveLength(6);
    expect(layout.homes.pod.every((p) => p.floor === 5)).toBe(true);
    expect(layout.homes.founder.every((p) => p.floor === 6)).toBe(true);
    expect(layout.stores).toHaveLength(2);
    expect(layout.vault.floor).toBe(0);
  });

  it('keeps every Room inside the stage', () => {
    for (const room of Object.values(layout.rooms)) {
      expect(room.x).toBeGreaterThanOrEqual(0);
      expect(room.y).toBeGreaterThanOrEqual(0);
      expect(room.x + room.w).toBeLessThanOrEqual(layout.width);
      expect(room.y + room.h).toBeLessThanOrEqual(layout.height);
    }
  });

  it('gives every Place a hit box of at least 30 by 30, and no two overlap', () => {
    const places = allPlaces();
    for (const p of places) {
      expect(p.w).toBeGreaterThanOrEqual(30);
      expect(p.h).toBeGreaterThanOrEqual(30);
    }
    places.forEach((a, i) => {
      for (const b of places.slice(i + 1)) expect(overlaps(hitBox(a), hitBox(b))).toBe(false);
    });
  });

  it('covers the walk lines of G, 1 and 2 with the one compute Room', () => {
    const { compute } = layout.rooms;
    for (const index of [1, 2, 3]) {
      const walkY = layout.floors[index]?.walkY ?? -1;
      expect(walkY).toBeGreaterThanOrEqual(compute.y);
      expect(walkY).toBeLessThanOrEqual(compute.y + compute.h);
    }
    for (const index of [0, 4]) {
      const walkY = layout.floors[index]?.walkY ?? -1;
      expect(walkY >= compute.y && walkY <= compute.y + compute.h).toBe(false);
    }
  });
});

describe('the Tower stage width', () => {
  it.each([
    [320, 2, 3],
    [360, 3, 5],
    [375, 2, 3],
    [375, 3, 5],
    [393, 3, 5],
    [412, 2.625, 5],
    [430, 3, 6],
  ])('fits a %i px viewport at DPR %f with %i device px per art px', (viewport, dpr, scale) => {
    const device = stageScale(viewport, layout.width, dpr, 0);
    expect(device).toBe(scale);
    expect((device * layout.width) / dpr).toBeLessThanOrEqual(viewport);
  });
});

describe('towerTheme drawing', () => {
  it.each([
    ['noon', stage()],
    ['night', stage({ hour: 23, host: null, liftInUse: false, vaultOpen: false, openStores: new Set() })],
  ])('paints the same calls for the same stage at %s', (_name, view) => {
    const first = paintEverything(view);
    const second = paintEverything(view);
    expect(first.painter.calls.length).toBeGreaterThan(0);
    expect(second.painter.calls).toEqual(first.painter.calls);
    expect(second.tips).toEqual(first.tips);
  });

  it('paints day and night differently', () => {
    expect(paintEverything(stage({ hour: 23 })).painter.calls).not.toEqual(paintEverything(stage()).painter.calls);
  });

  it('shows the lift in use differently from idle', () => {
    expect(paintBack(stage({ liftInUse: true })).calls).not.toEqual(paintBack(stage({ liftInUse: false })).calls);
  });

  it('shows the lift in use differently from idle at the same spot', () => {
    expect(paintBack(stage({ liftInUse: true, lift: carAt(band(3).walk) })).calls).not.toEqual(
      paintBack(stage({ liftInUse: false, lift: carAt(band(3).walk) })).calls,
    );
  });

  it('keeps every hotspot on the stage', () => {
    for (const { rect } of towerTheme.hotspots) {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.w).toBeLessThanOrEqual(layout.width);
      expect(rect.y + rect.h).toBeLessThanOrEqual(layout.height);
    }
  });
});

describe('the Tower overflow signs', () => {
  const signs = (vms: Vm[]): string[] => {
    const painter = new RecordingPainter();
    paintOverflow(painter, stage({ vms }));
    return painter.texts;
  };
  const sites = (n: number): Workload[] => Array.from({ length: n }, (_, i) => site(i));
  const pods = (n: number): Workload[] => Array.from({ length: n }, (_, i) => pod(i));

  it('paints nothing at capacity', () => {
    expect(signs([vm('compute', sites(12)), vm('ci', pods(3))])).toEqual([]);
    expect(signs([])).toEqual([]);
  });

  it('counts the 13th site instance across every VM', () => {
    expect(signs([vm('compute', sites(12)), vm('data', [site(99)])])).toEqual(['+1']);
  });

  it('counts the 4th pod', () => {
    expect(signs([vm('ci', pods(4))])).toEqual(['+1']);
    expect(signs([vm('compute', sites(15)), vm('ci', pods(5))])).toEqual(['+3', '+2']);
  });
});

describe('the Tower host temperatures', () => {
  const hostWith = (temps?: Temps): StageView =>
    stage({
      host: { name: 'pve', cpu: 40, mem: 80, findings: { ok: 3, warn: 1, crit: 0 }, ...(temps ? { temps } : {}) },
    });
  const hostTip = (view: StageView): Tip => {
    const tip = towerTheme.hotspots.map((h) => h.tip(view)).find((t) => t.title === 'pve');
    if (!tip) throw new Error('no host hotspot');
    return tip;
  };
  const coloursOf = (painter: RecordingPainter, text: string): string[] =>
    painter.calls.flatMap((c) => (c.op === 'text' && c.text === text ? [c.colour] : []));

  it('shows all three readings in their band colours', () => {
    const painter = paintBack(hostWith({ cpu: 71, chipset: 67, nvme: 56 }));
    expect(coloursOf(painter, '71')).toEqual([TEMP_COLOURS.warm]);
    expect(coloursOf(painter, '67')).toEqual([TEMP_COLOURS.cool]);
    expect(coloursOf(painter, '56')).toEqual([TEMP_COLOURS.cool]);
    expect(hostTip(hostWith({ cpu: 71, chipset: 67, nvme: 56 })).status).toContain(
      'CPU 71 °C, chipset 67 °C, NVMe 56 °C',
    );
  });

  it('shows a null reading as unreadable, never 0', () => {
    const view = hostWith({ cpu: 71, chipset: null, nvme: 56 });
    const painter = paintBack(view);
    expect(coloursOf(painter, '--')).toEqual([TEMP_COLOURS.unknown]);
    expect(painter.texts).not.toContain('0');
    expect(hostTip(view).status).toContain('chipset unreadable');
    expect(hostTip(view).status).not.toContain('chipset 0');
  });

  it('draws no gauges without temps, and still explains the host', () => {
    const painter = paintBack(hostWith());
    expect(painter.texts).not.toContain('PCH');
    expect(painter.texts).not.toContain('--');
    expect(hostTip(hostWith()).status).toBe('Running. NVMe SMART warning acknowledged');
  });
});

describe('the Tower findings lamp', () => {
  it.each([
    [{ ok: 1, warn: 2, crit: 1 }, LAMP_COLOURS.crit, 'crit'],
    [{ ok: 1, warn: 2, crit: 0 }, LAMP_COLOURS.warn, 'warn'],
    [{ ok: 4, warn: 0, crit: 0 }, LAMP_COLOURS.ok, 'ok'],
  ])('lights %o as %s', (findings, colour, severity) => {
    expect(findingsLamp(findings)).toBe(colour);
    const lamp = towerTheme.hotspots.find((h) => h.rect === FINDINGS_LAMP);
    expect(lamp?.tip(stage({ findings })).severity).toBe(severity);
    expect(paintBack(stage({ findings })).rects.some((r) => r.colour === colour)).toBe(true);
  });
});

describe('the Tower hotspots', () => {
  const tip = (title: string, view: StageView): Tip => {
    const found = towerTheme.hotspots.map((h) => h.tip(view)).find((t) => t.title === title);
    if (!found) throw new Error(`no hotspot titled ${title}`);
    return found;
  };

  it('reads the cabinets from the engine workloads and the rack from the runner', () => {
    expect(tip('PostgreSQL 16', stage())).toMatchObject({ cpu: 12, mem: 34, severity: 'ok' });
    expect(tip('MySQL 8.4', stage())).toMatchObject({ status: 'Unhealthy', severity: 'crit' });
    expect(tip('runner-1', stage())).toMatchObject({ cpu: 40, mem: 30, status: 'Healthy' });
    expect(tip('Deploy runner', stage({ vms: [] })).cpu).toBeUndefined();
  });
});

describe('the Tower lift car', () => {
  const CAR_LIT = '#fff2c4';
  const CAR_FRAME = '#c9a14a';
  const litCar = (view: StageView) => paintBack(view).rects.find((rect) => rect.colour === CAR_LIT);

  it('sits the same distance above the walk line on every floor', () => {
    for (let floor = 0; floor < STOREYS; floor++) {
      expect(band(floor).walk - (band(floor).back - 24)).toBe(CAR_TOP_OFFSET);
      expect(carTopAt(band(floor).walk)).toBe(band(floor).back - 24);
    }
  });

  it('is drawn lit at the walk line the Engine reports, wherever that is', () => {
    for (const walkY of [band(FLOOR.basement).walk, band(4).walk, (band(4).walk + band(5).walk) / 2]) {
      expect(litCar(stage({ liftInUse: true, lift: carAt(walkY) }))?.y).toBe(carTopAt(walkY));
    }
  });

  it('frames the lit car, and parks in the lobby when the Engine has no position yet', () => {
    const lobbyTop = carTopAt(band(FLOOR.lobby).walk);
    const view = stage({ liftInUse: true, lift: carAt(lobbyTop + CAR_TOP_OFFSET) });
    expect(litCar(view)?.y).toBe(lobbyTop);
    expect(paintBack(view).rects.some((rect) => rect.colour === CAR_FRAME && rect.y === lobbyTop - 1)).toBe(true);
  });

  it('parks shut at the floor it last stopped at when idle', () => {
    const parked = (walkY: number): number | undefined =>
      paintBack(stage({ liftInUse: false, lift: carAt(walkY) })).rects.find(
        (rect) => rect.colour === CAR_FRAME && rect.h === 2,
      )?.y;
    expect(litCar(stage({ liftInUse: false, lift: carAt(band(5).walk) }))).toBeUndefined();
    expect(parked(band(5).walk)).toBe(carTopAt(band(5).walk));
    expect(parked(band(FLOOR.lobby).walk)).toBe(carTopAt(band(FLOOR.lobby).walk));
  });

  describe('doors and lamps', () => {
    const DOOR_DARK = '#2a2533';
    const LAMP_BUSY = '#f2c230';
    const gaps = (view: StageView) =>
      paintBack(view).rects.filter((rect) => rect.colour === DOOR_DARK && rect.h === 24);
    const lamp = (view: StageView, floor: number) =>
      paintBack(view).rects.find((rect) => rect.w === 4 && rect.h === 1 && rect.y === carTopAt(band(floor).walk) - 4);
    const between = (band(3).walk + band(4).walk) / 2;

    it('shows the car door gap only while the doors are open', () => {
      const open = stage({ liftInUse: true, lift: { y: between, moving: false, doorsOpen: true, calls: new Set() } });
      const shut = stage({ liftInUse: true, lift: { y: between, moving: false, doorsOpen: false, calls: new Set() } });
      expect(gaps(open).some((rect) => rect.y === carTopAt(between))).toBe(true);
      expect(gaps(shut)).toHaveLength(0);
    });

    it('opens the landing doors only on the car floor while the doors are open', () => {
      const walkY = band(3).walk;
      const open = stage({ liftInUse: true, lift: { y: walkY, moving: false, doorsOpen: true, calls: new Set() } });
      const landing = gaps(open).map((rect) => rect.y);
      expect(landing).toContain(carTopAt(walkY));
      for (let floor = 0; floor < STOREYS; floor++) {
        if (floor !== 3) expect(landing).not.toContain(carTopAt(band(floor).walk));
      }
      expect(gaps(stage({ liftInUse: true, lift: carAt(walkY) }))).toHaveLength(0);
    });

    it('lights a landing lamp amber only for floors with a call', () => {
      const view = stage({ lift: { y: between, moving: false, doorsOpen: false, calls: new Set([2, 5]) } });
      for (let floor = 0; floor < STOREYS; floor++) {
        expect(lamp(view, floor)?.colour === LAMP_BUSY).toBe(floor === 2 || floor === 5);
      }
    });

    it('runs the cables only while the car travels', () => {
      const cables = (view: StageView) =>
        paintBack(view).rects.filter((rect) => rect.colour === '#55506a' && rect.h === 2);
      const walkY = band(3).walk;
      expect(cables(stage({ liftInUse: true, lift: { ...carAt(between), moving: true } })).length).toBeGreaterThan(0);
      expect(cables(stage({ liftInUse: false, lift: { ...carAt(between), moving: true } })).length).toBeGreaterThan(0);
      expect(cables(stage({ liftInUse: true, lift: carAt(walkY) }))).toHaveLength(0);
      expect(cables(stage({ liftInUse: true, lift: { ...carAt(walkY), doorsOpen: true } }))).toHaveLength(0);
    });
  });

  describe('the car body', () => {
    const lit = (view: StageView) => paintBack(view).rects.some((rect) => rect.colour === '#fff2c4');
    const walkY = band(3).walk;

    it("is drawn while the doors are open with nobody about (the last rider's dwell)", () => {
      expect(lit(stage({ liftInUse: false, lift: { ...carAt(walkY), doorsOpen: true } }))).toBe(true);
    });

    it('is drawn while the car moves with nobody about (a cancelled call)', () => {
      expect(lit(stage({ liftInUse: false, lift: { ...carAt(walkY), moving: true } }))).toBe(true);
    });

    it('shows only the gold cap when idle with nobody about', () => {
      expect(lit(stage({ liftInUse: false, lift: carAt(walkY) }))).toBe(false);
    });
  });
});
