import { describe, expect, it } from 'vitest';
import type { ServiceWorkload, SiteInstanceWorkload, Vm, VmRole, Workload } from '../../src/contract/snapshot.ts';
import type { Cue, LabSubject, Part, PersonLook } from '../../src/contract/theme.ts';
import { GLYPHS } from '../../src/engine/pixel-font.ts';
import { CITIZEN, castSubject } from '../../src/themes/hq/cast.ts';
import { FOUNDERS } from '../../src/themes/hq/founders.ts';
import { LEGEND } from '../../src/themes/hq/legend.ts';
import { BREAK_SPOT_KINDS, LINES } from '../../src/themes/hq/lines.ts';
import { CODENAMES } from '../../src/themes/hq/looks.ts';
import { VM_BLURBS } from '../../src/themes/hq/rooms.ts';
import { HQ_SPOKEN, SOUNDSCAPE } from '../../src/themes/hq/soundscape.ts';
import { CUE_SPEAKERS } from '../../src/page/audio/voice-lines.ts';
import { officeTheme } from '../../src/themes/office/index.ts';
import { expectSaneSound } from '../support/sane-sound.ts';

/* ------------------------------------------------------------------ helpers */

function site(over: Partial<SiteInstanceWorkload> = {}): SiteInstanceWorkload {
  return {
    kind: 'site-instance',
    id: 'scrd-server-develop',
    client: 'scrd',
    site: 'server',
    env: 'develop',
    siteType: 'node-api',
    cpu: 30,
    mem: 70,
    health: 'healthy',
    ...over,
  };
}

function service(kind: ServiceWorkload['kind'], name: string): ServiceWorkload {
  return { kind, id: name, name, cpu: 10, mem: 20, health: 'healthy' };
}

function vm(role: VmRole, workloads: Workload[] = []): Vm {
  return { id: role, role, name: `sls-${role}`, up: true, cpu: 20, mem: 60, workloads };
}

const compute = vm('compute');
const cast = (workload: Workload, generation = 0) =>
  castSubject({ kind: 'workload', vm: compute, workload }, generation);
const byRole = (role: VmRole) => castSubject({ kind: 'vm', vm: vm(role) }, 0);

function person(look: { kind: string } | undefined): PersonLook {
  if (look?.kind !== 'person') throw new Error('expected a person look');
  return look as PersonLook;
}

const hasDash = (text: string): boolean => /[–—]/.test(text);
const drawable = (text: string): boolean => [...text].every((char) => char === ' ' || char in GLYPHS);

const CUES = Object.keys({
  delivery: 1,
  'new-arrival': 1,
  'health-check': 1,
  healthy: 1,
  unhealthy: 1,
  'old-one-out': 1,
  'sent-home': 1,
  'still-serving': 1,
  'backup-start': 1,
  'backup-locked': 1,
  'backup-safe': 1,
  'backup-failed': 1,
  'pods-up': 1,
  'pod-done': 1,
  recovered: 1,
  query: 1,
  'query-answer': 1,
  visitor: 1,
  greet: 1,
  'check-in-reply': 1,
  'check-in-reply-busy': 1,
  alarm: 1,
} satisfies Record<Cue, 1>) as Cue[];

/** Every subject of every casting rule, as the Office's world test covers them. */
function castBlurbs(): string[] {
  const onCompute = (workload: Workload): LabSubject => ({ kind: 'workload', vm: compute, workload });
  const subjects: LabSubject[] = [
    ...(['data', 'compute', 'deploy', 'ci'] as const).map((role): LabSubject => ({ kind: 'vm', vm: vm(role) })),
    onCompute(site({ client: 'scrd', env: 'production' })),
    onCompute(site({ client: 'scrd', env: 'develop' })),
    onCompute(site({ client: 'acme-co', env: 'production' })),
    onCompute(service('platform', 'traefik')),
    onCompute(service('platform', 'cloudflared-1')),
    onCompute(service('platform', 'cloudflared-2')),
    onCompute(service('platform', 'gatus')),
    onCompute({ kind: 'ci-pod', id: 'pod-1', cpu: 90, mem: 40 }),
  ];
  return subjects.flatMap((subject) => castSubject(subject, 0)?.blurb ?? []);
}

