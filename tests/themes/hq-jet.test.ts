import { describe, expect, it } from 'vitest';
import type { Host, Vm, VmRole } from '../../src/contract/snapshot.ts';
import type { DecorFn, Place, Rect, StageView } from '../../src/contract/theme.ts';
import { GLYPHS } from '../../src/engine/pixel-font.ts';
import { APRON, BANDS, DECK, GROUND_Y, HEIGHT, WIDTH } from '../../src/themes/hq/geometry.ts';
import { hqTheme } from '../../src/themes/hq/index.ts';
import {
  BUNKER,
  BUNKER_BEACON,
  BUNKER_PAD,
  JET_AND_BUNKER,
  JET_BACK,
  JET_HOTSPOTS,
  JET_STAND,
  STAND_BOARD,
  bunkerTip,
  contrailAt,
} from '../../src/themes/hq/jet.ts';
import { HQ_LAYOUT, JET_RAMP_X } from '../../src/themes/hq/layout.ts';
import { ALARM, AMBER, CYAN, LAMP, STEEL } from '../../src/themes/hq/palette.ts';
import { HANGAR_DOOR } from '../../src/themes/hq/shell.ts';
import { inside, overlaps, rectsIn } from '../support/geometry.ts';
import { RecordingPainter, type PaintCall } from '../support/recording-painter.ts';
import { HOST, ROLES, stage as baseStage, vm } from '../support/stage.ts';

/* ------------------------------------------------------------------ helpers */

/** A calm afternoon with the jet on its stand. */
const stage = (over: Partial<StageView> = {}): StageView =>
  baseStage({ now: 0, vms: ROLES.map((role) => vm(role, { cpu: 10, mem: 40 })), ...over });

const CALM = stage();
const AWAY = stage({ vaultOpen: true });
const ALARMED = stage({ findings: { ok: 1, warn: 0, crit: 2 } });
const NIGHT = stage({ hour: 2.5, host: { ...HOST, cpu: 5 } });
const NIGHT_RUN = stage({ hour: 2.5, host: { ...HOST, cpu: 5 }, vaultOpen: true });

/** Every kind of stage the apron reads. */
const STAGES: readonly StageView[] = [
  CALM,
  AWAY,
  ALARMED,
  { ...ALARMED, vaultOpen: true },
  NIGHT,
  NIGHT_RUN,
  stage({ host: null, vms: [] }),
  stage({ hour: 18.4 }),
  stage({ vms: stage().vms.map((v) => (v.role === 'data' ? { ...v, up: false } : v)) }),
];

