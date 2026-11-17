/** The clips the image holds: clip key to file name, relative to the manifest. Empty where there are none. */
export type VoiceManifest = ReadonlyMap<string, string>;

const FILE_NAME = /^[\w.-]+$/;

/**
 * Reads the manifest `scripts/render-voices.ts` writes (`{ "version": 1, "clips": { "<key>": "<file>" } }`).
 * Anything else, or any one bad entry, gives an empty manifest, so a broken one falls back to `speechSynthesis`.
 * Its input is parsed JSON, so it is `unknown` until checked.
 */
export function parseVoiceManifest(json: unknown): VoiceManifest {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) return new Map();
  const { version, clips } = json as { version?: unknown; clips?: unknown };
  if (version !== 1 || typeof clips !== 'object' || clips === null || Array.isArray(clips)) return new Map();
  const entries = Object.entries(clips);
  if (!entries.every(([, file]) => typeof file === 'string' && FILE_NAME.test(file))) return new Map();
  return new Map(entries as [string, string][]);
}

/** Fetches and parses the manifest at `url`. Any failure, a 404 included (dev has no manifest), gives an empty one. */
export async function loadVoiceManifest(
  fetchFn: (url: string) => Promise<Response>,
  url: string,
): Promise<VoiceManifest> {
  try {
    const response = await fetchFn(url);
    return response.ok ? parseVoiceManifest(await response.json()) : new Map();
  } catch {
    return new Map();
  }
}
