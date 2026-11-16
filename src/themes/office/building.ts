import type { DecorFn } from '../../contract/theme.ts';
import { paintBasement, paintComputeFloor, paintLoadingBay, paintVault } from './groundfloor.ts';
import { paintCeilingLights, paintExits, paintGroundAndShell, paintLift, paintRooms } from './shell.ts';
import { paintArchive, paintFoundersOffice, paintInternPool, paintLanCorner } from './upstairs.ts';

/**
 * The static set: the building and everything fixed to its walls. It takes the stage because the
 * windows and doors show the live sky through them.
 */
export const paintBuilding: DecorFn = (painter, stage) => {
  paintGroundAndShell(painter);
  paintRooms(painter);
  paintLift(painter);
  paintCeilingLights(painter);
  paintExits(painter, stage);
  paintInternPool(painter, stage);
  paintArchive(painter);
  paintFoundersOffice(painter, stage);
  paintLanCorner(painter);
  paintComputeFloor(painter, stage);
  paintLoadingBay(painter);
  paintBasement(painter);
  paintVault(painter);
};
