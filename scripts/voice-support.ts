import { readFileSync } from 'node:fs';

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
