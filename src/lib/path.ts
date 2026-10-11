/**
 * The main course: units of short lessons, Duolingo style, each unit ending in a song, Simply
 * Piano style. Lessons are pieces written for the course (or made on the spot by the exercise
 * generator); the coach sets how fast and how much help each one gets.
 *
 * And the daily session: a warm-up on his weakest skill, the next lesson on the path, and a short
 * review, about ten minutes, chosen fresh each day from his skill profile.
 */
import { useEffect, useState } from 'react';
import type { SongInfo } from './catalog';
import { getCourseProgress, type CourseProgress, type CourseStep } from './course';
import { COURSE_SONGS, EXERCISE_TITLE, LEVEL_NAME, levelFor, line, makeExercise, writeSong } from './exercises';
import { loadProfile, SKILLS, weakest, type SkillId } from './skills';
import { dayKey } from './stats';
import type { Song } from './types';

/** What the lesson screen needs: a song and its steps as one section. */
export interface Playable {
  id: string;
  title: string;
  /** One line under the title: why this, now. */
  why: string;
  info: SongInfo;
  section: { id: string; title: string; bars: string; from: number; steps: CourseStep[]; learnt: boolean; done: number };
}

export interface PathLesson {
  id: string;
  title: string;
  sub: string;
  kind: 'learn' | 'practice' | 'song';
  make: () => Song;
}

export interface Unit {
  id: string; title: string; sub: string; lessons: PathLesson[];
  /** A short piece that proves the unit: pass it (2 stars) to skip the unit, in the placement test or by testing out. */
  test: () => Song;
}

const drill = (skill: SkillId, level: number, seed: number) => () => makeExercise(skill, level, seed);

export const UNITS: Unit[] = [
  {
    id: 'u1', title: 'Middle C, right hand', sub: 'Read the treble clef from C to G',
    lessons: [
      { id: 'u1-cde', title: 'Meet C, D and E', sub: 'Three notes, three fingers', kind: 'learn',
        make: () => writeSong('path:u1-cde', 'Meet C, D and E', [line('C4 D4 E4 D4 C4:2 C4:2 E4 D4 C4 D4 E4:2 E4:2 D4 D4 C4:2 C4 D4 E4 D4 C4:4', 'R')]) },
      { id: 'u1-five', title: 'Five fingers: C to G', sub: 'The whole hand on its keys', kind: 'learn', make: drill('treble', 0, 101) },
      { id: 'u1-beat', title: 'Keep the beat', sub: 'Half and whole notes', kind: 'practice', make: drill('rhythm', 0, 102) },
      { id: 'u1-mary', title: 'Mary Had a Little Lamb', sub: 'Your first song', kind: 'song', make: COURSE_SONGS.mary },
      { id: 'u1-ode', title: 'Ode to Joy', sub: 'Beethoven, right hand', kind: 'song', make: COURSE_SONGS.ode },
    ],
    test: drill('treble', 1, 191),
  },
  {
    id: 'u2', title: 'Bass clef, left hand', sub: 'Read the bass clef from C to G',
    lessons: [
      { id: 'u2-cde', title: 'C, D and E in the bass', sub: 'The left hand starts', kind: 'learn',
        make: () => writeSong('path:u2-cde', 'C, D and E in the bass', [line('C3 D3 E3 D3 C3:2 C3:2 E3 D3 C3 D3 E3:2 E3:2 D3 D3 C3:2 C3 D3 E3 D3 C3:4', 'L')]) },
      { id: 'u2-five', title: 'Five fingers, left hand', sub: 'C to G in the bass clef', kind: 'learn', make: drill('bass', 0, 201) },
      { id: 'u2-lune', title: 'Au clair de la lune', sub: 'A French song, left hand', kind: 'song', make: COURSE_SONGS.lune },
      { id: 'u2-review', title: 'Bass clef review', sub: 'Wider reach, C to C', kind: 'practice', make: drill('bass', 1, 202) },
    ],
    test: drill('bass', 1, 291),
  },
  {
    id: 'u3', title: 'Hands together', sub: 'Two clefs at once',
    lessons: [
      { id: 'u3-hold', title: 'The left hand holds', sub: 'Melody over a long C', kind: 'learn', make: drill('together', 0, 301) },
      { id: 'u3-move', title: 'The left hand moves', sub: 'C and G under the tune', kind: 'learn', make: drill('together', 1, 302) },
      { id: 'u3-ode', title: 'Ode to Joy, both hands', sub: 'Your first two-hand song', kind: 'song', make: COURSE_SONGS.odeBoth },
    ],
    test: drill('together', 1, 391),
  },
  {
    id: 'u4', title: 'Eighth notes', sub: 'Two notes to a beat',
    lessons: [
      { id: 'u4-pairs', title: 'Pairs of eighths', sub: 'Count “1 and 2 and”', kind: 'learn', make: drill('eighths', 0, 401) },
      { id: 'u4-frere', title: 'Frère Jacques', sub: 'Eighths in a round', kind: 'song', make: COURSE_SONGS.frere },
      { id: 'u4-more', title: 'Eighths on the move', sub: 'Wider melodies, faster notes', kind: 'practice', make: drill('eighths', 1, 402) },
    ],
    test: drill('eighths', 1, 491),
  },
  {
    id: 'u5', title: 'Chords in the left hand', sub: 'C, F and G',
    lessons: [
      { id: 'u5-fifth', title: 'Two notes at once', sub: 'C and G together', kind: 'learn', make: drill('chords', 0, 501) },
      { id: 'u5-triads', title: 'Three-note chords', sub: 'C, F and G major', kind: 'learn', make: drill('chords', 1, 502) },
      { id: 'u5-twinkle', title: 'Twinkle, Twinkle, Little Star', sub: 'Melody over chords', kind: 'song', make: COURSE_SONGS.twinkle },
    ],
    test: drill('chords', 1, 591),
  },
  {
    id: 'u6', title: 'G major: F sharp', sub: 'Your first key signature',
    lessons: [
      { id: 'u6-sharp', title: 'Meet F sharp', sub: 'The black key in G major', kind: 'learn', make: drill('accidentals', 0, 601) },
      { id: 'u6-minuet', title: 'Minuet in G', sub: 'Petzold, both hands', kind: 'song', make: COURSE_SONGS.minuet },
    ],
    test: drill('accidentals', 0, 691),
  },
  {
    id: 'u7', title: 'Dotted rhythms and 3/4', sub: 'Long, short and waltz time',
    lessons: [
      { id: 'u7-dotted', title: 'Long, then short', sub: 'Dotted quarter and eighth', kind: 'learn', make: drill('dotted', 0, 701) },
      { id: 'u7-grace', title: 'Amazing Grace', sub: 'A hymn in three', kind: 'song', make: COURSE_SONGS.grace },
      { id: 'u7-leaps', title: 'Leaps', sub: 'Jumps across the keyboard', kind: 'practice', make: drill('leaps', 0, 702) },
    ],
    test: drill('dotted', 0, 791),
  },
];

