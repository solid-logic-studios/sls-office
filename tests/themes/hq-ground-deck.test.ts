import { describe, expect, it } from 'vitest';
import type { Host, SiteInstanceWorkload, Vm, VmRole, Workload } from '../../src/contract/snapshot.ts';
import type { DecorFn, Place, Rect, StageView } from '../../src/contract/theme.ts';
import { GLYPHS } from '../../src/engine/pixel-font.ts';
import { BANDS, BAYS, DECK, HEIGHT, WIDTH } from '../../src/themes/hq/geometry.ts';
import {
  BEACON_XS,
  DISPATCH_SIGN,
  GEAR_RACKS,
  GROUND_DECK_BACK,
  GROUND_DECK_HOTSPOTS,
  HEARTBEAT_MONITOR,
  HOLO_TABLE,
  NAME_BOARD,
  OPS_CLOCK,
  TACTICAL_WALL,
  TEAM_EMBLEM,
  beaconRect,
  clockText,
  traceAt,
} from '../../src/themes/hq/ground-deck.ts';
import { HOTSPOTS } from '../../src/themes/hq/hotspots.ts';
import { DEPLOY_BUSY_CPU } from '../../src/themes/hq/jarvis-state.ts';
import { HQ_LAYOUT } from '../../src/themes/hq/layout.ts';
import { ALARM, AMBER, CYAN, ROOMS, STEEL } from '../../src/themes/hq/palette.ts';
import { GATE } from '../../src/themes/hq/shell.ts';
import { inside, overlaps, rectsIn } from '../support/geometry.ts';
import { RecordingPainter, type PaintCall } from '../support/recording-painter.ts';
import { HOST, ROLES, stage as baseStage, vm } from '../support/stage.ts';

/* ------------------------------------------------------------------ helpers */

const site = (i: number, client = 'scrd'): SiteInstanceWorkload => ({
  kind: 'site-instance',
  id: `site-${i}`,
  client,
  site: 'server',
  env: 'production',
  siteType: 'node',
  cpu: 20,
  mem: 40,
  health: 'healthy',
});

const sites = (n: number): Workload[] => Array.from({ length: n }, (_, i) => site(i, i % 2 ? 'bsra' : 'scrd'));

/** A calm afternoon with six heroes on watch. */
const stage = (over: Partial<StageView> = {}): StageView =>
  baseStage({
    now: 0,
    vms: ROLES.map((role) => vm(role, { cpu: 10, mem: 40 }, role === 'compute' ? sites(6) : [])),
    ...over,
  });

const withVm = (role: VmRole, over: Partial<Vm>): StageView =>
  stage({ vms: stage().vms.map((v) => (v.role === role ? { ...v, ...over } : v)) });

const HOLO_INDEX = HQ_LAYOUT.breakSpots.findIndex((spot) => spot.kind === 'holo');

const CALM = stage();
const DEPLOY = withVm('deploy', { cpu: DEPLOY_BUSY_CPU });
const ALARMED = stage({ findings: { ok: 1, warn: 0, crit: 2 } });
const NIGHT = stage({ hour: 2.5, host: { ...HOST, cpu: 5 } });

/** Every kind of stage the dressing reads. */
const STAGES: readonly StageView[] = [
  CALM,
  stage({ host: null, vms: [] }),
  DEPLOY,
  ALARMED,
  NIGHT,
  withVm('compute', { up: false }),
  withVm('deploy', { up: false }),
  withVm('compute', { workloads: sites(30) }),
  stage({ busyBreakSpots: new Set([HOLO_INDEX]) }),
];

function paint(view: StageView, fns: readonly DecorFn[] = GROUND_DECK_BACK): RecordingPainter {
  const painter = new RecordingPainter();
  for (const fn of fns) fn(painter, view);
  return painter;
}

/** The rectangle a recorded call covers: a rect as given, a text by its alignment and the 7 px cap height. */
function extentOf(call: PaintCall, painter: RecordingPainter): Rect {
  if (call.op === 'rect') return call;
  const w = painter.textWidth(call.text, call.style.bold);
  const x = call.style.align === 'centre' ? call.x - w / 2 : call.style.align === 'right' ? call.x - w : call.x;
  return { x, y: call.y - 7, w, h: 7 };
}

const wallOf = ([x0, x1]: readonly [number, number]): Rect => {
  const { ceil, back } = BANDS[DECK.ground];
  return { x: x0, y: ceil, w: x1 - x0, h: back - ceil };
};

