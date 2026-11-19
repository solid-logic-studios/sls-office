import type { Temps } from '../../contract/snapshot.ts';

/** Which host sensor a reading belongs to. */
export type TempSensor = keyof Temps;

export type TempBand = 'cool' | 'warm' | 'hot';

/** Upper bounds, inclusive, of the cool and warm bands per sensor: above `warm` is hot. */
const BANDS: Readonly<Record<TempSensor, { cool: number; warm: number }>> = {
  cpu: { cool: 69, warm: 85 },
  chipset: { cool: 69, warm: 80 },
  nvme: { cool: 59, warm: 70 },
};

export const TEMP_COLOURS: Readonly<Record<TempBand | 'unknown', string>> = {
  cool: '#5fcf7a',
  warm: '#f0b840',
  hot: '#ff6b5e',
  unknown: '#7f7a94',
};

export function tempBand(sensor: TempSensor, celsius: number): TempBand {
  const { cool, warm } = BANDS[sensor];
  return celsius <= cool ? 'cool' : celsius <= warm ? 'warm' : 'hot';
}
