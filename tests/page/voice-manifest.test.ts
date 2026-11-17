import { describe, expect, it } from 'vitest';
import { loadVoiceManifest, parseVoiceManifest } from '../../src/page/audio/voice-manifest.ts';

describe('parseVoiceManifest', () => {
  it('reads a valid manifest', () => {
    const manifest = parseVoiceManifest({ version: 1, clips: { '00ac723eda9c59cb': '00ac723eda9c59cb.ogg' } });
    expect(manifest.get('00ac723eda9c59cb')).toBe('00ac723eda9c59cb.ogg');
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['a string', 'clips'],
    ['no version', { clips: {} }],
    ['another version', { version: 2, clips: {} }],
    ['no clips', { version: 1 }],
    ['clips as an array', { version: 1, clips: ['a.ogg'] }],
    ['a non-string file', { version: 1, clips: { a: 3 } }],
    ['a path out of the folder', { version: 1, clips: { a: '../a.ogg' } }],
    ['one bad entry among good', { version: 1, clips: { a: 'a.ogg', b: '' } }],
  ])('gives an empty manifest for %s', (_name, json) => {
    expect(parseVoiceManifest(json).size).toBe(0);
  });
});

describe('loadVoiceManifest', () => {
  const json =
    (body: unknown, status = 200) =>
    async () =>
      new Response(JSON.stringify(body), { status });

  it('loads the manifest from the URL', async () => {
    const asked: string[] = [];
    const manifest = await loadVoiceManifest(async (url) => {
      asked.push(url);
      return new Response(JSON.stringify({ version: 1, clips: { a: 'a.ogg' } }));
    }, 'voices/manifest.json');
    expect(asked).toEqual(['voices/manifest.json']);
    expect(manifest.get('a')).toBe('a.ogg');
  });

  it('gives an empty manifest on a 404, a network failure or bad JSON', async () => {
    expect((await loadVoiceManifest(json({}, 404), 'u')).size).toBe(0);
    expect(
      (
        await loadVoiceManifest(async () => {
          throw new TypeError('offline');
        }, 'u')
      ).size,
    ).toBe(0);
    expect((await loadVoiceManifest(async () => new Response('<html>'), 'u')).size).toBe(0);
  });
});
