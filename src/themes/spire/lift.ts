import { liftCar } from '../hq/lift.ts';
import { DOOR_HEIGHT, FLOOR, SHAFT, STOREYS, band } from './geometry.ts';

/** The HQ's lift car (`hq/lift.ts`) in the Spire's seven-storey shaft, narrower to fit it. */
export const SPIRE_LIFT = liftCar({
  shaft: SHAFT,
  car: { w: 14, h: DOOR_HEIGHT },
  cableInset: 3,
  top: band(FLOOR.command).ceil,
  walks: Array.from({ length: STOREYS }, (_, floor) => band(floor).walk),
  floorDrop: band(FLOOR.gate).front - band(FLOOR.gate).walk,
});
