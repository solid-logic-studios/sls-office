import { describe, expect, it } from 'vitest';
import type { CiPodWorkload, SiteInstanceWorkload, Temps, Vm, VmRole, Workload } from '../../src/contract/snapshot.ts';
import type { DecorFn, Occupant, Place, Rect, Spot, StageView, Tip } from '../../src/contract/theme.ts';
import { stageScale } from '../../src/page/stage-canvas.ts';
import { THEMES } from '../../src/themes/index.ts';
import { hqTheme } from '../../src/themes/hq/index.ts';
import { READOUT_MIN_WIDTH, jarvisConsole } from '../../src/themes/hq/jarvis-console.ts';
import { powerCore } from '../../src/themes/hq/core.ts';
import { TEMP_COLOURS } from '../../src/themes/shared/temps.ts';
import {
  CORE,
  COUCH_RECT,
  FINDINGS_LAMP,
  GEAR_RACK,
  HOLO_PEDESTAL,
  JARVIS,
  JARVIS_ORB,
  POD_OVERFLOW,
  SILO,
  SITE_OVERFLOW,
  TEMP_STRIP,
} from '../../src/themes/spire/boards.ts';
import { DRESSING_BACK, DRESSING_PROPS, LAMP_COLOURS, paintOverflow } from '../../src/themes/spire/dressing.ts';
import { AXIS, DOOR_HEIGHT, FLOOR, ROOF, SHAFT_WALL, STOREYS, band } from '../../src/themes/spire/geometry.ts';
import { spireTheme } from '../../src/themes/spire/index.ts';
import { LIFT_COLOURS, carTopAt } from '../../src/themes/spire/lift.ts';
import { confine } from '../../src/themes/spire/relocate.ts';
import {
  BAG,
  BEACONS,
  BREW,
  BUNKER,
  CLOCK,
  DISPATCH,
  GATEWAY,
  MYSQL,
  PGSQL,
  RUNNER_LIGHTS,
  SHIELD,
  TROPHY,
  TUBE,
} from '../../src/themes/spire/set.ts';
import { DOORWAYS } from '../../src/themes/spire/shell.ts';
import { RecordingPainter } from '../support/recording-painter.ts';

/* ------------------------------------------------------------------ helpers */

const carAt = (y: number): StageView['lift'] => ({ y, moving: false, doorsOpen: false, calls: new Set() });

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
      vm('compute', [site(0), site(1), site(2)]),
      vm('deploy', [{ kind: 'runner', id: 'runner-1', name: 'runner-1', cpu: 40, mem: 30, health: 'healthy' }]),
      vm('ci', [pod()]),
    ],
    findings: { ok: 3, warn: 2, crit: 0 },
    liftInUse: true,
    lift: carAt(band(FLOOR.gate).walk),
    vaultOpen: false,
    openStores: new Set([0, 1]),
    busyBreakSpots: new Set([0, 2, 5, 6, 7]),
    ...over,
  };
}

/** The stages every drawing test sweeps: day, night, all hands, a backup, a deploy and before the first Snapshot. */
const STAGES: readonly (readonly [string, StageView])[] = [
  ['noon', stage()],
  ['night', stage({ hour: 23, liftInUse: false, openStores: new Set(), busyBreakSpots: new Set() })],
  ['all hands', stage({ findings: { ok: 1, warn: 0, crit: 2 }, now: 3.7 })],
  ['a backup', stage({ vaultOpen: true, now: 40.1 })],
  ['waking', stage({ host: null, vms: [], now: 0.4 })],
];

const { layout } = spireTheme;
const allPlaces = (): Place[] => Object.values(layout.homes).flat();

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (outer: Rect, inner: Rect): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.w <= outer.x + outer.w &&
  inner.y + inner.h <= outer.y + outer.h;
const hitBox = (p: Place): Rect => ({ x: p.x, y: p.baseY - p.h, w: p.w, h: p.h });

/** The box a line of pixel-font text covers (6 px a character, 7 bold, 7 px above the baseline). */
function textBox(call: { text: string; x: number; y: number; style: { align?: string; bold?: boolean } }): Rect {
  const w = call.text.length * (call.style.bold ? 7 : 6);
  const left = call.style.align === 'centre' ? call.x - w / 2 : call.style.align === 'right' ? call.x - w : call.x;
  return { x: left, y: call.y - 7, w, h: 7 };
}

/** Every rect and every text box `fn` paints. */
function boxes(fn: DecorFn, view: StageView): Rect[] {
  const painter = new RecordingPainter();
  fn(painter, view);
  return painter.calls.map((call) => (call.op === 'rect' ? call : textBox(call)));
}

