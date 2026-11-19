import type { Snapshot } from './contract/snapshot.ts';
import { Engine } from './engine/engine.ts';
import { Loop } from './engine/loop.ts';
import { ClipSpeechOutput } from './page/audio/clip-speech-output.ts';
import { HtmlAudioClipPlayer } from './page/audio/html-audio-clip-player.ts';
import { WebAudioOutput } from './page/audio/web-audio-output.ts';
import { OfficeDiary } from './page/audio/office-diary.ts';
import { initialMuted, saveMuted, type MuteStorage } from './page/audio/mute-preference.ts';
import { initialMusic, saveMusic } from './page/audio/music-preference.ts';
import { parseQuietHours } from './page/audio/quiet-hours.ts';
import { Soundboard } from './page/audio/soundboard.ts';
import { Standup } from './page/audio/standup.ts';
import { StandupSchedule } from './page/audio/standup-schedule.ts';
import { initialVolume, saveVolume } from './page/audio/volume-preference.ts';
import { loadVoiceManifest } from './page/audio/voice-manifest.ts';
import { WebSpeechOutput } from './page/audio/web-speech-output.ts';
import { chooseTheme } from './page/default-theme.ts';
import { throttleFrames } from './page/frame-throttle.ts';
import { localHour } from './page/clock.ts';
import { compactMedia, isCompact } from './page/compact.ts';
import { placeControls } from './page/controls-sheet.ts';
import { DetailSheet } from './page/detail-sheet.ts';
import { sheetOf } from './page/sheet.ts';
import { probeWithSlop } from './page/tap-slop.ts';
import { TroubleList } from './page/trouble-list.ts';
import { verdictOf } from './page/verdict.ts';
import { VerdictBar, type BarState } from './page/verdict-bar.ts';
import { mountControlRoom } from './page/control-room.ts';
import { isStale } from './page/freshness.ts';
import { renderLegend } from './page/legend.ts';
import { OfficeLog } from './page/office-log.ts';
import { Poller } from './page/poller.ts';
import { mountMusicButton } from './page/music-button.ts';
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
import { towerTheme } from './themes/tower/index.ts';

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
/** Read once: rotating a phone later does not swap the Theme, the sound default or the frame rate. */
const compactAtLoad = isCompact();
const firstTheme = chooseTheme(THEMES, query.get('theme'), compactAtLoad, { wide: officeTheme, compact: towerTheme });
/** A phone draws about 20 frames a second: the Office is slow-moving and it saves battery. */
const COMPACT_FRAME_MS = 50;

const canvas = element('office', HTMLCanvasElement);
const waking = element('waking', HTMLParagraphElement);
const roster = element('roster', HTMLUListElement);
const legend = element('legend', HTMLUListElement);
const pause = element('pause', HTMLButtonElement);

function themeLabel(): HTMLElement {
  const label = element('theme', HTMLSelectElement).closest('label');
  if (label === null) throw new Error('Missing the theme label');
  return label;
}

const engine = new Engine(firstTheme, { random: Math.random });
const stage = new StageCanvas(element('scroll', HTMLDivElement), canvas, engine.layout);
const tooltip = new TooltipView(element('tip', HTMLDivElement), element('stage', HTMLElement));
const stripEl = element('strip', HTMLDivElement);
const strip = new StatusStrip(stripEl);
const log = new OfficeLog(element('log', HTMLOListElement));

/** The compact page chrome. Above 480 px CSS keeps it hidden and none of it is used. */
const bar = new VerdictBar(element('vbar', HTMLDivElement));
const detail = new DetailSheet(element('sheet', HTMLElement), element('sheet-body', HTMLDivElement));
const menu = element('menu', HTMLButtonElement);
const controlsSheet = sheetOf(element('controls-sheet', HTMLElement), (open) =>
  menu.setAttribute('aria-expanded', String(open)),
);
const trouble = new TroubleList(element('trouble', HTMLUListElement), (issue) => {
  controlsSheet.close();
  detail.open(issue.tip);
});

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

/** Even reading `localStorage` can throw (blocked site data), so it is fetched inside a try. */
function browserStorage(): MuteStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const storage = browserStorage();

const soundboard = new Soundboard(engine, audio, {
  speech: clipSpeech,
  hour,
  quietHours: parseQuietHours(query),
  // The Simulator's synthetic Alarms must not reset the real streak, so `?sim` keeps its own in memory.
  storage: simulated ? null : storage,
});

const diary = new OfficeDiary(engine.bus, () => Date.now());
const standup = new Standup(engine, soundboard, diary, new StandupSchedule(storage));
soundboard.muted = initialMuted(query, storage, compactAtLoad);
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
soundboard.musicOn = initialMusic(storage);
mountMusicButton(element('music', HTMLButtonElement), {
  get on() {
    return soundboard.musicOn;
  },
  set on(value: boolean) {
    soundboard.musicOn = value;
  },
  get blocked() {
    return audio.blocked;
  },
  unlock: () => audio.unlock(),
  onToggle: (on) => saveMusic(storage, on),
});

