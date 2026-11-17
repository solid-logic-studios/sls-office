import type { Findings } from '../../contract/snapshot.ts';
import type { Mood, Vocabulary } from '../../contract/theme.ts';
import type { CharacterView } from '../../engine/engine.ts';

/** What the status is composed from: the lab's rooms and findings, and who is on stage. */
export interface StatusView {
  vmsUp: number;
  vmsDown: number;
  characters: readonly Pick<CharacterView, 'part' | 'mood' | 'visible'>[];
  findings: Findings;
}

/** The moods worth mentioning, worst first. Anyone calmer counts as calm. */
const TROUBLED: readonly Mood[] = ['fainted', 'swamped', 'stressed'];

/** A count in words, or in digits once it is past the vocabulary (the fallback says those). */
export function numberWord(vocabulary: Vocabulary, count: number): string {
  return vocabulary.numbers[count] ?? String(count);
}

/**
 * The status as an Announcement's pieces (ADR 0004): rooms up, rooms down if any, the visible worker in the
 * worst trouble (or "all calm" when nobody is stressed or worse) and the critical findings if any. Founders
 * and hidden characters are not counted, and a Part the vocabulary does not name is skipped. For example
 * `['three', 'rooms up', 'the gateway', 'is swamped']`.
 */
export function statusAnnouncement(vocabulary: Vocabulary, view: StatusView): string[] {
  const { phrases } = vocabulary;
  const pieces = [numberWord(vocabulary, view.vmsUp), view.vmsUp === 1 ? phrases.roomUp : phrases.roomsUp];
  if (view.vmsDown > 0) {
    pieces.push(numberWord(vocabulary, view.vmsDown), view.vmsDown === 1 ? phrases.roomDown : phrases.roomsDown);
  }
  const troubled = worstTrouble(vocabulary, view.characters);
  if (troubled === null) pieces.push(phrases.allCalm);
  else pieces.push(...troubled);
  const { crit } = view.findings;
  if (crit > 0) {
    pieces.push(numberWord(vocabulary, crit), crit === 1 ? phrases.criticalFinding : phrases.criticalFindings);
  }
  return pieces;
}

/** The first of the worst-off character's name and mood words, or `null` when nobody is in trouble. */
function worstTrouble(vocabulary: Vocabulary, characters: StatusView['characters']): [string, string] | null {
  for (const mood of TROUBLED) {
    for (const character of characters) {
      if (!character.visible || character.mood !== mood || character.part === 'founder') continue;
      const name = vocabulary.parts[character.part];
      if (name !== undefined) return [name, vocabulary.moods[mood]];
    }
  }
  return null;
}
