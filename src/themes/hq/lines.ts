import type { LineBank } from '../../contract/theme.ts';

/** The break-spot kinds the HQ's layout uses, in the order of its break spots (docs/design/hq-theme.md, section 4). */
export const BREAK_SPOT_KINDS = ['brew', 'couch', 'bag', 'holo', 'trophy'] as const;

/**
 * Everything the HQ says. Bubble text is capitals only (the pixel font has no lower case); the status
 * lines are tooltip text, in sentence case. Australian English, no em-dashes.
 */
export const LINES: LineBank = {
  status: {
    break: 'Standing down',
    working: 'On watch',
    stressed: 'Under the pump',
    swamped: 'Overrun',
    fainted: 'OOM killed, back up shortly',
    absent: 'Off duty',
    'new-arrival': 'Waiting on the health gate',
    leaving: 'Stood down, heading out',
    delivering: 'Deploying',
    'backing-up': 'Flying the nightly backup',
    visiting: 'In flight',
  },
  offline: 'OFFLINE',
  mood: {
    stressed: ['!!', 'CPU IS COOKED', 'TOO MANY CALLS', 'NEED BACKUP!'],
    working: ['200 OK', 'ON WATCH', 'ALL CLEAR HERE', 'CACHE HIT', 'HOLDING STEADY'],
    swamped: ['OVERRUN!', 'MEMORY IS MAXED', 'CANNOT HOLD MUCH MORE'],
  },
  part: {
    guard: ['TUNNEL IS CLEAR', 'NO INBOUND PORTS', 'THE GATE HOLDS'],
    checker: ['DOING MY ROUNDS', 'PULSE IS STRONG', 'TICK'],
    keeper: ['EVERY RECORD IN ITS PLACE', 'INDEX YOUR TABLES', 'FSYNC IS ON'],
    courier: ['HEALTH GATE FIRST', 'MIND THE CRATE', 'IMAGE IS BUILT'],
    wrangler: ['NO JOBS, NO ROOKIES', 'ONE MISSION EACH', 'THREE ROOKIES MAX'],
    pod: ['RUNNING TESTS!', 'LINT LINT LINT', 'PLEASE PASS'],
  },
  breakSpot: {
    brew: ['FLAT WHITE TIME', 'COFFEE FIRST'],
    couch: ['ONE MORE ROUND', 'MY CONTROLLER IS BROKEN', 'NICE SHOT'],
    bag: ['ONE-TWO!', 'STILL GOT IT'],
    holo: ['NICE MAP', 'WHERE IS STAGING?'],
    trophy: ['OUR FIRST CLIENT', 'GOOD TIMES'],
  },
  cue: {
    delivery: ['NEW GEAR, COMING THROUGH!', 'HANGAR TO OPS: INBOUND'],
    'new-arrival': ['NEW MARK, REPORTING', 'SUITED UP AND READY'],
    'health-check': ['VITALS CHECK...'],
    healthy: ['FIT FOR DUTY!'],
    unhealthy: ['NOT FIT FOR DUTY!'],
    'old-one-out': ['OLD MARK STANDING DOWN', 'MY WATCH IS DONE. CYA!'],
    'sent-home': ['BACK TO THE HANGAR...'],
    'still-serving': ['STILL ON WATCH'],
    'backup-start': ['02:30. JET RUN.'],
    'backup-locked': ['SEALED AND ENCRYPTED'],
    'backup-safe': ['SAFE IN THE R2 BUNKER'],
    'backup-failed': ['JET RUN ABORTED', 'BUNKER DID NOT ANSWER'],
    'pods-up': ['ROOKIES, SUIT UP!'],
    'pod-done': ['MISSION DONE. DISMISSED.'],
    recovered: ['BACK ON MY FEET'],
    query: ['NEED TABLE USERS', 'SELECT * FROM SCORES', 'WP_POSTS PLEASE', 'NEED WP_OPTIONS', 'ONE RECORD, TA'],
    'query-answer': ['FROM THE VAULT', 'HERE YOU GO'],
    // The Office's, so the clips are shared.
    visitor: ['GET /', 'GET /HEALTH', 'POST /SCORES', 'GET /WP-LOGIN'],
    greet: ['CITIZEN FOR YOU!', 'WHICH HOST HEADER?', 'PATCHING YOU THROUGH'],
    'check-in-reply': ['ALL QUIET ON MY WATCH', 'NO DRAMAS', 'HOLDING THE LINE'],
    'check-in-reply-busy': ['FLAT OUT, BOSS'],
    alarm: ['ALL HANDS!', '#ALERTS IS RINGING!'],
  },
};