/* -------------------------------------------------------------------- tests */

describe('the HQ words', () => {
  it('has no em-dash or en-dash anywhere it can say', () => {
    const said = JSON.stringify([
      LINES,
      FOUNDERS,
      CITIZEN,
      LEGEND,
      VM_BLURBS,
      castBlurbs(),
      SOUNDSCAPE.spoken,
      SOUNDSCAPE.vocabulary,
    ]);
    expect(castBlurbs().length).toBeGreaterThan(8);
    expect(hasDash(said)).toBe(false);
  });

  it('gives every cue at least one non-empty line', () => {
    for (const cue of CUES) {
      const lines = LINES.cue[cue];
      expect(lines.length, cue).toBeGreaterThan(0);
      expect(
        lines.every((line) => line.length > 0),
        cue,
      ).toBe(true);
    }
  });

  it('has lines for exactly the break-spot kinds of the spec, and for every cue speaker', () => {
    expect(Object.keys(LINES.breakSpot).sort()).toEqual([...BREAK_SPOT_KINDS].sort());
    for (const kind of BREAK_SPOT_KINDS) expect(LINES.breakSpot[kind]?.length, kind).toBeGreaterThan(0);
    expect(Object.keys(CUE_SPEAKERS).sort()).toEqual([...CUES].sort());
  });

  it('speaks in capitals the pixel font can draw', () => {
    const banked = [LINES.mood, LINES.part, LINES.breakSpot, LINES.cue].flatMap((bank) => Object.values(bank).flat());
    const founders = FOUNDERS.flatMap((f) => [...f.lines.idle, ...f.lines.checkIn, ...f.lines.alarm]);
    expect(LINES.offline).toBe(LINES.offline.toUpperCase());
    for (const line of [...banked, ...founders, LINES.offline]) {
      expect(line, line).toBe(line.toUpperCase());
      expect(drawable(line), line).toBe(true);
    }
  });

  it('covers every mood and scene status the Engine can show, and the chatter the spec asks for', () => {
    expect(Object.keys(LINES.status).sort()).toEqual(Object.keys(officeTheme.lines.status).sort());
    expect(Object.keys(LINES.mood).sort()).toEqual(['stressed', 'swamped', 'working']);
    const parts: Part[] = ['guard', 'checker', 'keeper', 'courier', 'wrangler', 'pod'];
    for (const part of parts) expect(LINES.part[part]?.length, part).toBeGreaterThan(0);
  });

  it('writes the Australian way', () => {
    const said = JSON.stringify([LINES, FOUNDERS, LEGEND, VM_BLURBS, castBlurbs()]);
    expect(said).not.toMatch(/\b(color|colors|organize|center|favorite)\b/i);
  });
});

