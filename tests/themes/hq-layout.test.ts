import { describe, expect, it } from 'vitest';
import type { Health, Host, SiteEnv, SiteInstanceWorkload, Vm, VmRole } from '../../src/contract/snapshot.ts';
import type { Mood, Occupant, Part, Place, Rect, StageView, Subject } from '../../src/contract/theme.ts';
import { FOUNDERS } from '../../src/themes/hq/founders.ts';
import { BANDS, BAYS, DECK, HULL_RECT, SHAFT, type Span } from '../../src/themes/hq/geometry.ts';
import { HQ_LAYOUT } from '../../src/themes/hq/layout.ts';
import { BREAK_SPOT_KINDS } from '../../src/themes/hq/lines.ts';
import { LAMP } from '../../src/themes/hq/palette.ts';
import { watchStationArt } from '../../src/themes/hq/places.ts';
import { DOORWAYS, DOOR_HEIGHT, GATE, HANGAR_DOOR } from '../../src/themes/hq/shell.ts';
import { inside, overlaps } from '../support/geometry.ts';
import { RecordingPainter, type PaintCall } from '../support/recording-painter.ts';
import { HOST, ROLES, stage, vm } from '../support/stage.ts';

/* ------------------------------------------------------------------ helpers */

/** Every kind of stage the furniture reads: calm, cold, busy, down, alarmed, at night. */
const STAGES: readonly StageView[] = [
  stage(),
  stage({ host: null, vms: [] }),
  stage({ vms: ROLES.map((role) => vm(role, { mem: 100 })), openStores: new Set([0, 1]), vaultOpen: true }),
  stage({ vms: ROLES.map((role) => vm(role, { up: false })) }),
  stage({ findings: { ok: 1, warn: 3, crit: 2 } }),
  stage({ hour: 2, host: { ...HOST, cpu: 5 } }),
];

const MOODS: readonly Mood[] = ['working', 'break', 'stressed', 'swamped', 'fainted', 'absent'];
const ENVS: readonly SiteEnv[] = ['develop', 'staging', 'production'];

function site(env: SiteEnv, health: Health, mem: number): SiteInstanceWorkload {
  return {
    kind: 'site-instance',
    id: 'w',
    client: 'scrd',
    site: 'server',
    env,
    siteType: 'wordpress',
    cpu: 50,
    mem,
    health,
  };
}

/** Who might sit at a Place of `part`: nobody, or each subject the part can have. */
function subjectsFor(part: Part): Subject[] {
  if (part === 'founder') return FOUNDERS.map((founder) => ({ kind: 'founder', founder }));
  if (part === 'worker') {
    const compute = vm('compute');
    // Each name plate at full memory, and an unhealthy hero for the DOWN note.
    const workloads = [...ENVS.map((env) => site(env, 'healthy', 100)), site('develop', 'unhealthy', 30)];
    return workloads.map((workload): Subject => ({ kind: 'workload', vm: compute, workload }));
  }
  return [{ kind: 'vm', vm: vm('compute') }];
}

function occupantsFor(part: Part): (Occupant | null)[] {
  return [
    null,
    ...subjectsFor(part).flatMap((subject) =>
      MOODS.flatMap((mood) => [true, false].map((atSeat): Occupant => ({ subject, mood, atSeat }))),
    ),
  ];
}

const PARTS = Object.keys(HQ_LAYOUT.homes) as Part[];
const placesOf = (part: Part): readonly Place[] => HQ_LAYOUT.homes[part];
const allPlaces = (): Place[] => PARTS.flatMap(placesOf);

const hoverBox = (place: Place): Rect => ({ x: place.x, y: place.baseY - place.h, w: place.w, h: place.h });

/** The rectangle a recorded call covers: a rect as given, a text by its alignment and the 7 px cap height. */
function extentOf(call: PaintCall, painter: RecordingPainter): Rect {
  if (call.op === 'rect') return call;
  const w = painter.textWidth(call.text, call.style.bold);
  const x = call.style.align === 'centre' ? call.x - w / 2 : call.style.align === 'right' ? call.x - w : call.x;
  return { x, y: call.y - 7, w, h: 7 };
}

/* -------------------------------------------------------------------- tests */

describe('the HQ furniture', () => {
  it.each(PARTS)("keeps every %s Place's art inside its box in every mood", (part) => {
    for (const place of placesOf(part)) {
      const box = hoverBox(place);
      for (const occupant of occupantsFor(part)) {
        for (const view of STAGES) {
          for (let frame = 0; frame < 6; frame++) {
            const painter = new RecordingPainter();
            place.art(painter, { place, occupant, stage: { ...view, now: frame * 0.37 } });
            const strays = painter.calls.filter((call) => !inside(box, extentOf(call, painter)));
            expect(strays, `${part} at ${place.x}`).toEqual([]);
          }
        }
      }
    }
  });

  it('gives no two Places overlapping hover boxes', () => {
    const places = allPlaces();
    places.forEach((a, i) => {
      for (const b of places.slice(i + 1)) {
        expect(
          overlaps(hoverBox(a), hoverBox(b)),
          `${JSON.stringify(hoverBox(a))} ${JSON.stringify(hoverBox(b))}`,
        ).toBe(false);
      }
    });
  });

  it('shows each mood on the watch station screen', () => {
    const [place] = HQ_LAYOUT.homes.worker;
    if (!place) throw new Error('no watch station');
    const compute = vm('compute');
    const paint = (mood: Mood, health: Health = 'healthy'): RecordingPainter => {
      const painter = new RecordingPainter();
      const subject: Subject = { kind: 'workload', vm: compute, workload: site('production', health, 95) };
      watchStationArt(painter, { place, occupant: { subject, mood, atSeat: true }, stage: stage({ now: 0 }) });
      return painter;
    };
    expect(paint('fainted').texts).toContain('OOM');
    expect(paint('absent').texts).toContain('AWAY');
    expect(paint('absent', 'unhealthy').texts).toContain('DOWN');
    expect(paint('working').texts).toEqual(['SER']);
    // Memory at 95% stacks five alert cards beside the screen.
    const cards = (painter: RecordingPainter): number =>
      painter.rects.filter((r) => r.w === 6 && r.colour === LAMP.warn).length;
    expect(cards(paint('swamped'))).toBe(5);
    expect(paint('fainted').rects.some((r) => r.colour === LAMP.warn)).toBe(true);
  });
});

