import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/engine/event-bus.ts';
import type { EngineEvent } from '../../src/engine/events.ts';

const AT = '2026-01-01T00:00:00Z';

describe('EventBus', () => {
  it('delivers an event to its own kind only', () => {
    const bus = new EventBus();
    const logs: string[] = [];
    const visitors: string[] = [];
    bus.subscribe('log', (event) => logs.push(event.text));
    bus.subscribe('visitor', (event) => visitors.push(event.targetId));

    bus.publish({ kind: 'log', text: 'hello' });

    expect(logs).toEqual(['hello']);
    expect(visitors).toEqual([]);
  });

  it('routes each kind of the oom, vm-down and vm-up member on its own', () => {
    const bus = new EventBus();
    const seen: string[] = [];
    bus.subscribe('oom', (event) => seen.push(`oom:${event.subject}`));
    bus.subscribe('vm-down', (event) => seen.push(`down:${event.subject}`));
    bus.subscribe('vm-up', (event) => seen.push(`up:${event.subject}`));

    bus.publish({ kind: 'oom', subject: 'w1', at: AT });
    bus.publish({ kind: 'vm-down', subject: 'vm1', at: AT });
    bus.publish({ kind: 'vm-up', subject: 'vm1', at: AT });

    expect(seen).toEqual(['oom:w1', 'down:vm1', 'up:vm1']);
  });

  it('runs handlers in subscription order', () => {
    const bus = new EventBus();
    const order: number[] = [];
    bus.subscribe('log', () => order.push(1));
    bus.subscribe('log', () => order.push(2));
    bus.subscribe('log', () => order.push(3));

    bus.publish({ kind: 'log', text: '' });

    expect(order).toEqual([1, 2, 3]);
  });

  it('stops delivering after unsubscribe', () => {
    const bus = new EventBus();
    const seen: EngineEvent[] = [];
    const unsubscribe = bus.subscribe('log', (event) => seen.push(event));

    bus.publish({ kind: 'log', text: 'a' });
    unsubscribe();
    bus.publish({ kind: 'log', text: 'b' });

    expect(seen).toEqual([{ kind: 'log', text: 'a' }]);
  });

  it('lets a handler unsubscribe itself during a publish', () => {
    const bus = new EventBus();
    const order: string[] = [];
    const unsubscribeFirst = bus.subscribe('log', () => {
      order.push('first');
      unsubscribeFirst();
    });
    bus.subscribe('log', () => order.push('second'));

    bus.publish({ kind: 'log', text: '' });
    bus.publish({ kind: 'log', text: '' });

    expect(order).toEqual(['first', 'second', 'second']);
  });

  it('lets a handler unsubscribe a later one during a publish', () => {
    const bus = new EventBus();
    const order: string[] = [];
    bus.subscribe('log', () => {
      order.push('first');
      unsubscribeSecond();
    });
    const unsubscribeSecond = bus.subscribe('log', () => order.push('second'));
    bus.subscribe('log', () => order.push('third'));

    bus.publish({ kind: 'log', text: '' });

    expect(order).toEqual(['first', 'third']);
  });
});
