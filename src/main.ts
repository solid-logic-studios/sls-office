import type { Snapshot } from './contract/snapshot.ts';
import { isStale } from './page/freshness.ts';
import { MOOD_LABELS, moodOf } from './page/mood.ts';
import { Poller } from './page/poller.ts';
import { Renderer } from './page/renderer.ts';
import { HttpSnapshotSource } from './source/http-snapshot-source.ts';

const POLL_INTERVAL_MS = 5_000;
const WAKING_TEXT = 'Waking the office…';

function element<T extends HTMLElement>(id: string, type: new () => T): T {
  const found = document.getElementById(id);
  if (!(found instanceof type)) throw new Error(`Missing #${id}`);
  return found;
}

const stage = element('stage', HTMLDivElement);
const canvas = element('office', HTMLCanvasElement);
const waking = element('waking', HTMLParagraphElement);
const roster = element('roster', HTMLUListElement);

const renderer = new Renderer(canvas, stage);
waking.textContent = WAKING_TEXT;

function show(snapshot: Snapshot | null): void {
  const awake = snapshot !== null && !isStale(snapshot, new Date());
  waking.hidden = awake;
  canvas.hidden = !awake;
  if (!awake) {
    roster.replaceChildren();
    return;
  }
  renderer.render(snapshot.vms);
  updateRoster(snapshot.vms.map((vm) => `${vm.name}: ${MOOD_LABELS[moodOf(vm)]}, cpu ${Math.round(vm.cpu)}%`));
}

/** Rebuild the live region only when its text changes, so screen readers are not re-read the roster every poll. */
function updateRoster(lines: readonly string[]): void {
  const current = Array.from(roster.children, (item) => item.textContent ?? '');
  if (current.length === lines.length && current.every((line, i) => line === lines[i])) return;
  roster.replaceChildren(
    ...lines.map((line) => {
      const item = document.createElement('li');
      item.textContent = line;
      return item;
    }),
  );
}

const source = new HttpSnapshotSource(new URL('snapshot.json', document.baseURI));
new Poller(source, POLL_INTERVAL_MS, show).start();
