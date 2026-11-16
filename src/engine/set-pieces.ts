/** Furniture that scenes open and close, read by the Theme through `StageView`. */
export class SetPieces {
  vaultOpen = false;
  /** Indexes into `layout.stores`. */
  readonly openStores = new Set<number>();
}