describe('the HQ cast', () => {
  it('casts the VMs by role', () => {
    expect(byRole('data')?.part).toBe('keeper');
    expect(byRole('data')?.blurb).toBe(VM_BLURBS.data);
    expect(byRole('ci')?.part).toBe('wrangler');
    expect(person(byRole('ci')?.look).carry).toBe('tablet');
    expect(byRole('deploy')?.part).toBe('courier');
    expect(person(byRole('deploy')?.look).hairStyle).toBe('hardhat');
    expect(byRole('compute')).toBeNull();
  });

  it('masks every sworn hero and leaves the rookies, founders and citizens bare', () => {
    const sworn = [
      byRole('data'),
      byRole('ci'),
      byRole('deploy'),
      cast(site()),
      cast(site({ env: 'production' })),
      cast(service('platform', 'traefik')),
      cast(service('platform', 'cloudflared-1')),
      cast(service('platform', 'gatus')),
    ];
    for (const casting of sworn) expect(person(casting?.look).glasses, casting?.blurb).toBe(true);
    expect(person(cast({ kind: 'ci-pod', id: 'pod-1', cpu: 1, mem: 1 })?.look).glasses).toBeUndefined();
    for (const founder of FOUNDERS) {
      if (founder.look.kind === 'person') expect(founder.look.glasses).toBeUndefined();
    }
    expect(person(CITIZEN.look(0.4)).glasses).toBeUndefined();
  });

  it('casts a site instance as a hero in its squad colour, with a codename and the full names in the blurb', () => {
    const casting = cast(site());
    expect(casting?.part).toBe('worker');
    expect(person(casting?.look).shirt).toBe('#e0563f');
    expect(casting?.blurb).toMatch(
      /^[A-Z]+ of the SCRD squad: server \(node-api\), develop, a container on sls-compute$/,
    );
    expect(cast(site({ client: 'forms-api' }))?.blurb).toContain('Forms API squad');
  });

  it('picks a codename from the list by workload id, so it survives a deploy', () => {
    const name = (generation: number) => cast(site(), generation)?.blurb.split(' ')[0] ?? '';
    expect(CODENAMES).toContain(name(0));
    expect(new Set([0, 1, 2, 3].map(name)).size).toBe(1);
    const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => cast(site({ id }))?.blurb.split(' ')[0]);
    expect(new Set(names).size).toBeGreaterThan(1);
  });

  it('dresses staging with a steel collar and production as a veteran with the client on the chest', () => {
    const develop = person(cast(site({ client: 'acme-co' }))?.look);
    const staging = person(cast(site({ client: 'acme-co', env: 'staging' }))?.look);
    const prod = person(cast(site({ client: 'acme-co', env: 'production' }))?.look);
    expect(develop.shirt).toBe(person(cast(site({ client: 'acme-co', id: 'other' }))?.look).shirt);
    expect(develop.shirt).not.toBe('#e0563f');
    expect(develop.trim).toBeUndefined();
    expect(staging.shirt).toBe(develop.shirt);
    expect(staging.trim).toBeDefined();
    expect(prod.tie).toBe(develop.shirt);
    expect(prod.shirt).toBe('#1d2740');
    expect(prod.trim).toBe('#e2b84a');
  });

  it('changes the face but not the suit when the workload is redeployed', () => {
    const looks = [0, 1, 2, 3, 4, 5].map((g) => person(cast(site(), g)?.look));
    expect(new Set(looks.map((l) => l.shirt)).size).toBe(1);
    expect(new Set(looks.map((l) => `${l.skin}/${l.hair}/${l.hairStyle}`)).size).toBeGreaterThan(1);
    expect(person(cast(site(), 3)?.look)).toEqual(person(cast(site(), 3)?.look));
  });

  it('casts the platform containers by name and leaves the rest without a character', () => {
    const board = cast(service('platform', 'traefik'));
    expect(board?.part).toBe('greeter');
    expect(person(board?.look).headset).toBe(true);
    const ping = cast(service('platform', 'cloudflared-1'));
    const pong = cast(service('platform', 'cloudflared-2'));
    expect(ping?.part).toBe('guard');
    expect(pong?.part).toBe('guard');
    expect(person(ping?.look).cap).toBe('#f38020');
    expect(person(ping?.look).wide).toBe(true);
    expect(ping?.blurb).toContain('Ping');
    expect(pong?.blurb).toContain('Pong');
    const medic = cast(service('platform', 'gatus'));
    expect(medic?.part).toBe('checker');
    expect(person(medic?.look).carry).toBe('clipboard');
    expect(cast(service('platform', 'watchtower'))).toBeNull();
    expect(cast(service('engine', 'postgres'))).toBeNull();
    expect(cast(service('runner', 'runner-1'))).toBeNull();
  });

  it('casts a CI pod as a rookie, varied by its id', () => {
    const rookie = cast({ kind: 'ci-pod', id: 'pod-1', cpu: 90, mem: 40 });
    expect(rookie?.part).toBe('pod');
    expect(rookie?.blurb).toContain('sls-compute');
    const faces = ['pod-1', 'pod-2', 'pod-3', 'pod-4', 'pod-5'].map((id) => {
      const look = person(cast({ kind: 'ci-pod', id, cpu: 1, mem: 1 })?.look);
      return `${look.skin}/${look.hair}/${look.hairStyle}`;
    });
    expect(new Set(faces).size).toBeGreaterThan(1);
  });

  it('casts the same parts as the Office for every VM role and workload kind', () => {
    const subjects: LabSubject[] = [
      ...(['data', 'compute', 'deploy', 'ci'] as const).map((role): LabSubject => ({ kind: 'vm', vm: vm(role) })),
      ...[
        site(),
        service('platform', 'traefik'),
        service('platform', 'cloudflared-2'),
        service('platform', 'gatus'),
        service('platform', 'watchtower'),
        service('engine', 'postgres'),
        service('runner', 'runner-1'),
        { kind: 'ci-pod' as const, id: 'pod-1', cpu: 1, mem: 1 },
      ].map((workload): LabSubject => ({ kind: 'workload', vm: compute, workload })),
    ];
    for (const subject of subjects) {
      expect(castSubject(subject, 0)?.part ?? null).toBe(officeTheme.cast(subject, 0)?.part ?? null);
    }
  });
});

