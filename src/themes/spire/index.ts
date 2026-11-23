import type { Theme } from '../../contract/theme.ts';
import { powerCore } from '../hq/core.ts';
import { hqTheme } from '../hq/index.ts';
import { jarvisConsole } from '../hq/jarvis-console.ts';
import { CORE, JARVIS } from './boards.ts';
import { DRESSING_BACK, DRESSING_PROPS } from './dressing.ts';
import { HOTSPOTS } from './hotspots.ts';
import { SPIRE_LAYOUT } from './layout.ts';
import { paintLift } from './lift.ts';
import { confine } from './relocate.ts';
import { SET_BACK, SKY_BACK } from './set.ts';
import { paintAlarmWash, paintNightTint, paintSpine, paintStructure } from './shell.ts';

/**
 * The HQ as a spire for a phone (docs/design/hq-theme.md, section 5): the same Nines, JARVIS, words
 * and sound, a storey or two per job, joined by one lift. The orb floats in the open on the roof and
 * the core glows at the foot, so on a phone the HQ is a spire with a beacon on top. Only the layout,
 * the furniture's placing, the set and the Hotspots are its own; the set is the HQ's art, placed anew.
 */
export const spireTheme: Theme = {
  id: 'spire',
  name: 'HQ Spire',
  layout: SPIRE_LAYOUT,
  cast: hqTheme.cast,
  founders: hqTheme.founders,
  visitor: hqTheme.visitor,
  lines: hqTheme.lines,
  decor: {
    back: [
      ...SKY_BACK,
      paintStructure,
      paintSpine,
      ...SET_BACK,
      ...DRESSING_BACK,
      paintLift,
      jarvisConsole(JARVIS),
      // The core's drive labels hang below its chamber, where the Spire has its floor: they are left out.
      confine(powerCore(CORE), CORE.chamber),
    ],
    props: DRESSING_PROPS,
    front: [paintNightTint, paintAlarmWash],
  },
  hotspots: HOTSPOTS,
  legend: hqTheme.legend,
  soundscape: hqTheme.soundscape,
};