function paint(view: StageView, fns: readonly DecorFn[] = JET_BACK): RecordingPainter {
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

/** The sky over the apron and its strip of tarmac, below the night sky's moon and Southern Cross. */
const APRON_AREA: Rect = { x: APRON[0], y: 140, w: APRON[1] - APRON[0], h: GROUND_Y + 4 - 140 };

const FRAMES = 12;
const frames = (view: StageView): StageView[] =>
  Array.from({ length: FRAMES }, (_, frame) => ({ ...view, now: frame * 0.37 }));

/* -------------------------------------------------------------------- tests */

describe('the apron, the jet and the bunker', () => {
  it('paints only over the apron and its tarmac, on stage', () => {
    expect(inside({ x: 0, y: 0, w: WIDTH, h: HEIGHT }, APRON_AREA)).toBe(true);
    for (const view of STAGES.flatMap(frames)) {
      const painter = paint(view);
      for (const call of painter.calls) {
        expect(inside(APRON_AREA, extentOf(call, painter)), JSON.stringify(call)).toBe(true);
      }
    }
  });

  it('leaves the hangar door, the hangar, its places and the spine alone', () => {
    const hangar: Rect = { x: 0, y: 0, w: HANGAR_DOOR.x + HANGAR_DOOR.w, h: HEIGHT };
    const places = Object.values(HQ_LAYOUT.homes)
      .flat()
      .map((place: Place): Rect => ({ x: place.x, y: place.baseY - place.h, w: place.w, h: place.h }));
    for (const view of STAGES.flatMap(frames)) {
      const painter = paint(view);
      for (const call of painter.calls) {
        const extent = extentOf(call, painter);
        expect(overlaps(hangar, extent), JSON.stringify(call)).toBe(false);
        for (const place of places) expect(overlaps(place, extent), JSON.stringify(call)).toBe(false);
      }
    }
  });

  it('parks the jet over the keeper loading spot, on the tarmac', () => {
    expect(JET_RAMP_X).toBeGreaterThan(JET_STAND.x);
    expect(JET_RAMP_X).toBeLessThan(JET_STAND.x + JET_STAND.w);
    expect(JET_STAND.y + JET_STAND.h).toBe(BANDS[DECK.ground].walk + 1);
    expect(inside(APRON_AREA, JET_STAND)).toBe(true);
    expect(overlaps(JET_STAND, BUNKER)).toBe(false);
    expect(overlaps(JET_STAND, STAND_BOARD)).toBe(false);
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

describe('the jet run', () => {
  /** The fuselage's top highlight: only the parked jet uses it. */
  const parked = (view: StageView): number => rectsIn(paint(view), JET_STAND, STEEL.shine);
  /** The contrail is the only ice-white on the apron. */
  const contrail = (view: StageView): number => rectsIn(paint(view), APRON_AREA, CYAN.hot);
  const atBunker = (view: StageView): number => rectsIn(paint(view), BUNKER_PAD, STEEL.light);

  it('keeps the jet on its stand until the vault opens, then sends it to the bunker', () => {
    for (const view of [CALM, NIGHT, ALARMED].flatMap(frames)) {
      expect(parked(view)).toBeGreaterThan(0);
      expect(atBunker(view)).toBe(0);
    }
    for (const view of [AWAY, NIGHT_RUN].flatMap(frames)) {
      expect(parked(view)).toBe(0);
      expect(atBunker(view)).toBeGreaterThan(0);
    }
  });

  it('streams a contrail only while the jet is away', () => {
    for (const view of [CALM, NIGHT, ALARMED].flatMap(frames)) expect(contrail(view)).toBe(0);
    for (const view of [AWAY, NIGHT_RUN].flatMap(frames)) expect(contrail(view)).toBeGreaterThan(30);
  });

  it('runs the contrail from the apron up to the bunker pad', () => {
    const from = contrailAt(0);
    const to = contrailAt(1);
    expect(from.x).toBeLessThan(JET_RAMP_X);
    expect(from.y).toBeGreaterThan(BUNKER_PAD.y + BUNKER_PAD.h);
    expect(inside(BUNKER_PAD, { x: to.x, y: to.y, w: 0, h: 0 })).toBe(true);
  });

  it('flows the contrail with time, towards the bunker', () => {
    const at = (now: number) => paint({ ...AWAY, now }).calls;
    expect(at(0)).not.toEqual(at(0.2));
  });
});

describe('the bunker beacon', () => {
  const lit = (view: StageView, colour: string): number =>
    frames(view).reduce((n, frame) => n + rectsIn(paint(frame), BUNKER_BEACON, colour), 0);

  it('lights while the jet is at the bunker, and stays dark otherwise', () => {
    expect(lit(AWAY, LAMP.ok)).toBeGreaterThan(0);
    expect(lit(NIGHT_RUN, LAMP.ok)).toBeGreaterThan(0);
    expect(lit(CALM, LAMP.ok)).toBe(0);
    expect(lit(NIGHT, LAMP.ok)).toBe(0);
    expect(lit(stage({ host: null, vms: [], vaultOpen: true }), LAMP.ok)).toBe(0);
  });

  it('turns red on all hands, like every other beacon, and red only then', () => {
    expect(lit(ALARMED, ALARM.base)).toBeGreaterThan(0);
    expect(lit({ ...ALARMED, vaultOpen: true }, ALARM.base)).toBeGreaterThan(0);
    for (const view of STAGES.filter((v) => v.findings.crit === 0 && v.vms.every((m) => m.up))) {
      expect(rectsIn(paint(view), APRON_AREA, ALARM.base)).toBe(0);
    }
  });
});

describe('the apron after dark', () => {
  it('lights the edge lamps, the cabin and the bunker sign', () => {
    const glow = (view: StageView): number => rectsIn(paint(view), APRON_AREA, CYAN.bright);
    expect(glow(NIGHT)).toBeGreaterThan(glow(CALM));
    const amber = (view: StageView): number => rectsIn(paint(view), APRON_AREA, AMBER.hot);
    expect(amber(NIGHT)).toBeGreaterThan(amber(CALM));
    const sign = (view: StageView) => paint(view).calls.find((c) => c.op === 'text' && c.text === 'R2');
    expect(sign(NIGHT)).toMatchObject({ colour: AMBER.glow });
    expect(sign(CALM)).toMatchObject({ colour: STEEL.shine });
  });
});

describe('the bunker hotspot', () => {
  it('sits on stage over the apron, clear of every other hotspot', () => {
    expect(inside(APRON_AREA, JET_AND_BUNKER)).toBe(true);
    for (const art of [JET_STAND, BUNKER, BUNKER_PAD, STAND_BOARD]) expect(inside(JET_AND_BUNKER, art)).toBe(true);
    const others = hqTheme.hotspots.filter((spot) => !JET_HOTSPOTS.includes(spot)).map((spot) => spot.rect);
    for (const rect of others) expect(overlaps(JET_AND_BUNKER, rect), JSON.stringify(rect)).toBe(false);
    expect(hqTheme.hotspots).toEqual(expect.arrayContaining([...JET_HOTSPOTS]));
  });

  it('gives the vault an honest status: locked, or a backup in progress', () => {
    expect(bunkerTip(CALM)).toMatchObject({ title: 'R2 bunker', status: 'Locked', severity: 'ok' });
    expect(bunkerTip(AWAY)).toMatchObject({ status: 'Backup in progress', severity: 'ok' });
    for (const view of STAGES) {
      const tip = bunkerTip(view);
      expect(tip.detail).not.toMatch(/[–—]/);
      expect(tip.status).not.toMatch(/[–—]/);
    }
  });
});