describe('the HQ founders', () => {
  it('puts JARVIS first, as a small amber remote, then Paul and Dhruv as people', () => {
    expect(FOUNDERS.map((f) => f.id)).toEqual(['jarvis', 'paul', 'dhruv']);
    const [jarvis, paul, dhruv] = FOUNDERS;
    expect(jarvis?.look).toEqual({ kind: 'box', colour: '#ffa733', w: 8, h: 8 });
    expect(person(paul?.look).hairStyle).toBe('thin');
    expect(person(paul?.look).wide).toBe(true);
    expect(person(dhruv?.look).shirt).toBe('#2f8f5b');
  });

  it('keeps the Office lines for Paul and Dhruv and gives JARVIS its own', () => {
    const lines = (id: string) => FOUNDERS.find((f) => f.id === id)?.lines;
    for (const id of ['paul', 'dhruv']) {
      expect(lines(id), id).toEqual(officeTheme.founders.find((f) => f.id === id)?.lines);
    }
    expect(lines('jarvis')?.idle.length).toBeGreaterThanOrEqual(4);
    expect(lines('jarvis')?.checkIn.length).toBeGreaterThanOrEqual(3);
    expect(lines('jarvis')?.alarm.length).toBeGreaterThanOrEqual(2);
  });

  it('shows the citizen as a person with a blurb', () => {
    expect(CITIZEN.title).toBe('Citizen');
    expect(CITIZEN.look(0.4).kind).toBe('person');
    expect(CITIZEN.look(1).kind).toBe('person');
  });
});

