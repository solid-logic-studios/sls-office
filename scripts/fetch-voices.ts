import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { defaultPinsPath, readFlags, readPins } from './voice-support.ts';

/**
 * Downloads every voice model pinned in `voices/models.json` and checks its SHA-256, failing on a mismatch
 * so a changed or tampered file never reaches the image. Usage:
 * `node fetch-voices.ts [--pins <models.json>] [--out models]`.
 */

async function download(url: string, expected: string, out: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const body = Buffer.from(await response.arrayBuffer());
  const actual = createHash('sha256').update(body).digest('hex');
  if (actual !== expected) throw new Error(`${url}: SHA-256 is ${actual}, expected ${expected}`);
  const file = basename(new URL(url).pathname);
  writeFileSync(join(out, file), body);
  console.log(`Fetched ${file} (${body.length} bytes)`);
}

const flags = readFlags(process.argv.slice(2), ['pins', 'out']);
const pins = readPins(resolve(flags.get('pins') ?? defaultPinsPath(import.meta.url)));
const out = resolve(flags.get('out') ?? 'models');
mkdirSync(out, { recursive: true });
for (const model of Object.values(pins.models)) {
  await download(model.onnx, model.onnxSha256, out);
  await download(model.config, model.configSha256, out);
}
