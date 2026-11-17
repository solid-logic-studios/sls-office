import { describe, expect, it } from 'vitest';
import { clipKey } from '../../src/page/audio/clip-key.ts';

describe('clipKey', () => {
  it('is deterministic and 16 lower-case hex characters', () => {
    expect(clipKey('office-worker', 'lgtm')).toBe(clipKey('office-worker', 'lgtm'));
    expect(clipKey('office-worker', 'lgtm')).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is pinned to known values, so a change to the hash is a deliberate re-render of every clip', () => {
    expect(clipKey('office-worker', 'lgtm')).toBe('9efb9a140c3242e9');
    expect(clipKey('boxes-default', 'hello')).toBe('114f218ba8e1e5d5');
  });

  it('hashes the spoken words as given, so a Theme override changes the key', () => {
    expect(clipKey('v', 'get slash')).not.toBe(clipKey('v', 'get /'));
    expect(clipKey('v', 'Hello')).not.toBe(clipKey('v', 'hello'));
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