const browserFrames = {
  requestFrame: (callback: (timeMs: number) => void): number => window.requestAnimationFrame(callback),
  cancelFrame: (handle: number): void => window.cancelAnimationFrame(handle),
};
const frames = compactAtLoad ? throttleFrames(browserFrames, COMPACT_FRAME_MS) : browserFrames;

const loop = new Loop(frames.requestFrame, frames.cancelFrame, (dt) => {
  if (!awake) return;
  engine.setHour(hour());
  engine.update(dt);
  const painter = stage.painter;
  painter.clear(engine.layout.width, engine.layout.height);
  engine.draw(painter);
});

function setPaused(paused: boolean): void {
  loop.paused = paused;
  pause.textContent = paused ? 'Play' : 'Pause';
}

pause.addEventListener('click', () => setPaused(!loop.paused));

menu.addEventListener('click', () => {
  if (controlsSheet.isOpen) {
    controlsSheet.close();
    return;
  }
  detail.close();
  controlsSheet.open();
});
placeControls(
  compactMedia,
  stripEl,
  element('controls-body', HTMLDivElement),
  [pause, element('sound', HTMLButtonElement), element('music', HTMLButtonElement), themeLabel()],
  () => {
    detail.close();
    controlsSheet.close();
  },
);

element('zoom-in', HTMLButtonElement).addEventListener('click', () => stage.zoomIn());
element('zoom-out', HTMLButtonElement).addEventListener('click', () => stage.zoomOut());

// Entering compact leaves no hover to dismiss the tooltip, so it is hidden as the breakpoint is crossed.
compactMedia.addEventListener('change', (event) => {
  if (event.matches) tooltip.hide();
});

stage.onPoint((point) => {
  if (isCompact()) return;
  const tip = point === null ? null : engine.tipAt(point.x, point.y);
  if (point === null || tip === null) tooltip.hide();
  else tooltip.show(tip, point);
});

/** A tap on empty stage speaks the status; anything with a tooltip (a character, hotspot or room) is unchanged. */
stage.onTap((point) => {
  if (isCompact()) {
    // A finger is wider than a character, so a miss is retried on a small ring around the tap.
    const tip = probeWithSlop((x, y) => engine.tipAt(x, y), point.x, point.y, stage.cssPerArtPixel);
    if (tip !== null) {
      controlsSheet.close();
      detail.open(tip);
      return;
    }
    detail.close();
    soundboard.announceStatus();
    return;
  }
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
  detail.close();
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

/** The `at` of the last Snapshot that parsed, so a stale or missing feed can say when it was last heard. */
let lastGood: Date | null = null;

function barStateOf(snapshot: Snapshot | null, fresh: boolean): BarState {
  if (snapshot === null) return { kind: 'no-signal', lastGood };
  if (!fresh) return { kind: 'stale', lastHeard: lastGood };
  return { kind: 'live', verdict: verdictOf(snapshot) };
}

function show(snapshot: Snapshot | null): void {
  const now = new Date();
  if (snapshot !== null) {
    const takenAt = new Date(snapshot.at);
    lastGood = Number.isNaN(takenAt.getTime()) ? lastGood : takenAt;
  }
  awake = snapshot !== null && !isStale(snapshot, now);
  const state = barStateOf(snapshot, awake);
  bar.render(state);
  bar.setClock(hour());
  trouble.update(state.kind === 'live' ? state.verdict.issues : []);
  waking.hidden = awake;
  canvas.hidden = !awake;
  if (snapshot === null || !awake) {
    soundboard.followClock();
    strip.clear();
    updateRoster([]);
    tooltip.hide();
    detail.close();
    return;
  }
  engine.accept(snapshot);
  soundboard.endSnapshot(snapshot);
  diary.noteSnapshot(snapshot);
  standup.check(now);
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
    onStandup: () => {
      standup.run(new Date());
    },
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
      bar.setClock(hour());
    },
    extra: [soundPanel.element],
  });
  refreshControls = () => controls.refresh();
  return simulator;
}

pollWhileVisible(new Poller(snapshotSource(), simulated ? SIM_POLL_MS : LIVE_POLL_MS, show), document);
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setPaused(true);
bar.setClock(hour());
loop.start();

/** Nothing is drawn while the canvas is scrolled out of view; polling, the bar and the list carry on. `start` resets the clock, so there is no jump. */
if (typeof IntersectionObserver !== 'undefined') {
  new IntersectionObserver((entries) => {
    const latest = entries[entries.length - 1];
    if (latest === undefined) return;
    if (latest.isIntersecting) loop.start();
    else loop.stop();
  }).observe(canvas);
}
