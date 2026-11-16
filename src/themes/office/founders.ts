import type { Founder } from '../../contract/theme.ts';
import { DHRUV_LOOK, PAUL_LOOK } from './looks.ts';

export const FOUNDERS: readonly Founder[] = [
  {
    id: 'paul',
    name: 'Paul',
    blurb: 'Co-founder of Solid Logic Studios. Dad, gamer, runs the lab and the LAN parties.',
    look: PAUL_LOOK,
    lines: {
      idle: [
        'HALO TONIGHT?',
        'LAN PARTY SATURDAY!',
        'KIDS ARE ASLEEP. GAME ON.',
        'ONE MORE ROUND OF BATTLE GOLF?',
        'I AM NOT LATE, I AM CACHED',
        'THAT NVME HAS UNTIL JANUARY',
        'TRIED OFF AND ON AGAIN?',
        'DAD JOKE LOADING...',
      ],
      checkIn: ["HOW'S IT GOING?", 'NEED MORE RAM?', 'LOOKING GOOD'],
      alarm: ['WHO BROKE PROD?', "PHONE'S RINGING!"],
    },
  },
  {
    id: 'dhruv',
    name: 'Dhruv',
    blurb: 'Co-founder of Solid Logic Studios. Dad, gamer, cricket tragic, never far from a meat pie.',
    look: DHRUV_LOOK,
    lines: {
      idle: [
        'NO WORRIES, MATE',
        "SHE'LL BE RIGHT",
        "RECKON THAT'S A BEAUTY",
        "FOOTY'S ON THIS ARVO",
        'WHO NICKED MY MEAT PIE?',
        'VEGEMITE TOAST FOR LUNCH',
        'HOWZAT! GREEN BUILD',
        'TOO EASY',
        'CHUCK IT ON STAGING, EH',
      ],
      checkIn: ['ALL GOOD, MATE?', 'GOING ALRIGHT?', "YOU'RE A LEGEND"],
      alarm: ['CRIKEY, #ALERTS IS GOING OFF', 'BIT OF A DRAMA, EH'],
    },
  },
];
