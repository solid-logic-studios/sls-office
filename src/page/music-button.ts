export interface MusicFace {
  text: string;
  /** Starts with `text`, so voice control can name the button by what it shows (WCAG 2.5.3). */
  label: string;
}

/** What the button shows. The state is in the text, so there is no `aria-pressed` to announce it twice. */
export function musicFace(on: boolean): MusicFace {
  return on
    ? { text: 'Music on', label: 'Music on, tap to turn off' }
    : { text: 'Music off', label: 'Music off, tap to turn on' };
}

/** What the music button needs from the page. */
export interface MusicControls {
  on: boolean;
  readonly blocked: boolean;
  /** Asks the browser to start audio. */
  unlock(): void;
  /** Called after the user toggles the music, to save the choice. */
  onToggle(on: boolean): void;
}

/**
 * A tap while blocked unlocks audio; it toggles only when the music was off, so music already chosen (and saved)
 * starts playing rather than being switched off. Any other tap toggles the music and saves it.
 */
export function musicClick(controls: MusicControls): void {
  if (controls.blocked) {
    controls.unlock();
    if (controls.on) return;
  }
  controls.on = !controls.on;
  controls.onToggle(controls.on);
}

/** Renders the music button and handles its clicks. */
export function mountMusicButton(button: HTMLButtonElement, controls: MusicControls): void {
  const render = (): void => {
    const face = musicFace(controls.on);
    button.textContent = face.text;
    button.setAttribute('aria-label', face.label);
  };
  button.addEventListener('click', () => {
    musicClick(controls);
    render();
  });
  render();
}
