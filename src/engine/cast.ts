import type { Vm } from '../contract/snapshot.ts';
import type { Founder as FounderData, LabSubject, Part, Place, Spot } from '../contract/theme.ts';
import type { Anchor } from './bubbles.ts';
import type { Character } from './characters/character.ts';
import { DeskWorker } from './characters/desk-worker.ts';
import { createCharacter } from './characters/factory.ts';
import { Founder } from './characters/founder.ts';
import { Visitor } from './characters/visitor.ts';
import { Homes } from './homes.ts';
import { titleOf } from './tips.ts';
import type { World } from './world.ts';

function subjectKey(subject: LabSubject): string {
  return subject.kind === 'vm' ? `vm:${subject.vm.id}` : `workload:${subject.workload.id}`;
}

function spotOf(place: Place): Spot {
  return { x: place.seat.x, floor: place.floor };
}

/**
 * Everyone on the stage, and who stands for what. It reconciles the cast with each Snapshot: new
 * subjects get a character and a home, refreshed ones get their new numbers, and departed ones retire.
 */
export class Cast {
  readonly homes: Homes;
  private everyone: Character[] = [];
  /** The current character for each lab subject. */
  private readonly bySubject = new Map<string, Character>();
  /** The highest generation cast so far for each workload, so every newcomer looks like somebody new. */
  private readonly generations = new Map<string, number>();
  private readonly unsubscribe: readonly (() => void)[];
  private visitorSerial = 0;

  constructor(private readonly world: World) {
    this.homes = new Homes(world.theme.layout.homes);
    this.unsubscribe = [
      world.bus.subscribe('oom', (event) => this.forWorkload(event.subject)?.faint()),
      world.bus.subscribe('visitor', (event) => this.byId(event.targetId)?.visited()),
      world.bus.subscribe('check-in', (event) => this.byId(event.toId)?.checkedIn()),
    ];
  }

  /** Puts the Theme's founders at their desks. The Stage calls this once it is fully built. */
  seatFounders(): void {
    for (const founder of this.world.theme.founders) this.addFounder(founder);
  }

  /* -------------------------------------------------------------- queries */

  list(): readonly Character[] {
    return this.everyone;
  }

  byId(id: string): Character | undefined {
    return this.everyone.find((character) => character.id === id);
  }

  forWorkload(workloadId: string): Character | undefined {
    return this.bySubject.get(`workload:${workloadId}`);
  }

  /** The first character playing `part` who is in the Office, if any. */
  lead(part: Part): Character | undefined {
    return this.everyone.find((character) => character.part === part && character.present && !character.retiring);
  }

  ofPart(part: Part): readonly Character[] {
    return this.everyone.filter((character) => character.part === part);
  }

  /** Site workers at their desks, well and in no scene. */
  availableWorkers(): readonly DeskWorker[] {
    return this.everyone.filter(
      (character): character is DeskWorker =>
        character instanceof DeskWorker && character.part === 'worker' && character.available,
    );
  }

  visitorCount(): number {
    return this.everyone.filter((character) => character instanceof Visitor && !character.gone).length;
  }

  /** Where a visible character is, for bubbles and flying paper. */
  locate(id: string): Anchor | null {
    const character = this.byId(id);
    if (character === undefined || !character.visible) return null;
    return { x: character.x, y: character.y, lying: character.pose === 'faint' };
  }

  /* ---------------------------------------------------------- reconciling */

  /** Refreshes the characters that stay, retires the ones whose subject is gone, then casts the new subjects. */
  reconcile(vms: readonly Vm[], announce: boolean): void {
    const keys = new Set<string>();
    const arrivals: LabSubject[] = [];
    for (const vm of vms) {
      this.refresh({ kind: 'vm', vm }, announce, keys, arrivals);
      if (!vm.up) {
        this.keepAway(vm, announce, keys);
        continue;
      }
      for (const workload of vm.workloads) this.refresh({ kind: 'workload', vm, workload }, announce, keys, arrivals);
    }
    for (const [key, character] of this.bySubject) {
      if (keys.has(key)) continue;
      this.bySubject.delete(key);
      character.retire();
    }
    for (const subject of arrivals) this.place(subject, announce);
  }

