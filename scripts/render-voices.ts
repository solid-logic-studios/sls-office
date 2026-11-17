import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  defaultPinsPath,
  readFlags,
  readPins,
  type ModelPin,
  type RenderLine,
  type VoiceListing,
  type VoicePins,
} from './voice-support.ts';

/**
 * Renders the image's voice clips (ADR 0004): reads the list `voice-lines.ts` wrote, runs Piper once per
 * (model, speaker, rate) group, encodes each WAV as Ogg Opus and writes the manifest and the
 * attribution. Fails loudly (a non-zero exit) on an unpinned model, a missing file or a failed tool.
 *
 * Usage: `node render-voices.ts --piper <bin> --models <dir> --lines <voice-lines.json> --out <dir>
 * [--pins <models.json>] [--limit N]`. `--limit` renders only the first N lines, to sample locally.
 */

interface Group {
  model: string;
  speaker: number | undefined;
  rate: number;
  lines: RenderLine[];
}

const BITRATE_KBPS = '24';

function fail(message: string): never {
  throw new Error(message);
}

/** Runs a tool and fails with its own words if it exits non-zero. */
function run(command: string, args: readonly string[], input?: string): string {
  const result = spawnSync(command, args, { input, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.error !== undefined) fail(`${command}: ${result.error.message}`);
  if (result.status !== 0) fail(`${command} exited ${result.status}: ${result.stderr}`);
  return result.stdout;
}

function groupLines(lines: readonly RenderLine[]): Group[] {
  const groups = new Map<string, Group>();
  for (const line of lines) {
    const id = `${line.model}|${line.speaker ?? ''}|${line.rate}`;
    const group = groups.get(id) ?? {
      model: line.model,
      speaker: line.speaker,
      rate: line.rate,
      lines: [],
    };
    group.lines.push(line);
    groups.set(id, group);
  }
  return [...groups.values()];
}

/**
 * Piper's `length_scale` for a Voice at `rate`: the model's own pace (`inference.length_scale` in its config,
 * 1 for libritts-high) divided by the rate. Piper reads the config's noise settings itself when no flag is given.
 */
function lengthScaleFor(configPath: string, rate: number): number {
  const config = JSON.parse(readFileSync(configPath, 'utf8')) as { inference?: { length_scale?: number } };
  const own = config.inference?.length_scale ?? 1;
  return Math.round((own / rate) * 1000) / 1000;
}

function pinFor(pins: VoicePins, model: string): ModelPin {
  return pins.models[model] ?? fail(`Model "${model}" is used by a line but not pinned in models.json`);
}

function attribution(pins: VoicePins, used: readonly string[]): string {
  const sections = [
    `Piper ${pins.piper.version}\nLicence: ${pins.piper.licence}\nSource: ${pins.piper.source}\nBuild-time only: the Piper binary is not in the image.`,
    ...used.map((name) => {
      const pin = pinFor(pins, name);
      return `Voice model ${name}\nLicence: ${pin.licence}\nDataset: ${pin.dataset}\nSource: ${pin.source}\nAttribution: ${pin.attribution}`;
    }),
  ];
  return `${sections.join('\n\n')}\n`;
}

const flags = readFlags(process.argv.slice(2), ['piper', 'models', 'lines', 'out', 'pins', 'limit']);
const need = (name: string): string => flags.get(name) ?? fail(`Missing --${name}`);
const pins = readPins(resolve(flags.get('pins') ?? defaultPinsPath(import.meta.url)));
const piper = resolve(need('piper'));
const models = resolve(need('models'));
const out = resolve(need('out'));
const listing = JSON.parse(readFileSync(resolve(need('lines')), 'utf8')) as VoiceListing;
if (listing.version !== 1) fail(`Unsupported voice-lines version ${String(listing.version)}`);
const limit = flags.has('limit') ? Number(flags.get('limit')) : listing.lines.length;
if (!Number.isInteger(limit) || limit < 1) fail('--limit must be a positive whole number');
const lines = listing.lines.slice(0, limit);

for (const model of new Set(lines.map((line) => line.model))) {
  pinFor(pins, model);
  for (const file of [`${model}.onnx`, `${model}.onnx.json`]) {
    if (!existsSync(join(models, file))) fail(`Missing ${file} in ${models}`);
  }
}

mkdirSync(out, { recursive: true });
const work = mkdtempSync(join(tmpdir(), 'voices-'));
const clips: Record<string, string> = {};
try {
  for (const group of groupLines(lines)) {
    const jsonl = group.lines
      .map((line) =>
        JSON.stringify({
          text: line.text,
          output_file: join(work, `${line.key}.wav`),
          ...(group.speaker === undefined ? {} : { speaker_id: group.speaker }),
        }),
      )
      .join('\n');
    const lengthScale = lengthScaleFor(join(models, `${group.model}.onnx.json`), group.rate);
    run(
      piper,
      [
        '--model',
        join(models, `${group.model}.onnx`),
        '--length_scale',
        String(lengthScale),
        '--json-input',
        '--quiet',
      ],
      `${jsonl}\n`,
    );
    for (const line of group.lines) {
      const wav = join(work, `${line.key}.wav`);
      if (!existsSync(wav)) fail(`Piper wrote no clip for ${line.key} (${line.text})`);
      run('opusenc', ['--quiet', '--bitrate', BITRATE_KBPS, wav, join(out, `${line.key}.ogg`)]);
      clips[line.key] = `${line.key}.ogg`;
    }
    console.log(
      `Rendered ${group.lines.length} lines: ${group.model}, rate ${group.rate}, length scale ${lengthScale}`,
    );
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

writeFileSync(join(out, 'manifest.json'), `${JSON.stringify({ version: 1, clips }, null, 2)}\n`);
writeFileSync(join(out, 'ATTRIBUTION.txt'), attribution(pins, [...new Set(lines.map((line) => line.model))].sort()));
const bytes = Object.values(clips).reduce((total, file) => total + statSync(join(out, file)).size, 0);
console.log(`Wrote ${Object.keys(clips).length} clips (${(bytes / 1024).toFixed(0)} KiB) to ${out}`);
