import type { Look } from '../../src/contract/theme.ts';
import { drawLook, type Pose, type SpriteState } from '../../src/engine/sprites.ts';
import { RecordingPainter } from './recording-painter.ts';

/** A sprite at (50, 100), facing right, with nothing special going on. */
export function spriteState(pose: Pose, overrides: Partial<SpriteState> = {}): SpriteState {
  return {
    x: 50,
    y: 100,
    pose,
    facing: 1,
    time: 1.3,
    frantic: false,
    talking: false,
    seated: false,
    inLift: false,
    trolley: null,
    ...overrides,
  };
}

/** Draw one look for one frame onto a recording painter. */
export function drawSprite(look: Look, sprite: SpriteState): RecordingPainter {
  const painter = new RecordingPainter();
  drawLook(painter, look, sprite);
  return painter;
}
