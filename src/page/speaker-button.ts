export interface SpeakerState {
  muted: boolean;
  /** The browser is holding audio back until a tap. Only matters while not muted. */
  blocked: boolean;
}

export interface SpeakerFace {
  text: string;
  /** Starts with `text`, so voice control can name the button by what it shows (WCAG 2.5.3). */
  label: string;
}

/**
 * What the button shows. Muted wins over blocked: there is nothing to enable while muted. The state is
 * in the text, so there is no `aria-pressed` to announce it twice.
 */
export function speakerFace({ muted, blocked }: SpeakerState): SpeakerFace {
  if (muted) return { text: 'Muted', label: 'Muted, tap to unmute' };
  if (blocked) return { text: 'Tap to enable', label: 'Tap to enable sound' };
  return { text: 'Sound on', label: 'Sound on, tap to mute' };
}

/** What the speaker button needs from the page. */
export interface SpeakerControls {
  muted: boolean;
  readonly blocked: boolean;
  /** Asks the browser to start audio. */
  unlock(): void;
  /** Called when `blocked` may have changed. */
  onChange(listener: () => void): void;
  /** Called after the user toggles mute, to save the choice. */
  onToggle(muted: boolean): void;
}

/** A tap while blocked (and not muted) only unlocks; any other tap toggles mute and saves it. */
export function speakerClick(controls: SpeakerControls): void {
  if (!controls.muted && controls.blocked) {
    controls.unlock();
    return;
  }
  controls.muted = !controls.muted;
  controls.onToggle(controls.muted);
}

/** Renders the speaker button and handles its clicks. */
export function mountSpeakerButton(button: HTMLButtonElement, controls: SpeakerControls): void {
  const render = (): void => {
    const face = speakerFace({ muted: controls.muted, blocked: controls.blocked });
    button.textContent = face.text;
    button.setAttribute('aria-label', face.label);
  };
  button.addEventListener('click', () => {
    speakerClick(controls);
    render();
  });
  controls.onChange(render);
  render();
}
