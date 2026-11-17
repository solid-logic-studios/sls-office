import { describe, expect, it } from 'vitest';
import type { Theme } from '../../src/contract/theme.ts';
import { Engine } from '../../src/engine/engine.ts';
import { seededRandom } from '../../src/engine/random.ts';
import { clipKey } from '../../src/page/audio/clip-key.ts';
import { spokenText, voiceFor } from '../../src/page/audio/voice-casting.ts';
import { CUE_SPEAKERS, voiceLines } from '../../src/page/audio/voice-lines.ts';
import { Simulator } from '../../src/simulator/simulator.ts';
import { boxesTheme } from '../../src/themes/boxes/index.ts';
import { officeTheme } from '../../src/themes/office/index.ts';
import { run } from '../support/lab.ts';

const THEMES: readonly Theme[] = [officeTheme, boxesTheme];

describe.each(THEMES)('voiceLines for the $name theme', (theme) => {
  const lines = voiceLines(theme);
  const keys = new Set(lines.map((line) => line.key));

  it('is unique by key and sorted by key, with the key of its own Voice and text', () => {
    expect(keys.size).toBe(lines.length);
    expect(lines.map((line) => line.key)).toEqual([...lines.map((line) => line.key)].sort());
    for (const line of lines) {
      expect(line.key).toBe(clipKey(line.voice.id, line.text));
      expect(line.text).toBe(spokenText(line.text));
    }
  });

  it('covers every line in the line banks and every founder line, in at least one Voice', () => {
    const spoken = new Set(lines.map((line) => line.text));
    const { lines: bank } = theme;
    const banked = [
      ...Object.values(bank.mood).flat(),
      ...Object.values(bank.part).flat(),
      ...Object.values(bank.breakSpot).flat(),
      ...Object.values(bank.cue).flat(),
      ...theme.founders.flatMap((founder) => [...founder.lines.idle, ...founder.lines.checkIn, ...founder.lines.alarm]),
    ];
    expect(banked.length).toBeGreaterThan(0);
    for (const text of banked) expect(spoken.has(spokenText(text)), text).toBe(true);
  });

  it('says every cue in the Voice of each Part that can say it', () => {
    const voices = theme.soundscape?.voices;
    if (voices === undefined) throw new Error('no voices');
    for (const [cue, speakers] of Object.entries(CUE_SPEAKERS)) {
      const bank = theme.lines.cue[cue as keyof typeof CUE_SPEAKERS];
      for (const speaker of speakers) {
        const voice = voiceFor(voices, speaker === 'visitor' ? undefined : { id: '', part: speaker });
        for (const text of bank) expect(keys.has(clipKey(voice.id, text)), `${cue} as ${speaker}`).toBe(true);
      }
    }
  });
});

describe('voiceLines asks no Voice for a line it can never say', () => {
  const voices = officeTheme.soundscape?.voices;
  const keys = new Set(voiceLines(officeTheme).map((line) => line.key));

  it('gives the founders none of the cue lines', () => {
    const founderVoices = officeTheme.founders.map((founder) => voices?.founders?.[founder.id]?.id ?? '');
    const cueTexts = Object.values(officeTheme.lines.cue).flat();
    for (const id of founderVoices) {
      for (const text of cueTexts) {
        const alsoFounderLine = officeTheme.founders.some((founder) =>
          [...founder.lines.idle, ...founder.lines.checkIn, ...founder.lines.alarm].includes(text),
        );
        if (!alsoFounderLine) expect(keys.has(clipKey(id, text)), `${id}: ${text}`).toBe(false);
      }
    }
  });

  it('gives the workers no cue line, and nobody but the workers a mood or break line', () => {
    const worker = voices?.parts?.worker?.id ?? '';
    const cueOnly = Object.values(officeTheme.lines.cue).flat();
    expect(keys.has(clipKey(worker, 'DELIVERY!'))).toBe(false);
    expect(cueOnly).toContain('DELIVERY!');
    const others = [voices?.default, ...Object.values(voices?.parts ?? {}), ...Object.values(voices?.founders ?? {})]
      .map((voice) => voice?.id ?? '')
      .filter((id) => id !== worker);
    for (const text of Object.values(officeTheme.lines.mood).flat()) {
      for (const id of others) expect(keys.has(clipKey(id, text)), `${id}: ${text}`).toBe(false);
    }
    for (const text of Object.values(officeTheme.lines.breakSpot).flat()) {
      for (const id of others) expect(keys.has(clipKey(id, text)), `${id}: ${text}`).toBe(false);
    }
  });

  it('has no lines for a theme without Voices', () => {
    expect(voiceLines({ ...officeTheme, soundscape: undefined })).toEqual([]);
  });
});

describe.each(THEMES)('coverage under the Simulator, in the $name theme', (theme) => {
  it('finds a clip for every line anyone says', () => {
    const voices = theme.soundscape?.voices;
    if (voices === undefined) throw new Error('no voices');
    const keys = new Set(voiceLines(theme).map((line) => line.key));
    // A constant 0.99 starts nothing by itself, so every command below is the only thing that happens.
    const simulator = new Simulator({ random: () => 0.99, now: () => new Date(Date.UTC(2026, 10, 16, 9)) });
    const engine = new Engine(theme, { random: seededRandom(11) });
    // The speaker is resolved as the line is said: a character who walks out afterwards is no longer listed.
    const missing: string[] = [];
    let said = 0;
    engine.bus.subscribe('speech', ({ speakerId, text }) => {
      said += 1;
      const voice = voiceFor(
        voices,
        engine.characters().find((character) => character.id === speakerId),
      );
      if (!keys.has(clipKey(voice.id, text))) missing.push(`${speakerId} (${voice.id}): ${text}`);
    });
    const play = (seconds: number): void => {
      for (let second = 0; second < seconds; second++) {
        simulator.advance(1);
        engine.accept(simulator.snapshot());
        run(engine, 1);
      }
    };
    play(3);
    simulator.dispatch({ kind: 'deploy', outcome: 'healthy' });
    play(40);
    simulator.dispatch({ kind: 'deploy', outcome: 'rolled-back' });
    play(40);
    simulator.dispatch({ kind: 'ci-burst' });
    play(25);
    simulator.dispatch({ kind: 'oom' });
    play(12);
    simulator.dispatch({ kind: 'set-up', vmId: 'sls-compute', up: false });
    play(6);
    simulator.dispatch({ kind: 'set-up', vmId: 'sls-compute', up: true });
    play(12);
    simulator.dispatch({ kind: 'backup' });
    play(40);
    simulator.dispatch({ kind: 'preset', preset: 'fire' });
    play(40);
    // Busy traffic brings visitors, queries and founder check-ins.
    simulator.dispatch({ kind: 'preset', preset: 'arvo' });
    play(90);

    expect(said).toBeGreaterThan(30);
    expect(missing).toEqual([]);
  });
});
