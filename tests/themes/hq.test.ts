import { describe, expect, it } from 'vitest';
import type { CiPodWorkload, Host, Vm, VmRole, Workload } from '../../src/contract/snapshot.ts';
import type { Place, Rect, StageView } from '../../src/contract/theme.ts';
import { GLYPHS } from '../../src/engine/pixel-font.ts';
import { CORE, JARVIS, JARVIS_CONSOLE, POWER_CORE } from '../../src/themes/hq/boards.ts';
import { bankWidth, coreTone, powerCore, sputterOn } from '../../src/themes/hq/core.ts';
import { HEIGHT, SUBLEVEL, WIDTH } from '../../src/themes/hq/geometry.ts';
import { coreTip, jarvisTip } from '../../src/themes/hq/hotspots.ts';
import { hqTheme } from '../../src/themes/hq/index.ts';
import { READOUT_MIN_WIDTH, jarvisConsole } from '../../src/themes/hq/jarvis-console.ts';
import { JARVIS_LINES, JARVIS_LINE_MAX } from '../../src/themes/hq/jarvis-lines.ts';
import { LINE_SECONDS, TYPE_RATE, jarvisSpeech } from '../../src/themes/hq/jarvis-speech.ts';
import { DEPLOY_BUSY_CPU, jarvisState, type JarvisState } from '../../src/themes/hq/jarvis-state.ts';
import { disc } from '../../src/themes/hq/kit.ts';
import { orbReach, paintOrb } from '../../src/themes/hq/orb.ts';
import { ALARM } from '../../src/themes/hq/palette.ts';
import { paintAlarmWash } from '../../src/themes/hq/shell.ts';
import { RecordingPainter } from '../support/recording-painter.ts';

/* ------------------------------------------------------------------ helpers */

const pod = (i: number): CiPodWorkload => ({ kind: 'ci-pod', id: `pod-${i}`, cpu: 90, mem: 40 });

function vm(role: VmRole, over: Partial<Vm> = {}, workloads: Workload[] = []): Vm {
  return { id: role, role, name: `sls-${role}`, up: true, cpu: 10, mem: 40, workloads, ...over };
}

const HOST: Host = {
  name: 'pve',
  cpu: 40,
  mem: 60,
  findings: { ok: 9, warn: 1, crit: 0 },
  temps: { cpu: 58, chipset: 59, nvme: 46 },
};

/** A calm afternoon: JARVIS is idle. */
function stage(over: Partial<StageView> = {}): StageView {
  return {
    now: 12.3,
    hour: 14,
    host: HOST,
    vms: [vm('data'), vm('compute'), vm('deploy'), vm('ci')],
    findings: { ok: 9, warn: 1, crit: 0 },
    liftInUse: false,
    lift: { y: 242, moving: false, doorsOpen: false, calls: new Set() },
    vaultOpen: false,
    openStores: new Set(),
    busyBreakSpots: new Set(),
    ...over,
  };
}

/** One stage for each thing JARVIS can be attending to. */
const STAGES: Readonly<Record<JarvisState, StageView>> = {
  waking: stage({ host: null }),
  idle: stage(),
  deploy: stage({ vms: [vm('data'), vm('compute'), vm('deploy', { cpu: DEPLOY_BUSY_CPU }), vm('ci')] }),
  ci: stage({ vms: [vm('data'), vm('compute'), vm('deploy'), vm('ci', {}, [pod(1), pod(2), pod(3)])] }),
  backup: stage({ vaultOpen: true }),
  night: stage({ hour: 2, host: { ...HOST, cpu: 6 } }),
  alarm: stage({ findings: { ok: 7, warn: 1, crit: 2 } }),
};
const STATES = Object.keys(STAGES) as JarvisState[];

const inside = (outer: Rect, inner: Rect): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.w <= outer.x + outer.w &&
  inner.y + inner.h <= outer.y + outer.h;

/* ------------------------------------------------------------- JARVIS state */

