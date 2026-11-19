import { Ajv } from 'ajv';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { generateSnapshotSchema } from '../scripts/snapshot-schema.ts';
import { isSnapshot } from '../src/source/is-snapshot.ts';
import { VALID_FIXTURES, loadFixture } from './helpers.ts';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(generateSnapshotSchema());

describe('snapshot schema generated from the contract types', () => {
  it.each(VALID_FIXTURES)('accepts %s and the runtime guard agrees', (name) => {
    const fixture = loadFixture(name);
    expect(validate(fixture), JSON.stringify(validate.errors)).toBe(true);
    expect(isSnapshot(fixture)).toBe(true);
  });

  // snapshot.invalid.json has two defects: `v` is 2 (only 1 is known) and the sls-data VM has cpu 140.
  it('rejects the invalid fixture; the guard rejects it too, on `v`', () => {
    const invalid = loadFixture('snapshot.invalid.json');
    expect(validate(invalid)).toBe(false);
    expect(isSnapshot(invalid)).toBe(false);
  });

  it.each(['host', 'events'] as const)('guard rejects a body missing %s', (field) => {
    const { [field]: _omitted, ...rest } = loadFixture('snapshot.all-working.json');
    expect(isSnapshot(rest)).toBe(false);
  });

  it('rejects out-of-range percentages and non-integer finding counts', () => {
    const base = loadFixture('snapshot.all-working.json');
    expect(validate({ ...base, host: { ...base.host, cpu: 101 } })).toBe(false);
    expect(validate({ ...base, host: { ...base.host, findings: { ok: 1.5, warn: 0, crit: 0 } } })).toBe(false);
  });

  describe('host temps', () => {
    const base = loadFixture('snapshot.all-working.json');
    const withTemps = (temps: unknown) => ({ ...base, host: { ...base.host, temps } });

    it('keeps the v0.3.0 shape (no temps) valid', () => {
      expect(base.host.temps).toBeUndefined();
      expect(validate(base)).toBe(true);
    });

    it.each([
      ['all present', { cpu: 71, chipset: 67, nvme: 56 }],
      ['all null', { cpu: null, chipset: null, nvme: null }],
      ['partial', { cpu: 71 }],
      ['empty', {}],
    ])('accepts temps that are %s, and the guard agrees', (_name, temps) => {
      const body = withTemps(temps);
      expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
      expect(isSnapshot(body)).toBe(true);
    });

    it.each([
      ['an extra key', { cpu: 1, gpu: 2 }],
      ['a non-integer', { cpu: 71.5 }],
      ['a string reading', { cpu: '71' }],
    ])('rejects temps with %s', (_name, temps) => {
      expect(validate(withTemps(temps))).toBe(false);
    });

    it('guard rejects a string reading and a null or array temps', () => {
      expect(isSnapshot(withTemps({ cpu: '71' }))).toBe(false);
      expect(isSnapshot(withTemps(null))).toBe(false);
      expect(isSnapshot(withTemps([]))).toBe(false);
      expect(isSnapshot(withTemps('hot'))).toBe(false);
    });
  });

  it('rejects a non date-time at', () => {
    expect(validate({ ...loadFixture('snapshot.all-working.json'), at: 'yesterday' })).toBe(false);
  });
});
