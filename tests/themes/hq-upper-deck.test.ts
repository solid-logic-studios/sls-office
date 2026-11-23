import { describe, expect, it } from 'vitest';
import type { CiPodWorkload, Host, ServiceWorkload, Vm, VmRole, Workload } from '../../src/contract/snapshot.ts';
import type { Rect, StageView } from '../../src/contract/theme.ts';
import { GLYPHS } from '../../src/engine/pixel-font.ts';
import { JARVIS, JARVIS_CONSOLE } from '../../src/themes/hq/boards.ts';
import { BANDS, BAYS, DECK, HEIGHT, WIDTH, type Span } from '../../src/themes/hq/geometry.ts';
import { hqTheme } from '../../src/themes/hq/index.ts';
import { HQ_LAYOUT } from '../../src/themes/hq/layout.ts';
import { ALARM, CYAN, ROOMS } from '../../src/themes/hq/palette.ts';
import {
  ALERT_TEXT,
  BACK_WALL_FOOT,
  BREW_STATION,
  BREW_TEXT,
  LOCKERS,
  MISSION_BOARD,
  MISSION_TITLE,
  MYSQL_LOCKER,
  POSTGRES_LOCKER,
  PUNCHING_BAG,
  STRONGROOM,
  SUIT_UP_TUBE,
  TELLY,
  UPPER_BEACONS,
  UPPER_DECK_BACK,
  UPPER_DECK_HOTSPOTS,
  UPPER_DECK_PROPS,
  postgresLockerTip,
  suitUpTip,
  tellyTip,
} from '../../src/themes/hq/upper-deck.ts';
import { RecordingPainter, type PaintCall } from '../support/recording-painter.ts';

/* ------------------------------------------------------------------ helpers */

const HOST: Host = {
  name: 'pve',
  cpu: 40,
  mem: 60,
  findings: { ok: 9, warn: 1, crit: 0 },
  temps: { cpu: 58, chipset: 59, nvme: 46 },
};

const pod = (i: number): CiPodWorkload => ({ kind: 'ci-pod', id: `pod-${i}`, cpu: 90, mem: 40 });
const engine = (id: string, health: ServiceWorkload['health']): ServiceWorkload => ({
  kind: 'engine',
  id,
  name: id,
  cpu: 5,
  mem: 30,
  health,
});

function vm(role: VmRole, over: Partial<Vm> = {}, workloads: Workload[] = []): Vm {
  return { id: role, role, name: `sls-${role}`, up: true, cpu: 20, mem: 50, workloads, ...over };
}

const ENGINES = [engine('postgres', 'healthy'), engine('mysql', 'healthy')];
const vms = (pods = 0, up = true): Vm[] => [
  vm('data', { up }, ENGINES),
  vm('compute', { up }),
  vm('deploy', { up }),
  vm(
    'ci',
    { up },
    Array.from({ length: pods }, (_, i) => pod(i)),
  ),
];

function stage(over: Partial<StageView> = {}): StageView {
  return {
    now: 12.3,
    hour: 14,
    host: HOST,
    vms: vms(),
    findings: { ok: 9, warn: 1, crit: 0 },
    liftInUse: false,
    lift: { y: 242, moving: false, doorsOpen: false, calls: new Set() },
    vaultOpen: false,
    openStores: new Set(),
    busyBreakSpots: new Set(),
    ...over,
  };
}

const spotsOf = (kind: string): number[] => HQ_LAYOUT.breakSpots.flatMap((spot, i) => (spot.kind === kind ? [i] : []));
const ALL_SPOTS = new Set(HQ_LAYOUT.breakSpots.map((_, i) => i));

/** Every kind of stage the dressing reads: calm, cold, flat out, down, alarmed, a quiet night and a LAN night. */
const STAGES: readonly StageView[] = [
  stage(),
  stage({ host: null, vms: [] }),
  stage({ vms: vms(5), openStores: new Set([0, 1]), vaultOpen: true, busyBreakSpots: ALL_SPOTS }),
  stage({ vms: vms(2, false) }),
  stage({ findings: { ok: 1, warn: 3, crit: 2 }, busyBreakSpots: ALL_SPOTS }),
  stage({ hour: 2, host: { ...HOST, cpu: 5 } }),
  stage({ hour: 2, busyBreakSpots: new Set(spotsOf('couch')) }),
];
const TIMES = [0, 0.3, 1.7, 4.45, 12.3, 61.9];

function paint(view: StageView): RecordingPainter {
  const painter = new RecordingPainter();
  for (const decor of UPPER_DECK_BACK) decor(painter, view);
  for (const prop of UPPER_DECK_PROPS) prop.draw(painter, view);
  return painter;
}

