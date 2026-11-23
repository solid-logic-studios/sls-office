import type { Vocabulary } from '../../contract/theme.ts';
import { VOCABULARY as OFFICE_VOCABULARY } from '../office/vocabulary.ts';

/**
 * The words the HQ's Announcements are stitched from (ADR 0004), in JARVIS's mouth. Part and room names
 * are the HQ's; numbers, moods and phrases are the Office's. Lower case, as spoken.
 */
export const VOCABULARY: Vocabulary = {
  ...OFFICE_VOCABULARY,
  parts: {
    worker: 'the avenger on watch',
    pod: 'the rookie',
    greeter: 'nick fury',
    guard: 'hawkeye',
    checker: 'black widow',
    keeper: 'the hulk',
    courier: 'thor',
    wrangler: 'the captain',
  },
  rooms: {
    ci: 'the rookie bay',
    data: 'the archive vault',
    compute: 'the ops floor',
    deploy: 'the hangar',
  },
};