const barsOf = (song: Song) => {
  const [num, den] = song.timeSig;
  const measure = song.ppq * 4 * (num / den);
  return Math.max(1, Math.ceil(Math.max(...song.notes.map(n => n.ticks + n.durationTicks)) / measure - 1e-6));
};

/** The steps of a course lesson: with help, on your own, in tempo (and hand by hand for two hands). */
function stepsFor(song: Song, kind: PathLesson['kind'] | 'warmup' | 'test'): CourseStep[] {
  const to = barsOf(song);
  const at = { from: 1, to };
  const one = song.hands.length === 1 ? song.hands[0] : 'both';
  const s = (id: string, title: string, hands: CourseStep['hands'], speed: number, wait: boolean): CourseStep =>
    ({ id, kind: wait ? 'phrase' : 'tempo', title, short: id, ...at, hands, speed, wait });
  if (kind === 'warmup') return [s('go', 'Warm-up', one, 0.8, true)];
  if (kind === 'test') return [s('test', 'Test', song.hands.length === 2 ? 'both' : one, 0.9, true)];
  if (song.hands.length === 2) {
    return [s('R', 'Right hand', 'R', 0.7, true), s('L', 'Left hand', 'L', 0.7, true), s('both', 'Hands together', 'both', 0.8, true), ...(kind === 'song' ? [s('tempo', 'In tempo', 'both', 1, false)] : [])];
  }
  return [s('help', 'Slowly', one, 0.7, true), s('own', 'On your own', one, 0.9, true), ...(kind === 'song' ? [s('tempo', 'In tempo', one, 1, false)] : [])];
}

function playable(id: string, title: string, why: string, song: Song, kind: PathLesson['kind'] | 'warmup' | 'test', prog: CourseProgress = {}): Playable {
  song.entry = { ...song.entry, id: `path:${id}`, title };
  const steps = stepsFor(song, kind);
  const done = steps.filter(st => (prog[st.id]?.stars ?? 0) > 0).length;
  return {
    id, title, why,
    info: { entry: song.entry, song, prog, stars: 0, total: steps.length * 3, done },
    section: { id, title, bars: `${barsOf(song)} bars`, from: 1, steps, learnt: done === steps.length, done },
  };
}

// ---------- Progress on the path ----------

export interface LessonState { stars: number; done: boolean; open: boolean; steps: number; passed: number; /** Skipped by a test. */ tested?: boolean; }

// ---------- Placement: units proved by a test count as done ----------