/** Every call the dressing makes, over every stage at several moments. */
function everyCall(): { call: PaintCall; painter: RecordingPainter }[] {
  return STAGES.flatMap((base) =>
    TIMES.flatMap((now) => {
      const painter = paint({ ...base, now });
      return painter.calls.map((call) => ({ call, painter }));
    }),
  );
}

/** The rectangle a recorded call covers: a rect as given, a text by its alignment and the 7 px cap height. */
function extentOf(call: PaintCall, painter: RecordingPainter): Rect {
  if (call.op === 'rect') return call;
  const w = painter.textWidth(call.text, call.style.bold);
  const x = call.style.align === 'centre' ? call.x - w / 2 : call.style.align === 'right' ? call.x - w : call.x;
  return { x, y: call.y - 7, w, h: 7 };
}

const inside = (outer: Rect, inner: Rect): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.w <= outer.x + outer.w &&
  inner.y + inner.h <= outer.y + outer.h;

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const UPPER = BANDS[DECK.upper];
const wallOf = ([x0, x1]: Span): Rect => ({ x: x0, y: UPPER.ceil, w: x1 - x0, h: BACK_WALL_FOOT - UPPER.ceil });
const roomOf = ([x0, x1]: Span): Rect => ({ x: x0, y: UPPER.ceil, w: x1 - x0, h: UPPER.front - UPPER.ceil });
const UPPER_BAYS: readonly Span[] = [BAYS.rookieBay, BAYS.archive, BAYS.command, BAYS.rec];

const rectsIn = (painter: RecordingPainter, area: Rect, colour?: string): number =>
  painter.rects.filter((r) => inside(area, r) && (colour === undefined || r.colour === colour)).length;

const callsIn = (painter: RecordingPainter, area: Rect): string =>
  JSON.stringify(painter.calls.filter((call) => call.op === 'rect' && overlaps(area, call)));

/* -------------------------------------------------------------------- tests */

describe('the upper deck dressing', () => {
  it("stays on the upper deck's back walls, inside its rooms and off the floor", () => {
    for (const { call, painter } of everyCall()) {
      const extent = extentOf(call, painter);
      expect(
        UPPER_BAYS.some((bay) => inside(wallOf(bay), extent)),
        JSON.stringify(call),
      ).toBe(true);
    }
  });

  it('keeps clear of the orb, the readout and every Place but Muster’s post in front of the tube', () => {
    // Rookies step out of the suit-up tube, so Muster's post stands in front of its foot on purpose.
    const [wrangler] = HQ_LAYOUT.homes.wrangler;
    const places = Object.values(HQ_LAYOUT.homes)
      .flat()
      .filter((place) => place !== wrangler && place.floor === DECK.upper);
    const keepOut: Rect[] = [
      JARVIS_CONSOLE,
      JARVIS.readout,
      ...places.map((place) => ({ x: place.x, y: place.baseY - place.h, w: place.w, h: place.h })),
    ];
    for (const { call, painter } of everyCall()) {
      const extent = extentOf(call, painter);
      for (const area of keepOut) expect(overlaps(area, extent), JSON.stringify(call)).toBe(false);
    }
  });

  it('is a pure function of the stage', () => {
    for (const view of STAGES) expect(paint(view).calls).toEqual(paint(view).calls);
  });

  it('only writes capitals the pixel font can draw, with no em-dash', () => {
    const texts = new Set(everyCall().flatMap(({ call }) => (call.op === 'text' ? [call.text] : [])));
    expect(texts.size).toBeGreaterThan(0);
    for (const text of texts) {
      expect(text).toBe(text.toUpperCase());
      for (const char of text) expect(char === ' ' || char in GLYPHS, `${char} in ${text}`).toBe(true);
    }
  });

  it('sizes every board from its text', () => {
    const painter = new RecordingPainter();
    const textWidth = (text: string): number => painter.textWidth(text);
    for (const { rect, label } of LOCKERS) expect(textWidth(label) + 4).toBeLessThanOrEqual(rect.w);
    expect(textWidth(MISSION_TITLE) + textWidth('9/3') + 14).toBeLessThanOrEqual(MISSION_BOARD.w);
    expect(textWidth(ALERT_TEXT) + 4).toBeLessThanOrEqual(TELLY.w - 4);
    expect(textWidth(BREW_TEXT)).toBeLessThanOrEqual(BREW_STATION.w - 1);
  });
});