function occupant(): Occupant {
  const workload = site();
  return { subject: { kind: 'workload', vm: vm('compute', [workload]), workload }, mood: 'working', atSeat: true };
}

/** Every decor layer, every place's art (empty, occupied, a founder) and every hotspot tip. */
function paintEverything(view: StageView): { painter: RecordingPainter; tips: Tip[] } {
  const painter = new RecordingPainter();
  const { back, props, front } = spireTheme.decor;
  for (const fn of back) fn(painter, view);
  for (const prop of props) prop.draw(painter, view);
  for (const fn of front) fn(painter, view);
  const founder = spireTheme.founders[0];
  for (const place of allPlaces()) {
    place.art(painter, { place, occupant: null, stage: view });
    place.art(painter, { place, occupant: occupant(), stage: view });
    if (founder) {
      const asFounder: Occupant = { subject: { kind: 'founder', founder }, mood: 'working', atSeat: true };
      place.art(painter, { place, occupant: asFounder, stage: view });
    }
  }
  return { painter, tips: spireTheme.hotspots.map((h) => h.tip(view)) };
}

const paintBack = (view: StageView): RecordingPainter => {
  const painter = new RecordingPainter();
  for (const fn of spireTheme.decor.back) fn(painter, view);
  return painter;
};

/* -------------------------------------------------------------------- tests */

describe('spireTheme', () => {
  it('is listed after the HQ', () => {
    const ids = THEMES.map((t) => t.id);
    expect(ids.indexOf('spire')).toBe(ids.indexOf('hq') + 1);
    expect(spireTheme.name).toBe('HQ Spire');
  });

  it("reuses the HQ's world", () => {
    expect(spireTheme.cast).toBe(hqTheme.cast);
    expect(spireTheme.founders).toBe(hqTheme.founders);
    expect(spireTheme.visitor).toBe(hqTheme.visitor);
    expect(spireTheme.lines).toBe(hqTheme.lines);
    expect(spireTheme.legend).toBe(hqTheme.legend);
    expect(spireTheme.soundscape).toBe(hqTheme.soundscape);
  });
});

