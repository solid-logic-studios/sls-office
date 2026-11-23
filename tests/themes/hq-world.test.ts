import { describe, expect, it } from 'vitest';
import type { ServiceWorkload, SiteInstanceWorkload, Vm, VmRole, Workload } from '../../src/contract/snapshot.ts';
import type { Cue, LabSubject, Part, PersonLook } from '../../src/contract/theme.ts';
import { GLYPHS } from '../../src/engine/pixel-font.ts';
import { CITIZEN, castSubject } from '../../src/themes/hq/cast.ts';
import { FOUNDERS } from '../../src/themes/hq/founders.ts';
import { LEGEND } from '../../src/themes/hq/legend.ts';
import { BREAK_SPOT_KINDS, LINES } from '../../src/themes/hq/lines.ts';
import { HEROES, POSTS, ROOKIES, SQUADS, RESERVES } from '../../src/themes/hq/avengers.ts';
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

  it('speaks of the Avengers and no longer of the Nines', () => {
    expect(LINES.cue['pods-up']).toEqual(['ROOKIES, ASSEMBLE!']);
    expect(LINES.cue.alarm).toContain('AVENGERS, ASSEMBLE!');
    expect(LINES.cue['backup-start']).toEqual(['02:30. HULK FLY JET.']);
    expect(JSON.stringify(LINES)).not.toMatch(/MARK|MUSTER|SUIT UP!/);
  });

  it('writes the Australian way', () => {
    const said = JSON.stringify([LINES, FOUNDERS, LEGEND, VM_BLURBS, castBlurbs()]);
    expect(said).not.toMatch(/\b(color|colors|organize|center|favorite)\b/i);
  });
});

