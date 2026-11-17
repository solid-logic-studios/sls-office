import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Theme } from '../src/contract/theme.ts';
import { voiceLines } from '../src/page/audio/voice-lines.ts';
import { THEMES } from '../src/themes/index.ts';
import type { RenderLine, VoiceListing } from './voice-support.ts';

/**
 * Writes the list of clips the image must render (ADR 0004): every line a Voice with a Piper voice can say,
 * in every Theme the page ships. The `voices` Docker stage renders from it, and the file is stable
 * byte for byte for unchanged input, so it is the layer cache key. Usage: `node scripts/voice-lines.ts [out]`.
 */

/** The pairs to render across `themes`: only Voices with a Piper voice, unique by key, sorted by key. */
export function renderLines(themes: readonly Theme[]): RenderLine[] {
  const found = new Map<string, RenderLine>();
  for (const theme of themes) {
    for (const { key, voice, text } of voiceLines(theme)) {
      if (voice.piper === undefined || found.has(key)) continue;
      const { model, speaker } = voice.piper;
      found.set(key, {
        key,
        model,
        ...(speaker === undefined ? {} : { speaker }),
        rate: Math.round(voice.rate * 1000) / 1000,
        text,
      });
    }
  }
  return [...found.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const out = resolve(process.argv[2] ?? 'dist-voices/voice-lines.json');
  const listing: VoiceListing = { version: 1, lines: renderLines(THEMES) };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(listing, null, 2)}\n`);
  console.log(`Wrote ${listing.lines.length} lines to ${out}`);
}