describe('spireTheme layout', () => {
  it('is 212 px wide and 404 tall, with seven storeys 52 px apart, bottom first', () => {
    expect(layout.width).toBe(212);
    expect(layout.height).toBe(404);
    expect(layout.floors).toHaveLength(STOREYS);
    for (let i = 1; i < layout.floors.length; i++) {
      expect((layout.floors[i - 1]?.walkY ?? 0) - (layout.floors[i]?.walkY ?? 0)).toBe(52);
    }
  });

  it('joins every floor with the one lift', () => {
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
      expect(place.x + place.w).toBeLessThanOrEqual(SHAFT_WALL);
      expect(place.baseY).toBeLessThanOrEqual(floor?.walkY ?? -Infinity);
      expect(place.baseY - place.h).toBeGreaterThan((floor?.walkY ?? Infinity) - 52);
    }
  });

  it('enters through the gate from off stage on the left, and keeps the vault in the sub-level', () => {
    expect(layout.entrance).toEqual({ x: -12, floor: FLOOR.gate });
    expect(layout.vault.floor).toBe(FLOOR.sublevel);
    expect(layout.vault.x).toBe(SILO.x + SILO.w / 2);
  });

  it('has the homes the HQ has, a storey or two per job', () => {
    const counts = Object.fromEntries(Object.entries(layout.homes).map(([part, places]) => [part, places.length]));
    const hqCounts = Object.fromEntries(Object.entries(hqTheme.layout.homes).map(([part, p]) => [part, p.length]));
    expect(counts).toEqual(hqCounts);
    const floorsOf = (places: readonly Place[]): number[] => [...new Set(places.map((p) => p.floor))].sort();
    expect(floorsOf(layout.homes.worker)).toEqual([FLOOR.ops1, FLOOR.ops2]);
    expect(layout.homes.worker.filter((p) => p.floor === FLOOR.ops1)).toHaveLength(6);
    expect(floorsOf([...layout.homes.pod, ...layout.homes.wrangler])).toEqual([FLOOR.rookieBay]);
    expect(floorsOf([...layout.homes.keeper, ...layout.homes.courier])).toEqual([FLOOR.hangar]);
    expect(floorsOf(layout.homes.founder)).toEqual([FLOOR.command]);
    expect(floorsOf([...layout.homes.guard, ...layout.homes.greeter, ...layout.homes.checker])).toEqual([FLOOR.gate]);
    expect(layout.stores.every((s) => s.floor === FLOOR.hangar)).toBe(true);
    expect(layout.podSpawn.floor).toBe(FLOOR.rookieBay);
  });

  it("homes JARVIS's remote first, at its dock, and the founders either side of the orb", () => {
    const [dock, paul, dhruv] = layout.homes.founder;
    expect(dock?.seat.y).toBeUndefined();
    expect((paul?.seat.x ?? Infinity) < AXIS && AXIS < (dhruv?.seat.x ?? -Infinity)).toBe(true);
  });

  it("keeps the HQ's break spots, in the HQ's order, so its dressing reads them by index", () => {
    expect(layout.breakSpots.map((s) => s.kind)).toEqual(hqTheme.layout.breakSpots.map((s) => s.kind));
  });

  it('keeps every Room inside the stage, and the compute Room over the gate and both ops storeys', () => {
    for (const room of Object.values(layout.rooms)) {
      expect(inside({ x: 0, y: 0, w: layout.width, h: layout.height }, room)).toBe(true);
    }
    const { compute } = layout.rooms;
    for (const floor of [FLOOR.gate, FLOOR.ops1, FLOOR.ops2]) {
      const walkY = layout.floors[floor]?.walkY ?? -1;
      expect(walkY >= compute.y && walkY <= compute.y + compute.h).toBe(true);
    }
    for (const floor of [FLOOR.sublevel, FLOOR.hangar]) {
      const walkY = layout.floors[floor]?.walkY ?? -1;
      expect(walkY >= compute.y && walkY <= compute.y + compute.h).toBe(false);
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

  it('puts a doorway, a hero tall, under every wall the walk line crosses', () => {
    for (const door of DOORWAYS) {
      const floor = layout.floors[door.floor];
      const b = band(door.floor);
      expect(door.x).toBeGreaterThan(floor?.minX ?? Infinity);
      expect(door.x + door.w).toBeLessThan(floor?.maxX ?? -Infinity);
      expect(b.front - DOOR_HEIGHT).toBeLessThanOrEqual(b.walk - 22);
    }
    expect(DOORWAYS.filter((d) => d.x === SHAFT_WALL)).toHaveLength(STOREYS);
  });
});

describe('the Spire stage width', () => {
  it.each([
    [320, 2, 3],
    [375, 3, 5],
    [393, 3, 5],
    [430, 3, 6],
  ])('fits a %i px viewport at DPR %f with %i device px per art px', (viewport, dpr, scale) => {
    const device = stageScale(viewport, layout.width, dpr, 0);
    expect(device).toBe(scale);
    expect((device * layout.width) / dpr).toBeLessThanOrEqual(viewport);
  });
});

describe('spireTheme drawing', () => {
  it.each(STAGES)('paints the same calls for the same stage at %s', (_name, view) => {
    const first = paintEverything(view);
    const second = paintEverything(view);
    expect(first.painter.calls.length).toBeGreaterThan(0);
    expect(second.painter.calls).toEqual(first.painter.calls);
    expect(second.tips).toEqual(first.tips);
  });

  it('paints day and night differently', () => {
    expect(paintEverything(stage({ hour: 23 })).painter.calls).not.toEqual(paintEverything(stage()).painter.calls);
  });

  it.each(STAGES)('paints nothing off the stage at %s', (_name, view) => {
    const stageRect = { x: 0, y: 0, w: layout.width, h: layout.height };
    for (const call of paintEverything(view).painter.calls) {
      const box = call.op === 'rect' ? call : textBox(call);
      expect(inside(stageRect, box), JSON.stringify(call)).toBe(true);
    }
  });
});

describe('the Spire set stays inside its regions', () => {
  const RELOCATED = { BUNKER, SHIELD, BREW, TROPHY, TUBE, BAG, PGSQL, MYSQL, RUNNER_LIGHTS, GATEWAY, DISPATCH, CLOCK };

  it.each(STAGES)('keeps every relocated HQ piece inside its new spot at %s', (_name, view) => {
    for (const [name, piece] of [...Object.entries(RELOCATED), ...BEACONS.map((b, i) => [`beacon ${i}`, b] as const)]) {
      for (const box of boxes(piece.paint, view))
        expect(inside(piece.rect, box), `${name} ${JSON.stringify(box)}`).toBe(true);
    }
  });

  it('shows the HQ art in each relocated piece, text included', () => {
    const texts = (fn: DecorFn): string[] => {
      const painter = new RecordingPainter();
      fn(painter, stage());
      return painter.texts;
    };
    expect(texts(BREW.paint)).toEqual(['BREW']);
    expect(texts(PGSQL.paint)).toEqual(['PGSQL']);
    expect(texts(MYSQL.paint)).toEqual(['MYSQL']);
    expect(texts(DISPATCH.paint)).toContain('DISPATCH');
    expect(boxes(TUBE.paint, stage()).length).toBeGreaterThan(0);
  });

  it.each(STAGES)("keeps the Spire's own dressing inside its boxes at %s", (_name, view) => {
    const regions = [FINDINGS_LAMP, HOLO_PEDESTAL, COUCH_RECT, GEAR_RACK, SILO, SITE_OVERFLOW, POD_OVERFLOW];
    const strip: Rect = { x: TEMP_STRIP.x, y: TEMP_STRIP.baseline - 7, w: CORE.chamber.w - 4, h: 7 };
    const drawn = [...DRESSING_BACK, ...DRESSING_PROPS.map((p) => p.draw)].flatMap((fn) => boxes(fn, view));
    for (const box of drawn) {
      expect(
        [...regions, strip].some((region) => inside(region, box)),
        JSON.stringify(box),
      ).toBe(true);
    }
  });

  it.each(STAGES)('keeps the orb on the roof and the readout on the command deck at %s', (_name, view) => {
    for (const box of boxes(jarvisConsole(JARVIS), view)) {
      expect(inside(box.y < ROOF ? JARVIS_ORB : JARVIS.readout, box), JSON.stringify(box)).toBe(true);
    }
    expect(JARVIS.readout.w).toBeGreaterThanOrEqual(READOUT_MIN_WIDTH);
    expect(JARVIS.readout.x + JARVIS.readout.w).toBeLessThanOrEqual(SHAFT_WALL);
  });

  it.each(STAGES)('keeps the power core inside its chamber, drive labels and all, at %s', (_name, view) => {
    const core = confine(powerCore(CORE), CORE.chamber);
    for (const box of boxes(core, view)) expect(inside(CORE.chamber, box), JSON.stringify(box)).toBe(true);
  });

  it('stands the orb, the spine and the core on one axis', () => {
    expect(JARVIS.orb.cx).toBe(AXIS);
    expect(CORE.hub.cx).toBe(AXIS);
  });
});

describe('the Spire hotspots', () => {
  it('keeps every hotspot on the stage, and no two overlap', () => {
    const rects = spireTheme.hotspots.map((h) => h.rect);
    for (const rect of rects) expect(inside({ x: 0, y: 0, w: layout.width, h: layout.height }, rect)).toBe(true);
    rects.forEach((a, i) => {
      for (const b of rects.slice(i + 1))
        expect(overlaps(a, b), `${JSON.stringify(a)} ${JSON.stringify(b)}`).toBe(false);
    });
  });

  it("answers in the HQ's words", () => {
    const titles = spireTheme.hotspots.map((h) => h.tip(stage()).title);
    for (const title of ['JARVIS', 'R2 bunker', 'Holo-table', 'pve']) expect(titles).toContain(title);
    const lamp = spireTheme.hotspots.find((h) => h.rect === FINDINGS_LAMP);
    expect(lamp?.tip(stage({ findings: { ok: 1, warn: 0, crit: 1 } })).severity).toBe('crit');
  });
});

describe('the Spire findings lamp', () => {
  it.each([
    [{ ok: 1, warn: 2, crit: 1 }, LAMP_COLOURS.crit],
    [{ ok: 1, warn: 2, crit: 0 }, LAMP_COLOURS.warn],
    [{ ok: 4, warn: 0, crit: 0 }, LAMP_COLOURS.ok],
  ])('lights %o as %s', (findings, colour) => {
    const lens = paintBack(stage({ findings })).rects.find(
      (r) => r.w === 8 && r.h === 6 && r.y === FINDINGS_LAMP.y + 2,
    );
    expect(lens?.colour).toBe(colour);
  });
});

describe('the Spire overflow signs', () => {
  const signs = (vms: Vm[]): string[] => {
    const painter = new RecordingPainter();
    paintOverflow(painter, stage({ vms }));
    return painter.texts;
  };
  const sites = (n: number): Workload[] => Array.from({ length: n }, (_, i) => site(i));
  const pods = (n: number): Workload[] => Array.from({ length: n }, (_, i) => pod(i));

  it('paints nothing at capacity', () => {
    expect(signs([vm('compute', sites(12)), vm('ci', pods(3))])).toEqual([]);
  });

  it('counts the 13th site instance and the 4th pod', () => {
    expect(signs([vm('compute', sites(15)), vm('ci', pods(5))])).toEqual(['+3', '+2']);
  });
});

describe('the Spire host temperatures', () => {
  const hostWith = (temps?: Temps): StageView =>
    stage({
      host: { name: 'pve', cpu: 40, mem: 80, findings: { ok: 3, warn: 1, crit: 0 }, ...(temps ? { temps } : {}) },
    });
  const coloursOf = (painter: RecordingPainter, text: string): string[] =>
    painter.calls.flatMap((c) => (c.op === 'text' && c.text === text ? [c.colour] : []));

  it('shows all three readings in their band colours along the sub-level floor', () => {
    const painter = paintBack(hostWith({ cpu: 71, chipset: 67, nvme: 56 }));
    expect(coloursOf(painter, '71')).toEqual([TEMP_COLOURS.warm]);
    expect(coloursOf(painter, '67')).toEqual([TEMP_COLOURS.cool]);
    expect(coloursOf(painter, '56')).toEqual([TEMP_COLOURS.cool]);
  });

  it('shows a null reading as unreadable, and nothing without temps', () => {
    expect(coloursOf(paintBack(hostWith({ cpu: 71, chipset: null, nvme: 56 })), '--')).toEqual([TEMP_COLOURS.unknown]);
    expect(paintBack(hostWith()).texts).not.toContain('PCH');
  });
});

describe('the Spire jet silo', () => {
  const siloTexts = (vaultOpen: boolean): string[] => {
    const painter = paintBack(stage({ vaultOpen }));
    return painter.calls.flatMap((c) => (c.op === 'text' && inside(SILO, textBox(c)) ? [c.text] : []));
  };

  it('stands the jet in the silo, and empties it while the backup is away', () => {
    expect(siloTexts(false)).toEqual([]);
    expect(siloTexts(true)).toEqual(['R2']);
    const jetPaint = (vaultOpen: boolean) => paintBack(stage({ vaultOpen })).rects.filter((r) => inside(SILO, r));
    expect(jetPaint(true)).not.toEqual(jetPaint(false));
  });
});

describe('the Spire lift car', () => {
  const litCar = (view: StageView) =>
    paintBack(view).rects.find((rect) => rect.colour === LIFT_COLOURS.lit.inside && rect.h === DOOR_HEIGHT);

  it('is drawn lit at the walk line the Engine reports, on every storey and between them', () => {
    const between = (band(3).walk + band(4).walk) / 2;
    for (const walkY of [...Array.from({ length: STOREYS }, (_, f) => band(f).walk), between]) {
      expect(litCar(stage({ liftInUse: true, lift: carAt(walkY) }))?.y).toBe(carTopAt(walkY));
    }
    expect(litCar(stage({ liftInUse: false, lift: carAt(band(5).walk) }))).toBeUndefined();
  });

  it('stands the car on the front edge of the floor', () => {
    for (let floor = 0; floor < STOREYS; floor++)
      expect(carTopAt(band(floor).walk) + DOOR_HEIGHT).toBe(band(floor).front);
  });

  it('lights a landing lamp amber only for floors with a call', () => {
    const view = stage({ lift: { y: band(3).walk, moving: false, doorsOpen: false, calls: new Set([2, 5]) } });
    const lamps = paintBack(view).rects.filter((r) => r.w === 4 && r.h === 1);
    for (let floor = 0; floor < STOREYS; floor++) {
      const lamp = lamps.find((r) => r.y === carTopAt(band(floor).walk) - 4);
      expect(lamp?.colour === LIFT_COLOURS.lamp.call, `floor ${floor}`).toBe(floor === 2 || floor === 5);
    }
  });

  it('opens the doors only on the car floor while the doors are open', () => {
    const gaps = (view: StageView) =>
      paintBack(view)
        .rects.filter((r) => r.colour === LIFT_COLOURS.gap && r.h === DOOR_HEIGHT)
        .map((r) => r.y);
    const walkY = band(3).walk;
    const open = gaps(stage({ lift: { y: walkY, moving: false, doorsOpen: true, calls: new Set() } }));
    expect(open).toContain(carTopAt(walkY));
    for (let floor = 0; floor < STOREYS; floor++) {
      if (floor !== 3) expect(open).not.toContain(carTopAt(band(floor).walk));
    }
    expect(gaps(stage({ lift: carAt(walkY) }))).toHaveLength(0);
  });
});
