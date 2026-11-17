import type { Vocabulary } from '../../contract/theme.ts';
import type { DiarySummary } from './office-diary.ts';
import { numberWord } from './status-announcement.ts';

/** A count and what it counts, in the singular or the plural, or nothing when there were none. */
function counted(vocabulary: Vocabulary, count: number, one: string, many: string): string[] {
  return count === 0 ? [] : [numberWord(vocabulary, count), count === 1 ? one : many];
}

/**
 * The Standup as an Announcement's pieces (ADR 0004): "good morning", "in the last day", the deploys,
 * rollbacks and faults there were, the backups, then the busiest and calmest rooms. A quiet day (nothing
 * to count) says so instead of the counts, and still names the rooms. Backups are "backups safe" when
 * some finished and none failed, the number that failed when any did, and left out when none ran. For
 * example `['good morning', 'in the last day', 'three', 'deploys', 'backups safe', 'the busiest room was',
 * 'the archive']`.
 */
export function standupAnnouncement(vocabulary: Vocabulary, summary: DiarySummary): string[] {
  const { phrases, rooms } = vocabulary;
  const backups =
    summary.backupsFailed > 0
      ? counted(vocabulary, summary.backupsFailed, phrases.backupFailed, phrases.backupsFailed)
      : summary.backupsFinished > 0
        ? [phrases.backupsSafe]
        : [];
  const counts = [
    ...counted(vocabulary, summary.deploys, phrases.deploy, phrases.deploys),
    ...counted(vocabulary, summary.rollbacks, phrases.rollback, phrases.rollbacks),
    ...counted(vocabulary, summary.faults, phrases.fault, phrases.faults),
    ...backups,
  ];
  const pieces = [phrases.goodMorning, phrases.lastDay, ...(counts.length === 0 ? [phrases.quietDay] : counts)];
  if (summary.busiest !== null) pieces.push(phrases.busiest, rooms[summary.busiest]);
  if (summary.calmest !== null) pieces.push(phrases.calmest, rooms[summary.calmest]);
  return pieces;
}
