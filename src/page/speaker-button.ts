export interface SpeakerState {
  muted: boolean;
  /** The browser is holding audio back until a tap. Only matters while not muted. */
  blocked: boolean;
}

export interface SpeakerFace {
  text: string;
  label: string;
  pressed: boolean;
}

/** What the button shows. Muted wins over blocked: there is nothing to enable while muted. */
export function speakerFace({ muted, blocked }: SpeakerState): SpeakerFace {
  if (muted) return { text: 'Muted', label: 'Unmute the Office', pressed: true };
  if (blocked) return { text: 'Tap to enable', label: 'Enable sound', pressed: false };
  return { text: 'Sound on', label: 'Mute the Office', pressed: false };
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

/** Renders the speaker button and handles its clicks. Returns a function to re-render. */
export function mountSpeakerButton(button: HTMLButtonElement, controls: SpeakerControls): () => void {
  const render = (): void => {
    const face = speakerFace({ muted: controls.muted, blocked: controls.blocked });
    button.textContent = face.text;
    button.setAttribute('aria-label', face.label);
    button.setAttribute('aria-pressed', String(face.pressed));
  };
  button.addEventListener('click', () => {
    if (!controls.muted && controls.blocked) {
      controls.unlock();
    } else {
      controls.muted = !controls.muted;
      controls.onToggle(controls.muted);
    }
    render();
  });
  controls.onChange(render);
  render();
  return render;
}
