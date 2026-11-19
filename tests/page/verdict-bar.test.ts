import { describe, expect, it } from 'vitest';
import { barView } from '../../src/page/verdict-bar.ts';
import type { Verdict } from '../../src/page/verdict.ts';

function verdict(overrides: Partial<Verdict> = {}): Verdict {
  return {
    level: 'ok',
    vmsUp: 4,
    vmsTotal: 4,
    workloadsHealthy: 17,
    workloadsTotal: 17,
    pods: 0,
    crit: 0,
    warn: 1,
    issues: [],
    ...overrides,
  };
}

describe('barView', () => {
  it('says all calm with the counts', () => {
    expect(barView({ kind: 'live', verdict: verdict() })).toEqual({
      headline: 'ALL CALM',
      tone: 'ok',
      counts: ['VMs 4/4', 'Workloads 17/17', 'Findings 0C 1W'],
    });
  });

  it('adds a pod count only above zero', () => {
    expect(barView({ kind: 'live', verdict: verdict({ pods: 3 }) }).counts.at(-1)).toBe('3 pods');
    expect(barView({ kind: 'live', verdict: verdict({ pods: 1 }) }).counts.at(-1)).toBe('1 pod');
  });

  it('maps watch and trouble to warn and crit', () => {
    expect(barView({ kind: 'live', verdict: verdict({ level: 'watch' }) })).toMatchObject({
      headline: 'WATCH',
      tone: 'warn',
    });
    expect(barView({ kind: 'live', verdict: verdict({ level: 'trouble' }) })).toMatchObject({
      headline: 'TROUBLE',
      tone: 'crit',
    });
  });

  it('omits the workloads count when there are no workloads', () => {
    const sparse = verdict({ workloadsHealthy: 0, workloadsTotal: 0 });
    expect(barView({ kind: 'live', verdict: sparse }).counts).toEqual(['VMs 4/4', 'Findings 0C 1W']);
  });

  it('says stale with the last heard time and blanks the counts', () => {
    const view = barView({ kind: 'stale', lastHeard: new Date(2026, 10, 19, 14, 2) });
    expect(view).toEqual({ headline: 'STALE, last heard 14:02', tone: 'neutral', counts: [] });
    expect(barView({ kind: 'stale', lastHeard: null }).headline).toBe('STALE');
  });

  it('says no signal, with the last good time when there was one', () => {
    expect(barView({ kind: 'no-signal', lastGood: new Date(2026, 10, 19, 9, 5) })).toEqual({
      headline: 'NO SIGNAL, last good 09:05',
      tone: 'neutral',
      counts: [],
    });
    expect(barView({ kind: 'no-signal', lastGood: null }).headline).toBe('NO SIGNAL');
  });

  it('says no VMs reported for an empty lab, neutral and with no counts', () => {
    const empty = verdict({ vmsUp: 0, vmsTotal: 0, workloadsHealthy: 0, workloadsTotal: 0, warn: 0 });
    expect(barView({ kind: 'live', verdict: empty })).toEqual({
      headline: 'NO VMS REPORTED',
      tone: 'neutral',
      counts: [],
    });
  });

  it('never hides trouble behind an empty lab', () => {
    const empty = verdict({ vmsUp: 0, vmsTotal: 0, level: 'trouble', crit: 2 });
    expect(barView({ kind: 'live', verdict: empty })).toMatchObject({ headline: 'TROUBLE', tone: 'crit' });
  });
});
