import { describe, expect, it } from 'vitest';
import type { MusicScore, SynthNote } from '../../src/contract/theme.ts';
import {
  LOOKAHEAD,
  MAX_CHANGE_PER_BAR,
  MusicSequencer,
  START_DELAY,
  TICK_MS,
  nextBpm,
  targetBpm,
  toSynthNote,
} from '../../src/page/audio/music-sequencer.ts';
import { boxesTheme } from '../../src/themes/boxes/index.ts';
import { MUSIC } from '../../src/themes/office/music.ts';
import { officeTheme } from '../../src/themes/office/index.ts';

interface Played {
  voice: string;
  note: SynthNote;
  at: number;
}

/** A sequencer over `score` with a clock the test moves, recording every note it plays. */
function run(score: MusicScore, load = 0) {
  const played: Played[] = [];
  const sequencer = new MusicSequencer(score, (voice, note, at) => played.push({ voice, note, at }));
  sequencer.setLoad(load);
  let now = 0;
  sequencer.start(now);
  const advance = (seconds: number): void => {
    const end = now + seconds;
    while (now < end) {
      sequencer.tick(now);
      now += TICK_MS / 1000;
    }
  };
  return { sequencer, played, advance, clock: () => now, jump: (seconds: number) => (now += seconds) };
}

const onsets = (played: readonly Played[], voice: string): number[] =>
  played.filter((entry) => entry.voice === voice).map((entry) => entry.at);

const gaps = (times: readonly number[]): number[] => times.slice(1).map((time, index) => time - (times[index] ?? 0));

/** How many bass notes each bar of each Office section has, so bar lines can be found from the bass alone. */
const BASS_NOTES_PER_BAR: readonly (readonly number[])[] = [
  [3, 3, 3, 4],
  [3, 3, 3, 4],
  [3, 3, 3, 4],
  [1, 1, 1, 1],
];

/** The start time of each Office bar, read from the bass (every bar opens with a bass note on step 0). */
function barStarts(played: readonly Played[]): number[] {
  const bass = onsets(played, 'bass');
  const starts: number[] = [];
  let at = 0;
  for (const section of MUSIC.order.concat(MUSIC.order)) {
    for (const count of BASS_NOTES_PER_BAR[section] ?? []) {
      const start = bass[at];
      if (start === undefined) return starts;
      starts.push(start);
      at += count;
    }
  }
  return starts;
}

describe('the tempo mapping', () => {
  it('runs from calm to busy on the grid', () => {
    expect(targetBpm(MUSIC, 0)).toBe(68);
    expect(targetBpm(MUSIC, 1)).toBe(96);
    expect(targetBpm(MUSIC, 0.5)).toBe(82);
  });

  it('clamps the load', () => {
    expect(targetBpm(MUSIC, -3)).toBe(68);
    expect(targetBpm(MUSIC, 9)).toBe(96);
  });

  it('moves at most a few BPM a bar, either way', () => {
    expect(nextBpm(68, 96)).toBe(68 + MAX_CHANGE_PER_BAR);
    expect(nextBpm(96, 68)).toBe(96 - MAX_CHANGE_PER_BAR);
    expect(nextBpm(80, 82)).toBe(82);
    expect(nextBpm(80, 80)).toBe(80);
  });
});

describe('toSynthNote', () => {
  const voice = { wave: 'square', volume: 0.02, attack: 0.01, release: 0.05, gate: 0.5 } as const;

  it('holds a note for its gated length less the attack', () => {
    expect(toSynthNote(voice, { step: 0, steps: 4, hz: 220 }, 0.25)).toEqual({
      wave: 'square',
      startHz: 220,
      endHz: 220,
      attack: 0.01,
      sustain: 0.49,
      decay: 0.05,
      volume: 0.02,
    });
  });

  it('never holds for less than nothing', () => {
    expect(toSynthNote({ ...voice, gate: 0.05 }, { step: 0, steps: 1, hz: 220 }, 0.1).sustain).toBe(0);
  });
});

describe('the Office music at a steady load', () => {
  it('keeps a calm lab at 68 BPM: a bar is 3.5294 s and the verse ticks sit 1.7647 s apart', () => {
    const { played, advance } = run(MUSIC, 0);
    advance(8);
    const hats = onsets(played, 'hat');
    expect(gaps(hats.slice(0, 4))[0]).toBeCloseTo((3 / 4) * 0 + 8 * (60 / (68 * 4)), 4);
    expect(gaps(hats.slice(0, 4))[0]).toBeCloseTo(1.7647, 3);
    expect(gaps(barStarts(played))[0]).toBeCloseTo(3.5294, 3);
  });

  it('keeps a flat out lab at 96 BPM: a bar is 2.5 s and the ticks 1.25 s apart', () => {
    const { played, advance } = run(MUSIC, 1);
    advance(6);
    expect(gaps(barStarts(played))[0]).toBeCloseTo(2.5, 6);
    expect(gaps(onsets(played, 'hat').slice(0, 2))[0]).toBeCloseTo(1.25, 6);
  });

  it('starts the first bar START_DELAY in, at the target tempo', () => {
    const { played, advance } = run(MUSIC, 0.5);
    advance(0.5);
    expect(played[0]?.at).toBeCloseTo(START_DELAY, 9);
    advance(6);
    expect(gaps(barStarts(played))[0]).toBeCloseTo(240 / 82, 6);
  });
});