/** Where the ground deck's dressing may paint: the ops floor's and hangar's back walls, the gate and the sky over the roof. */
const ALLOWED: readonly Rect[] = [wallOf(BAYS.ops), wallOf(BAYS.hangar), GATE, { x: 0, y: 0, w: WIDTH, h: 34 }];

const FRAMES = 12;
const frames = (view: StageView): StageView[] =>
  Array.from({ length: FRAMES }, (_, frame) => ({ ...view, now: frame * 0.37 }));

const hoverBox = (place: Place): Rect => ({ x: place.x, y: place.baseY - place.h, w: place.w, h: place.h });
const groundPlaces = Object.values(HQ_LAYOUT.homes)
  .flat()
  .filter((place) => place.floor === DECK.ground);

/* -------------------------------------------------------------------- tests */

describe('the ground deck dressing', () => {
  it('paints only on the ops floor and hangar walls, the gate and the roof band', () => {
    for (const view of STAGES.flatMap(frames)) {
      const painter = paint(view);
      for (const call of painter.calls) {
        const extent = extentOf(call, painter);
        expect(
          ALLOWED.some((area) => inside(area, extent)),
          JSON.stringify(call),
        ).toBe(true);
      }
    }
  });

  it('leaves every ground deck Place clear, so the furniture and its people stay in view', () => {
    for (const view of STAGES.flatMap(frames)) {
      const painter = paint(view);
      for (const call of painter.calls) {
        for (const place of groundPlaces) {
          expect(overlaps(hoverBox(place), extentOf(call, painter)), JSON.stringify(call)).toBe(false);
        }
      }
    }
  });

  it('keeps clear of the spine that runs up the middle of the ops floor', () => {
    const spine: Rect = { x: 354, y: BANDS[DECK.ground].ceil, w: 8, h: 78 };
    for (const view of frames(ALARMED)) {
      const painter = paint(view);
      for (const call of painter.calls)
        expect(overlaps(spine, extentOf(call, painter)), JSON.stringify(call)).toBe(false);
    }
  });

  it('is a pure function of the stage', () => {
    for (const view of STAGES) expect(paint(view).calls).toEqual(paint(view).calls);
  });

  it('writes only capitals the pixel font can draw, with no em-dash', () => {
    for (const view of STAGES.flatMap(frames)) {
      for (const text of paint(view).texts) {
        expect(text).toBe(text.toUpperCase());
        for (const char of text) expect(char === ' ' || char in GLYPHS, `glyph for "${char}" in ${text}`).toBe(true);
      }
    }
  });
});

describe('the ground deck boards', () => {
  const width = (text: string, bold = false): number => new RecordingPainter().textWidth(text, bold);

  it('fits DISPATCH on its sign, wider than the 28 px desk under it', () => {
    expect(width('DISPATCH')).toBeLessThanOrEqual(DISPATCH_SIGN.w - 2);
    expect(width('DISPATCH')).toBeGreaterThan(28);
  });

  it('fits every time of day on the ops clock', () => {
    for (let hour = 0; hour < 24; hour += 0.25) {
      expect(width(clockText(hour))).toBeLessThanOrEqual(OPS_CLOCK.w - 4);
    }
  });

  it('keeps every painted text inside its board', () => {
    const boards = [OPS_CLOCK, DISPATCH_SIGN, HEARTBEAT_MONITOR, TACTICAL_WALL, TEAM_EMBLEM];
    for (const view of STAGES.flatMap(frames)) {
      const painter = paint(view);
      for (const call of painter.calls.filter((c) => c.op === 'text')) {
        const extent = extentOf(call, painter);
        expect(
          boards.some((board) => inside(board, extent)),
          JSON.stringify(call),
        ).toBe(true);
      }
    }
  });

  it('fits every SCRD score on the tactical wall over a long run', () => {
    for (let now = 0; now < 4000; now += 7) {
      const painter = paint(stage({ now }));
      const panel: Rect = { x: TACTICAL_WALL.x + 49, y: TACTICAL_WALL.y, w: 72, h: TACTICAL_WALL.h };
      const scores = painter.calls.filter((c) => c.op === 'text' && c.style.bold && c.y > TACTICAL_WALL.y);
      expect(scores).toHaveLength(1);
      for (const call of scores) expect(inside(panel, extentOf(call, painter)), JSON.stringify(call)).toBe(true);
    }
  });
});

