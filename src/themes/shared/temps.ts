import type { Temps } from '../../contract/snapshot.ts';

/** Which host sensor a reading belongs to. */
export type TempSensor = keyof Temps;

export type TempBand = 'cool' | 'warm' | 'hot';

interface SensorSpec {
  /** Label on the basement strip, three or four pixel-font capitals. */
  label: string;
  /** Name in the host tooltip. */
  name: string;
  /** Highest whole degree that is still cool, and still warm: above `warm` is hot. */
  cool: number;
  warm: number;
}

export const TEMP_SENSORS: Readonly<Record<TempSensor, SensorSpec>> = {
  cpu: { label: 'CPU', name: 'CPU', cool: 69, warm: 85 },
  chipset: { label: 'PCH', name: 'chipset', cool: 69, warm: 80 },
  nvme: { label: 'NVME', name: 'NVMe', cool: 59, warm: 70 },
};

/** The order the strip and the tooltip show the sensors in. */
export const SENSOR_ORDER: readonly TempSensor[] = ['cpu', 'chipset', 'nvme'];

export const TEMP_COLOURS: Readonly<Record<TempBand | 'unknown', string>> = {
  cool: '#5fcf7a',
  warm: '#f0b840',
  hot: '#ff6b5e',
  unknown: '#7f7a94',
};

export function tempBand(sensor: TempSensor, celsius: number): TempBand {
  const { cool, warm } = TEMP_SENSORS[sensor];
  return celsius <= cool ? 'cool' : celsius <= warm ? 'warm' : 'hot';
}

export interface Reading {
  celsius: number;
  band: TempBand;
}

/** One sensor's reading in whole degrees with its band, or `null` when it is unreadable or missing. */
export function readingOf(temps: Temps, sensor: TempSensor): Reading | null {
  const raw = temps[sensor];
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  const celsius = Math.round(raw);
  return { celsius, band: tempBand(sensor, celsius) };
}