  /** A deploy's newcomer for a workload: the next generation, standing at `at`, with no home yet. */
  newcomer(workloadId: string, at: Spot): Character | null {
    const subject = this.forWorkload(workloadId)?.subject;
    if (subject?.kind !== 'workload') return null;
    const generation = (this.generations.get(workloadId) ?? 0) + 1;
    const casting = this.world.theme.cast(subject, generation);
    if (casting === null) return null;
    this.generations.set(workloadId, generation);
    const character = createCharacter(this.world, casting.part, {
      id: `${workloadId}#${generation}`,
      part: casting.part,
      title: titleOf(subject),
      blurb: casting.blurb,
      look: casting.look,
      subject,
      home: null,
      start: at,
    });
    this.everyone.push(character);
    character.settleIn(false);
    return character;
  }

  /** The newcomer takes over the old character's subject and home, for good. */
  handover(from: Character, to: Character): void {
    const subject = from.subject;
    if (subject !== null && subject.kind !== 'founder') this.bySubject.set(subjectKey(subject), to);
    const place = from.home;
    from.home = null;
    if (place === null) return;
    to.home = place;
    this.homes.occupy(place, to);
  }

  addVisitor(target: DeskWorker, hosts: readonly Character[]): void {
    const { visitor } = this.world.theme;
    this.visitorSerial += 1;
    const character = new Visitor(
      this.world,
      {
        id: `visitor-${this.visitorSerial}`,
        part: null,
        title: visitor.title,
        blurb: visitor.blurb,
        look: visitor.look(this.world.random.next()),
        subject: null,
        home: null,
        start: this.world.theme.layout.entrance,
      },
      target,
      hosts,
    );
    this.everyone.push(character);
  }

  /* --------------------------------------------------------------- frame */

  update(dt: number): void {
    for (const character of [...this.everyone]) character.update(dt);
    if (!this.everyone.some((character) => character.gone)) return;
    for (const character of this.everyone) {
      if (!character.gone) continue;
      character.dispose();
      if (character.home !== null) this.homes.vacate(character.home, character);
      const subject = character.subject;
      if (subject !== null && subject.kind !== 'founder') {
        const key = subjectKey(subject);
        if (this.bySubject.get(key) === character) this.bySubject.delete(key);
      }
    }
    this.everyone = this.everyone.filter((character) => !character.gone);
  }

  dispose(): void {
    for (const unsubscribe of this.unsubscribe) unsubscribe();
  }

  /* ------------------------------------------------------------- private */

  private addFounder(founder: FounderData): void {
    const home = this.homes.free('founder');
    if (home === null) return;
    const character = new Founder(
      this.world,
      {
        id: founder.id,
        part: 'founder',
        title: founder.name,
        blurb: founder.blurb,
        look: founder.look,
        subject: { kind: 'founder', founder },
        home,
        start: spotOf(home),
      },
      founder,
    );
    this.homes.occupy(home, character);
    this.everyone.push(character);
    character.settleIn(false);
  }

  /** Notes that a subject is in this Snapshot. Its character, if it has one, takes the new numbers. */
  private refresh(subject: LabSubject, announce: boolean, keys: Set<string>, arrivals: LabSubject[]): void {
    const key = subjectKey(subject);
    keys.add(key);
    const existing = this.bySubject.get(key);
    if (existing === undefined) {
      arrivals.push(subject);
      return;
    }
    existing.subject = subject;
    existing.refreshMood(announce);
  }

  private place(subject: LabSubject, announce: boolean): void {
    const id = subject.kind === 'vm' ? subject.vm.id : subject.workload.id;
    const generation = subject.kind === 'workload' ? (this.generations.get(id) ?? 0) : 0;
    const casting = this.world.theme.cast(subject, generation);
    if (casting === null) return;
    const home = this.homes.free(casting.part);
    if (home === null) return;
    const character = createCharacter(this.world, casting.part, {
      id: generation > 0 ? `${id}#${generation}` : id,
      part: casting.part,
      title: titleOf(subject),
      blurb: casting.blurb,
      look: casting.look,
      subject,
      home,
      start: spotOf(home),
    });
    this.homes.occupy(home, character);
    this.bySubject.set(subjectKey(subject), character);
    this.everyone.push(character);
    character.settleIn(announce);
  }

  /** A down VM no longer reports its workloads: keep their characters, absent, with the VM's new state. */
  private keepAway(vm: Vm, announce: boolean, keys: Set<string>): void {
    for (const [key, character] of this.bySubject) {
      const subject = character.subject;
      if (subject?.kind !== 'workload' || subject.vm.id !== vm.id) continue;
      keys.add(key);
      character.subject = { ...subject, vm };
      character.refreshMood(announce);
    }
  }
}
