import type { Theme } from '../../contract/theme.ts';
import { paintBuilding } from './building.ts';
import { castSubject } from './cast.ts';
import { DRESSING } from './dressing.ts';
import { FOUNDERS } from './founders.ts';
import { HOTSPOTS } from './hotspots.ts';
import { OFFICE_LAYOUT } from './layout.ts';
import { LEGEND } from './legend.ts';
import { LINES } from './lines.ts';
import { visitorLook } from './looks.ts';
import { PROPS, paintNightTint } from './props.ts';
import { paintCloudOffice, paintSky } from './sky.ts';

/** The Solid Logic Studios lab as an office: a pixel-art cutaway with a basement and a cloud. */
export const officeTheme: Theme = {
  id: 'office',
  name: 'Office',
  layout: OFFICE_LAYOUT,
  cast: castSubject,
  founders: FOUNDERS,
  visitor: {
    look: visitorLook,
    title: 'Visitor',
    blurb: 'An HTTP request, in through the Cloudflare Tunnel and routed by Traefik.',
  },
  lines: LINES,
  decor: {
    back: [paintSky, paintCloudOffice, paintBuilding, ...DRESSING],
    props: PROPS,
    front: [paintNightTint],
  },
  hotspots: HOTSPOTS,
  legend: LEGEND,
};
