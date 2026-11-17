import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));
const src = join(root, 'src');
const audio = join(src, 'page', 'audio');

function sources(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) return sources(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

describe('audio architecture (ADR 0004)', () => {
  const outside = sources(src).filter((file) => !file.startsWith(audio));

  it('finds the sources outside src/page/audio', () => {
    expect(outside.length).toBeGreaterThan(20);
  });

  it.each(outside.map((file) => [relative(root, file), file]))(
    '%s touches no Web Audio or speech API',
    (_name, file) => {
      // Comments may mention them; code may not.
      const code = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      expect(code).not.toMatch(/\bAudioContext\b|\bspeechSynthesis\b/);
    },
  );
});