describe('the HQ cast', () => {
  it('casts the VMs by role, each with its hero', () => {
    expect(byRole('data')?.part).toBe('keeper');
    expect(byRole('data')?.blurb).toBe(VM_BLURBS.data);
    expect(byRole('data')?.look).toBe(POSTS.keeper.look);
    expect(byRole('ci')?.part).toBe('wrangler');
    expect(byRole('ci')?.look).toBe(POSTS.wrangler.look);
    expect(byRole('ci')?.blurb).toContain('Captain America');
    expect(byRole('deploy')?.part).toBe('courier');
    expect(byRole('deploy')?.look).toBe(POSTS.courier.look);
    expect(byRole('compute')).toBeNull();
  });

  it('names every hero in its tooltip', () => {
    expect(byRole('data')?.blurb).toContain('Hulk');
    expect(byRole('deploy')?.blurb).toContain('Thor');
    expect(cast(service('platform', 'traefik'))?.blurb).toContain('Nick Fury');
    expect(cast(service('platform', 'cloudflared-1'))?.blurb).toContain('Hawkeye');
    expect(cast(service('platform', 'cloudflared-2'))?.blurb).toContain('Kate Bishop');
    expect(cast(service('platform', 'gatus'))?.blurb).toContain('Black Widow');
    for (const [client, squad] of Object.entries(SQUADS)) {
      const w = site({ client, id: `${client}-x`, env: 'production' });
      const onVm = { ...compute, workloads: [w] };
      const casting = castSubject({ kind: 'workload', vm: onVm, workload: w }, 0);
      expect(casting?.blurb, client).toContain(squad[0].name);
    }
  });

  it('casts a site instance as the squad hero on its station, leader first on the senior environment', () => {
    const w = site({ client: 'scrd', env: 'production' });
    const casting = castSubject({ kind: 'workload', vm: { ...compute, workloads: [w] }, workload: w }, 0);
    expect(casting?.part).toBe('worker');
    expect(casting?.look).toBe(SQUADS.scrd[0].look);
    expect(casting?.blurb).toBe(
      'Iron Man, leading the SCRD squad: server (node-api), production, a container on sls-compute',
    );
    const staging = site({ client: 'scrd', env: 'staging', id: 'scrd-staging' });
    const both = { ...compute, workloads: [w, staging] };
    expect(castSubject({ kind: 'workload', vm: both, workload: staging }, 0)?.blurb).toMatch(
      /^Scarlet Witch of the SCRD squad: server \(node-api\), staging, a container on sls-compute$/,
    );
    expect(cast(site({ client: 'forms-api' }))?.blurb).toContain('Forms API squad');
  });

  it('puts an unknown client on the reserves', () => {
    const casting = cast(site({ client: 'acme-co' }));
    expect(RESERVES.map((hero) => hero.look)).toContain(casting?.look);
    expect(casting?.blurb).toContain('acme-co squad');
  });

  it('tags a different hero in when the workload is redeployed', () => {
    const looks = [0, 1, 2].map((g) => cast(site(), g)?.look);
    expect(looks[1]).not.toBe(looks[0]);
    expect(cast(site(), 2)).toEqual(cast(site(), 2));
  });

  it('casts the platform containers by name and leaves the rest without a character', () => {
    const board = cast(service('platform', 'traefik'));
    expect(board?.part).toBe('greeter');
    expect(board?.look).toBe(POSTS.greeter.look);
    const first = cast(service('platform', 'cloudflared-1'));
    const second = cast(service('platform', 'cloudflared-2'));
    expect(first?.part).toBe('guard');
    expect(second?.part).toBe('guard');
    expect(first?.look).toBe(POSTS.guards[0].look);
    expect(second?.look).toBe(POSTS.guards[1].look);
    const widow = cast(service('platform', 'gatus'));
    expect(widow?.part).toBe('checker');
    expect(widow?.look).toBe(POSTS.checker.look);
    expect(cast(service('platform', 'watchtower'))).toBeNull();
    expect(cast(service('engine', 'postgres'))).toBeNull();
    expect(cast(service('runner', 'runner-1'))).toBeNull();
  });

  it('casts a CI pod as one of the rookies, picked by its id', () => {
    const rookie = cast({ kind: 'ci-pod', id: 'pod-1', cpu: 90, mem: 40 });
    expect(rookie?.part).toBe('pod');
    expect(rookie?.blurb).toContain('sls-compute');
    const names = ROOKIES.map((r) => r.name);
    const ids = ['pod-1', 'pod-2', 'pod-3', 'pod-4', 'pod-5', 'pod-6'];
    const blurbs = ids.map((id) => cast({ kind: 'ci-pod', id, cpu: 1, mem: 1 })?.blurb ?? '');
    for (const blurb of blurbs)
      expect(
        names.some((name) => blurb.startsWith(name)),
        blurb,
      ).toBe(true);
    expect(new Set(blurbs.map((b) => b.split(',')[0])).size).toBeGreaterThan(1);
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

  it('gives Paul and Dhruv their Office faces and colours, each with the arc reactor', () => {
    for (const id of ['paul', 'dhruv']) {
      const mine = person(FOUNDERS.find((f) => f.id === id)?.look);
      const theirs = person(officeTheme.founders.find((f) => f.id === id)?.look);
      expect({ ...mine, emblem: undefined }).toEqual({ ...theirs, emblem: undefined });
      expect(mine.emblem?.glow, id).toBeDefined();
    }
    expect(FOUNDERS[0]?.id).toBe('jarvis');
    expect(person(FOUNDERS[1]?.look).emblem).toEqual(person(FOUNDERS[2]?.look).emblem);
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
  it('names the squad leaders and the posts in the Avengers words', () => {
    const labels = LEGEND.map((entry) => entry.label);
    expect(labels).toContain('SCRD squad: Iron Man leads');
    expect(labels).toContain('Nick Fury: Traefik');
    expect(labels).toContain('The Hawkeyes: cloudflared x2');
    expect(labels).toContain('Captain America: the autoscaler');
    expect(labels.join(' ')).not.toMatch(/Switchboard|Vitals|Ledger|Payload|Muster|Tunnel Twins/);
  });

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
      worker: 'the avenger on watch',
      pod: 'the rookie',
      greeter: 'nick fury',
      guard: 'hawkeye',
      checker: 'black widow',
      keeper: 'the hulk',
      courier: 'thor',
      wrangler: 'the captain',
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
