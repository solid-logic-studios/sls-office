import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Shared by the scripts that run in the image's `voices` stage (ADR 0004): `fetch-voices.ts` and
 * `render-voices.ts`. Node only, no dependencies, erasable TypeScript only (Node strips the types).
 */

/** One pinned voice model, as `voices/models.json` records it. */
export interface ModelPin {
  onnx: string;
  onnxSha256: string;
  config: string;
  configSha256: string;
  licence: string;
  dataset: string;
  source: string;
  /** `trained from scratch`, or `fine-tuned from <another pinned model>`: see the licence rule in `voices/README.md`. */
  training: string;
  attribution: string;
}

/** `voices/models.json`: the Piper release and every voice model, pinned by version and SHA-256. */
export interface VoicePins {
  piper: {
    version: string;
    licence: string;
    source: string;
    sha256: { x86_64: string; aarch64: string };
  };
  models: Readonly<Record<string, ModelPin>>;
}

/** One clip to render, as `voice-lines.ts` lists it and `render-voices.ts` reads it. */
export interface RenderLine {
  key: string;
  model: string;
  speaker?: number;
  /** The Voice's `rate`, 3 decimals. The render script divides the model's own `length_scale` by it, so a faster Voice is a shorter clip. */
  rate: number;
  text: string;
}

/** The file `voice-lines.ts` writes. */
export interface VoiceListing {
  version: 1;
  lines: RenderLine[];
}

/** Where a script finds the pins when `--pins` is absent: `models.json` beside it (in the image), else the repo's. */
export function defaultPinsPath(scriptUrl: string): string {
  const here = dirname(fileURLToPath(scriptUrl));
  return (
    [join(here, 'models.json'), join(here, '..', 'voices', 'models.json')].find(existsSync) ?? join(here, 'models.json')
  );
}

/** Reads and parses a pin file. A malformed one fails later, loudly, where a field is used. */
export function readPins(path: string): VoicePins {
  return JSON.parse(readFileSync(path, 'utf8')) as VoicePins;
}

/** Parses `--name value` pairs; a flag with no value is an error. */
export function readFlags(argv: readonly string[], allowed: readonly string[]): Map<string, string> {
  const flags = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index]?.replace(/^--/, '');
    const value = argv[index + 1];
    if (name === undefined || !allowed.includes(name) || value === undefined) {
      throw new Error(`Usage: expected pairs of ${allowed.map((flag) => `--${flag} <value>`).join(' ')}`);
    }
    flags.set(name, value);
  }
  return flags;
}
