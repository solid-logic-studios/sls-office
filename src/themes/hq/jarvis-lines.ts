import type { JarvisState } from './jarvis-state.ts';

/** The longest line the readout can show after its prompt: 24 pixel-font capitals. */
export const JARVIS_LINE_MAX = 24;

type Lines = readonly [string, ...string[]];

/**
 * Everything JARVIS says on the readout, by what it is attending to. Capitals only (the pixel font has
 * no lower case), Australian English, no em-dashes, and never longer than `JARVIS_LINE_MAX`.
 */
export const JARVIS_LINES: Readonly<Record<JarvisState, Lines>> = {
  waking: ['WAKING THE HQ...', 'AWAITING FIRST SNAPSHOT', 'WARMING THE CORE'],
  idle: [
    'ALL SYSTEMS NOMINAL',
    'THE TEAM IS ON WATCH',
    'I HAVE THE HELM',
    'MONITORING ALL SITES',
    'KETTLE IS ON, AS EVER',
    'UPTIME IS A TEAM SPORT',
    'NOTHING TO REPORT. GOOD.',
    'TICKETS TRIAGED. NEXT?',
  ],
  deploy: [
    'DEPLOY IN PROGRESS',
    'HANGAR DOORS ARE OPEN',
    'NEW GEAR ON THE WAY',
    'HEALTH GATE IS ARMED',
    'ROLLBACK IS STANDING BY',
    'BUILDING. DO NOT JINX IT',
  ],
  ci: [
    'ROOKIES ARE SUITED UP',
    'ONE MISSION EACH. GO.',
    'LINT FIRST, GLORY LATER',
    'THE ROOKIE BAY IS BUSY',
    'GREEN BUILDS, PLEASE',
  ],
  alarm: [
    'ALL HANDS. THIS IS REAL.',
    'CRITICAL FINDING OPEN',
    'ALARM. EYES ON THE BOARD',
    'FOUNDERS HAVE BEEN PAGED',
    'STAY CALM. FIX FORWARD.',
  ],
  backup: ['JET AWAY TO THE BUNKER', 'BACKUP RUN IN THE AIR', 'ENCRYPTED, SEALED, FLOWN', 'OFF-SITE COPY INBOUND'],
  night: [
    'QUIET NIGHT. I HAVE IT.',
    'EVERYONE REST. I WATCH.',
    'LOW POWER, HIGH ALERT',
    'THE CORE HUMS. ALL WELL.',
    'BACKUPS LEAVE AT 02:30',
    'NOT A CREATURE STIRRING',
  ],
};
