import type { Snapshot } from './contract/snapshot.ts';
import { Engine } from './engine/engine.ts';
import { Loop } from './engine/loop.ts';
import { ClipSpeechOutput } from './page/audio/clip-speech-output.ts';
import { HtmlAudioClipPlayer } from './page/audio/html-audio-clip-player.ts';
import { WebAudioOutput } from './page/audio/web-audio-output.ts';
import { initialMuted, saveMuted, type MuteStorage } from './page/audio/mute-preference.ts';
import { parseQuietHours } from './page/audio/quiet-hours.ts';
import { Soundboard } from './page/audio/soundboard.ts';
import { initialVolume, saveVolume } from './page/audio/volume-preference.ts';
import { loadVoiceManifest } from './page/audio/voice-manifest.ts';
import { WebSpeechOutput } from './page/audio/web-speech-output.ts';
import { localHour } from './page/clock.ts';
import { mountControlRoom } from './page/control-room.ts';
import { isStale } from './page/freshness.ts';
import { renderLegend } from './page/legend.ts';
import { OfficeLog } from './page/office-log.ts';
import { Poller } from './page/poller.ts';
import { mountSoundPanel } from './page/sound-panel.ts';
import { mountSpeakerButton } from './page/speaker-button.ts';
import { pollWhileVisible } from './page/visibility.ts';
import { StageCanvas } from './page/stage-canvas.ts';
import { StatusStrip } from './page/status-strip.ts';
import { mountThemeSwitcher } from './page/theme-switcher.ts';
import { TooltipView } from './page/tooltip-view.ts';
import { Simulator } from './simulator/simulator.ts';
import { HttpSnapshotSource } from './source/http-snapshot-source.ts';
import { THEMES } from './themes/index.ts';
import { officeTheme } from './themes/office/index.ts';

/** The composition root: it picks the Theme and the SnapshotSource and joins the Engine to the page. */

const LIVE_POLL_MS = 5_000;
/** The Simulator steps by the time between polls, so it is polled often to keep scenes prompt. */
const SIM_POLL_MS = 1_000;
const WAKING_TEXT = 'Waking the office…';
/** Where the image keeps the rendered clips and their manifest, relative to the page. */
const VOICES_URL = 'voices/';

function element<T extends HTMLElement>(id: string, type: new () => T): T {
  const found = document.getElementById(id);
  if (!(found instanceof type)) throw new Error(`Missing #${id}`);
  return found;
}

const query = new URLSearchParams(window.location.search);
const simulated = query.has('sim');
const firstTheme = THEMES.find((theme) => theme.id === query.get('theme')) ?? officeTheme;

const canvas = element('office', HTMLCanvasElement);
const waking = element('waking', HTMLParagraphElement);
const roster = element('roster', HTMLUListElement);
const legend = element('legend', HTMLUListElement);
const pause = element('pause', HTMLButtonElement);

const engine = new Engine(firstTheme, { random: Math.random });
const stage = new StageCanvas(element('scroll', HTMLDivElement), canvas, engine.layout);
const tooltip = new TooltipView(element('tip', HTMLDivElement), element('stage', HTMLElement));
const strip = new StatusStrip(element('strip', HTMLDivElement));
const log = new OfficeLog(element('log', HTMLOListElement));

/** Set by the control room's time-of-day slider; `null` follows the local clock. */
let hourOverride: number | null = null;
const hour = (): number => hourOverride ?? localHour(new Date());
let awake = false;

waking.textContent = WAKING_TEXT;
renderLegend(legend, firstTheme.legend);
engine.bus.subscribe('log', (event) => log.add(event.text, new Date()));

const audio = new WebAudioOutput();
audio.unlockOnGesture(document);
/** The image holds Piper clips under `voices/`; where there are none (`pnpm dev`) every line is spoken by the browser. */
const clipSpeech = new ClipSpeechOutput({
  player: new HtmlAudioClipPlayer(),
  fallback: new WebSpeechOutput(),
  baseUrl: VOICES_URL,
});
void loadVoiceManifest(fetch, `${VOICES_URL}manifest.json`).then((manifest) => clipSpeech.useManifest(manifest));
const soundboard = new Soundboard(engine, audio, { speech: clipSpeech, hour, quietHours: parseQuietHours(query) });

