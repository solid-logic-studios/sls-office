import type { SimCommand, VmControl } from '../simulator/commands.ts';
import { PRESET_IDS, PRESET_NAMES } from '../simulator/presets.ts';
import type { Simulator } from '../simulator/simulator.ts';
import { formatHour, localHour } from './clock.ts';

export interface ControlRoomOptions {
  /** `null` means follow the local clock. */
  onHour(hour: number | null): void;
  /** More groups for the end of the control room, built by the caller (the Sound panel), which it knows nothing of. */
  extra?: readonly HTMLElement[];
}

interface Action {
  label: string;
  command: SimCommand;
  bad?: boolean;
}

const ACTIONS: readonly Action[] = [
  { label: 'Deploy (success)', command: { kind: 'deploy', outcome: 'healthy' } },
  { label: 'Deploy (rollback)', command: { kind: 'deploy', outcome: 'rolled-back' } },
  { label: 'CI job burst', command: { kind: 'ci-burst' } },
  { label: 'Backup run', command: { kind: 'backup' } },
  { label: 'OOM a random worker', command: { kind: 'oom' }, bad: true },
  { label: 'VM down', command: { kind: 'vm-down' }, bad: true },
];

/** The backup preset runs at half past two in the morning, so the sky should match. */
const BACKUP_HOUR = 2.5;

export function make<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className !== undefined) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

export function labelFor(input: HTMLInputElement, text: string, className?: string): HTMLLabelElement {
  const label = make('label', className, text);
  label.htmlFor = input.id;
  return label;
}

export function range(id: string, min: number, max: number, step: number, value: number): HTMLInputElement {
  const input = make('input');
  input.type = 'range';
  input.id = id;
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  return input;
}

export function checkbox(id: string, checked: boolean): HTMLInputElement {
  const input = make('input');
  input.type = 'checkbox';
  input.id = id;
  input.checked = checked;
  return input;
}

export function button(label: string, className: string | undefined, onClick: () => void): HTMLButtonElement {
  const element = make('button', className, label);
  element.type = 'button';
  element.addEventListener('click', onClick);
  return element;
}

export function group(title: string, ...children: HTMLElement[]): HTMLElement {
  const element = make('div', 'grp');
  element.append(make('span', 'lab', title), ...children);
  return element;
}

/** One VM card: an up checkbox plus CPU and MEM target sliders. */
class VmCard {
  readonly element = make('div', 'vm');
  private readonly up: HTMLInputElement;
  private readonly cpu: HTMLInputElement;
  private readonly mem: HTMLInputElement;
  private readonly cpuOut = make('span');
  private readonly memOut = make('span');

  constructor(
    control: VmControl,
    private readonly dispatch: (command: SimCommand) => void,
  ) {
    const { id } = control;
    this.up = checkbox(`up-${id}`, control.up);
    this.cpu = range(`cpu-${id}`, 0, 100, 1, control.cpu);
    this.mem = range(`mem-${id}`, 0, 100, 1, control.mem);
    const upLabel = labelFor(this.up, ' up', 'up');
    upLabel.prepend(this.up);
    this.element.append(
      make('span', 'nm', control.name),
      upLabel,
      labelFor(this.cpu, 'CPU'),
      this.cpu,
      this.cpuOut,
      labelFor(this.mem, 'MEM'),
      this.mem,
      this.memOut,
    );
    this.up.addEventListener('change', () => this.dispatch({ kind: 'set-up', vmId: id, up: this.up.checked }));
    for (const slider of [this.cpu, this.mem]) {
      slider.addEventListener('input', () => {
        this.showReadouts();
        this.dispatch({ kind: 'set-load', vmId: id, cpu: Number(this.cpu.value), mem: Number(this.mem.value) });
      });
    }
    this.showReadouts();
  }

  /** Leaves a slider alone while it is being dragged. */
  update(control: VmControl): void {
    this.up.checked = control.up;
    if (document.activeElement !== this.cpu) this.cpu.value = String(control.cpu);
    if (document.activeElement !== this.mem) this.mem.value = String(control.mem);
    this.showReadouts();
  }

  private showReadouts(): void {
    this.cpuOut.textContent = `${this.cpu.value}%`;
    this.memOut.textContent = `${this.mem.value}%`;
  }
}

/** The time-of-day controls; it only reports the hour, it does not know what the sky does with it. */
class TimeOfDay {
  readonly element: HTMLElement;
  private readonly local = checkbox('tLocal', true);
  private readonly hour = range('tHour', 0, 23.75, 0.25, 12);
  private readonly label = make('span');

  constructor(private readonly onHour: ControlRoomOptions['onHour']) {
    this.hour.disabled = true;
    this.hour.setAttribute('aria-label', 'Hour of day');
    const localLabel = labelFor(this.local, ' Use local clock');
    localLabel.prepend(this.local);
    const row = make('div', 'time');
    row.append(localLabel, this.hour, this.label);
    this.element = group('Time of day (the window sky)', row);
    this.local.addEventListener('change', () => this.apply());
    this.hour.addEventListener('input', () => this.apply());
    this.apply();
  }

  /** Pins the sky to a fixed hour (and moves the slider to match). */
  set(hour: number): void {
    this.local.checked = false;
    this.hour.value = String(hour);
    this.apply();
  }

  /** Keeps the read-out current while following the local clock. */
  refresh(): void {
    if (this.local.checked) this.label.textContent = `${formatHour(localHour(new Date()))} (local)`;
  }

  private apply(): void {
    const following = this.local.checked;
    this.hour.disabled = following;
    this.label.textContent = following
      ? `${formatHour(localHour(new Date()))} (local)`
      : formatHour(Number(this.hour.value));
    this.onHour(following ? null : Number(this.hour.value));
  }
}

/** Builds the control room into `container`. Every action is a SimCommand; no lab logic lives here. */
export function mountControlRoom(
  container: HTMLElement,
  simulator: Pick<Simulator, 'dispatch' | 'controls'>,
  options: ControlRoomOptions,
): { refresh(): void } {
  const send = (command: SimCommand): void => simulator.dispatch(command);
  const time = new TimeOfDay(options.onHour);
  const cards = new Map<string, VmCard>();

  const refresh = (): void => {
    for (const control of simulator.controls()) cards.get(control.id)?.update(control);
    time.refresh();
  };

  const presets = make('div', 'btns');
  for (const preset of PRESET_IDS) {
    presets.append(
      button(PRESET_NAMES[preset], 'go', () => {
        send({ kind: 'preset', preset });
        if (preset === 'backup') time.set(BACKUP_HOUR);
        refresh();
      }),
    );
  }

  const actions = make('div', 'btns');
  for (const { label, command, bad } of ACTIONS) {
    actions.append(
      button(label, bad ? 'bad' : undefined, () => {
        send(command);
        refresh();
      }),
    );
  }

  const vms = make('div', 'vms');
  for (const control of simulator.controls()) {
    const card = new VmCard(control, send);
    cards.set(control.id, card);
    vms.append(card.element);
  }

  const inner = make('div', 'in');
  inner.append(
    group('Presets', presets),
    group('Make something happen', actions),
    group('VM load', vms),
    time.element,
    ...(options.extra ?? []),
  );

  const details = make('details', 'console px');
  details.open = window.innerWidth >= 720;
  details.append(make('summary', undefined, 'Control room (simulated data)'), inner);
  container.append(details);

  return { refresh };
}