describe('the ground deck hotspots', () => {
  const rects = GROUND_DECK_HOTSPOTS.map((spot) => spot.rect);

  it('puts every rectangle on stage', () => {
    for (const rect of rects)
      expect(inside({ x: 0, y: 0, w: WIDTH, h: HEIGHT }, rect), JSON.stringify(rect)).toBe(true);
  });

  it('overlaps no other hotspot', () => {
    const all = [...HOTSPOTS.map((spot) => spot.rect), ...rects];
    all.forEach((a, i) => {
      for (const b of all.slice(i + 1)) expect(overlaps(a, b), `${JSON.stringify(a)} ${JSON.stringify(b)}`).toBe(false);
    });
  });

  it('gives every piece an honest tip in sentence case', () => {
    for (const spot of GROUND_DECK_HOTSPOTS) {
      for (const view of STAGES) {
        const tip = spot.tip(view);
        expect(tip.title.length).toBeGreaterThan(0);
        expect(tip.detail).not.toMatch(/[–—]/);
        expect(tip.status).not.toMatch(/[–—]/);
      }
    }
  });

  it('reads the lab: alerts, pings, the gate, the holo-table and the runner', () => {
    const tipAt = (rect: Rect, view: StageView) => GROUND_DECK_HOTSPOTS.find((spot) => spot.rect === rect)?.tip(view);
    const beacon = GROUND_DECK_HOTSPOTS.find((spot) => spot.rect.x === beaconRect(BEACON_XS[0] ?? 0).x);
    expect(beacon?.tip(ALARMED)).toMatchObject({
      title: 'Discord alerts',
      status: '2 critical findings',
      severity: 'crit',
    });
    expect(tipAt(TEAM_EMBLEM, CALM)).toMatchObject({ title: 'Five nines' });
    expect(beacon?.tip(CALM)).toMatchObject({ status: 'Quiet', severity: 'ok' });
    expect(tipAt(HEARTBEAT_MONITOR, ALARMED)).toMatchObject({ title: 'Healthchecks.io', severity: 'crit' });
    expect(tipAt(GATE, withVm('compute', { up: false }))).toMatchObject({ status: 'Field down', severity: 'crit' });
    expect(tipAt(OPS_CLOCK, NIGHT)).toMatchObject({ status: '02:30' });
    const holo = GROUND_DECK_HOTSPOTS.find((spot) => spot.rect.x === HOLO_TABLE.x);
    expect(holo?.tip(withVm('data', { up: false }))).toMatchObject({ status: '1 VM down', severity: 'crit' });
    expect(holo?.tip(CALM)).toMatchObject({ status: 'All 4 VMs up' });
    const runner: Workload = { kind: 'runner', id: 'r', name: 'runner', cpu: 70, mem: 30, health: 'healthy' };
    expect(tipAt(GEAR_RACKS[0] ?? GATE, withVm('deploy', { workloads: [runner] }))).toMatchObject({
      title: 'runner',
      cpu: 70,
      status: 'Healthy',
    });
  });
});

