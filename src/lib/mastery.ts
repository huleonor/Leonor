/**
 * Mastery: how well he knows one song, and the lesson that will teach it fastest next.
 *
 * Every note he plays is a measurement: right first time or not, what he played instead, how long
 * he paused before it, and with the beat whether it came in time. Each note belongs to a bar, a
 * hand, and the movement his hand made to reach it (a leap, a jump to a chord, a chord change, a
 * new hand position). So the app keeps a strength (0-1) for every bar of each hand, for the hands
 * together in every bar, and for every kind of movement the song asks for. Strength rises with
 * clean playing, falls with mistakes and pauses, and fades while he stays away; a bar he always
 * plays clean comes back less and less often (spaced review), a weak one every session.
 *
 * The planner follows the rules of fast, accurate practice:
 *  - Notes first, in free play with no beat (hand by hand, unless he is picking it up fast), then
 *    the same music with the metronome on a tempo ladder (60% to 100%), one rung up only after two
 *    clean runs in a row. A clean run is 95% right; a first try that is already clean counts twice.
 *  - Mistakes are not practised: with the beat a slip takes him back a bar (engine.ts), and a
 *    passage that keeps going wrong is zoomed into (the one movement, two bars, one hand) until it
 *    is clean, then put back into its part.
 *  - The difficulty stays in the zone: below 85% the music slows down or the chunk gets smaller;
 *    two clean runs and it speeds up or grows.
 *  - When his playing stops improving it suggests stopping for the day: sleep does the rest.
 *
 * 100% is the whole song with the beat at full speed, 95% right, on two different days.
 */
import { useEffect, useReducer } from 'react';
import type { SongInfo } from './catalog';
import { buildCourse, type CourseStep } from './course';
import type { Engine } from './engine';
import { dayKey } from './stats';
import { HIT, MISS, type Hand, type HandsChoice, type Song, type SongNote } from './types';

/** The tempo ladder, as a share of the written speed. */
export const RUNGS = [0.6, 0.7, 0.8, 0.9, 1];
const TOP = RUNGS.length - 1;
/** A run this good is clean: it counts towards the next step. */
const CLEAN = 0.95;
/** Below this the music is too hard as it is: slower, or a smaller piece. */
const HARD = 0.85;
const DAY = 86_400_000;
const FREE_SPEED = 0.7;

// ---------- Movements ----------

/** The notes one hand plays at the same moment, in order. */
function handGroups(song: Song, hand: Hand): SongNote[][] {
  const q = song.ppq / 4;
  const out: SongNote[][] = [];
  let lastQ = -1;
  const notes = song.notes.filter(n => n.hand === hand).sort((a, b) => a.ticks - b.ticks || a.midi - b.midi);
  for (const n of notes) {
    const k = Math.round(n.ticks / q);
    if (k === lastQ) out[out.length - 1].push(n);
    else { out.push([n]); lastQ = k; }
  }
  return out;
}

const centre = (g: SongNote[]) => g.reduce((a, n) => a + n.midi, 0) / g.length;
const sig = (g: SongNote[]) => g.map(n => n.midi).join('.');

/**
 * For every note, the movement its hand made to reach it, when that movement is one worth
 * practising on its own: a leap (more than a fifth), a chord change, a move to a new position.
 * The same movement anywhere in the song has the same key, so a weakness found in bar 3 and bar 11
 * is seen as one problem.
 */
export function movesOf(song: Song): Map<number, string> {
  const out = new Map<number, string>();
  for (const hand of song.hands) {
    const gs = handGroups(song, hand);
    for (let i = 1; i < gs.length; i++) {
      const g = gs[i], p = gs[i - 1];
      const d = centre(g) - centre(p);
      const chord = g.length >= 2;
      let kind = '';
      if (Math.abs(d) >= 8) kind = `leap-${d > 0 ? 'up' : 'down'}${chord ? '-chord' : ''}`;
      else if (chord && sig(g) !== sig(p)) kind = 'chord';
      else if (g.some(n => n.fingerCue)) kind = 'shift';
      if (kind) for (const n of g) out.set(n.id, `${hand}:${kind}`);
    }
  }
  return out;
}

const MOVES: Record<string, string> = {
  'leap-up': 'the leap up',
  'leap-down': 'the leap down',
  'leap-up-chord': 'the jump up to the chord',
  'leap-down-chord': 'the jump down to the chord',
  chord: 'the chord changes',
  shift: 'the moves to a new position',
};
export const moveLabel = (key: string) => {
  const [h, k] = key.split(':');
  return `${h === 'R' ? 'Right' : 'Left'} hand: ${MOVES[k] ?? 'this move'}`;
};

// ---------- The song as the planner sees it ----------

interface Part { n: number; from: number; to: number; /** Bars it stands for, with its repeats. */ weight: number; }

interface Model {
  parts: Part[];
  /** Every part in song order, repeats included (`of` is the part it repeats). */
  order: { from: number; to: number; of: number }[];
  moves: Map<number, string>;
  /** 1-based bar of a note. */
  barOf: (n: SongNote) => number;
  two: boolean;
  hands: Hand[];
  all: HandsChoice;
  first: number;
  last: number;
}

