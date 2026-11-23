import type { DecorFn, Prop, Theme } from '../../contract/theme.ts';
import { officeTheme } from '../office/index.ts';
import { paintSky } from '../office/sky.ts';
import { CORE, JARVIS } from './boards.ts';
import { powerCore } from './core.ts';
import { HOTSPOTS } from './hotspots.ts';
import { jarvisConsole } from './jarvis-console.ts';
import { HQ_LAYOUT } from './layout.ts';
import { ROOMS } from './palette.ts';
import { paintAlarmWash, paintNightTint, paintSpine, paintStructure } from './shell.ts';

/** The rec room couch: its back is set dressing; its front sorts by base line, so sitters sit behind it. */
const COUCH = { x: 484, base: 128, w: 50 } as const;

const paintCouchBack: DecorFn = (painter) => {
  painter.rect('#8a3f6a', COUCH.x, COUCH.base - 22, COUCH.w, 16);
  painter.rect(ROOMS.rec.accent, COUCH.x, COUCH.base - 22, COUCH.w, 1);
};

const paintCouchFront: DecorFn = (painter) => {
  painter.rect('#753458', COUCH.x, COUCH.base - 8, COUCH.w, 8);
  painter.rect('#a04d7c', COUCH.x, COUCH.base - 8, COUCH.w, 2);
  painter.rect('#5c2845', COUCH.x, COUCH.base - 1, COUCH.w, 1);
};

const PROPS: readonly Prop[] = [{ baseY: COUCH.base, draw: paintCouchFront }];

/**
 * The lab as a superhero HQ with JARVIS at the helm (issue #4). The structure, the JARVIS orb and the
 * power core are the HQ's own. The cast, founders, lines, legend and sound are the Office's until the
 * HQ's own land (docs/design/hq-theme.md).
 */
export const hqTheme: Theme = {
  id: 'hq',
  name: 'HQ',
  layout: HQ_LAYOUT,
  cast: officeTheme.cast,
  founders: officeTheme.founders,
  visitor: officeTheme.visitor,
  lines: officeTheme.lines,
  decor: {
    back: [paintSky, paintStructure, paintSpine, paintCouchBack, jarvisConsole(JARVIS), powerCore(CORE)],
    props: PROPS,
    front: [paintNightTint, paintAlarmWash],
  },
  hotspots: HOTSPOTS,
  legend: officeTheme.legend,
  soundscape: officeTheme.soundscape,
};
