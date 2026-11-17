import { describe, expect, it } from 'vitest';
import { statusAnnouncement, type StatusView } from '../../src/page/audio/status-announcement.ts';
import { VOCABULARY } from '../../src/themes/office/vocabulary.ts';

const CALM: StatusView = {
  vmsUp: 4,
  vmsDown: 0,
  characters: [{ part: 'worker', mood: 'working', visible: true }],
  findings: { ok: 10, warn: 0, crit: 0 },
};
const say = (view: Partial<StatusView>): string[] => statusAnnouncement(VOCABULARY, { ...CALM, ...view });

describe('statusAnnouncement', () => {
  it('counts the rooms up and says all calm when nobody is in trouble', () => {
    expect(say({})).toEqual(['four', 'rooms up', 'all calm']);
  });

  it('says a single room in the singular', () => {
    expect(say({ vmsUp: 1 })).toEqual(['one', 'room up', 'all calm']);
  });

  it('adds the rooms down, in the plural or the singular', () => {
    expect(say({ vmsUp: 2, vmsDown: 2 })).toEqual(['two', 'rooms up', 'two', 'rooms down', 'all calm']);
    expect(say({ vmsUp: 3, vmsDown: 1 })).toEqual(['three', 'rooms up', 'one', 'room down', 'all calm']);
  });

  it('names the part in the worst mood: fainted over swamped over stressed', () => {
    const characters: StatusView['characters'] = [
      { part: 'worker', mood: 'stressed', visible: true },
      { part: 'keeper', mood: 'fainted', visible: true },
      { part: 'greeter', mood: 'swamped', visible: true },
    ];
    expect(say({ vmsUp: 3, characters })).toEqual(['three', 'rooms up', 'the keeper', 'has fainted']);
    expect(say({ vmsUp: 3, characters: characters.filter((c) => c.mood !== 'fainted') })).toEqual([
      'three',
      'rooms up',
      'the gateway',
      'is swamped',
    ]);
  });

  it('breaks a tie in favour of the first in the list', () => {
    const characters: StatusView['characters'] = [
      { part: 'guard', mood: 'swamped', visible: true },
      { part: 'greeter', mood: 'swamped', visible: true },
    ];
    expect(say({ characters }).slice(-2)).toEqual(['the doorman', 'is swamped']);
  });

  it('treats a break, working or absent character as calm', () => {
    const characters: StatusView['characters'] = [
      { part: 'worker', mood: 'break', visible: true },
      { part: 'pod', mood: 'absent', visible: true },
    ];
    expect(say({ characters })).toEqual(['four', 'rooms up', 'all calm']);
  });

  it('ignores founders and hidden characters', () => {
    const characters: StatusView['characters'] = [
      { part: 'founder', mood: 'swamped', visible: true },
      { part: 'keeper', mood: 'fainted', visible: false },
    ];
    expect(say({ characters })).toEqual(['four', 'rooms up', 'all calm']);
  });

  it('skips a part the vocabulary does not name', () => {
    const vocabulary = { ...VOCABULARY, parts: { keeper: 'the keeper' } };
    const characters: StatusView['characters'] = [
      { part: 'worker', mood: 'fainted', visible: true },
      { part: 'keeper', mood: 'stressed', visible: true },
    ];
    expect(statusAnnouncement(vocabulary, { ...CALM, characters }).slice(-2)).toEqual(['the keeper', 'is stressed']);
  });

  it('ends with the critical findings, singular or plural', () => {
    expect(say({ findings: { ok: 0, warn: 0, crit: 1 } }).slice(-2)).toEqual(['one', 'critical finding']);
    expect(say({ findings: { ok: 0, warn: 0, crit: 3 } }).slice(-2)).toEqual(['three', 'critical findings']);
  });

  it('says a number past the vocabulary in digits', () => {
    expect(say({ vmsUp: 25 }).slice(0, 2)).toEqual(['25', 'rooms up']);
  });
});