const models = new WeakMap<Song, Model>();

function model(song: Song): Model {
  const hit = models.get(song);
  if (hit) return hit;
  const course = buildCourse(song);
  const [num, den] = song.timeSig;
  const measure = song.ppq * 4 * (num / den);
  const size = (p: { from: number; to: number }) => p.to - p.from + 1;
  const parts: Part[] = course.parts.filter(p => !p.sameAs).map(p => ({
    n: p.n, from: p.from, to: p.to,
    weight: size(p) + course.parts.filter(q => q.sameAs === p.n).reduce((a, q) => a + size(q), 0),
  }));
  const two = song.hands.length === 2;
  const m: Model = {
    parts, moves: movesOf(song),
    order: course.parts.map(p => ({ from: p.from, to: p.to, of: p.sameAs ?? p.n })),
    barOf: n => Math.floor(n.ticks / measure + 1e-6) + 1,
    two, hands: song.hands, all: two ? 'both' : song.hands[0],
    first: parts[0]?.from ?? 1,
    last: course.parts[course.parts.length - 1]?.to ?? 1,
  };
  models.set(song, m);
  return m;
}

// ---------- What he knows ----------

/** A strength (0-1) learnt from notes, with its spaced-review interval. */
interface Item { s: number; n: number; at: number; /** Days until it is due again. */ ivl: number; due: number; }
/** Runs of one piece of music played one way. `streak` is clean runs in a row. */
interface Chunk { runs: number; streak: number; best: number; last: number; at: number; }

export type LessonKind = 'hand' | 'together' | 'beat' | 'spot' | 'move' | 'join' | 'song' | 'review';

export interface MLesson {
  /** The chunk it trains: the same music played the same way shares its record. */
  chunk: string;
  kind: LessonKind;
  title: string;
  /** Why this lesson now, in a line. */
  why: string;
  from: number;
  to: number;
  hands: HandsChoice;
  wait: boolean;
  /** Rung on the tempo ladder (with the beat). */
  rung: number;
  speed: number;
  fingers?: 'all';
  /** A movement drill: the key of the movement. */
  move?: string;
}

/** A zoom-in: a weak spot practised on its own until it is clean, then back to `back`. */
interface Focus { lesson: MLesson; back: MLesson; tries: number; }

export interface MasteryState {
  items: Record<string, Item>;
  chunks: Record<string, Chunk>;
  /** Highest rung played clean twice, per stretch and hands; missing means none yet. */
  top: Record<string, number>;
  /** The rung he is on now, per stretch and hands. */
  rung: Record<string, number>;
  /** Days with the whole song clean at full speed. */
  days: string[];
  /** First tries, and how many were clean: a fast learner skips the hand-by-hand steps. */
  fast: { tries: number; clean: number };
  focus?: Focus;
  /** The lesson a finished zoom-in hands back to: it comes next. */
  resume?: MLesson;
  session: { day: string; runs: { acc: number; progress: boolean; chunk?: string }[]; restAt: number };
}

const KEY = (id: string) => `hugos-piano:mastery:${id}`;
const blank = (): MasteryState => ({ items: {}, chunks: {}, top: {}, rung: {}, days: [], fast: { tries: 0, clean: 0 }, session: { day: '', runs: [], restAt: 0 } });

const listeners = new Set<() => void>();
export const onMastery = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

export function loadMastery(id: string): MasteryState {
  try { return { ...blank(), ...JSON.parse(localStorage.getItem(KEY(id)) ?? '{}') }; } catch { return blank(); }
}
function saveMastery(id: string, st: MasteryState) {
  try { localStorage.setItem(KEY(id), JSON.stringify(st)); } catch { /* storage unavailable */ }
  listeners.forEach(fn => fn());
}
export function resetMastery(id: string) {
  try { localStorage.removeItem(KEY(id)); } catch { /* ignore */ }
  listeners.forEach(fn => fn());
}