describe('the ground deck, reacting to the stage', () => {
  it('reads the time of day on the ops clock, colon blinking', () => {
    expect(clockText(14)).toBe('14:00');
    expect(clockText(2.5)).toBe('02:30');
    expect(clockText(23.99)).toBe('23:59');
    expect(paint(stage({ hour: 9.75, now: 0 })).texts).toContain('09:45');
    expect(paint(stage({ hour: 9.75, now: 1 })).texts).toContain('09 45');
  });

  it('turns the alarm beacons only on all hands', () => {
    const lit = (view: StageView): number =>
      BEACON_XS.reduce((n, x) => n + rectsIn(paint(view), beaconRect(x), ALARM.base), 0);
    expect(lit(ALARMED)).toBeGreaterThanOrEqual(BEACON_XS.length);
    expect(lit(withVm('data', { up: false }))).toBeGreaterThanOrEqual(BEACON_XS.length);
    for (const view of [CALM, DEPLOY, NIGHT]) expect(lit(view)).toBe(0);
    // The beam sweeps: two moments in a turn throw it to opposite sides.
    const beam = (now: number): Rect[] =>
      paint({ ...ALARMED, now }).rects.filter((r) => r.colour === ALARM.light && r.y < 160 && r.w === 5);
    const side = (now: number): number => Math.sign((beam(now)[0]?.x ?? 0) - (BEACON_XS[0] ?? 0));
    expect(side(0)).toBe(-side(0.45));
  });

  it('runs the hangar lights while the runner deploys, and darkens them while the hangar is down', () => {
    const lights = (view: StageView): string[] =>
      paint(view)
        .rects.filter((r) => r.w === 3 && r.h === 2 && r.y === 167)
        .map((r) => r.colour);
    expect(lights(DEPLOY)).toContain(ROOMS.hangar.accent);
    expect(lights(CALM)).not.toContain(ROOMS.hangar.accent);
    expect(new Set(lights(withVm('deploy', { up: false })))).toEqual(new Set(['#16202e']));
    // The chase moves on.
    expect(lights({ ...DEPLOY, now: 0 })).not.toEqual(lights({ ...DEPLOY, now: 0.12 }));
  });

  it('keeps the hangar lights chasing through a deploy even while an alarm outranks it', () => {
    const lights = (view: StageView): string[] =>
      paint(view)
        .rects.filter((r) => r.w === 3 && r.h === 2 && r.y === 167)
        .map((r) => r.colour);
    const alarmedDeploy = stage({
      findings: { ok: 1, warn: 0, crit: 2 },
      vms: ROLES.map((role) => vm(role, role === 'deploy' ? { cpu: DEPLOY_BUSY_CPU } : {})),
    });
    expect(lights(alarmedDeploy)).toContain(ROOMS.hangar.accent);
    expect(lights({ ...alarmedDeploy, now: 0 })).not.toEqual(lights({ ...alarmedDeploy, now: 0.12 }));
  });

  it('stacks a crate on the gear racks for every Site instance, up to the racks being full', () => {
    const crates = (view: StageView): number =>
      paint(view).rects.filter((r) => r.colour === STEEL.shine && r.w === 5 && r.h === 1).length;
    expect(crates(CALM)).toBe(6);
    expect(crates(withVm('compute', { workloads: sites(12) }))).toBe(12);
    expect(crates(withVm('compute', { workloads: sites(30) }))).toBe(15);
    expect(crates(stage({ host: null, vms: [] }))).toBe(0);
  });

  it('reads AVENGERS on the roof name board, inside the board', () => {
    const painter = paint(CALM);
    const call = painter.calls.find((c) => c.op === 'text' && c.text === NAME_BOARD.text);
    if (call === undefined) throw new Error('no name board text');
    expect(inside(NAME_BOARD, extentOf(call, painter))).toBe(true);
  });

  it('lights the emblem and the mast halo after dark', () => {
    const roof: Rect = { x: 0, y: 0, w: WIDTH, h: 34 };
    const glow = (view: StageView): number => rectsIn(paint(view), roof, AMBER.glow);
    expect(glow(CALM)).toBe(0);
    expect(glow(NIGHT)).toBeGreaterThan(0);
  });

  it('runs the tactical wall at half brightness on the quiet watch', () => {
    const shade = (view: StageView): number =>
      paint(view).rects.filter((r) => inside(TACTICAL_WALL, r) && r.w === TACTICAL_WALL.w - 4).length;
    expect(shade(NIGHT)).toBeGreaterThan(shade(CALM));
  });

  it('drops the gate field and the hologram while the ops floor is offline', () => {
    const field = (view: StageView): number => rectsIn(paint(view), GATE, CYAN.hot);
    expect(field(CALM)).toBeGreaterThan(0);
    expect(field(withVm('compute', { up: false }))).toBe(0);
    const holo = (view: StageView): number => rectsIn(paint(view), HOLO_TABLE, CYAN.bright);
    expect(holo(CALM)).toBeGreaterThan(0);
    expect(holo(withVm('compute', { up: false }))).toBe(0);
  });

  it('brightens the holo-table and drops a marker while someone studies it', () => {
    const busy = paint(stage({ busyBreakSpots: new Set([HOLO_INDEX]) }));
    expect(rectsIn(busy, HOLO_TABLE, AMBER.glow)).toBeGreaterThan(0);
    expect(rectsIn(paint(CALM), HOLO_TABLE, AMBER.glow)).toBe(0);
  });

  it('shows a calm heartbeat that turns red while a critical finding is open', () => {
    expect(Array.from({ length: 26 }, (_, i) => traceAt(i, 0))).toContain(10);
    expect(traceAt(-1, 0)).toBe(traceAt(25, 0));
    expect(paint(ALARMED).texts).toContain('FAIL');
    expect(paint(CALM).texts).toContain('PING');
    expect(rectsIn(paint(ALARMED), HEARTBEAT_MONITOR, ALARM.base)).toBeGreaterThan(0);
    expect(rectsIn(paint(CALM), HEARTBEAT_MONITOR, ALARM.base)).toBe(0);
  });
});
