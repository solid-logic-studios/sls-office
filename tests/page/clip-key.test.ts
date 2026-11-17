import { describe, expect, it } from 'vitest';
import { clipKey } from '../../src/page/audio/clip-key.ts';

describe('clipKey', () => {
  it('is deterministic and 16 lower-case hex characters', () => {
    expect(clipKey('office-worker', 'LGTM')).toBe(clipKey('office-worker', 'LGTM'));
    expect(clipKey('office-worker', 'LGTM')).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is pinned to known values, so a change to the hash is a deliberate re-render of every clip', () => {
    expect(clipKey('office-worker', 'LGTM')).toBe('9efb9a140c3242e9');
    expect(clipKey('boxes-default', 'hello')).toBe('114f218ba8e1e5d5');
  });

  it('ignores the case of the text, as the bubble capitals are spoken in lower case', () => {
    expect(clipKey('v', 'JOB DONE. POD GONE.')).toBe(clipKey('v', 'job done. pod gone.'));
  });

  it('differs by Voice id and by text', () => {
    expect(clipKey('office-worker', 'hello')).not.toBe(clipKey('office-pod', 'hello'));
    expect(clipKey('office-worker', 'hello')).not.toBe(clipKey('office-worker', 'hello!'));
  });

  it('keeps the Voice id and the text apart, so moving a character across the boundary changes the key', () => {
    expect(clipKey('ab', 'c')).not.toBe(clipKey('a', 'bc'));
  });

  it('rarely collides across a few thousand near-identical texts', () => {
    const keys = new Set(Array.from({ length: 5000 }, (_, n) => clipKey('office-worker', `line ${n}`)));
    expect(keys.size).toBe(5000);
  });
});