const range = (from: number, to: number) => `${from}-${to}`;
const chunkKey = (from: number, to: number, hands: HandsChoice, wait: boolean, rung = 0) => `${range(from, to)}:${hands}:${wait ? 'free' : `beat${rung}`}`;
const ladderKey = (from: number, to: number, hands: HandsChoice) => `${range(from, to)}:${hands}`;
const streakOf = (st: MasteryState, key: string) => st.chunks[key]?.streak ?? 0;
const topOf = (st: MasteryState, key: string) => st.top[key] ?? -1;
const bars = (from: number, to: number) => (from === to ? `bar ${from}` : `bars ${from}-${to}`);
const Bars = (from: number, to: number) => (from === to ? `Bar ${from}` : `Bars ${from}-${to}`);
const handName = (h: HandsChoice) => (h === 'R' ? 'right hand' : h === 'L' ? 'left hand' : 'both hands');
const list = (xs: number[]) => (xs.length <= 1 ? `${xs[0]}` : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** What practice has left after `days` away: nothing lost for two days, then a little each day. */
const retention = (days: number) => (days <= 2 ? 1 : Math.max(0.7, 1 - 0.03 * (days - 2)));
/** An item's strength today, after forgetting. */
const strength = (it: Item | undefined, now = Date.now()) => (it ? it.s * retention((now - it.at) / DAY - it.ivl) : 0);

// ---------- The meter ----------

export interface PartMeter { n: number; from: number; to: number; value: number; weight: number; }
export interface Meter { value: number; parts: PartMeter[]; days: number; }

function lastAt(st: MasteryState, prefix: string) {
  let t = 0;
  for (const [k, c] of Object.entries(st.chunks)) if (k.startsWith(prefix) && c.at > t) t = c.at;
  return t;
}

function partValue(m: Model, st: MasteryState, p: { from: number; to: number }, now: number) {
  const r = range(p.from, p.to);
  const t = topOf(st, ladderKey(p.from, p.to, m.all));
  const done = (k: string, need = 2) => Math.min(1, streakOf(st, k) / need);
  let v: number;
  if (t >= 0) v = 0.35 + 0.65 * (t + 1) / RUNGS.length;
  else if (done(chunkKey(p.from, p.to, m.all, true)) >= 1) v = 0.35;
  else if (m.two) v = m.hands.reduce((a, h) => a + 0.1 * done(chunkKey(p.from, p.to, h, true)), 0) + 0.15 * done(chunkKey(p.from, p.to, 'both', true));
  else v = 0.35 * done(chunkKey(p.from, p.to, m.all, true));
  const at = lastAt(st, `${r}:`);
  return at ? v * retention((now - at) / DAY) : v;
}

/** How much of the song he has mastered (0-1), and each part's share. */
export function meterOf(song: Song, st = loadMastery(song.entry.id), now = Date.now()): Meter {
  const m = model(song);
  const parts = m.parts.map(p => ({ n: p.n, from: p.from, to: p.to, weight: p.weight, value: partValue(m, st, p, now) }));
  const w = parts.reduce((a, p) => a + p.weight, 0) || 1;
  const partsV = parts.reduce((a, p) => a + p.value * p.weight, 0) / w;
  const whole = ladderKey(m.first, m.last, m.all);
  const wt = topOf(st, whole);
  let wholeV = streakOf(st, chunkKey(m.first, m.last, m.all, true)) >= 1 ? 0.2 : 0;
  if (wt >= 2) wholeV = 0.2 + 0.5 * (wt - 1) / 3;
  if (st.days.length >= 1) wholeV = 0.85;
  const away = (now - (lastAt(st, `${range(m.first, m.last)}:`) || now)) / DAY;
  const value = st.days.length >= 2 ? retention(away) : Math.min(0.99, 0.7 * partsV + 0.3 * wholeV * retention(away));
  return { value, parts, days: st.days.length };
}

// ---------- The planner ----------

function lesson(st: MasteryState, o: { kind: LessonKind; from: number; to: number; hands: HandsChoice; wait: boolean; rung?: number; title: string; why: string; move?: string; fingers?: 'all' }): MLesson {
  const rung = o.wait ? 0 : o.rung ?? Math.max(0, st.rung[ladderKey(o.from, o.to, o.hands)] ?? 0);
  const chunk = o.move ? `move:${o.move}:${o.wait ? 'free' : `beat${rung}`}` : chunkKey(o.from, o.to, o.hands, o.wait, rung);
  return { ...o, rung, chunk, speed: o.wait ? FREE_SPEED : RUNGS[rung] };
}

const fastLearner = (st: MasteryState) => st.fast.tries >= 2 && st.fast.clean / st.fast.tries >= 0.6;

/** The free-play steps of a part, hand by hand unless he learns fast; undefined once its notes are known. */
function notesLesson(m: Model, st: MasteryState, p: Part): MLesson | undefined {
  const both = chunkKey(p.from, p.to, m.all, true);
  if (streakOf(st, both) >= 2) return undefined;
  const at = Bars(p.from, p.to);
  if (!m.two) return lesson(st, { kind: 'hand', from: p.from, to: p.to, hands: m.all, wait: true, title: `${at}, free play`, why: 'Notes first: the music waits for each note, no beat yet.' });
  const tried = st.chunks[both];
  const stuck = tried && tried.best < HARD;
  if (fastLearner(st) && !stuck) {
    return lesson(st, { kind: 'together', from: p.from, to: p.to, hands: 'both', wait: true, title: `${at}, both hands`, why: 'Both hands straight away: you are picking this up fast.' });
  }
  for (const h of m.hands) {
    if (streakOf(st, chunkKey(p.from, p.to, h, true)) < 2) {
      return lesson(st, { kind: 'hand', from: p.from, to: p.to, hands: h, wait: true, title: `${at}, ${handName(h)}`, why: `Notes first, ${handName(h)} on its own: the music waits for each note.` });
    }
  }
  return lesson(st, { kind: 'together', from: p.from, to: p.to, hands: 'both', wait: true, title: `${at}, both hands`, why: 'Each hand knows it: now together, still no beat.' });
}

function beatLesson(m: Model, st: MasteryState, from: number, to: number, kind: LessonKind, title: string, firstRung = 0): MLesson {
  const lk = ladderKey(from, to, m.all);
  const rung = Math.max(firstRung, st.rung[lk] ?? firstRung);
  const up = rung > 0 && topOf(st, lk) === rung - 1 && streakOf(st, chunkKey(from, to, m.all, false, rung)) === 0;
  const why = up ? 'Clean twice in a row: a little faster now.' : rung === TOP ? 'Full speed, with the beat. A slip takes you back a bar.' : 'With the metronome now. A slip takes you back a bar.';
  return lesson(st, { kind, from, to, hands: m.all, wait: false, rung, title, why });
}

const partLearnt = (m: Model, st: MasteryState, p: Part) => topOf(st, ladderKey(p.from, p.to, m.all)) >= 1;

/** The part to review: the weakest one he has learnt, by the strength of its bars today. */
function weakestPart(m: Model, st: MasteryState, now: number): Part | undefined {
  const score = (p: Part) => {
    let sum = 0, n = 0;
    for (let b = p.from; b <= p.to; b++) for (const h of m.hands) { sum += strength(st.items[`b${b}:${h}`], now); n++; }
    return n ? sum / n : 1;
  };
  return [...m.parts].filter(p => partLearnt(m, st, p)).sort((a, b) => score(a) - score(b))[0];
}

/** The lesson that will teach him the most right now. */
export function planNext(song: Song, st = loadMastery(song.entry.id), now = Date.now()): MLesson {
  const m = model(song);
  const today = dayKey(new Date(now));
  if (!m.parts.length) return lesson(st, { kind: 'song', from: 1, to: 1, hands: m.all, wait: true, title: 'The whole song', why: '' });

  // A weak spot being fixed carries on until it is clean, then the passage it came from.
  if (st.focus) return st.focus.lesson;
  if (st.resume) return st.resume;

  const wholeLk = ladderKey(m.first, m.last, m.all);
  const firstToday = st.session.day !== today || !st.session.runs.length;
  // The first lesson of a day checks what stuck overnight.
  if (firstToday && st.days.length === 1 && !st.days.includes(today)) {
    return lesson(st, { kind: 'song', from: m.first, to: m.last, hands: m.all, wait: false, rung: TOP, title: 'The whole song, full speed', why: 'One more clean run on another day locks it in.' });
  }
  if (firstToday && Object.keys(st.chunks).length) {
    const due = m.parts.filter(p => partLearnt(m, st, p)).map(p => {
      let over = 0;
      for (let b = p.from; b <= p.to; b++) for (const h of m.hands) { const it = st.items[`b${b}:${h}`]; if (it && it.due <= now) over++; }
      return { p, over };
    }).filter(x => x.over > 0).sort((a, b) => b.over - a.over)[0];
    if (due) {
      const lk = ladderKey(due.p.from, due.p.to, m.all);
      return lesson(st, { kind: 'review', from: due.p.from, to: due.p.to, hands: m.all, wait: false, rung: Math.max(0, topOf(st, lk)), title: `${Bars(due.p.from, due.p.to)}, with the beat`, why: 'A quick check of what stuck since last time.' });
    }
  }

  // Learn the notes and the beat part by part, joining each one to the part before it.
  for (let i = 0; i < m.parts.length; i++) {
    const p = m.parts[i];
    if (!partLearnt(m, st, p)) {
      return notesLesson(m, st, p) ?? beatLesson(m, st, p.from, p.to, 'beat', `${Bars(p.from, p.to)}, with the beat`);
    }
    // The part played just before it in the song (maybe a repeat of an earlier one).
    const prev = m.order.find(q => q.to + 1 === p.from);
    const prevPart = prev && m.parts.find(q => q.n === prev.of);
    if (prev && prevPart && partLearnt(m, st, prevPart) && streakOf(st, chunkKey(prev.from, p.to, m.all, true)) < 1) {
      return lesson(st, { kind: 'join', from: prev.from, to: p.to, hands: m.all, wait: true, title: `${Bars(prev.from, p.to)} in one go`, why: `Join part ${prev.of} to part ${p.n}: the seam between parts is where songs fall apart.` });
    }
  }

  // Every part is learnt: the whole song once without the beat.
  if (streakOf(st, chunkKey(m.first, m.last, m.all, true)) < 1) {
    return lesson(st, { kind: 'song', from: m.first, to: m.last, hands: m.all, wait: true, title: 'The whole song, free play', why: 'All the parts together, no beat yet.' });
  }

  // Each part up the tempo ladder, slowest part first.
  const slow = [...m.parts].map(p => ({ p, t: topOf(st, ladderKey(p.from, p.to, m.all)) })).filter(x => x.t < TOP).sort((a, b) => a.t - b.t)[0];
  if (slow) return beatLesson(m, st, slow.p.from, slow.p.to, 'beat', `${Bars(slow.p.from, slow.p.to)}, with the beat`);

  // Then the whole song up to full speed.
  if (topOf(st, wholeLk) < TOP && !st.days.includes(today)) return beatLesson(m, st, m.first, m.last, 'song', 'The whole song, with the beat', 2);
  if (!st.days.length) return lesson(st, { kind: 'song', from: m.first, to: m.last, hands: m.all, wait: false, rung: TOP, title: 'The whole song, full speed', why: 'Full speed, 95% right: the run that counts.' });

  // Played clean today, or mastered: polish the weakest part.
  const weak = weakestPart(m, st, now) ?? m.parts[0];
  return lesson(st, {
    kind: 'review', from: weak.from, to: weak.to, hands: m.all, wait: false, rung: TOP, title: `${Bars(weak.from, weak.to)}, full speed`,
    why: st.days.length >= 2 ? 'Mastered. Keeping your weakest part sharp.' : 'The last step is the whole song again on another day. Until then, your weakest part.',
  });
}

// ---------- Learning from a run ----------

/** What one chord of the run showed. */
interface GroupEv { ids: number[]; q: number; wrong: number[]; }

export interface MasteryVerdict {
  before: number;
  after: number;
  /** What the run showed, in a line. */
  line: string;
  /** Set when it is a good moment to stop for today. */
  rest?: string;
  next: MLesson;
}

/** Zoom in on what went wrong: the movement, the bars, or the hands together. */
function zoomIn(m: Model, st: MasteryState, l: MLesson, song: Song, groups: GroupEv[]): { lesson: MLesson; line: string } | null {
  const weak = groups.filter(g => g.q <= 0.65);
  if (!weak.length) return null;
  const note = (id: number) => song.notes[id];
  // A movement that went wrong in two or more different bars is one problem, not several.
  const moveBars = new Map<string, Set<number>>();
  for (const g of weak) for (const id of g.ids) {
    const k = m.moves.get(id);
    if (!k || (l.hands !== 'both' && !k.startsWith(l.hands))) continue;
    const s = moveBars.get(k) ?? new Set<number>();
    s.add(m.barOf(note(id)));
    moveBars.set(k, s);
  }
  const move = [...moveBars.entries()].filter(([k, b]) => b.size >= 2 && strength(st.items[`m:${k}`]) < 0.8).sort((a, b) => b[1].size - a[1].size)[0];
  if (move && !l.move) {
    const [key, where] = move;
    const hand = key[0] as Hand;
    const at = [...where].sort((a, b) => a - b);
    return {
      lesson: lesson(st, { kind: 'move', from: 1, to: 1, hands: hand, wait: l.wait, rung: Math.max(0, l.rung - 1), move: key, title: moveLabel(key), why: `Just this move, again and again, then back to ${bars(l.from, l.to)}.` }),
      line: `${moveLabel(key)} went wrong in ${at.length > 4 ? `${at.length} bars, from bar ${at[0]}` : `bars ${list(at)}`}. Next: that move on its own.`,
    };
  }
  if (l.move) return null;
  // Otherwise the bar where it went wrong most, with the bar before it. One chord gone wrong is
  // enough to make a bar weak: the right notes around it do not cancel it out.
  const perBar = new Map<number, { lost: number; R: number[]; L: number[]; weak: boolean }>();
  for (const g of groups) {
    const b = m.barOf(note(g.ids[0]));
    const e = perBar.get(b) ?? { lost: 0, R: [], L: [], weak: false };
    e.lost += 1 - g.q;
    if (g.q <= 0.65) e.weak = true;
    for (const h of new Set(g.ids.map(id => note(id).hand))) e[h].push(g.q);
    perBar.set(b, e);
  }
  const weakBars = [...perBar.entries()].filter(([, e]) => e.weak).sort((a, b) => b[1].lost - a[1].lost);
  if (!weakBars.length) return null;
  const spread = weakBars.length >= 3;
  const handsKnown = m.two && m.hands.every(h => streakOf(st, chunkKey(l.from, l.to, h, true)) >= 2);
  if (spread && l.hands === 'both' && handsKnown && l.to - l.from >= 3) {
    const mid = Math.floor((l.from + l.to) / 2);
    const worstFirst = weakBars.filter(([b]) => b <= mid).length >= weakBars.filter(([b]) => b > mid).length;
    const [a, b] = worstFirst ? [l.from, mid] : [mid + 1, l.to];
    return {
      lesson: lesson(st, { kind: 'spot', from: a, to: b, hands: 'both', wait: l.wait, rung: Math.max(0, l.rung - 1), title: `${Bars(a, b)}, both hands`, why: 'Half the part at a time until both hands are sure of it.' }),
      line: 'Each hand knows it: together is the hard part. Next: half the part at a time.',
    };
  }
  const [bar, e] = weakBars[0];
  const from = Math.max(l.from, bar - 1);
  let hands: HandsChoice = l.hands;
  if (l.hands === 'both') {
    const r = Math.min(1, ...e.R), lft = Math.min(1, ...e.L);
    if (r <= 0.65 && lft >= 0.85) hands = 'R';
    else if (lft <= 0.65 && r >= 0.85) hands = 'L';
  }
  if (from === l.from && bar === l.to && hands === l.hands) return null;
  return {
    lesson: lesson(st, { kind: 'spot', from, to: bar, hands, wait: l.wait, rung: Math.max(0, l.rung - 1), title: `${Bars(from, bar)}${hands !== m.all || l.hands !== m.all ? `, ${handName(hands)}` : ''}`, why: `Just these bars until they are clean, then back to ${bars(l.from, l.to)}.` }),
    line: `${Bars(bar, bar)} tripped you up. Next: ${from === bar ? 'that bar' : `${bars(from, bar)}`} on ${hands === l.hands ? 'its own' : `the ${handName(hands)}`}.`,
  };
}

/** A zoom-in that is still not clean after several tries gets smaller still, or gives way. */
function zoomFurther(m: Model, st: MasteryState, l: MLesson): MLesson | null {
  if (!l.wait) return lesson(st, { ...l, wait: true, why: 'Without the beat first, until the notes are sure.' });
  if (l.move) return null;
  if (l.hands === 'both' && m.two) return lesson(st, { ...l, hands: 'R', title: `${Bars(l.from, l.to)}, right hand`, why: 'One hand at a time.' });
  if (l.to > l.from) return lesson(st, { ...l, from: l.to, title: `${Bars(l.to, l.to)}${l.hands === m.all ? '' : `, ${handName(l.hands)}`}`, why: 'Just one bar, until it is clean.' });
  return null;
}

/**
 * Takes in a finished run: updates the strengths, the chunk's record and the tempo ladder, decides
 * whether to zoom in, and says whether it is time to stop for today.
 */
function learn(song: Song, l: MLesson, groups: GroupEv[], run: { accuracy: number; cutShort: boolean; rewinds: number }): MasteryVerdict {
  const id = song.entry.id;
  const m = model(song);
  const st = loadMastery(id);
  const now = Date.now();
  const today = dayKey();
  const before = meterOf(song, st, now).value;

  // Strengths: every note is evidence for its bar, its hand, its movement and the hands together.
  const acc: Record<string, { sum: number; n: number }> = {};
  const add = (k: string, q: number) => { const a = acc[k] ?? { sum: 0, n: 0 }; a.sum += q; a.n++; acc[k] = a; };
  for (const g of groups) {
    const hands = new Set(g.ids.map(i => song.notes[i].hand));
    for (const i of g.ids) {
      const n = song.notes[i];
      const b = m.barOf(n);
      add(`b${b}:${n.hand}`, g.q);
      const mv = m.moves.get(i);
      if (mv) add(`m:${mv}`, g.q);
    }
    if (hands.size > 1) add(`t${m.barOf(song.notes[g.ids[0]])}`, g.q);
  }
  for (const [k, a] of Object.entries(acc)) {
    const it = st.items[k] ?? { s: 0.4, n: 0, at: now, ivl: 0, due: now };
    const q = a.sum / a.n;
    it.s += Math.min(0.5, 0.2 + 0.05 * a.n) * (q - it.s);
    it.n += a.n;
    it.at = now;
    // Spaced review: clean doubles the gap (1, 2, 4, 8 days...), a weak run brings it back tomorrow.
    if (q >= CLEAN && a.n >= 2) it.ivl = Math.min(30, Math.max(1, it.ivl * 2));
    else if (q < 0.8) it.ivl = 1;
    it.due = now + it.ivl * DAY;
    st.items[k] = it;
  }

  // The chunk's record. Clean is 95% right with at most one slip (two in a run is a pattern); a
  // first try without a single mistake counts as two clean runs.
  const wrongs = groups.reduce((a, g) => a + g.wrong.length, 0);
  const clean = run.accuracy >= CLEAN && !run.cutShort && run.rewinds <= 1;
  const perfect = clean && !wrongs && !run.rewinds && run.accuracy >= 0.999;
  const c = st.chunks[l.chunk] ?? { runs: 0, streak: 0, best: 0, last: 0, at: now };
  const first = c.runs === 0;
  c.runs++;
  c.streak = clean ? c.streak + (first && perfect ? 2 : 1) : 0;
  c.best = Math.max(c.best, run.accuracy);
  c.last = run.accuracy;
  c.at = now;
  st.chunks[l.chunk] = c;
  if (first && l.kind !== 'review') { st.fast.tries++; if (perfect) st.fast.clean++; }

  // The tempo ladder: two clean runs climb a rung, a run below the zone steps one down.
  let line = '';
  if (!l.wait && !l.move) {
    const lk = ladderKey(l.from, l.to, l.hands);
    if (clean && c.streak >= 2) {
      st.top[lk] = Math.max(topOf(st, lk), l.rung);
      st.rung[lk] = Math.min(TOP, Math.max(st.rung[lk] ?? 0, l.rung + 1));
    } else if ((run.accuracy < HARD || run.cutShort) && l.kind !== 'review') {
      st.rung[lk] = Math.max(0, Math.min(st.rung[lk] ?? l.rung, l.rung) - 1);
    }
    // The run that counts: the whole song, full speed, clean.
    if (clean && l.from === m.first && l.to === m.last && l.rung === TOP && !st.days.includes(today)) st.days.push(today);
  }

  // Zooming: a weak spot is fixed on its own; a zoom-in that is clean twice hands back to its part.
  const focused = st.focus && st.focus.lesson.chunk === l.chunk;
  if (focused) {
    const f = st.focus!;
    f.tries++;
    if (c.streak >= 2) { st.focus = undefined; st.resume = f.back; line = `Clean${first ? ' on the first try' : ' twice'}. Back to ${f.back.title.toLowerCase().startsWith('bar') ? f.back.title.replace(/^B/, 'b') : 'the passage'}.`; }
    else if (f.tries >= 4) {
      const smaller = zoomFurther(m, st, f.lesson);
      if (smaller) { st.focus = { ...f, lesson: smaller, tries: 0 }; line = 'Still tricky, so smaller still.'; }
      else { st.focus = undefined; st.resume = f.back; line = 'Leave it for now: it will feel easier after a night’s sleep.'; }
    }
  } else {
    if (st.resume?.chunk === l.chunk) st.resume = undefined;
    const z = !clean && (run.accuracy < 0.92 || run.cutShort || run.rewinds >= 2) ? zoomIn(m, st, l, song, groups) : null;
    if (z) { st.focus = { lesson: z.lesson, back: l, tries: 0 }; line = z.line; }
  }
  if (!line) {
    line = run.cutShort ? 'Too many slips at this speed.'
      : clean ? (first && perfect ? 'Perfect on the first try.' : c.streak >= 2 ? 'Clean twice in a row.' : 'Clean. Once more like that.')
      : wrongs ? `${Math.round(run.accuracy * 100)}% right. Again, slowly enough to get every note.` : `${Math.round(run.accuracy * 100)}% right.`;
  }

  // Is he still improving today? Four runs in a row with nothing gained, or three getting worse,
  // and it is time to stop: more now would only practise the mistakes.
  if (st.session.day !== today) st.session = { day: today, runs: [], restAt: 0 };
  const after = meterOf(song, st, now).value;
  st.session.runs.push({ acc: run.accuracy, progress: clean || after - before >= 0.002, chunk: l.chunk });
  const recent = st.session.runs.slice(st.session.restAt);
  const flat = recent.length >= 4 && recent.slice(-4).every(r => !r.progress);
  const last3 = recent.slice(-3);
  const worse = recent.length >= 4 && last3.every(r => r.chunk === l.chunk) && last3[1].acc < last3[0].acc && last3[2].acc < last3[1].acc && last3[2].acc < HARD;
  let rest: string | undefined;
  if (flat || worse) {
    st.session.restAt = st.session.runs.length;
    rest = 'A good moment to stop: your playing has levelled off for today, and sleep turns practice into skill. Come back tomorrow.';
  } else if (st.days.length === 1 && st.days[0] === today && clean && l.from === m.first && l.to === m.last) {
    rest = 'The whole song, clean at full speed. Play it like that on another day and it is yours.';
  }

  // Wrong notes next to the right key point at the hand's position: show the fingers.
  const near = groups.flatMap(g => g.wrong.map(w => Math.min(...g.ids.map(i => Math.abs(song.notes[i].midi - w))))).filter(d => d <= 2).length;
  if (st.focus && wrongs >= 2 && near / wrongs >= 0.5) st.focus.lesson.fingers = 'all';

  saveMastery(id, st);
  return { before, after, line, rest, next: planNext(song, st, now) };
}

// ---------- Listening to a run ----------

/**
 * Follows the engine through a run and scores every chord: right first time and without pausing
 * is 1, found after a pause or wrong notes less, missed 0; with the beat, early or late costs a
 * little. `map` turns a drill's note ids back into the song's.
 */
export function track(song: Song, l: MLesson, engine: Engine, map?: number[]) {
  const groups: GroupEv[] = [];
  let cur = engine.gi, waitStart = 0, firstSettled = false;
  const wrongAt = new Map<number, number[]>();
  const offsets = new Map<number, number>();
  let lastOffset = 0;
  const free = () => !!(engine.opts.wait || engine.opts.follow);

  const settle = (gi: number, now: number) => {
    const g = engine.groups[gi];
    if (!g) return;
    const st = g.ids.map(id => engine.status[id]);
    if (st.some(s => s !== HIT && s !== MISS)) return;
    const wrong = wrongAt.get(gi) ?? [];
    wrongAt.delete(gi);
    let q: number;
    if (st.some(s => s === MISS)) q = 0;
    else if (free()) {
      // The first chord waits for him to get ready: its pause is not hesitation.
      const stuck = firstSettled && gi === cur && waitStart ? (now - waitStart) / 1000 : 0;
      q = 1 - Math.min(0.5, Math.max(0, stuck - 1.5) * 0.15) - Math.min(0.7, wrong.length * 0.35);
    } else {
      const off = Math.max(0, ...g.ids.map(id => Math.abs(offsets.get(id) ?? 0)));
      q = 1 - (off > 0.12 ? 0.25 : 0) - Math.min(0.7, wrong.length * 0.5);
    }
    firstSettled = true;
    groups.push({ ids: g.ids.map(id => map?.[id] ?? id), q: Math.max(0, q), wrong });
  };
  const check = () => {
    const now = performance.now();
    if (engine.gi < cur) { cur = engine.gi; waitStart = 0; }
    if (engine.waiting && !waitStart) waitStart = engine.waitSince || now;
    while (cur < engine.gi) { settle(cur, now); cur++; waitStart = engine.waiting ? now : 0; }
  };
  const off = engine.on(e => {
    if (e.type === 'wrong') { const w = wrongAt.get(engine.gi) ?? []; w.push(e.midi); wrongAt.set(engine.gi, w); }
    if (e.type === 'judge') lastOffset = e.offset;
    if (e.type === 'press' && e.ok && e.id !== undefined) offsets.set(e.id, lastOffset);
    check();
  });
  return {
    stop: () => off(),
    finish: (): MasteryVerdict => {
      check();
      off();
      // Chords he slipped on and never got past (the run stopped first) are failures too.
      for (const [gi, wrong] of wrongAt) {
        const g = engine.groups[gi];
        if (g) groups.push({ ids: g.ids.map(id => map?.[id] ?? id), q: 0, wrong });
      }
      const { accuracy } = engine.stats();
      return learn(song, l, groups, { accuracy, cutShort: engine.cutShort, rewinds: engine.rewinds });
    },
  };
}

// ---------- Drills ----------

/**
 * A movement on its own: every place the song makes it, the note before and the note it lands on,
 * one pair to a bar, each twice (four times if it is always the same). `map` gives each drill
 * note the song note it stands for.
 */
export function drillSong(song: Song, key: string): { song: Song; map: number[] } {
  const m = model(song);
  const hand = key[0] as Hand;
  const gs = handGroups(song, hand);
  const seen = new Set<string>();
  const pairs: [SongNote[], SongNote[]][] = [];
  for (let i = 1; i < gs.length; i++) {
    if (m.moves.get(gs[i][0].id) !== key) continue;
    const s = `${sig(gs[i - 1])}>${sig(gs[i])}`;
    if (seen.has(s)) continue;
    seen.add(s);
    pairs.push([gs[i - 1], gs[i]]);
    if (pairs.length >= 4) break;
  }
  const reps = pairs.length === 1 ? 4 : 2;
  const [num, den] = song.timeSig;
  const measure = song.ppq * 4 * (num / den);
  const lastTick = Math.max(...song.notes.map(n => n.ticks + n.durationTicks), 1);
  const spt = song.ticksToSeconds(lastTick) / lastTick;
  const notes: SongNote[] = [];
  const src: number[] = [];
  let bar = 0;
  for (const pair of pairs) {
    for (let r = 0; r < reps; r++) {
      const base = bar * measure;
      const gap = Math.max(song.ppq / 2, Math.min(measure - song.ppq / 2, pair[1][0].ticks - pair[0][0].ticks));
      const place = (g: SongNote[], at: number, room: number) => {
        for (const n of g) {
          const durationTicks = Math.max(song.ppq / 4, Math.min(n.durationTicks, room));
          notes.push({ ...n, id: 0, ticks: at, durationTicks, time: at * spt, duration: durationTicks * spt * 0.95 });
          src.push(n.id);
        }
      };
      place(pair[0], base, gap);
      place(pair[1], base + gap, measure - gap);
      bar++;
    }
  }
  const order = notes.map((_, i) => i).sort((a, b) => notes[a].ticks - notes[b].ticks || notes[a].midi - notes[b].midi);
  const sorted = order.map((i, id) => ({ ...notes[i], id }));
  const map = order.map(i => src[i]);
  const pitches = sorted.map(n => n.midi);
  return {
    map,
    song: {
      entry: { ...song.entry, id: `${song.entry.id}~move`, title: moveLabel(key), builtIn: true },
      notes: sorted,
      duration: Math.max(...sorted.map(n => n.time + n.duration)),
      firstNoteTime: 0,
      ppq: song.ppq,
      timeSig: song.timeSig,
      fifths: song.fifths,
      ticksToSeconds: t => t * spt,
      hands: [hand],
      range: [Math.min(...pitches), Math.max(...pitches)],
      ceiling: song.ceiling,
    },
  };
}

// ---------- For the lesson screen ----------

/** A planned lesson as the lesson screen plays it: one step, and what to listen with. */
export function masteryPlayable(info: SongInfo, l: MLesson) {
  const song = info.song!;
  const drill = l.move ? drillSong(song, l.move) : null;
  const play = drill?.song ?? song;
  const [num, den] = play.timeSig;
  const last = drill ? Math.max(1, Math.ceil(Math.max(...play.notes.map(n => n.ticks + n.durationTicks)) / (play.ppq * 4 * num / den) - 1e-6)) : l.to;
  const step: CourseStep = {
    id: `m:${l.chunk}`, kind: l.wait ? 'phrase' : 'tempo', title: l.title, short: 'M',
    from: drill ? 1 : l.from, to: drill ? last : l.to, hands: l.hands, speed: l.speed, wait: l.wait, exact: true, fingers: l.fingers,
  };
  return {
    info: drill ? { entry: play.entry, song: play, prog: {}, stars: 0, total: 3, done: 0 } as SongInfo : info,
    section: { id: 'mastery', title: 'Mastery', bars: bars(step.from, step.to), from: step.from, steps: [step], learnt: false, done: 0 },
    track: (engine: Engine) => track(song, l, engine, drill?.map),
  };
}

/** The meter and the next lesson for a song, kept fresh as he plays. */
export function useMastery(song?: Song) {
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => onMastery(bump), []);
  return song ? { meter: meterOf(song), next: planNext(song) } : null;
}
