import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Theme } from '../../src/contract/theme.ts';
import { voiceLines } from '../../src/page/audio/voice-lines.ts';
import { boxesTheme } from '../../src/themes/boxes/index.ts';
import { officeTheme } from '../../src/themes/office/index.ts';
import { readPins } from '../../scripts/voice-support.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const pins = readPins(`${root}voices/models.json`);
const SHA256 = /^[0-9a-f]{64}$/;
const LICENCES = ['public domain', 'CC0-1.0', 'CC-BY-4.0'];
const THEMES: readonly Theme[] = [officeTheme, boxesTheme];

describe('voices/models.json', () => {
  const used = new Set(
    THEMES.flatMap((theme) => voiceLines(theme).flatMap((line) => (line.voice.piper ? [line.voice.piper.model] : []))),
  );

  it('pins every Piper model a shipped Theme uses', () => {
    expect(used.size).toBeGreaterThan(0);
    for (const model of used) expect(pins.models[model], model).toBeDefined();
  });

  it.each(Object.entries(pins.models))('pins %s by hash, to a revision, under an accepted licence', (_name, pin) => {
    expect(pin.onnxSha256).toMatch(SHA256);
    expect(pin.configSha256).toMatch(SHA256);
    for (const url of [pin.onnx, pin.config]) {
      expect(url.startsWith('https://')).toBe(true);
      expect(url).not.toContain('/resolve/main/');
      expect(url).toMatch(/\/resolve\/[0-9a-f]{40}\//);
    }
    expect(LICENCES).toContain(pin.licence);
    for (const field of [pin.dataset, pin.source, pin.attribution]) expect(field.length).toBeGreaterThan(0);
  });

  it('pins the Piper release for both architectures', () => {
    expect(pins.piper.version).toMatch(/^\d{4}\.\d{2}\.\d{2}-\d+$/);
    expect(pins.piper.sha256.x86_64).toMatch(SHA256);
    expect(pins.piper.sha256.aarch64).toMatch(SHA256);
  });

  it('agrees with the Dockerfile on the Piper release and its hashes', () => {
    const dockerfile = readFileSync(`${root}Dockerfile`, 'utf8');
    const arg = (name: string): string | undefined => new RegExp(`^ARG ${name}=(\\S+)$`, 'm').exec(dockerfile)?.[1];
    expect(arg('PIPER_VERSION')).toBe(pins.piper.version);
    expect(arg('PIPER_SHA256_X86_64')).toBe(pins.piper.sha256.x86_64);
    expect(arg('PIPER_SHA256_AARCH64')).toBe(pins.piper.sha256.aarch64);
  });
});