describe('the tempo following the load', () => {
  it('climbs a few BPM a bar at bar lines, then holds', () => {
    const { played, advance, sequencer, clock } = run(MUSIC, 0);
    advance(1);
    sequencer.setLoad(1);
    advance(clock() + 60);
    const bars = gaps(barStarts(played)).map((seconds) => Math.round(240 / seconds));
    // Bar 0 started at 68 before the load rose; the next bar line is the first to move.
    expect(bars.slice(0, 9)).toEqual([68, 72, 76, 80, 84, 88, 92, 96, 96]);
  });

  it('never moves a note of the bar being played when the load changes mid bar', () => {
    const steady = run(MUSIC, 0);
    steady.advance(3);
    const changing = run(MUSIC, 0);
    changing.advance(1);
    changing.sequencer.setLoad(1);
    changing.advance(2);
    const firstBar = (entries: readonly Played[]) => entries.filter((entry) => entry.at < 3).map((entry) => entry.at);
    expect(firstBar(changing.played)).toEqual(firstBar(steady.played));
  });

  it('keeps one step spacing within a bar', () => {
    const { played, advance, sequencer } = run(MUSIC, 0);
    advance(1);
    sequencer.setLoad(1);
    advance(12);
    const bass = onsets(played, 'bass');
    // The bass plays on steps 0, 6 and 8 of each verse bar: 6 steps then 2 steps, in the one tempo.
    const [first, second, third] = bass;
    expect((second ?? 0) - (first ?? 0)).toBeCloseTo(((third ?? 0) - (second ?? 0)) * 3, 6);
  });
});

describe('looping', () => {
  it('wraps from the last section back to the first with no gap', () => {
    const score = boxesTheme.soundscape?.music;
    if (score === undefined) throw new Error('boxes has no music');
    const { played, advance } = run(score, 0);
    advance(10);
    // One bar of four blips every 2 s at load 0: the step after the wrap is exactly one step (0.5 s) later.
    const times = onsets(played, 'blip');
    expect(times.length).toBeGreaterThan(8);
    for (const gap of gaps(times)) expect(gap).toBeCloseTo(1, 6);
  });

  it('wraps the Office order from its last section to its first', () => {
    const { played, advance } = run(MUSIC, 1);
    advance(80.5);
    const bars = barStarts(played);
    // 32 bars of 2.5 s; the 33rd bar is the first again, one bar after the last.
    expect(bars[32]).toBeCloseTo(START_DELAY + 32 * 2.5, 6);
    expect((bars[32] ?? 0) - (bars[31] ?? 0)).toBeCloseTo(2.5, 6);
    const lead = played.filter((entry) => entry.voice === 'lead');
    expect(lead.length).toBeGreaterThan(0);
  });

  it('resumes after a late wake at now plus START_DELAY, without a burst', () => {
    const { played, advance, sequencer, jump, clock } = run(MUSIC, 0);
    advance(1);
    const before = played.length;
    jump(30);
    sequencer.tick(clock());
    const woken = played.slice(before);
    expect(woken.every((entry) => entry.at >= clock() + START_DELAY - 1e-9)).toBe(true);
    expect(woken.every((entry) => entry.at < clock() + LOOKAHEAD + START_DELAY)).toBe(true);
  });
});

describe('the boxes music', () => {
  const score = boxesTheme.soundscape?.music;

  it('lands its notes 1 s apart at load 0 and 0.5 s apart at load 1', () => {
    if (score === undefined) throw new Error('boxes has no music');
    const calm = run(score, 0);
    calm.advance(5);
    for (const gap of gaps(onsets(calm.played, 'blip'))) expect(gap).toBeCloseTo(1, 6);
    const busy = run(score, 1);
    busy.advance(3);
    for (const gap of gaps(onsets(busy.played, 'blip'))) expect(gap).toBeCloseTo(0.5, 6);
  });
});

describe('every Theme score', () => {
  const scores = [officeTheme, boxesTheme].flatMap((theme) =>
    theme.soundscape?.music === undefined ? [] : [[theme.id, theme.soundscape.music] as const],
  );

  it('is found', () => {
    expect(scores.map(([id]) => id)).toEqual(['office', 'boxes']);
  });

  it.each(scores)('%s: a sane tempo and grid', (_id, score) => {
    expect(score.bpm.calm).toBeGreaterThan(0);
    expect(score.bpm.calm).toBeLessThanOrEqual(score.bpm.busy);
    expect(score.stepsPerBar % score.stepsPerBeat).toBe(0);
    expect(score.volume).toBeGreaterThan(0);
    expect(score.volume).toBeLessThanOrEqual(1);
  });

  it.each(scores)('%s: the order indexes real sections', (_id, score) => {
    expect(score.order.length).toBeGreaterThan(0);
    for (const index of score.order) expect(score.sections[index]).toBeDefined();
  });

  it.each(scores)('%s: every note is in range and every part is a voice', (_id, score) => {
    for (const section of score.sections) {
      for (const [voice, notes] of Object.entries(section.parts)) {
        expect(Object.keys(score.voices)).toContain(voice);
        for (const note of notes ?? []) {
          expect(note.steps).toBeGreaterThanOrEqual(1);
          expect(note.step).toBeGreaterThanOrEqual(0);
          expect(note.step).toBeLessThan(section.bars * score.stepsPerBar);
        }
      }
    }
  });

  it.each(scores)('%s: every voice has sane levels', (_id, score) => {
    for (const voice of Object.values(score.voices)) {
      expect(voice.volume).toBeGreaterThan(0);
      expect(voice.volume).toBeLessThanOrEqual(1);
      expect(voice.gate).toBeGreaterThan(0);
      expect(voice.gate).toBeLessThanOrEqual(1);
      expect(voice.attack).toBeGreaterThan(0);
    }
  });
});

describe('the Office hum and music tuning', () => {
  it('shares D3 with the music', async () => {
    const { D3_HZ } = await import('../../src/themes/office/music.ts');
    expect(officeTheme.soundscape?.ambient?.hum.hz).toBe(D3_HZ);
  });
});
