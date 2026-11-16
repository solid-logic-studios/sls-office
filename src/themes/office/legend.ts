import type { LegendEntry } from '../../contract/theme.ts';
import { CLIENT_COLOURS, ENV_PLATE } from './palette.ts';

export const LEGEND: readonly LegendEntry[] = [
  { colour: CLIENT_COLOURS.scrd, label: 'SCRD desks' },
  { colour: CLIENT_COLOURS.bsra, label: 'BSRA desks' },
  { colour: CLIENT_COLOURS.formsApi, label: 'Forms API desks' },
  { colour: CLIENT_COLOURS.labTest, label: 'Lab Test desks' },
  { colour: ENV_PLATE.develop.face, label: 'develop name plate' },
  { colour: ENV_PLATE.staging.face, label: 'staging name plate' },
  { colour: ENV_PLATE.production.face, label: 'production: gold plate, tie' },
  { colour: '#37abc8', label: 'Receptionist: Traefik' },
  { colour: '#f38020', label: 'Doormen: cloudflared x2' },
  { colour: '#4aa86b', label: 'Clipboard rounds: Gatus' },
  { colour: '#7a5a8a', label: 'Archivist: sls-data' },
  { colour: '#f2c230', label: 'Builder (hi-vis): sls-deploy' },
  { colour: '#eef0ff', label: 'Interns: CI pods on sls-ci' },
  { colour: '#35507a', label: 'Paul' },
  { colour: '#2f8f5b', label: 'Dhruv' },
];