describe('the HQ legend', () => {
  it('labels every entry once, in a hex colour, with JARVIS last', () => {
    expect(new Set(LEGEND.map((entry) => entry.label)).size).toBe(LEGEND.length);
    for (const entry of LEGEND) {
      expect(entry.colour).toMatch(/^#[0-9a-f]{6}$/i);
      expect(entry.label.length).toBeGreaterThan(0);
    }
    expect(LEGEND.at(-1)).toEqual({ colour: '#ffa733', label: 'JARVIS' });
  });
});

describe('the HQ soundscape', () => {
  const { voices, vocabulary, spoken } = SOUNDSCAPE;
  const allVoices = [voices?.default, ...Object.values(voices?.parts ?? {}), ...Object.values(voices?.founders ?? {})];

  it('defines an Alarm, Reminder and All-clear of sane notes, each different', () => {
    expectSaneSound(SOUNDSCAPE.alarm);
    expectSaneSound(SOUNDSCAPE.reminder);
    expectSaneSound(SOUNDSCAPE.allClear);
    expect(SOUNDSCAPE.alarm).not.toEqual(SOUNDSCAPE.reminder);
    expect(SOUNDSCAPE.alarm).not.toEqual(SOUNDSCAPE.allClear);
    expect(SOUNDSCAPE.reminder).not.toEqual(SOUNDSCAPE.allClear);
  });

  it('sounds the Alarm as three downward klaxon whoops, never shrill', () => {
    const notes = SOUNDSCAPE.alarm.notes;
    expect(notes).toHaveLength(3);
    for (const note of notes) {
      expect(note.wave).toBe('sawtooth');
      expect(note.endHz).toBeLessThan(note.startHz);
      expect(note.startHz).toBeLessThanOrEqual(650);
    }
  });

  it('gives every stage effect a sane sound', () => {
    const effects = Object.entries(SOUNDSCAPE.effects ?? {});
    expect(effects.length).toBeGreaterThanOrEqual(13);
    for (const [, sound] of effects) expectSaneSound(sound);
  });

  it('has valid Voices, unique by id, with JARVIS the announcer', () => {
    const ids = allVoices.map((voice) => voice?.id);
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
    const defined = allVoices.flatMap((voice) => (voice ? [voice] : []));
    const distinct = new Map(defined.map((voice) => [voice.id, voice]));
    // A Voice is shared only as the same object content: the same id never means two different Voices.
    for (const voice of defined) expect(distinct.get(voice.id)).toEqual(voice);
    for (const voice of defined) {
      expect(voice.rate).toBeGreaterThanOrEqual(0.5);
      expect(voice.rate).toBeLessThanOrEqual(2);
      expect(voice.pitch).toBeGreaterThanOrEqual(0);
      expect(voice.pitch).toBeLessThanOrEqual(2);
      expect(voice.lang).toBe('en-AU');
      expect(voice.piper?.model).toBe('en_US-libritts-high');
      expect(Number.isInteger(voice.piper?.speaker)).toBe(true);
    }
    const jarvis = voices?.founders?.jarvis;
    expect(jarvis).toMatchObject({ id: 'founder-jarvis', rate: 0.95, pitch: 0.9 });
    // The only new Voice: everything else is the Office's, so its clips are shared.
    const officeIds = new Set(
      [
        officeTheme.soundscape?.voices?.default,
        ...Object.values(officeTheme.soundscape?.voices?.parts ?? {}),
        ...Object.values(officeTheme.soundscape?.voices?.founders ?? {}),
      ].map((voice) => voice?.id),
    );
    expect([...distinct.keys()].filter((id) => !officeIds.has(id))).toEqual(['founder-jarvis']);
    for (const founder of FOUNDERS) expect(voices?.founders?.[founder.id], founder.id).toBeDefined();
  });

  it('names every Part and VM room in the HQ words, in lower case', () => {
    expect(vocabulary?.parts).toEqual({
      worker: 'the hero on watch',
      pod: 'the rookie',
      greeter: 'dispatch',
      guard: 'the gatekeeper',
      checker: 'the medic',
      keeper: 'the archivist',
      courier: 'the quartermaster',
      wrangler: 'the drill instructor',
    });
    expect(vocabulary?.rooms).toEqual({
      ci: 'the rookie bay',
      data: 'the archive vault',
      compute: 'the ops floor',
      deploy: 'the hangar',
    });
    expect(vocabulary?.numbers).toEqual(officeTheme.soundscape?.vocabulary?.numbers);
    expect(vocabulary?.phrases).toEqual(officeTheme.soundscape?.vocabulary?.phrases);
    const words = [...Object.values(vocabulary?.parts ?? {}), ...Object.values(vocabulary?.rooms ?? {})];
    for (const word of words) expect(word).toBe(word.toLowerCase());
  });

  it('spells out every symbol, digit and ellipsis it says, in lower case', () => {
    const banked = [LINES.mood, LINES.part, LINES.breakSpot, LINES.cue].flatMap((bank) => Object.values(bank).flat());
    const founders = FOUNDERS.flatMap((f) => [...f.lines.idle, ...f.lines.checkIn, ...f.lines.alarm]);
    const needsWords = (line: string): boolean => /[0-9*#_/:]|\.\.\.|^[^A-Z]+$/.test(line);
    for (const line of [...banked, ...founders].filter(needsWords)) {
      expect(spoken?.[line], line).toBeDefined();
    }
    for (const [line, words] of Object.entries(spoken ?? {})) expect(words, line).toBe(words.toLowerCase());
    // Every override the HQ adds is for a line it actually has.
    for (const line of Object.keys(HQ_SPOKEN)) expect(banked, line).toContain(line);
  });
});
