import { describe, expect, it } from 'vitest';
import { BREAK_BELOW_CPU, STRESSED_ABOVE_CPU, describeCpu, moodOf } from '../src/page/mood.ts';

describe('moodOf', () => {
  it.each([
    [{ up: false, cpu: 50 }, 'absent'],
    [{ up: false, cpu: 0 }, 'absent'],
    [{ up: true, cpu: 0 }, 'break'],
    [{ up: true, cpu: BREAK_BELOW_CPU - 0.1 }, 'break'],
    [{ up: true, cpu: BREAK_BELOW_CPU }, 'working'],
    [{ up: true, cpu: 45 }, 'working'],
    [{ up: true, cpu: STRESSED_ABOVE_CPU }, 'working'],
    [{ up: true, cpu: STRESSED_ABOVE_CPU + 0.1 }, 'stressed'],
    [{ up: true, cpu: 100 }, 'stressed'],
  ] as const)('%j is %s', (vm, mood) => {
    expect(moodOf(vm)).toBe(mood);
  });
});

describe('describeCpu', () => {
  it.each([
    [{ up: true, cpu: 45.4 }, 'cpu 45%'],
    [{ up: true, cpu: 99.5 }, 'cpu 100%'],
    [{ up: false, cpu: 50 }, 'cpu n/a'],
  ] as const)('%j is %s', (vm, text) => {
    expect(describeCpu(vm)).toBe(text);
  });
});