describe('the upper deck reacts to the stage', () => {
  it('pulls out and lights a locker drawer only while Ledger has that store open', () => {
    const shut = paint(stage());
    const pg = paint(stage({ openStores: new Set([0]) }));
    expect(callsIn(pg, POSTGRES_LOCKER)).not.toBe(callsIn(shut, POSTGRES_LOCKER));
    expect(callsIn(pg, MYSQL_LOCKER)).toBe(callsIn(shut, MYSQL_LOCKER));
    expect(rectsIn(pg, POSTGRES_LOCKER, CYAN.bright)).toBeGreaterThan(0);
    expect(rectsIn(shut, POSTGRES_LOCKER, CYAN.bright)).toBe(0);
  });

  it('lights each locker lamp red for an unhealthy engine', () => {
    const sick = stage({ vms: [vm('data', {}, [engine('postgres', 'unhealthy'), engine('mysql', 'healthy')])] });
    expect(rectsIn(paint(sick), POSTGRES_LOCKER, ALARM.base)).toBe(1);
    expect(rectsIn(paint(sick), MYSQL_LOCKER, ALARM.base)).toBe(0);
  });

  it('swings the punching bag only while its break spot is busy', () => {
    const bag = new Set(spotsOf('bag'));
    expect(bag.size).toBe(1);
    const at = (now: number, busy: ReadonlySet<number>): string =>
      callsIn(paint(stage({ now, busyBreakSpots: busy })), PUNCHING_BAG);
    expect(at(0.2, bag)).not.toBe(at(0.65, bag));
    expect(at(0.2, new Set())).toBe(at(0.65, new Set()));
  });

  it('opens the strongroom while the backup is out', () => {
    expect(callsIn(paint(stage({ vaultOpen: true })), STRONGROOM)).not.toBe(callsIn(paint(stage()), STRONGROOM));
  });

  it('glows the suit-up tube while any rookie is on a mission', () => {
    const mint = ROOMS.rookieBay.accent;
    expect(rectsIn(paint(stage({ vms: vms(2) })), SUIT_UP_TUBE, mint)).toBeGreaterThan(
      rectsIn(paint(stage()), SUIT_UP_TUBE, mint),
    );
  });

  it('turns the big screen off on a quiet night, races while the couch is taken and shows the alert in an alarm', () => {
    const couch = new Set(spotsOf('couch'));
    const night = paint(stage({ hour: 2 }));
    const lanNight = paint(stage({ hour: 2, busyBreakSpots: couch }));
    const alarm = paint(stage({ findings: { ok: 1, warn: 0, crit: 1 } }));
    const pink = ROOMS.rec.accent;
    expect(rectsIn(night, TELLY, pink)).toBe(0);
    expect(rectsIn(lanNight, TELLY, pink)).toBeGreaterThan(0);
    expect(alarm.texts).toContain(ALERT_TEXT);
    expect(night.texts).not.toContain(ALERT_TEXT);
  });

  it('lights the beacons red only in an alarm', () => {
    const red = (view: StageView): number =>
      paint(view).rects.filter(
        (r) =>
          (r.colour === ALARM.base || r.colour === ALARM.light) && UPPER_BEACONS.some((x) => Math.abs(r.x - x) < 12),
      ).length;
    expect(red(stage({ findings: { ok: 1, warn: 0, crit: 1 } }))).toBeGreaterThan(0);
    expect(red(stage({ vms: vms(0, false) }))).toBeGreaterThan(0);
    expect(red(stage())).toBe(0);
  });
});

describe('the upper deck Hotspots', () => {
  it('puts every Hotspot on stage and inside its room', () => {
    for (const { rect } of UPPER_DECK_HOTSPOTS) {
      expect(inside({ x: 0, y: 0, w: WIDTH, h: HEIGHT }, rect)).toBe(true);
      expect(
        UPPER_BAYS.some((bay) => inside(roomOf(bay), rect)),
        JSON.stringify(rect),
      ).toBe(true);
    }
  });

  it('is wired into the HQ', () => {
    for (const hotspot of UPPER_DECK_HOTSPOTS) expect(hqTheme.hotspots).toContain(hotspot);
  });

  it('gives every tip a title, a detail and a status on every stage', () => {
    for (const view of STAGES) {
      for (const { tip } of UPPER_DECK_HOTSPOTS) {
        const { title, detail, status } = tip(view);
        expect(title.length * detail.length * status.length).toBeGreaterThan(0);
        expect(`${title} ${detail} ${status}`).not.toMatch(/[–—]/);
      }
    }
  });

  it('reads the lab: the engine behind each locker, the rookies in the tube and the alarm on the screen', () => {
    expect(postgresLockerTip(stage()).status).toBe('Healthy');
    expect(suitUpTip(stage({ vms: vms(2) })).status).toBe('2 rookies suited up');
    expect(suitUpTip(stage({ vms: vms(0, false) })).severity).toBe('crit');
    expect(tellyTip(stage({ findings: { ok: 1, warn: 0, crit: 1 } })).severity).toBe('crit');
  });
});
