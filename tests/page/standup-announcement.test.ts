import { describe, expect, it } from 'vitest';
import type { DiarySummary } from '../../src/page/audio/office-diary.ts';
import { standupAnnouncement } from '../../src/page/audio/standup-announcement.ts';
import { VOCABULARY } from '../../src/themes/office/vocabulary.ts';

const QUIET: DiarySummary = {
  deploys: 0,
  rollbacks: 0,
  faults: 0,
  backupsFinished: 0,
  backupsFailed: 0,
  busiest: null,
  calmest: null,
};
const say = (summary: Partial<DiarySummary>): string[] => standupAnnouncement(VOCABULARY, { ...QUIET, ...summary });

describe('standupAnnouncement', () => {
  it('sums up a full day, then names the busiest and calmest rooms', () => {
    expect(
      say({ deploys: 3, rollbacks: 2, faults: 4, backupsFinished: 1, busiest: 'compute', calmest: 'data' }),
    ).toEqual([
      'good morning',
      'in the last day',
      'three',
      'deploys',
      'two',
      'rollbacks',
      'four',
      'faults',
      'backups safe',
      'the busiest room was',
      'the open plan floor',
      'the calmest room was',
      'the archive',
    ]);
  });

  it('says a quiet day instead of the counts, and still gives the rooms', () => {
    expect(say({ busiest: 'ci', calmest: 'deploy' })).toEqual([
      'good morning',
      'in the last day',
      'a quiet day',
      'the busiest room was',
      'the intern pool',
      'the calmest room was',
      'the build room',
    ]);
  });

  it('uses the singular for one', () => {
    expect(say({ deploys: 1, rollbacks: 1, faults: 1 }).slice(2)).toEqual([
      'one',
      'deploy',
      'one',
      'rollback',
      'one',
      'fault',
    ]);
  });

  it('counts failed backups rather than saying they are safe, and says nothing when none ran', () => {
    expect(say({ backupsFinished: 2, backupsFailed: 1 }).slice(2)).toEqual(['one', 'backup failed']);
    expect(say({ backupsFailed: 3 }).slice(2)).toEqual(['three', 'backups failed']);
    expect(say({ deploys: 1 })).not.toContain('backups safe');
  });

  it('leaves out the rooms it has no samples for', () => {
    expect(say({ deploys: 2 })).toEqual(['good morning', 'in the last day', 'two', 'deploys']);
    expect(say({ deploys: 2, busiest: 'data' }).slice(-2)).toEqual(['the busiest room was', 'the archive']);
  });

  it('says a count past the vocabulary in digits', () => {
    expect(say({ faults: 25 }).slice(2)).toEqual(['25', 'faults']);
  });
});
