import type { Founder } from '../../contract/theme.ts';
import { FOUNDERS as OFFICE_FOUNDERS } from '../office/founders.ts';
import { DHRUV_LOOK, PAUL_LOOK } from './avengers.ts';
import { JARVIS_LOOK } from './looks.ts';

/**
 * The Office's Paul and Dhruv keep their names, faces and lines (they are about the people, and the voice clips
 * are already rendered) and each wears the arc reactor: Paul is the Stark of the outfit, Dhruv his Rhodes.
 * JARVIS's remote is the third founder and `founders[0]`, so it is the announcer.
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
    blurb:
      'Co-founder of Solid Logic Studios and the Stark of the outfit: built the HQ and JARVIS. Dad, gamer, runs the lab and the LAN parties.',
    look: PAUL_LOOK,
  },
  {
    ...OFFICE_DHRUV,
    blurb:
      "Co-founder of Solid Logic Studios and the Rhodes to Paul's Stark. Dad, gamer, cricket tragic, never far from a meat pie.",
    look: DHRUV_LOOK,
  },
];