/** Even reading `localStorage` can throw (blocked site data), so it is fetched inside a try. */
function browserStorage(): MuteStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const storage = browserStorage();
soundboard.muted = initialMuted(query, storage);
/** The saved volume applies everywhere; only the slider that sets it is `?sim`-only. */
soundboard.volume = initialVolume(storage);
mountSpeakerButton(element('sound', HTMLButtonElement), {
  get muted() {
    return soundboard.muted;
  },
  set muted(value: boolean) {
    soundboard.muted = value;
  },
  get blocked() {
    return audio.blocked;
  },
  unlock: () => audio.unlock(),
  onChange: (listener) => audio.onChange(listener),
  onToggle: (muted) => saveMuted(query, storage, muted),
});

const loop = new Loop(
  (callback) => window.requestAnimationFrame(callback),
  (handle) => window.cancelAnimationFrame(handle),
  (dt) => {
    if (!awake) return;
    engine.setHour(hour());
    engine.update(dt);
    const painter = stage.painter;
    painter.clear(engine.layout.width, engine.layout.height);
    engine.draw(painter);
  },
);

function setPaused(paused: boolean): void {
  loop.paused = paused;
  pause.textContent = paused ? 'Play' : 'Pause';
}

pause.addEventListener('click', () => setPaused(!loop.paused));
element('zoom-in', HTMLButtonElement).addEventListener('click', () => stage.zoomIn());
element('zoom-out', HTMLButtonElement).addEventListener('click', () => stage.zoomOut());

stage.onPoint((point) => {
  const tip = point === null ? null : engine.tipAt(point.x, point.y);
  if (point === null || tip === null) tooltip.hide();
  else tooltip.show(tip, point);
});

/** A tap on empty stage speaks the status; anything with a tooltip (a character, hotspot or room) is unchanged. */
stage.onTap((point) => {
  if (engine.tipAt(point.x, point.y) === null) soundboard.announceStatus();
});

/** The `?sim` Sound panel, which follows the Theme switcher. Stays `null` outside `?sim`. */
let soundPanel: ReturnType<typeof mountSoundPanel> | null = null;

mountThemeSwitcher(element('theme', HTMLSelectElement), THEMES, firstTheme.id, (id) => {
  const theme = THEMES.find((candidate) => candidate.id === id);
  if (theme === undefined) return;
  engine.setTheme(theme);
  stage.resize(theme.layout.width, theme.layout.height);
  renderLegend(legend, theme.legend);
  soundPanel?.setTheme(theme);
  tooltip.hide();
});

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

let refreshControls = (): void => {};

function show(snapshot: Snapshot | null): void {
  awake = snapshot !== null && !isStale(snapshot, new Date());
  waking.hidden = awake;
  canvas.hidden = !awake;
  if (snapshot === null || !awake) {
    soundboard.followClock();
    strip.clear();
    updateRoster([]);
    tooltip.hide();
    return;
  }
  engine.accept(snapshot);
  soundboard.endSnapshot(snapshot);
  strip.update(engine.findings, hour());
  updateRoster(engine.roster());
  refreshControls();
}

function snapshotSource(): HttpSnapshotSource | Simulator {
  if (!simulated) return new HttpSnapshotSource(new URL('snapshot.json', document.baseURI));
  const simulator = new Simulator();
  const container = element('control-room', HTMLDivElement);
  container.hidden = false;
  soundPanel = mountSoundPanel({
    theme: engine.theme,
    play: (audition) => soundboard.audition(audition),
    volume: soundboard.volume,
    onVolume: (level) => {
      soundboard.volume = level;
      saveVolume(storage, level);
    },
    ignoreQuietHours: soundboard.ignoreQuietHours,
    onIgnoreQuietHours: (on) => {
      soundboard.ignoreQuietHours = on;
    },
  });
  const controls = mountControlRoom(container, simulator, {
    onHour: (value) => {
      hourOverride = value;
    },
    extra: [soundPanel.element],
  });
  refreshControls = () => controls.refresh();
  return simulator;
}

pollWhileVisible(new Poller(snapshotSource(), simulated ? SIM_POLL_MS : LIVE_POLL_MS, show), document);
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setPaused(true);
loop.start();
