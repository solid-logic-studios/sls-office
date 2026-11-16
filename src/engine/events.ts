import type { LabEvent, Workload } from '../contract/snapshot.ts';

/**
 * Everything published on the Engine's bus.
 *
 * - `LabEvent`s come from the Snapshot, or are derived by the differ (a VM's `up` flag flipping).
 *   A `deploy` or `oom` subject is a workload id; a `vm-down` or `vm-up` subject is a VM id.
 * - `workload-added` and `workload-removed` are derived by the differ from two Snapshots.
 * - `speech`, `paper`, `visitor` and `log` are messages between parts of the Engine: characters and
 *   scenes publish them, and the bubble, effects and log systems subscribe. Nothing calls another
 *   character directly.
 */
export type EngineEvent =
  | LabEvent
  | { kind: 'workload-added'; vmId: string; workload: Workload }
  | { kind: 'workload-removed'; vmId: string; workload: Workload }
  /** `force` shows the bubble even when the stage is already busy with bubbles. */
  | { kind: 'speech'; speakerId: string; text: string; force: boolean }
  /** A sheet of paper flies from one character to another. */
  | { kind: 'paper'; fromId: string; toId: string }
  /** A visitor has reached the worker it came to see. */
  | { kind: 'visitor'; targetId: string }
  /** One line for the Office log. */
  | { kind: 'log'; text: string };

export type EngineEventKind = EngineEvent['kind'];
export type EngineEventOf<K extends EngineEventKind> = Extract<EngineEvent, { kind: K }>;
