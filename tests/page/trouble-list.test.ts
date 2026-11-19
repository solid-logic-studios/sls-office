import { describe, expect, it } from 'vitest';
import { MAX_TROUBLE_ROWS, troubleRows } from '../../src/page/trouble-list.ts';
import type { Issue } from '../../src/page/verdict.ts';

function issue(text: string, severity: 'crit' | 'warn'): Issue {
  return { severity, text, tip: { title: text, detail: '', status: severity, severity } };
}

const texts = (rows: readonly Issue[]): string[] => rows.map((row) => row.text);

describe('troubleRows', () => {
  it('is empty when there are no issues', () => {
    expect(troubleRows([], false)).toEqual({ rows: [], more: 0 });
  });

  it('keeps the order it is given, which verdictOf has already made critical first', () => {
    const { rows } = troubleRows([issue('c1', 'crit'), issue('c2', 'crit'), issue('w1', 'warn')], false);
    expect(texts(rows)).toEqual(['c1', 'c2', 'w1']);
  });

  it('caps at three rows and counts the rest', () => {
    const issues = ['a', 'b', 'c', 'd', 'e'].map((name) => issue(name, 'warn'));
    const { rows, more } = troubleRows(issues, false);
    expect(rows).toHaveLength(MAX_TROUBLE_ROWS);
    expect(more).toBe(2);
  });

  it('shows exactly three without a more row', () => {
    const issues = ['a', 'b', 'c'].map((name) => issue(name, 'crit'));
    expect(troubleRows(issues, false)).toMatchObject({ more: 0 });
    expect(troubleRows(issues, false).rows).toHaveLength(3);
  });

  it('shows every row once expanded', () => {
    const issues = ['a', 'b', 'c', 'd'].map((name) => issue(name, 'warn'));
    expect(troubleRows(issues, true)).toMatchObject({ more: 0 });
    expect(troubleRows(issues, true).rows).toHaveLength(4);
  });
});
