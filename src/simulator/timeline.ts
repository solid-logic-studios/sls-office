export type Cancel = () => void;

export const noCancel: Cancel = () => {};

interface Entry {
  due: number;
  seq: number;
  run: () => void;
  cancelled: boolean;
}

/** Model clock with cancellable one-shot timers. Time only moves through `advanceTo`. */
export class Timeline {
  now = 0;
  private entries: Entry[] = [];
  private seq = 0;

  after(seconds: number, run: () => void): Cancel {
    const entry: Entry = { due: this.now + seconds, seq: this.seq++, run, cancelled: false };
    this.entries.push(entry);
    return () => {
      entry.cancelled = true;
    };
  }

  /** Runs every due timer in order, with `now` set to each timer's own due time, then lands on `time`. */
  advanceTo(time: number): void {
    for (;;) {
      this.entries = this.entries.filter((entry) => !entry.cancelled);
      const next = this.entries.filter((entry) => entry.due <= time).sort((a, b) => a.due - b.due || a.seq - b.seq)[0];
      if (next === undefined) break;
      this.entries.splice(this.entries.indexOf(next), 1);
      this.now = Math.max(this.now, next.due);
      next.run();
    }
    this.now = time;
  }
}