describe('jarvisState', () => {
  it.each(STATES)('reads %s from the stage', (state) => {
    expect(jarvisState(STAGES[state])).toBe(state);
  });

  it('puts an alarm ahead of everything else', () => {
    const busy = stage({ ...STAGES.ci, ...STAGES.backup, findings: { ok: 1, warn: 0, crit: 1 } });
    expect(jarvisState(busy)).toBe('alarm');
  });

  it('counts a VM that is down as an alarm', () => {
    expect(jarvisState(stage({ vms: [vm('data', { up: false }), vm('compute')] }))).toBe('alarm');
  });

  it("reads the runner's own CPU where the Snapshot lists the runner", () => {
    const runner: Workload = { kind: 'runner', id: 'runner', name: 'runner', cpu: 2, mem: 10, health: 'healthy' };
    const idleRunner = stage({ vms: [vm('deploy', { cpu: 90 }, [runner])] });
    expect(jarvisState(idleRunner)).toBe('idle');
  });

  it('keeps a busy night out of the quiet watch', () => {
    expect(jarvisState(stage({ hour: 2, host: { ...HOST, cpu: 60 } }))).toBe('idle');
  });
});

/* -------------------------------------------------------------- JARVIS words */

describe('the JARVIS line bank', () => {
  const lines = STATES.flatMap((state) => JARVIS_LINES[state].map((line) => [state, line] as const));

  it.each(lines)('%s: "%s" fits the readout in pixel-font capitals', (_state, line) => {
    expect(line.length).toBeLessThanOrEqual(JARVIS_LINE_MAX);
    expect(line).toBe(line.toUpperCase());
    for (const char of line) expect(char === ' ' || char in GLYPHS, `glyph for "${char}"`).toBe(true);
  });

  it('gives every state at least three lines', () => {
    for (const state of STATES) expect(JARVIS_LINES[state].length, state).toBeGreaterThanOrEqual(3);
  });
});

describe('jarvisSpeech', () => {
  it('types a line out, then holds it', () => {
    const start = jarvisSpeech(stage({ now: LINE_SECONDS * 3 }));
    expect(start).toMatchObject({ state: 'idle', shown: 0, speaking: true });
    const typing = jarvisSpeech(stage({ now: LINE_SECONDS * 3 + 4 / TYPE_RATE + 0.001 }));
    expect(typing).toMatchObject({ text: start.text, shown: 4, speaking: true });
    const held = jarvisSpeech(stage({ now: LINE_SECONDS * 4 - 0.1 }));
    expect(held).toMatchObject({ text: start.text, shown: start.text.length, speaking: false });
  });

  it('takes the lines in turn and speaks for the state it is in', () => {
    const turns = JARVIS_LINES.idle.map((_, turn) => jarvisSpeech(stage({ now: turn * LINE_SECONDS })).text);
    expect(turns).toEqual([...JARVIS_LINES.idle]);
    expect(JARVIS_LINES.alarm).toContain(jarvisSpeech(STAGES.alarm).text);
  });
});

/* ---------------------------------------------------------------------- orb */

describe('the JARVIS orb', () => {
  it('paints a disc as a stack of rows exactly 2r + 1 across', () => {
    const painter = new RecordingPainter();
    disc(painter, '#fff', 20, 20, 5);
    const xs = painter.rects.flatMap((r) => [r.x, r.x + r.w]);
    const ys = painter.rects.flatMap((r) => [r.y, r.y + r.h]);
    expect([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]).toEqual([15, 26, 15, 26]);
    expect(painter.rects.reduce((rows, r) => rows + r.h, 0)).toBe(11);
  });

  it.each(STATES.flatMap((state) => [10, 15].map((r) => [state, r] as const)))(
    'stays inside its reach while %s at radius %i',
    (state, r) => {
      const orb = { cx: 100, cy: 100, r };
      const reach = orbReach(r);
      const box: Rect = { x: orb.cx - reach, y: orb.cy - reach, w: reach * 2 + 1, h: reach * 2 + 1 };
      for (let frame = 0; frame < 40; frame++) {
        const painter = new RecordingPainter();
        paintOrb(painter, { ...STAGES[state], now: frame * 0.37 }, orb);
        for (const rect of painter.rects) expect(inside(box, rect), JSON.stringify(rect)).toBe(true);
      }
    },
  );

  it('is a pure function of the stage', () => {
    const paint = (): RecordingPainter => {
      const painter = new RecordingPainter();
      paintOrb(painter, STAGES.deploy, JARVIS.orb);
      return painter;
    };
    expect(paint().calls).toEqual(paint().calls);
  });

  it('turns red only for the alarm', () => {
    const colours = (state: JarvisState): Set<string> => {
      const painter = new RecordingPainter();
      paintOrb(painter, STAGES[state], JARVIS.orb);
      return new Set(painter.rects.map((r) => r.colour));
    };
    expect(colours('alarm').has(ALARM.base)).toBe(true);
    for (const state of STATES.filter((s) => s !== 'alarm')) expect(colours(state).has(ALARM.base), state).toBe(false);
  });

  it('circles one satellite per CI pod', () => {
    const count = (view: StageView): number => {
      const painter = new RecordingPainter();
      paintOrb(painter, view, JARVIS.orb);
      return painter.rects.length;
    };
    const onePod = stage({ vms: [vm('ci', {}, [pod(1)])] });
    // Each satellite is a 2 px head and a 1 px trail.
    expect(count(STAGES.ci) - count(onePod)).toBe(4);
  });
});

