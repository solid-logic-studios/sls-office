import type { SpeechOutput, SpokenLine } from './speech-output.ts';

/** `en_AU` and `en-au` are the same tag; Android reports the first, the Web Speech API's examples the second. */
function normalise(lang: string): string {
  return lang.replace('_', '-').toLowerCase();
}

/**
 * The browser voice for `lang`: an exact match, else one with the same primary language (`en`), else
 * `undefined`, which leaves the browser's default in place.
 */
export function pickVoice<V extends { lang: string }>(voices: readonly V[], lang: string): V | undefined {
  const wanted = normalise(lang);
  const primary = wanted.split('-')[0];
  return (
    voices.find((voice) => normalise(voice.lang) === wanted) ??
    voices.find((voice) => normalise(voice.lang).split('-')[0] === primary)
  );
}

/** Allowance per character at normal rate, plus slack, before a line that never reported its end is given up on. */
const MS_PER_CHARACTER = 120;
const WATCHDOG_SLACK_MS = 5000;

/** How long `text` may take at `rate` before the watchdog ends it. Generous: it only catches a lost `end`. */
export function watchdogMs(text: string, rate: number): number {
  return (text.length * MS_PER_CHARACTER) / rate + WATCHDOG_SLACK_MS;
}

/** Speaks through the browser's `speechSynthesis`. Where it is missing, every line ends at once, unspoken. */
export class WebSpeechOutput implements SpeechOutput {
  /** Held so the browser cannot collect an utterance mid-line, which in Chrome drops its `end` event. */
  private utterance: SpeechSynthesisUtterance | null = null;

  speak(line: SpokenLine, onEnd: () => void): void {
    if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') {
      onEnd();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(line.text);
    utterance.lang = line.voice.lang;
    utterance.pitch = line.pitch;
    utterance.rate = line.rate;
    // Voices load asynchronously and may be empty at first, so look one up each time.
    const voice = pickVoice(speechSynthesis.getVoices(), line.voice.lang);
    if (voice !== undefined) utterance.voice = voice;
    let ended = false;
    const finish = (): void => {
      if (ended) return;
      ended = true;
      clearTimeout(watchdog);
      if (this.utterance === utterance) this.utterance = null;
      onEnd();
    };
    // Some engines (Chrome on Linux among them) now and then never fire `end`. Without this the queue
    // would wait for it all day, so a line that overruns is cancelled and counted as finished.
    const watchdog = setTimeout(
      () => {
        if (ended) return;
        speechSynthesis.cancel();
        finish();
      },
      watchdogMs(line.text, line.rate),
    );
    // `error` covers `not-allowed`, which the browser raises before the first gesture.
    utterance.onend = finish;
    utterance.onerror = finish;
    this.utterance = utterance;
    speechSynthesis.speak(utterance);
  }

  stop(): void {
    if (typeof speechSynthesis === 'undefined') return;
    speechSynthesis.cancel();
  }
}