describe('the HQ boards', () => {
  const [station] = HQ_LAYOUT.homes.worker;
  const [, ...consoles] = HQ_LAYOUT.homes.founder;

  it.each(['DOWN', 'AWAY', 'OOM', 'SER'])('fits %s on a 24 px watch station', (text) => {
    expect(station?.w).toBe(24);
    expect(new RecordingPainter().textWidth(text)).toBeLessThanOrEqual(station?.w ?? 0);
  });

  it.each(FOUNDERS.filter((founder) => founder.id !== 'jarvis').map((founder) => founder.name))(
    "fits %s's name on a founder's console",
    (name) => {
      for (const place of consoles) {
        expect(new RecordingPainter().textWidth(name.toUpperCase())).toBeLessThanOrEqual(place.w);
      }
    },
  );
});

describe('HQ_LAYOUT', () => {
  const { floors } = HQ_LAYOUT;

  it('docks the JARVIS remote first, then seats Paul and Dhruv, in the founders order', () => {
    expect(FOUNDERS.map((founder) => founder.id)).toEqual(['jarvis', 'paul', 'dhruv']);
    expect(HQ_LAYOUT.homes.founder[0]?.seat.y).toBeUndefined();
  });

  it('uses only break-spot kinds the line bank speaks for', () => {
    expect(new Set(HQ_LAYOUT.breakSpots.map((spot) => spot.kind))).toEqual(new Set(BREAK_SPOT_KINDS));
  });

  it('puts every home, break spot, store, vault and pod spawn on a floor and inside its span', () => {
    const spots = [
      ...allPlaces().flatMap((place) => [
        { x: place.seat.x, floor: place.floor },
        { x: place.x, floor: place.floor },
        { x: place.x + place.w, floor: place.floor },
      ]),
      ...HQ_LAYOUT.breakSpots,
      ...HQ_LAYOUT.stores,
      HQ_LAYOUT.vault,
      HQ_LAYOUT.podSpawn,
    ];
    for (const spot of spots) {
      const floor = floors[spot.floor];
      expect(floor, JSON.stringify(spot)).toBeDefined();
      expect(spot.x, JSON.stringify(spot)).toBeGreaterThanOrEqual(floor?.minX ?? Infinity);
      expect(spot.x, JSON.stringify(spot)).toBeLessThanOrEqual(floor?.maxX ?? -Infinity);
    }
  });

  it('stands each Place on its deck: a seat behind the walk line, a post on it', () => {
    for (const place of allPlaces()) {
      const walk = floors[place.floor]?.walkY ?? 0;
      expect(place.baseY).toBeLessThanOrEqual(walk);
      if (place.seat.y !== undefined) {
        expect(place.seat.y).toBeLessThan(place.baseY);
      } else {
        expect(place.baseY).toBe(walk);
      }
    }
  });

  it('opens a doorway wherever a walk line crosses a wall', () => {
    const decks: readonly [number, readonly Span[]][] = [
      [DECK.upper, [BAYS.rookieBay, BAYS.archive, BAYS.command, BAYS.rec]],
      [DECK.ground, [BAYS.ops, BAYS.hangar]],
    ];
    for (const [deck, spans] of decks) {
      const floor = floors[deck];
      if (!floor) throw new Error(`no floor ${deck}`);
      // An inner wall is a gap between rooms; across the lift it is the shaft's two walls.
      const walls = spans.slice(1).flatMap((span, i): number[] => {
        const end = spans[i]?.[1] ?? 0;
        return span[0] - end > 4 ? [end, SHAFT.x + SHAFT.w] : [end];
      });
      for (const x of walls.filter((wall) => wall > floor.minX && wall < floor.maxX)) {
        expect(
          DOORWAYS.some((door) => door.deck === deck && door.x === x),
          `deck ${deck} wall at ${x}`,
        ).toBe(true);
      }
      const walk = BANDS[deck]?.walk ?? Infinity;
      // The outer walls: crossed only through the gate (left) and the hangar door (right).
      const [first] = spans;
      const last = spans[spans.length - 1];
      for (const [crossed, door] of [
        [floor.minX < (first?.[0] ?? 0), GATE],
        [floor.maxX > (last?.[1] ?? 0), HANGAR_DOOR],
      ] as const) {
        if (!crossed) continue;
        expect(door.y + door.h).toBeGreaterThanOrEqual(walk);
        expect(door.h).toBeGreaterThanOrEqual(26);
      }
    }
    expect(DOOR_HEIGHT).toBeGreaterThanOrEqual(26);
    expect(GATE.x).toBe(HULL_RECT.x);
  });
});
