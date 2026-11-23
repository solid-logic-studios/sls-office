import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Theme } from '../../src/contract/theme.ts';
import { clipKey } from '../../src/page/audio/clip-key.ts';
import { THEMES } from '../../src/themes/index.ts';
import { officeTheme } from '../../src/themes/office/index.ts';
import { renderLines } from '../../scripts/voice-lines.ts';

describe('the voice-lines script', () => {
  it('runs under plain Node, as the image build runs it (strip-only TypeScript)', () => {
    // The Dockerfile runs `pnpm voice-lines`, which loads every Theme with Node's type stripping:
    // syntax it rejects (constructor parameter properties, enums) fails the image but not Vitest.
    const dir = mkdtempSync(join(tmpdir(), 'voice-lines-'));
    try {
      const out = join(dir, 'lines.json');
      const run = spawnSync(process.execPath, ['scripts/voice-lines.ts', out], { encoding: 'utf8' });
      expect(run.status, run.stderr).toBe(0);
      expect(JSON.parse(readFileSync(out, 'utf8')).lines).toHaveLength(renderLines(THEMES).length);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('is the same list for the same input, sorted and unique by key', () => {
    const first = renderLines(THEMES);
    expect(JSON.stringify(renderLines(THEMES))).toBe(JSON.stringify(first));
    expect(first.map((line) => line.key)).toEqual([...new Set(first.map((line) => line.key))].sort());
  });

  it('lists only Voices with a Piper voice, with the Voice rate and speaker', () => {
    const soundscape = officeTheme.soundscape;
    const voices = soundscape?.voices;
    const podVoice = voices?.parts?.pod;
    if (soundscape === undefined || voices === undefined || podVoice === undefined) throw new Error('no pod voice');
    const withoutPiper: Theme = {
      ...officeTheme,
      soundscape: {
        ...soundscape,
        voices: { ...voices, parts: { ...voices.parts, pod: { ...podVoice, piper: undefined } } },
      },
    };
    const key = clipKey(podVoice.id, 'running tests!');
    expect(renderLines([withoutPiper]).some((line) => line.key === key)).toBe(false);
    const pod = renderLines([officeTheme]).find((line) => line.key === key);
    expect(pod?.rate).toBeCloseTo(podVoice.rate, 3);
    expect(pod?.speaker).toBe(podVoice.piper?.speaker);
    expect(pod?.speaker).toBe(702);
    expect(pod?.model).toBe('en_US-libritts-high');
  });
});
