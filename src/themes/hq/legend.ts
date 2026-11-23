import type { LegendEntry } from '../../contract/theme.ts';
import { CLIENT_COLOURS, ENV_PLATE } from '../office/palette.ts';
import { AMBER } from './palette.ts';

export const LEGEND: readonly LegendEntry[] = [
  { colour: CLIENT_COLOURS.scrd, label: 'SCRD squad' },
  { colour: CLIENT_COLOURS.bsra, label: 'BSRA squad' },
  { colour: CLIENT_COLOURS.formsApi, label: 'Forms API squad' },
  { colour: CLIENT_COLOURS.labTest, label: 'Lab Test squad' },
  { colour: ENV_PLATE.develop.face, label: 'develop name plate' },
  { colour: ENV_PLATE.staging.face, label: 'staging name plate' },
  { colour: ENV_PLATE.production.face, label: 'production: gold plate, veteran suit' },
  { colour: '#37abc8', label: 'Switchboard: Traefik' },
  { colour: '#f38020', label: 'Tunnel Twins: cloudflared x2' },
  { colour: '#4aa86b', label: 'Vitals: Gatus' },
  { colour: '#7a5a8a', label: 'Ledger: sls-data' },
  { colour: '#f2c230', label: 'Payload (hi-vis): sls-deploy' },
  { colour: '#7df0c0', label: 'Muster: the autoscaler' },
  { colour: '#eef0ff', label: 'Rookies: CI pods on sls-ci' },
  { colour: '#35507a', label: 'Paul' },
  { colour: '#2f8f5b', label: 'Dhruv' },
  { colour: AMBER.glow, label: 'JARVIS' },
];
