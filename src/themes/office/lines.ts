import type { LineBank } from '../../contract/theme.ts';

/** Everything the Office says. Bubble text is capitals only: the pixel font has no lower case. */
const QUERY_POSTGRES = ['NEED TABLE USERS', 'SELECT * FROM SCORES', 'ONE QUERY, TA'];
const QUERY_MYSQL = ['WP_POSTS PLEASE', 'NEED WP_OPTIONS', 'ONE QUERY, TA'];

export const LINES: LineBank = {
  status: {
    break: 'On a break',
    working: 'Healthy',
    stressed: 'Under the pump',
    swamped: 'Snowed under',
    fainted: 'OOM killed, restarting',
    absent: 'Away',
    'new-arrival': 'Waiting on the health gate',
    leaving: 'Stopped, heading home',
    delivering: 'Deploying',
    'backing-up': 'Running the nightly backup',
    visiting: 'In flight',
  },
  offline: 'OFFLINE',
  mood: {
    stressed: ['!!', 'CPU IS COOKED', 'TOO MANY REQUESTS', 'SEND HELP'],
    working: ['200 OK', 'LGTM', 'CACHE HIT', 'ONE SEC...', 'SHIPPING IT'],
    swamped: ['BURIED IN PAPER', 'WHERE DID MY DESK GO?', 'SEND MORE TRAYS'],
  },
  part: {
    guard: ['COME THROUGH', 'NO INBOUND PORTS HERE', 'TUNNEL IS CLEAR'],
    checker: ['DOING MY ROUNDS', 'ALL HEALTHY', 'TICK'],
    keeper: ['SHHH.', 'INDEX YOUR TABLES', 'FSYNC IS ON', 'FILED UNDER P'],
    courier: ['HEALTH GATE FIRST', 'MIND THE TROLLEY', 'IMAGE IS BUILT'],
    wrangler: ['NO JOBS, NO INTERNS', 'SINGLE USE ONLY', 'THREE PODS MAX'],
    pod: ['RUNNING TESTS!', 'LINT LINT LINT', 'PLEASE PASS'],
  },
  breakSpot: {
    coffee: ['FLAT WHITE TIME', 'COFFEE FIRST'],
    fridge: ['WHO DREW THE SUN?', 'NICE DRAWING'],
    couch: ['ONE MORE ROUND', 'MY CONTROLLER IS BROKEN', 'NICE SHOT'],
    putt: ['FORE!', 'SO CLOSE'],
    cooler: ['QUIET TODAY, EH', 'HEARD ABOUT THE NVME?'],
    plant: ['HELLO PLANT', 'NICE AND QUIET'],
  },
  cue: {
    delivery: ['DELIVERY!'],
    'new-arrival': ['NEW IMAGE, READY'],
    'health-check': ['HEALTH CHECK...'],
    healthy: ['HEALTHY!'],
    unhealthy: ['UNHEALTHY!'],
    'old-one-out': ['OLD ONE OUT. CYA!'],
    'sent-home': ['SENT HOME...'],
    'still-serving': ['STILL SERVING'],
    'backup-start': ['02:30. BACKUP TIME.'],
    'backup-locked': ['ENCRYPTED AND LOCKED'],
    'backup-safe': ['SAFE IN R2'],
    'backup-failed': ['BACKUP FAILED', 'VAULT RUN FELL OVER'],
    'pods-up': ['JOBS QUEUED. SCALE UP!'],
    'pod-done': ['JOB DONE. POD GONE.'],
    recovered: ['I AM BACK'],
    query: [...QUERY_POSTGRES, ...QUERY_MYSQL],
    'query-answer': ['HERE YOU GO'],
    visitor: ['GET /', 'GET /HEALTH', 'POST /SCORES', 'GET /WP-LOGIN'],
    greet: ['VISITOR FOR YOU!', 'WHICH HOST HEADER?', 'ROUTING YOU NOW'],
    'check-in-reply': ['ALL GOOD', 'NO DRAMAS', 'TICKING ALONG'],
    'check-in-reply-busy': ['FLAT OUT, BOSS'],
    alarm: ['#ALERTS IS RINGING!'],
  },
};
