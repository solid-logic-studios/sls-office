import type { Theme } from '../../contract/theme.ts';
import { officeTheme } from '../office/index.ts';
import { paintPlantRoom, paintVault } from './basement.ts';
import { DRESSING } from './dressing.ts';
import { HOTSPOTS } from './hotspots.ts';
import { TOWER_LAYOUT } from './layout.ts';
import { paintLift } from './lift.ts';
import { paintBuilding, paintNightTint } from './shell.ts';
import { paintSky } from './sky.ts';

/**
 * The Office's world as a narrow high-rise for a phone: the same cast, words and sound, one storey
 * per job, joined by one lift. Only the layout, the furniture's placing, the set and the Hotspots are its own.
 */
export const towerTheme: Theme = {
  id: 'tower',
  name: 'Tower',
  layout: TOWER_LAYOUT,
  cast: officeTheme.cast,
  founders: officeTheme.founders,
  visitor: officeTheme.visitor,
  lines: officeTheme.lines,
  decor: {
    back: [paintSky, paintBuilding, paintLift, paintPlantRoom, paintVault, ...DRESSING],
    props: [],
    front: [paintNightTint],
  },
  hotspots: HOTSPOTS,
  legend: officeTheme.legend,
  soundscape: officeTheme.soundscape,
};
