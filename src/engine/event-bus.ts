import type { EngineEvent, EngineEventKind, EngineEventOf } from './events.ts';

type Handler = (event: EngineEvent) => void;

export class EventBus {
  private readonly handlers = new Map<EngineEventKind, Set<{ handler: Handler }>>();

  /** Returns the unsubscribe function. */
  subscribe<K extends EngineEventKind>(kind: K, handler: (event: EngineEventOf<K>) => void): () => void {
    // The one cast: the map holds handlers of every kind, and publish only calls a handler with its own kind.
    const entry = { handler: handler as Handler };
    const entries = this.handlers.get(kind) ?? new Set<{ handler: Handler }>();
    entries.add(entry);
    this.handlers.set(kind, entries);
    return () => {
      entries.delete(entry);
    };
  }

  publish(event: EngineEvent): void {
    const entries = this.handlers.get(event.kind);
    if (!entries) return;
    // Iterate a copy so a handler can unsubscribe mid-publish; skip any that went in the meantime.
    for (const entry of [...entries]) {
      if (entries.has(entry)) entry.handler(event);
    }
  }
}