describe('the JARVIS console', () => {
  it('has a readout wide enough for the longest line and its cursor', () => {
    expect(JARVIS.readout.w).toBeGreaterThanOrEqual(READOUT_MIN_WIDTH);
  });

  it('types the line JARVIS is speaking after a prompt', () => {
    const view = stage({ now: LINE_SECONDS - 0.1 });
    const painter = new RecordingPainter();
    jarvisConsole(JARVIS)(painter, view);
    expect(painter.texts).toContain(`> ${jarvisSpeech(view).text}`);
  });

  it('keeps the orb clear of the readout above it and inside its hover target', () => {
    const reach = orbReach(JARVIS.orb.r);
    expect(JARVIS.orb.cy - reach).toBeGreaterThanOrEqual(JARVIS.readout.y + JARVIS.readout.h);
    expect(JARVIS_CONSOLE.x).toBeLessThanOrEqual(JARVIS.orb.cx - reach);
    expect(JARVIS_CONSOLE.x + JARVIS_CONSOLE.w).toBeGreaterThanOrEqual(JARVIS.orb.cx + reach);
  });
});

/* --------------------------------------------------------------------- core */

describe('the power core', () => {
  const paint = (view: StageView): RecordingPainter => {
    const painter = new RecordingPainter();
    powerCore(CORE)(painter, view);
    return painter;
  };

  it('is cold before the first Snapshot, hot when a sensor reads hot, otherwise steady', () => {
    expect(coreTone({ host: null })).toBe('cold');
    expect(coreTone({ host: HOST })).toBe('steady');
    expect(coreTone({ host: { ...HOST, temps: { cpu: 60, chipset: 60, nvme: 75 } } })).toBe('hot');
    expect(coreTone({ host: { name: 'pve', cpu: 40, mem: 60, findings: HOST.findings } })).toBe('steady');
  });

  it.each(['steady', 'hot', 'cold'] as const)('paints only inside the sub-level while %s', (tone) => {
    const hosts = { steady: HOST, hot: { ...HOST, cpu: 97, temps: { cpu: 91, chipset: 74, nvme: 73 } }, cold: null };
    for (let frame = 0; frame < 40; frame++) {
      const painter = paint(stage({ host: hosts[tone], now: frame * 0.37 }));
      for (const rect of painter.rects) expect(inside(SUBLEVEL, rect), JSON.stringify(rect)).toBe(true);
    }
  });

  it('lights the banks in step with host CPU and memory', () => {
    const lit = (view: StageView): number => paint(view).rects.filter((r) => r.w === 7 && r.h === 8).length;
    const unlit = (host: Host | null): number =>
      paint(stage({ host })).rects.filter((r) => r.w === 7 && r.h === 8 && r.colour === '#16202e').length;
    expect(lit(stage())).toBe(CORE.banks.cells * 2);
    expect(unlit(null)).toBe(CORE.banks.cells * 2);
    expect(unlit({ ...HOST, cpu: 100, mem: 100 })).toBe(0);
    expect(unlit({ ...HOST, cpu: 50, mem: 25 })).toBe(CORE.banks.cells * 2 - 6 - 3);
  });

  it('labels the drives and hangs the replacement note on the NVMe', () => {
    const { texts } = paint(stage());
    for (const text of ['POWER CORE', 'CPU', 'MEM', 'SSD', 'NVME', 'REPLACE', 'JAN 2027', 'PVE']) {
      expect(texts, text).toContain(text);
    }
  });

  it('shows each temperature, and dashes for a sensor that could not be read', () => {
    const { texts } = paint(stage({ host: { ...HOST, temps: { cpu: 71, chipset: null, nvme: 56 } } }));
    expect(texts).toEqual(expect.arrayContaining(['71', '--', '56', 'PCH']));
  });

  it('sputters without a steady beat, the same way every time', () => {
    const run = Array.from({ length: 200 }, (_, i) => sputterOn(i * 0.05));
    expect(run).toEqual(Array.from({ length: 200 }, (_, i) => sputterOn(i * 0.05)));
    const on = run.filter(Boolean).length;
    expect(on).toBeGreaterThan(100);
    expect(on).toBeLessThan(200);
  });

  it('fits its banks between the nameplate and the hub', () => {
    expect(CORE.banks.x + bankWidth(CORE.banks.cells)).toBeLessThan(CORE.hub.cx - CORE.hub.r);
    expect(inside(SUBLEVEL, CORE.tag ?? SUBLEVEL)).toBe(true);
  });
});

