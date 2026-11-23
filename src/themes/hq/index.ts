import type { DecorFn, Prop, Theme } from '../../contract/theme.ts';
import { paintSky } from '../shared/sky.ts';
import { CORE, JARVIS } from './boards.ts';
import { CITIZEN, castSubject } from './cast.ts';
import { powerCore } from './core.ts';
import { HOTSPOTS } from './hotspots.ts';
import { FOUNDERS } from './founders.ts';
import { jarvisConsole } from './jarvis-console.ts';
import { HQ_LAYOUT } from './layout.ts';
import { LEGEND } from './legend.ts';
import { LINES } from './lines.ts';
import { ROOMS } from './palette.ts';
import { paintAlarmWash, paintNightTint, paintSpine, paintStructure } from './shell.ts';
import { SOUNDSCAPE } from './soundscape.ts';

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
    back: [paintSky, paintStructure, paintSpine, paintCouchBack, jarvisConsole(JARVIS), powerCore(CORE)],
    props: PROPS,
    front: [paintNightTint, paintAlarmWash],
  },
  hotspots: HOTSPOTS,
  legend: LEGEND,
  soundscape: SOUNDSCAPE,
};
