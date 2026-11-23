import type { Theme } from '../../contract/theme.ts';
import { paintSky } from '../shared/sky.ts';
import { CORE, JARVIS } from './boards.ts';
import { CITIZEN, castSubject } from './cast.ts';
import { powerCore } from './core.ts';
import { HOTSPOTS } from './hotspots.ts';
import { FOUNDERS } from './founders.ts';
import { jarvisConsole } from './jarvis-console.ts';
import { GROUND_DECK_BACK, GROUND_DECK_HOTSPOTS } from './ground-deck.ts';
import { JET_BACK, JET_HOTSPOTS } from './jet.ts';
import { HQ_LAYOUT } from './layout.ts';
import { LIFT_BACK } from './lift.ts';
import { LEGEND } from './legend.ts';
import { LINES } from './lines.ts';
import { paintAlarmWash, paintNightTint, paintSpine, paintStructure } from './shell.ts';
import { SOUNDSCAPE } from './soundscape.ts';
import { COUCH_PROP, UPPER_DECK_BACK, UPPER_DECK_HOTSPOTS } from './upper-deck.ts';

/**
 * The lab as a superhero HQ with JARVIS at the helm (issue #4): the Nines on watch, JARVIS as the HQ's
 * AI and first founder, and the arc-style power core under it (docs/design/hq-theme.md).
 */
export const hqTheme: Theme = {
  id: 'hq',
  name: 'HQ',
  layout: HQ_LAYOUT,
  cast: castSubject,
  founders: FOUNDERS,
  visitor: CITIZEN,
  lines: LINES,
  decor: {
    back: [
      paintSky,
      paintStructure,
      paintSpine,
      ...UPPER_DECK_BACK,
      ...GROUND_DECK_BACK,
      ...JET_BACK,
      ...LIFT_BACK,
      jarvisConsole(JARVIS),
      powerCore(CORE),
    ],
    props: [COUCH_PROP],
    front: [paintNightTint, paintAlarmWash],
  },
  hotspots: [...HOTSPOTS, ...UPPER_DECK_HOTSPOTS, ...GROUND_DECK_HOTSPOTS, ...JET_HOTSPOTS],
  legend: LEGEND,
  soundscape: SOUNDSCAPE,
};