const PLACED = 'hugos-piano:placed';
export function placedUnits(): string[] {
  try { return JSON.parse(localStorage.getItem(PLACED) ?? '[]'); } catch { return []; }
}
export function placeUnit(id: string) {
  const all = new Set(placedUnits());
  // Proving a unit proves the ones before it too.
  for (const u of UNITS) { all.add(u.id); if (u.id === id) break; }
  try { localStorage.setItem(PLACED, JSON.stringify([...all])); } catch { /* storage unavailable */ }
  pathChanged();
}
export const placementTaken = () => { try { return localStorage.getItem(PLACED) !== null; } catch { return false; } };
export function markPlacementTaken() {
  try { if (localStorage.getItem(PLACED) === null) localStorage.setItem(PLACED, '[]'); } catch { /* ignore */ }
  pathChanged();
}
export type PathState = Record<string, LessonState>;

const listeners = new Set<() => void>();
export const pathChanged = () => listeners.forEach(fn => fn());

export async function loadPath(): Promise<{ state: PathState; progs: Record<string, CourseProgress> }> {
  const state: PathState = {};
  const progs: Record<string, CourseProgress> = {};
  let prevDone = true;
  const placed = new Set(placedUnits());
  for (const u of UNITS) {
    for (const l of u.lessons) {
      const prog = await getCourseProgress(`path:${l.id}`);
      progs[l.id] = prog;
      const n = stepsFor(l.make(), l.kind).length;
      const got = Object.values(prog).filter(r => r.stars > 0);
      const tested = placed.has(u.id) && got.length < n;
      const done = got.length >= n || tested;
      state[l.id] = { stars: got.length >= n ? Math.min(...Object.values(prog).map(r => r.stars)) : 0, done, open: prevDone || tested, steps: n, passed: got.length, tested };
      prevDone = done;
    }
  }
  return { state, progs };
}

export function usePath() {
  const [data, setData] = useState<Awaited<ReturnType<typeof loadPath>> | null>(null);
  useEffect(() => {
    let live = true;
    const load = () => loadPath().then(d => live && setData(d));
    load();
    listeners.add(load);
    return () => { live = false; listeners.delete(load); };
  }, []);
  return data;
}

export function lessonPlayable(l: PathLesson, prog?: CourseProgress): Playable {
  return playable(l.id, l.title, l.sub, l.make(), l.kind, prog);
}

/** The next lesson on the path: the first open one not done yet. */
export function nextLesson(state: PathState): PathLesson | undefined {
  return UNITS.flatMap(u => u.lessons).find(l => state[l.id]?.open && !state[l.id]?.done);
}

// ---------- The daily session ----------

const seedOfDay = (salt: number) => [...dayKey()].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, salt);

/** Today's session: warm-up on the weakest skill, the next lesson, then a short review. */
export function dailySession(state: PathState, progs: Record<string, CourseProgress>): Playable[] {
  const profile = loadProfile();
  const weak = weakest(profile);
  const name = (id: SkillId) => SKILLS.find(s => s.id === id)!.name;
  const out: Playable[] = [];
  const first: SkillId = weak[0] ?? 'treble';
  const lv = levelFor(profile[first].m);
  out.push(playable(`warm-${first}`, EXERCISE_TITLE[first],
    weak[0] ? `Your weakest skill right now: ${name(first)} (${LEVEL_NAME[lv]})` : 'A first look at how you read',
    makeExercise(first, lv, seedOfDay(1)), 'warmup'));
  const next = nextLesson(state);
  if (next) out.push({ ...lessonPlayable(next, progs[next.id]), why: `Next on your path: ${next.sub}` });
  const second: SkillId = weak[1] ?? (first === 'rhythm' ? 'treble' : 'rhythm');
  const lv2 = levelFor(profile[second].m);
  out.push(playable(`review-${second}`, EXERCISE_TITLE[second], `To keep it fresh: ${name(second)} (${LEVEL_NAME[lv2]})`,
    makeExercise(second, lv2, seedOfDay(2)), 'warmup'));
  return out;
}

/** A practice piece for any skill at his level, for the skill map's "Practise" buttons. */
export function skillPractice(skill: SkillId): Playable {
  const m = loadProfile()[skill].m;
  const lv = levelFor(m);
  return playable(`skill-${skill}`, EXERCISE_TITLE[skill], `${LEVEL_NAME[lv]} level, made for you just now`, makeExercise(skill, lv), 'warmup');
}

/** The lesson after this one on the path, if any. */
export function lessonAfter(id: string): PathLesson | undefined {
  const all = UNITS.flatMap(u => u.lessons);
  const i = all.findIndex(l => `path:${l.id}` === id || l.id === id);
  return i >= 0 ? all[i + 1] : undefined;
}

/** A unit's test as a one-step piece: passing takes 2 stars (85%). */
export function unitTest(u: Unit): Playable {
  const i = UNITS.indexOf(u);
  return playable(`test-${u.id}`, `Unit ${i + 1} test: ${u.title}`, 'Pass with 2 stars to skip this unit', u.test(), 'test');
}

/** The placement test: each unit's test in order, stopping at the first one he does not pass. */
export function placementTest(): Playable[] {
  return UNITS.map(unitTest);
}
