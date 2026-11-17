import type { Theme } from '../contract/theme.ts';
import { auditionLabel, auditions, type Audition } from './audio/auditions.ts';
import { button, checkbox, group, labelFor, make, range } from './control-room.ts';

export interface SoundPanelControls {
  /** The Theme showing now, whose Soundscape the buttons play. */
  theme: Theme;
  /** Plays one sound, as the Soundboard does (so mute and quiet hours still apply). */
  play(audition: Audition): void;
  /** The master volume to show, 0 to 1. */
  volume: number;
  onVolume(level: number): void;
  ignoreQuietHours: boolean;
  onIgnoreQuietHours(on: boolean): void;
}

const PERCENT = 100;

/**
 * The control room's Sound group: a button per sound in the Theme's Soundscape, the master volume and a switch
 * to ignore quiet hours while testing. It only reports what was chosen; the Soundboard does the playing.
 */
export function mountSoundPanel(controls: SoundPanelControls): { element: HTMLElement; setTheme(theme: Theme): void } {
  const buttons = make('div', 'btns');
  const render = (theme: Theme): void => {
    buttons.replaceChildren(
      ...auditions(theme).map((audition) => button(auditionLabel(audition), undefined, () => controls.play(audition))),
    );
  };

  const slider = range('soundVolume', 0, PERCENT, 1, Math.round(controls.volume * PERCENT));
  slider.setAttribute('aria-label', 'Master volume');
  const readout = make('span');
  const showVolume = (): void => {
    readout.textContent = `${slider.value}%`;
  };
  slider.addEventListener('input', () => {
    showVolume();
    controls.onVolume(Number(slider.value) / PERCENT);
  });
  showVolume();

  const ignore = checkbox('soundIgnoreQuiet', controls.ignoreQuietHours);
  const ignoreLabel = labelFor(ignore, ' Ignore quiet hours');
  ignoreLabel.prepend(ignore);
  ignore.addEventListener('change', () => controls.onIgnoreQuietHours(ignore.checked));

  const volume = make('div', 'time');
  volume.append(labelFor(slider, 'Volume'), slider, readout);

  render(controls.theme);
  return { element: group('Sound', buttons, volume, ignoreLabel), setTheme: render };
}
