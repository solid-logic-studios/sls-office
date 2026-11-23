import type { LegendEntry, PersonLook } from '../../contract/theme.ts';
import { CLIENT_COLOURS, ENV_PLATE } from '../office/palette.ts';
import { HAWKEYE, ROOKIES, POSTS, DHRUV_LOOK, PAUL_LOOK, type Hero } from './avengers.ts';
import { AMBER } from './palette.ts';

/** A swatch is taken from the hero's look, not a copied hex: `pick` names the piece of the costume that carries it. */
const swatch = (hero: Hero, pick: (look: PersonLook) => string | undefined): string => {
  const colour = pick(hero.look);
  if (colour === undefined) throw new Error(`${hero.name} has no colour for the legend`);
  return colour;
};

const quiver = ({ carry }: PersonLook): string | undefined =>
  typeof carry === 'object' && carry.kind === 'bow' ? carry.quiver : undefined;

export const LEGEND: readonly LegendEntry[] = [
  { colour: CLIENT_COLOURS.scrd, label: 'SCRD squad: Iron Man leads' },
  { colour: CLIENT_COLOURS.bsra, label: 'BSRA squad: Captain Marvel leads' },
  { colour: CLIENT_COLOURS.formsApi, label: 'Forms API squad: Black Panther leads' },
  { colour: CLIENT_COLOURS.labTest, label: 'Lab Test squad: Vision leads' },
  { colour: ENV_PLATE.develop.face, label: 'develop name plate' },
  { colour: ENV_PLATE.staging.face, label: 'staging name plate' },
  { colour: ENV_PLATE.production.face, label: 'production: gold plate' },
  { colour: swatch(POSTS.greeter, (look) => look.shirt), label: 'Nick Fury: Traefik' },
  { colour: swatch(HAWKEYE, quiver), label: 'The Hawkeyes: cloudflared x2' },
  { colour: swatch(POSTS.checker, (look) => look.hair), label: 'Black Widow: Gatus' },
  { colour: swatch(POSTS.keeper, (look) => look.shirt), label: 'Hulk: sls-data' },
  { colour: swatch(POSTS.courier, (look) => look.cape), label: 'Thor: sls-deploy' },
  { colour: swatch(POSTS.wrangler, (look) => look.shirt), label: 'Captain America: the autoscaler' },
  { colour: swatch(ROOKIES[0], (look) => look.shirt), label: 'Rookies: CI pods on sls-ci' },
  { colour: PAUL_LOOK.shirt, label: 'Paul' },
  { colour: DHRUV_LOOK.shirt, label: 'Dhruv' },
  { colour: AMBER.glow, label: 'JARVIS' },
];
