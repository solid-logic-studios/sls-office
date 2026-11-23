import type { Founder } from '../../contract/theme.ts';
import { FOUNDERS as OFFICE_FOUNDERS } from '../office/founders.ts';
import { DHRUV_LOOK, JARVIS_LOOK, PAUL_LOOK } from './looks.ts';

const NINES = 'Founder of the Nines and co-founder of Solid Logic Studios.';

/**
 * The Office's Paul and Dhruv keep their lines (they are about the people, and the voice clips are already
 * rendered); JARVIS's remote is the third founder and `founders[0]`, so it is the announcer.
 */
const [OFFICE_PAUL, OFFICE_DHRUV] = OFFICE_FOUNDERS;
if (OFFICE_PAUL === undefined || OFFICE_DHRUV === undefined) throw new Error('the Office founders changed');

export const FOUNDERS: readonly Founder[] = [
  {
    id: 'jarvis',
    name: 'JARVIS',
    blurb: "JARVIS, out on the floor. The HQ's AI and the orchestrator of the /ticket loop.",
    look: JARVIS_LOOK,
    lines: {
      idle: ['ALL SYSTEMS NOMINAL', 'I HAVE THE HELM', 'DOING THE ROUNDS', 'TICKETS TRIAGED. NEXT?'],
      checkIn: ['STATUS REPORT?', 'HOLDING UP?', 'NEED ANYTHING?'],
      alarm: ['ALL HANDS. THIS IS REAL.', 'FOUNDERS HAVE BEEN PAGED'],
    },
  },
  {
    ...OFFICE_PAUL,
    blurb: `${NINES} Dad, gamer, runs the lab and the LAN parties.`,
    look: PAUL_LOOK,
  },
  {
    ...OFFICE_DHRUV,
    blurb: `${NINES} Dad, gamer, cricket tragic, never far from a meat pie.`,
    look: DHRUV_LOOK,
  },
];
