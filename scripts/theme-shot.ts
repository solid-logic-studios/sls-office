/**
 * Renders a Theme headlessly to exact-pixel PNGs: `pnpm shot <themeId> [outDir]`.
 * Defaults to `.shots/<themeId>/`. Each shot is a scripted Simulator run drawn through the Engine.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Theme } from '../src/contract/theme.ts';
import { Engine } from '../src/engine/engine.ts';
import { seededRandom } from '../src/engine/random.ts';
import { Simulator } from '../src/simulator/simulator.ts';
import type { SimCommand } from '../src/simulator/simulator.ts';
import { THEMES } from '../src/themes/index.ts';
import { BufferPainter } from './buffer-painter.ts';

interface Shot {
  name: string;
  /** Hour of day (0 to 24) the Engine draws at. */
  hour: number;
  /** Simulator commands, each followed by that many seconds of play. */
  script: readonly (SimCommand | number)[];
}

/** A number in a script is seconds to play; anything else is a command. */
const SHOTS: readonly Shot[] = [
  { name: 'day', hour: 14, script: [{ kind: 'preset', preset: 'arvo' }, 31] },
  { name: 'deploy', hour: 10.5, script: [{ kind: 'preset', preset: 'deploy' }, 9] },
  {
    name: 'alarm',
    hour: 16,
    script: [{ kind: 'preset', preset: 'fire' }, 14, { kind: 'set-up', vmId: 'sls-data', up: false }, 4],
  },
  { name: 'night', hour: 2.5, script: [{ kind: 'preset', preset: 'quiet' }, 30] },
];

const SCALE = 2;

function render(theme: Theme, shot: Shot): Buffer {
  const sim = new Simulator({ random: seededRandom(11), now: () => new Date(Date.UTC(2026, 10, 23, 3)) });
  const engine = new Engine(theme, { random: seededRandom(7) });
  engine.setHour(shot.hour);
  const play = (seconds: number): void => {
    for (let s = 0; s < seconds; s++) {
      sim.advance(1);
      engine.accept(sim.snapshot());
      engine.update(1);
    }
  };
  play(2);
  for (const step of shot.script) {
    if (typeof step === 'number') play(step);
    else sim.dispatch(step);
  }
  const { width, height } = theme.layout;
  const painter = new BufferPainter(width, height);
  engine.draw(painter);
  return painter.png(SCALE);
}

const [themeId, outArg] = process.argv.slice(2);
const theme = THEMES.find((candidate) => candidate.id === themeId);
if (theme === undefined) {
  console.error(`Usage: pnpm shot <themeId> [outDir]   (themes: ${THEMES.map((t) => t.id).join(', ')})`);
  process.exit(1);
}
const out = outArg ?? join('.shots', theme.id);
mkdirSync(out, { recursive: true });
for (const shot of SHOTS) writeFileSync(join(out, `${theme.id}-${shot.name}.png`), render(theme, shot));
console.log(`Wrote ${SHOTS.length} shots to ${out}`);