/* -------------------------------------------------------------------- theme */

describe('hqTheme', () => {
  const { layout } = hqTheme;
  const places = (): Place[] => Object.values(layout.homes).flat();

  it('is a 660 by 300 stage with two decks joined by the lift', () => {
    expect([layout.width, layout.height]).toEqual([WIDTH, HEIGHT]);
    expect(layout.floors).toHaveLength(2);
    for (const floor of layout.floors) {
      expect(layout.liftX).toBeGreaterThanOrEqual(floor.minX);
      expect(layout.liftX).toBeLessThanOrEqual(floor.maxX);
    }
  });

  it('seats twelve heroes on watch, three rookies, both founders and docks the JARVIS remote', () => {
    expect(layout.homes.worker).toHaveLength(12);
    expect(layout.homes.pod).toHaveLength(3);
    expect(layout.homes.founder).toHaveLength(3);
  });

  it('keeps every seat, spot and store on its floor', () => {
    const spots = [
      ...places().map((place) => ({ x: place.seat.x, floor: place.floor })),
      ...layout.breakSpots,
      ...layout.stores,
      layout.vault,
      layout.podSpawn,
    ];
    for (const spot of spots) {
      const floor = layout.floors[spot.floor];
      expect(floor, JSON.stringify(spot)).toBeDefined();
      expect(spot.x).toBeGreaterThanOrEqual(floor?.minX ?? 0);
      expect(spot.x).toBeLessThanOrEqual(floor?.maxX ?? 0);
    }
  });

  it('seats the founders either side of the orb, clear of the projector', () => {
    const [, left, right] = layout.homes.founder;
    expect((left?.x ?? 0) + (left?.w ?? 0)).toBeLessThanOrEqual(JARVIS.pedestal.x);
    expect(right?.x ?? 0).toBeGreaterThanOrEqual(JARVIS.pedestal.x + JARVIS.pedestal.w);
  });

  it('explains the orb and the core on hover', () => {
    expect(hqTheme.hotspots.slice(0, 2).map((spot) => spot.rect)).toEqual([JARVIS_CONSOLE, POWER_CORE]);
    expect(jarvisTip(STAGES.alarm)).toMatchObject({ title: 'JARVIS', severity: 'crit' });
    expect(jarvisTip(STAGES.night)).toMatchObject({ status: 'Keeping the quiet watch', severity: 'ok' });
    expect(coreTip(stage())).toMatchObject({ title: 'pve', cpu: 40, mem: 60, severity: 'warn' });
    expect(coreTip(stage()).detail).toContain('power core');
  });

  it('washes the HQ red only while JARVIS is in alarm', () => {
    const washes = (view: StageView): number => {
      const painter = new RecordingPainter();
      paintAlarmWash(painter, view);
      return painter.rects.length;
    };
    expect(washes(STAGES.alarm)).toBe(1);
    expect(washes(STAGES.idle)).toBe(0);
  });
});
