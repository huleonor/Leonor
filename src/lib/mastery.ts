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
 *
 * Then it has to last: a mastery check comes due after a week, then two weeks later, then a
 * month later (the whole song at full speed, 95% right, any day from the due date, with a week's
 * grace). Three checks kept and the song is his for good. A check missed by more than the grace
 * week drops it to silver until he plays it clean again, which restores gold and starts the
 * checks over; nothing is ever lost for good.
 */
import { barGrid, barIndex, barStart } from './bars';
import { useEffect, useReducer } from 'react';
import { buildCourse, type CourseStep } from './course';
import type { Engine } from './engine';
import { dueIn, GAP, kept, relearn, START_H, typical } from './memory';
import { diagnose, hintLine, type Diagnosis } from './hints';
import { fit, observe, predict, TARGET, type Features } from './predict';
import { dayKey } from './stats';
import { askStrategy, onStrategy, strategyOf } from './strategy';
import type { PartPlan, Stretch } from './strategyShape';
import { HIT, MISS, type FingerMode, type Hand, type HandsChoice, type Song, type SongNote } from './types';

/** The tempo ladder, as a share of the written speed. */
export const RUNGS = [0.6, 0.7, 0.8, 0.9, 1];
const TOP = RUNGS.length - 1;
/** A run this good is clean: it counts towards the next step. */
const CLEAN = 0.95;
/** Below this the music is too hard as it is: slower, or a smaller piece. */
const HARD = 0.85;
const DAY = 86_400_000;
/** Days between mastery checks after 100%: a week, then two weeks, then a month. */
export const CHECK_GAPS = [7, 14, 30];
/** Days of grace after a check falls due before the song drops back to silver. */
export const CHECK_GRACE = 7;
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
  const grid = barGrid(song);
  const size = (p: { from: number; to: number }) => p.to - p.from + 1;
  const parts: Part[] = course.parts.filter(p => !p.sameAs).map(p => ({
    n: p.n, from: p.from, to: p.to,
    weight: size(p) + course.parts.filter(q => q.sameAs === p.n).reduce((a, q) => a + size(q), 0),
  }));
  const two = song.hands.length === 2;
  const m: Model = {
    parts, moves: movesOf(song),
    order: course.parts.map(p => ({ from: p.from, to: p.to, of: p.sameAs ?? p.n })),
    barOf: n => barIndex(grid, n.ticks) + 1,
    two, hands: song.hands, all: two ? 'both' : song.hands[0],
    first: parts[0]?.from ?? 1,
    last: course.parts[course.parts.length - 1]?.to ?? 1,
  };
  models.set(song, m);
  return m;
}

// ---------- What he knows ----------

/** A strength (0-1) learnt from notes, with its spaced-review interval. */
interface Item { s: number; n: number; at: number; /** Half-life in days: how fast it fades while he is away (memory.ts). */ h: number; due: number; /** Before half-lives: days until due. */ ivl?: number; }
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
  fingers?: FingerMode;
  /** Good runs it takes, in a row, before the lesson moves on (the dots under the step count). */
  reps: number;
  /** A movement drill: music of its own, cut from the song (`from` and `to` are its bars). */
  cut?: Cut;
}

/** A mastered song's checks: how many kept, when the next is due, and whether it is his for good. */
export interface Crown { at: number; checks: number; due: number; forever?: boolean; }

/**
 * A movement drill's music: the same movement taken from the places in the song where he plays it
 * worst, each with the chord before it, one after the other. Every note is a real note of the song
 * (pitch, length, place in the bar, finger) and `src` says which, so what he plays here counts for
 * those bars and that movement.
 */
export interface Cut { song: Song; src: number[]; bars: number[]; move: string; }

export interface MasteryState {
  crown?: Crown;
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
  /** His typical half-life in days, learnt from every return (memory.ts). */
  h0: number;
  session: { day: string; runs: { acc: number; progress: boolean; chunk?: string }[]; restAt: number };
}

const KEY = (id: string) => `hugos-piano:mastery:${id}`;
const blank = (): MasteryState => ({ items: {}, chunks: {}, top: {}, rung: {}, days: [], fast: { tries: 0, clean: 0 }, h0: START_H, session: { day: '', runs: [], restAt: 0 } });

const listeners = new Set<() => void>();
export const onMastery = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

export function loadMastery(id: string): MasteryState {
  try {
    const st: MasteryState = { ...blank(), ...JSON.parse(localStorage.getItem(KEY(id)) ?? '{}') };
    // Saved before half-lives: the old review interval is a fair first guess.
    for (const it of Object.values(st.items)) if (!it.h) it.h = Math.max(START_H, it.ivl ?? 0);
    return st;
  } catch { return blank(); }
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
const Bars = (from: number, to: number) => (from === to ? `Bar ${from}` : `Bars ${from}-${to}`);
const handName = (h: HandsChoice) => (h === 'R' ? 'right hand' : h === 'L' ? 'left hand' : 'both hands');

/** What practice on a whole part has left after `days` away (the meter): nothing lost for two days, then a little each day. */
const retention = (days: number) => (days <= 2 ? 1 : Math.max(0.7, 1 - 0.03 * (days - 2)));
/** An item's strength today, after forgetting at its own half-life. */
const strength = (it: Item | undefined, now = Date.now()) => (it ? it.s * kept((now - it.at) / DAY, it.h) : 0);

// ---------- The meter ----------

export interface PartMeter { n: number; from: number; to: number; value: number; weight: number; }
export interface Meter { value: number; parts: PartMeter[]; days: number; }

function lastAt(st: MasteryState, prefix: string) {
  let t = 0;
  for (const [k, c] of Object.entries(st.chunks)) if (k.startsWith(prefix) && c.at > t) t = c.at;
  return t;
}

/**
 * How far each bar has come (0-1), from every stretch he has played that covers it: the notes
 * (each hand alone a quarter, both hands together the rest) and then the beat, rung by rung. A
 * run that did not pass still counts for half of what it got right, so the meter follows him as
 * he plays instead of waiting for a stretch to be perfect.
 */
function barProgress(m: Model, st: MasteryState, now: number) {
  const hand = new Map<string, number>(), together = new Map<number, number>(), beat = new Map<number, number>();
  const up = <K,>(map: Map<K, number>, k: K, v: number) => map.set(k, Math.max(map.get(k) ?? 0, v));
  for (const [k, c] of Object.entries(st.chunks)) {
    const x = /^(\d+)-(\d+):(\w+):(free|beat(\d))$/.exec(k);
    if (!x) continue;
    const credit = c.best >= PASS ? 1 : 0.5 * c.best;
    for (let b = +x[1]; b <= +x[2]; b++) {
      if (x[4] !== 'free') { if (x[3] === m.all) up(beat, b, credit * (+x[5] + 1) / RUNGS.length); }
      else if (x[3] === m.all) up(together, b, credit);
      else up(hand, `${b}:${x[3]}`, credit);
    }
  }
  return (b: number) => {
    const be = beat.get(b) ?? 0;
    const alone = m.hands.reduce((a, h) => a + (hand.get(`${b}:${h}`) ?? 0), 0) / m.hands.length;
    const notes = be > 0 ? 1 : m.two ? Math.max(together.get(b) ?? 0, 0.5 * alone) : Math.max(together.get(b) ?? 0, alone);
    let at = 0;
    for (const h of m.hands) at = Math.max(at, st.items[`b${b}:${h}`]?.at ?? 0);
    return (0.45 * notes + 0.55 * be) * (at ? retention((now - at) / DAY) : 1);
  };
}

function partValue(bar: (b: number) => number, p: { from: number; to: number }) {
  let sum = 0;
  for (let b = p.from; b <= p.to; b++) sum += bar(b);
  return sum / (p.to - p.from + 1);
}

/** The meter as a whole percent: any progress shows as at least 1%, so the first right notes move it. */
export const pctOf = (v: number) => (v > 0 ? Math.max(1, Math.floor(v * 100)) : 0);

/** How much of the song he has mastered (0-1), and each part's share. */
export function meterOf(song: Song, st = loadMastery(song.entry.id), now = Date.now()): Meter {
  const m = model(song);
  const bar = barProgress(m, st, now);
  const parts = m.parts.map(p => ({ n: p.n, from: p.from, to: p.to, weight: p.weight, value: partValue(bar, p) }));
  const w = parts.reduce((a, p) => a + p.weight, 0) || 1;
  const partsV = parts.reduce((a, p) => a + p.value * p.weight, 0) / w;
  // The whole song start to finish: free play, then the beat rung by rung, then the clean run.
  const wt = topOf(st, ladderKey(m.first, m.last, m.all));
  const free = st.chunks[chunkKey(m.first, m.last, m.all, true)];
  let wholeV = free ? 0.15 * (free.best >= PASS ? 1 : 0.5 * free.best) : 0;
  if (wt >= 0) wholeV = Math.max(wholeV, 0.6 * (wt + 1) / RUNGS.length);
  if (st.days.length >= 1) wholeV = 0.8;
  const away = (now - (lastAt(st, `${range(m.first, m.last)}:`) || now)) / DAY;
  // Mastered and kept up (checks on time, or his for good): it stays at 100%.
  const kept = st.crown && (st.crown.forever || now <= st.crown.due + CHECK_GRACE * DAY);
  // 100% only once it is perfect: the whole song clean at full speed on two different days.
  const value = kept ? 1 : st.days.length >= 2 ? retention(away) : Math.min(0.99, 0.85 * partsV + 0.15 * wholeV * retention(away));
  return { value, parts, days: st.days.length };
}

// ---------- What the prediction model sees ----------

const UNSEEN = 0.3;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : UNSEEN);

/** An exercise described for the prediction model (predict.ts), from what he knows today. */
export function featuresOf(song: Song, l: MLesson, st = loadMastery(song.entry.id), now = Date.now()): Features {
  const m = model(song);
  if (l.cut) return cutFeatures(l, l.cut, st, now);
  const hands: Hand[] = l.hands === 'both' ? m.hands : [l.hands];
  const bars: number[] = [], together: number[] = [], moves = new Set<string>();
  let notes = 0;
  for (let b = l.from; b <= l.to; b++) {
    for (const h of hands) bars.push(st.items[`b${b}:${h}`] ? strength(st.items[`b${b}:${h}`], now) : UNSEEN);
    if (hands.length > 1) together.push(st.items[`t${b}`] ? strength(st.items[`t${b}`], now) : UNSEEN);
  }
  for (const n of song.notes) {
    const b = m.barOf(n);
    if (b < l.from || b > l.to || !hands.includes(n.hand)) continue;
    notes++;
    const mv = m.moves.get(n.id);
    if (mv) moves.add(mv);
  }
  const mv = [...moves].map(k => (st.items[`m:${k}`] ? strength(st.items[`m:${k}`], now) : UNSEEN));
  const c = st.chunks[l.chunk];
  const size = l.to - l.from + 1;
  let at = 0;
  for (let b = l.from; b <= l.to; b++) for (const h of hands) at = Math.max(at, st.items[`b${b}:${h}`]?.at ?? 0);
  return {
    bars: mean(bars),
    together: hands.length > 1 ? mean(together) : 1,
    move: mv.length ? Math.min(...mv) : 1,
    tried: c ? 1 : 0,
    last: c ? c.last : 0,
    streak: c ? Math.min(3, c.streak) / 3 : 0,
    beat: l.wait ? 0 : 1,
    speed: l.wait ? 0 : (l.speed - RUNGS[0]) / (RUNGS[TOP] - RUNGS[0]),
    size: Math.min(1, (size - 1) / 7),
    density: Math.min(1, notes / size / 8),
    both: hands.length > 1 ? 1 : 0,
    noFingers: l.fingers === 'off' ? 1 : l.fingers === 'some' ? 0.5 : 0,
    away: at ? Math.min(1, (now - at) / DAY / 7) : 0,
  };
}

function cutFeatures(l: MLesson, cut: Cut, st: MasteryState, now: number): Features {
  const h = cut.move.split(':')[0] as Hand;
  const bars = [...new Set(cut.bars)];
  const it = (k: string) => (st.items[k] ? strength(st.items[k], now) : UNSEEN);
  const c = st.chunks[l.chunk];
  const size = l.to - l.from + 1;
  const at = Math.max(0, ...bars.map(b => st.items[`b${b}:${h}`]?.at ?? 0));
  return {
    bars: mean(bars.map(b => it(`b${b}:${h}`))),
    together: 1,
    move: it(`m:${cut.move}`),
    tried: c ? 1 : 0,
    last: c ? c.last : 0,
    streak: c ? Math.min(3, c.streak) / 3 : 0,
    beat: l.wait ? 0 : 1,
    speed: l.wait ? 0 : (l.speed - RUNGS[0]) / (RUNGS[TOP] - RUNGS[0]),
    size: Math.min(1, (size - 1) / 7),
    density: Math.min(1, cut.src.length / size / 8),
    both: 0,
    noFingers: l.fingers === 'off' ? 1 : l.fingers === 'some' ? 0.5 : 0,
    away: at ? Math.min(1, (now - at) / DAY / 7) : 0,
  };
}

/** Places a movement drill takes from the song: the weakest first, at most this many. */
const CUT_PLACES = 4;
/** A drill plays at least this many places (one place alone comes round again). */
const CUT_MIN = 3;

/**
 * Cuts a movement drill out of the song: each place the movement happens is the chord before it
 * and the chord it moves to, kept where they fall in the bar so the beat still feels right. Places
 * that sound the same count once; the ones in his weakest bars come first, then they are played in
 * song order.
 */
export function cutMove(song: Song, key: string, st = loadMastery(song.entry.id), now = Date.now()): Cut | null {
  const m = model(song);
  const h = key.split(':')[0] as Hand;
  if (!song.hands.includes(h)) return null;
  const gs = handGroups(song, h);
  const [num, den] = song.timeSig;
  const measure = song.ppq * 4 * (num / den);
  const seen = new Map<string, { pair: SongNote[][]; bar: number }>();
  for (let i = 1; i < gs.length; i++) {
    if (m.moves.get(gs[i][0].id) !== key) continue;
    const sound = `${sig(gs[i - 1])}>${sig(gs[i])}`;
    const bar = m.barOf(gs[i][0]);
    const weak = (b: number) => strength(st.items[`b${b}:${h}`], now);
    const had = seen.get(sound);
    if (!had || weak(bar) < weak(had.bar)) seen.set(sound, { pair: [gs[i - 1], gs[i]], bar });
  }
  if (!seen.size) return null;
  let places = [...seen.values()].sort((a, b) => strength(st.items[`b${a.bar}:${h}`], now) - strength(st.items[`b${b.bar}:${h}`], now)).slice(0, CUT_PLACES);
  places.sort((a, b) => a.bar - b.bar);
  while (places.length < CUT_MIN) places = places.concat(places.slice(0, CUT_MIN - places.length));
  // A steady tempo for the drill: the song's own, around the first place.
  const t0 = places[0].pair[0][0].ticks;
  const secPerTick = (song.ticksToSeconds(t0 + song.ppq) - song.ticksToSeconds(t0)) / song.ppq;
  const notes: SongNote[] = [];
  const src: number[] = [];
  const bars: number[] = [];
  let cursor = 0;
  for (const { pair, bar } of places) {
    const start = pair[0][0].ticks;
    // Where the move sits in its own bar (the bar grid follows any change of metre).
    const srcGrid = barGrid(song);
    const inBar = start - barStart(srcGrid, barIndex(srcGrid, start));
    // A long note before the move: the move comes in the next bar, on its own beat, not bars later.
    const gap = pair[1][0].ticks - start;
    const skipBars = Math.max(0, Math.floor((inBar + gap) / measure + 1e-6) - 1);
    const at = (n: SongNote) => n.ticks - start - (n.ticks >= pair[1][0].ticks ? skipBars * measure : 0);
    const span = Math.max(1, Math.ceil((inBar + gap - skipBars * measure + 1) / measure));
    const limit = cursor + span * measure;
    for (const g of pair) for (const n of g) {
      const ticks = cursor + inBar + at(n);
      const next = g === pair[0] ? cursor + inBar + at(pair[1][0]) : limit;
      const durationTicks = Math.max(1, Math.min(n.durationTicks, next - ticks));
      notes.push({ ...n, id: 0, ticks, durationTicks, time: ticks * secPerTick, duration: durationTicks * secPerTick * (n.duration / Math.max(1e-6, song.ticksToSeconds(n.ticks + n.durationTicks) - song.ticksToSeconds(n.ticks))) });
      src.push(n.id);
    }
    bars.push(bar);
    cursor = limit;
  }
  const order = notes.map((_, i) => i).sort((a, b) => notes[a].ticks - notes[b].ticks || notes[a].midi - notes[b].midi);
  const sorted = order.map((i, k) => ({ ...notes[i], id: k }));
  const pitches = sorted.map(n => n.midi);
  const drill: Song = {
    entry: song.entry,
    notes: sorted,
    duration: Math.max(...sorted.map(n => n.time + n.duration)),
    firstNoteTime: sorted[0].time,
    ppq: song.ppq,
    timeSig: song.timeSig,
    fifths: song.fifths,
    ticksToSeconds: t => t * secPerTick,
    hands: [h],
    range: [Math.min(...pitches), Math.max(...pitches)],
    ceiling: song.ceiling,
  };
  return { song: drill, src: order.map(i => src[i]), bars, move: key };
}

/** A movement drill as a lesson: free play, or with the beat on a rung. */
function moveLesson(cut: Cut, wait: boolean, rung = 0): MLesson {
  const [num, den] = cut.song.timeSig;
  const measure = cut.song.ppq * 4 * (num / den);
  const bars = Math.max(1, Math.ceil(Math.max(...cut.song.notes.map(n => n.ticks + 1)) / measure));
  const r = wait ? 0 : rung;
  const chunk = `move:${cut.move}:${wait ? 'free' : `beat${r}`}`;
  return {
    chunk, kind: 'move', title: moveLabel(cut.move), why: 'The same move from around the song.',
    from: 1, to: bars, hands: cut.move.split(':')[0] as Hand, wait, rung: r, speed: wait ? FREE_SPEED : RUNGS[r],
    fingers: wait ? 'all' : 'some', reps: REPS.move, cut,
  };
}

/** The chance he plays this exercise well now. */
export const chanceOf = (song: Song, l: MLesson, st = loadMastery(song.entry.id), now = Date.now()) => predict(featuresOf(song, l, st, now));

/** The fastest rung, up to `max`, that he is likely to play well; the slowest when none is. */
function pickRung(song: Song, st: MasteryState, l: MLesson, max: number, now = Date.now()): MLesson {
  for (let r = Math.max(0, max); r > 0; r--) {
    const t = withRung(l, r);
    if (chanceOf(song, t, st, now) >= TARGET - 0.07) return t;
  }
  return withRung(l, 0);
}

/**
 * The exercise he needs most, aimed at the zone of ideal effort. Every weak bar of a hand, every
 * weak bar of hands together and every weak movement becomes a short stretch of the song's own
 * notes (two bars), played free or with the beat at each speed. Each is weighed by how weak it is,
 * how often the song plays it, whether it is due for review and how close the model's chance is to
 * the target; one practised a moment ago counts for less. Only music he has already played is
 * drilled, and nothing in `skip` (the bars the section is about to teach anyway).
 */
export function nextDrill(song: Song, st = loadMastery(song.entry.id), now = Date.now(), skip?: { from: number; to: number }): MLesson | null {
  const m = model(song);
  const seen = (k: string) => (st.items[k]?.n ?? 0) >= 4;
  const plays = new Map<number, number>();
  for (const o of m.order) for (let b = o.from; b <= o.to; b++) {
    const part = m.parts.find(p => p.n === o.of);
    const src = part ? part.from + (b - o.from) : b;
    plays.set(src, (plays.get(src) ?? 0) + 1);
  }
  const recent = new Set(st.session.runs.slice(-6).map(r => r.chunk));
  const stretch = (bar: number, weaker: (b: number) => number) => {
    const prev = bar - 1 >= m.first ? weaker(bar - 1) : 2, next = bar + 1 <= m.last ? weaker(bar + 1) : 2;
    return prev <= next ? { from: bar - 1, to: bar } : { from: bar, to: bar + 1 };
  };
  const wants: { kind: LessonKind; from: number; to: number; hands: HandsChoice; need: number; title: string }[] = [];
  const due = (k: string) => (st.items[k]?.due ?? Infinity) <= now;
  const need = (k: string, bar: number) => (1 - strength(st.items[k], now)) * (1 + 0.5 * ((plays.get(bar) ?? 1) - 1)) * (due(k) ? 1.3 : 1);
  for (const h of m.hands) for (let b = m.first; b <= m.last; b++) {
    const k = `b${b}:${h}`;
    if (!seen(k) || strength(st.items[k], now) >= 0.8) continue;
    const s = stretch(b, x => strength(st.items[`b${x}:${h}`], now));
    wants.push({ kind: 'spot', ...s, hands: m.two ? h : m.all, need: need(k, b), title: `${Bars(s.from, s.to)}${m.two ? `, ${handName(h)}` : ''}` });
  }
  if (m.two) for (let b = m.first; b <= m.last; b++) {
    const k = `t${b}`;
    if (!seen(k) || strength(st.items[k], now) >= 0.8) continue;
    const s = stretch(b, x => strength(st.items[`t${x}`], now));
    wants.push({ kind: 'spot', ...s, hands: 'both', need: need(k, b), title: `${Bars(s.from, s.to)}, both hands` });
  }
  // A weak movement is drilled where it is weakest: the bar it happens in that he plays worst.
  const moveBars = new Map<string, Set<number>>();
  for (const [id, k] of m.moves) {
    const set = moveBars.get(k) ?? new Set<number>();
    set.add(m.barOf(song.notes[id]));
    moveBars.set(k, set);
  }
  // A weak movement is drilled on its own: the same move from around the song, one after the other.
  const cuts: { cut: Cut; need: number }[] = [];
  for (const [k, set] of moveBars) {
    const key = `m:${k}`;
    if (!seen(key) || strength(st.items[key], now) >= 0.8) continue;
    const cut = cutMove(song, k, st, now);
    const need = (1 - strength(st.items[key], now)) * (1 + 0.25 * (set.size - 1)) * (due(key) ? 1.3 : 1);
    if (cut && !(skip && cut.bars.every(b => b >= skip.from && b <= skip.to))) { cuts.push({ cut, need }); continue; }
    const h = k.split(':')[0] as Hand;
    const barS = (b: number) => strength(st.items[`b${b}:${h}`], now);
    const bar = [...set].filter(b => st.items[`b${b}:${h}`]).sort((a, b) => barS(a) - barS(b))[0];
    if (bar === undefined) continue;
    const s = stretch(bar, barS);
    wants.push({ kind: 'move', ...s, hands: m.two ? h : m.all, need: (1 - strength(st.items[key], now)) * (1 + 0.25 * (set.size - 1)) * (due(key) ? 1.3 : 1), title: `${Bars(s.from, s.to)}${m.two ? `, ${handName(h)}` : ''}` });
  }

  let best: { l: MLesson; value: number } | null = null;
  for (const w of wants) {
    if (skip && w.from <= skip.to && w.to >= skip.from) continue;
    const variants = [lesson(st, { kind: w.kind, from: w.from, to: w.to, hands: w.hands, wait: true, title: w.title })];
    // With the beat only once the notes are known, free or in their part.
    const notesKnown = known(st, w.from, w.to, w.hands, true) || m.parts.some(p => p.from <= w.from && p.to >= w.to && partLearnt(m, st, p));
    if (notesKnown) for (let r = 0; r <= TOP; r++) variants.push(lesson(st, { kind: w.kind, from: w.from, to: w.to, hands: w.hands, wait: false, rung: r, fingers: 'some', title: `${w.title}, with the beat` }));
    for (const l of variants) {
      const value = w.need * fit(chanceOf(song, l, st, now)) * (recent.has(l.chunk) ? 0.3 : 1);
      if (!best || value > best.value) best = { l, value };
    }
  }
  for (const { cut, need } of cuts) {
    const variants = [moveLesson(cut, true)];
    if (streakOf(st, `move:${cut.move}:free`) >= 2) for (let r = 0; r <= TOP; r++) variants.push(moveLesson(cut, false, r));
    for (const l of variants) {
      const value = need * fit(chanceOf(song, l, st, now)) * (recent.has(l.chunk) ? 0.3 : 1);
      if (!best || value > best.value) best = { l, value };
    }
  }
  return best && best.value >= 0.15 ? { ...best.l, why: best.l.cut ? best.l.why : 'Your weakest spot right now.' } : null;
}

// ---------- The planner: a section at a time ----------

/** Steps go phrase by phrase: about four bars, never fewer than two. */
const PHRASE = 4;
/** Good runs a step takes before it moves on: once in free play, twice with the beat, so he keeps moving through the song. */
const REPS: Record<LessonKind, number> = { hand: 1, together: 1, beat: 2, spot: 2, move: 2, join: 1, song: 1, review: 1 };
/** A good run: 90% right, at most one slip. */
const PASS = 0.9;

/**
 * Finger numbers fade as he learns, the way a teacher pencils them in and then rubs them out:
 * every note while he learns the notes, only where the hand moves once he plays with the beat,
 * none once the part is learnt and he is getting it up to speed or playing the whole song.
 */
const FINGERS: Record<LessonKind, FingerMode> = { hand: 'all', together: 'all', spot: 'all', move: 'all', beat: 'some', join: 'some', song: 'off', review: 'off' };

function lesson(st: MasteryState, o: { kind: LessonKind; from: number; to: number; hands: HandsChoice; wait: boolean; rung?: number; title: string; reps?: number; fingers?: FingerMode }): MLesson {
  const rung = o.wait ? 0 : o.rung ?? Math.max(0, st.rung[ladderKey(o.from, o.to, o.hands)] ?? 0);
  return { why: '', fingers: FINGERS[o.kind], ...o, rung, reps: o.reps ?? REPS[o.kind], chunk: chunkKey(o.from, o.to, o.hands, o.wait, rung), speed: o.wait ? FREE_SPEED : RUNGS[rung] };
}
const withRung = (l: MLesson, rung: number): MLesson => ({ ...l, rung, speed: RUNGS[rung], chunk: l.cut ? `move:${l.cut.move}:beat${rung}` : chunkKey(l.from, l.to, l.hands, l.wait, rung) });

/** A section: the steps of one stretch of practice, played one after the other without stopping. */
export interface MSection { title: string; why: string; lessons: MLesson[]; /** What finishing it means. */ done: string; }

const fastLearner = (st: MasteryState) => st.fast.tries >= 2 && st.fast.clean / st.fast.tries >= 0.6;
/**
 * A part is learnt enough to go on once he has played it with the beat: clean at any speed, nearly
 * right, or tried twice and more than half right. The song keeps moving; what is still weak comes
 * back later (each part faster, the warm-ups, the drills on weak spots), so he feels it growing.
 */
const partLearnt = (m: Model, st: MasteryState, p: Part) => {
  if (topOf(st, ladderKey(p.from, p.to, m.all)) >= 0) return true;
  const runs = RUNGS.map((_, r) => st.chunks[chunkKey(p.from, p.to, m.all, false, r)]).filter(Boolean);
  const best = Math.max(0, ...runs.map(c => c!.best));
  return best >= HARD || (runs.reduce((a, c) => a + c!.runs, 0) >= 2 && best >= 0.6);
};
/** Played well once: that stretch is known and the planner moves on. */
const known = (st: MasteryState, from: number, to: number, hands: HandsChoice, wait: boolean, rung = 0) => streakOf(st, chunkKey(from, to, hands, wait, rung)) >= 1;

/** The bars of a part in phrases of about four. */
function phrases(p: { from: number; to: number }) {
  const out: { from: number; to: number }[] = [];
  for (let b = p.from; b <= p.to; b += PHRASE) out.push({ from: b, to: Math.min(p.to, b + PHRASE - 1) });
  const last = out[out.length - 1];
  if (out.length > 1 && last.to - last.from < 1) { out.pop(); out[out.length - 1].to = last.to; }
  return out;
}

/** The part's phrases as the song's plan splits them (its real musical phrases), else in fours. */
function phrasesOf(p: Part, pp?: PartPlan) {
  if (!pp?.phrases.length || pp.phrases[0] !== p.from) return phrases(p);
  return pp.phrases.map((b, i) => ({ from: b, to: (pp.phrases[i + 1] ?? p.to + 1) - 1 }));
}

/**
 * The part he is learning, the way the song's plan (strategy.ts) says suits this music: its hard
 * spots first, then phrase by phrase in free play (hand by hand, both hands from the start, or the
 * lead hand through the whole part before the other joins), then the part with the beat.
 */
function partSection(song: Song, m: Model, st: MasteryState, p: Part, pp: PartPlan | undefined, focus: Stretch[]): MSection {
  const out: MLesson[] = [];
  const ph = phrasesOf(p, pp);
  const fast = fastLearner(st);
  // A hand with nothing to play in a phrase gets no step of its own there.
  const plays = (h: Hand, f: { from: number; to: number }) => song.notes.some(n => n.hand === h && m.barOf(n) >= f.from && m.barOf(n) <= f.to);
  // Lead hand first.
  const order = pp && m.hands.includes(pp.lead) ? [pp.lead, ...m.hands.filter(h => h !== pp.lead)] : m.hands;
  let mode = m.two ? pp?.hands ?? 'hand-by-phrase' : 'together';
  if (fast && mode === 'hand-by-phrase') mode = 'together';
  const hand = (h: Hand, f: { from: number; to: number }, title?: string) => {
    if (!known(st, f.from, f.to, h, true)) out.push(lesson(st, { kind: 'hand', from: f.from, to: f.to, hands: h, wait: true, title: title ?? `${Bars(f.from, f.to)}, ${handName(h)}` }));
  };
  const together = (f: { from: number; to: number }) => {
    if (!known(st, f.from, f.to, m.all, true)) out.push(lesson(st, { kind: m.two ? 'together' : 'hand', from: f.from, to: f.to, hands: m.all, wait: true, title: m.two ? `${Bars(f.from, f.to)}, both hands` : `${Bars(f.from, f.to)}, free play` }));
  };

  // The hard spots in this part, drilled before he meets them in the music.
  for (const s of focus) {
    if (s.from < p.from || s.to > p.to) continue;
    const h: HandsChoice = s.hand === 'both' ? m.all : s.hand;
    if (!known(st, s.from, s.to, h, true)) out.push({ ...lesson(st, { kind: 'spot', from: s.from, to: s.to, hands: h, wait: true, reps: 1, title: `${Bars(s.from, s.to)}${h !== m.all ? `, ${handName(h)}` : ''}` }), why: 'A hard spot, on its own first.' });
  }

  if (mode === 'lead-hand-first') {
    // The lead hand through the whole part until it runs by itself, then the other, then together.
    for (const h of order) {
      for (const f of ph) if (plays(h, f)) hand(h, f);
      if (ph.length > 1 && plays(h, p)) hand(h, p, `${Bars(p.from, p.to)}, ${handName(h)}`);
    }
    for (const f of ph) if (m.hands.every(h => plays(h, f))) together(f);
  } else {
    for (const f of ph) {
      const both = order.filter(h => plays(h, f));
      // Only one hand plays here: that hand on its own is the whole phrase.
      if (m.two && both.length < 2) { for (const h of both) hand(h, f); continue; }
      if (mode === 'hand-by-phrase') for (const h of order) hand(h, f);
      together(f);
    }
  }
  if (ph.length > 1 && !known(st, p.from, p.to, m.all, true)) out.push(lesson(st, { kind: 'together', from: p.from, to: p.to, hands: m.all, wait: true, reps: 1, fingers: 'some', title: `${Bars(p.from, p.to)}, free play` }));
  // With the beat once the notes are known: on the plan's first rung (70% unless the music is
  // dense or very easy), or a rung lower while the model says that is still too hard for him.
  const start = pp?.rung ?? 1;
  const beat = lesson(st, { kind: 'beat', from: p.from, to: p.to, hands: m.all, wait: false, rung: start, title: `${Bars(p.from, p.to)}, with the beat` });
  out.push(start === 0 || known(st, p.from, p.to, m.all, false, start - 1) ? beat : pickRung(song, st, beat, start));
  return { title: `Part ${p.n}`, why: ph.length > 1 || m.two ? 'Phrase by phrase without the beat, then the part with the metronome.' : 'Notes first, then with the metronome.', lessons: out, done: `Part ${p.n} learnt, with the beat.` };
}

/**
 * A pattern that comes back all through the song (an ostinato, a left-hand figure), learnt on its
 * own before the parts: once it runs by itself, every part that uses it is half learnt.
 */
function patternSection(m: Model, st: MasteryState, s: Stretch): MSection | null {
  const h: HandsChoice = s.hand === 'both' ? m.all : s.hand;
  // Already past it: the part it sits in is learnt.
  if (m.parts.some(p => p.from <= s.from && p.to >= s.from && partLearnt(m, st, p))) return null;
  const free = known(st, s.from, s.to, h, true);
  const beat = topOf(st, ladderKey(s.from, s.to, h)) >= 0;
  if (free && beat) return null;
  const lessons: MLesson[] = [];
  const title = `${Bars(s.from, s.to)}${h !== m.all ? `, ${handName(h)}` : ''}`;
  if (!free) lessons.push(lesson(st, { kind: 'hand', from: s.from, to: s.to, hands: h, wait: true, title }));
  lessons.push(lesson(st, { kind: 'beat', from: s.from, to: s.to, hands: h, wait: false, rung: 1, title: `${title}, with the beat` }));
  return { title: 'The pattern', why: 'It comes back all through the song: learn it once and it is there everywhere.', lessons, done: 'The pattern runs by itself.' };
}

/** The part to review: the weakest one he has learnt, by the strength of its bars today. */
function weakestPart(m: Model, st: MasteryState, now: number): Part | undefined {
  const score = (p: Part) => {
    let sum = 0, n = 0;
    for (let b = p.from; b <= p.to; b++) for (const h of m.hands) { sum += strength(st.items[`b${b}:${h}`], now); n++; }
    return n ? sum / n : 1;
  };
  return [...m.parts].filter(p => partLearnt(m, st, p)).sort((a, b) => score(a) - score(b))[0];
}

/** The section that will teach him the most right now. */
export function planSection(song: Song, st = loadMastery(song.entry.id), now = Date.now()): MSection {
  const sec = plan(song, st, now);
  // The lock-in run on a new day stands alone; any other section may open with one drill on
  // his weakest spot, chosen by the prediction model, away from the bars the section teaches.
  if (sec.lessons.length === 1 && sec.lessons[0].kind === 'song') return sec;
  const learning = sec.lessons.some(l => l.wait && l.kind !== 'join');
  const span = { from: Math.min(...sec.lessons.map(l => l.from)), to: Math.max(...sec.lessons.map(l => l.to)) };
  const drill = nextDrill(song, st, now, learning ? span : undefined);
  const lessons = drill && !sec.lessons.some(l => l.chunk === drill.chunk) ? [drill, ...sec.lessons] : sec.lessons;
  return { ...sec, lessons: bridged(song, st, lessons, now) };
}

/** Below this chance a step is too big a jump: something easier goes in front of it. */
const TOO_HARD = 0.6;
/** At most this many lead-ins in one section, so it stays the section the planner meant. */
const MAX_BRIDGES = 2;

/**
 * An easier way into a step the model thinks he will probably fail, played once just before it:
 * the same music a little slower, the half of it he finds harder, or the harder hand alone. Of
 * those he is likely to play well, the one closest to the target. The step itself stays as the
 * planner made it (the tempo ladder still climbs); the lead-in only makes the jump smaller.
 */
export function bridgeFor(song: Song, st: MasteryState, l: MLesson, now = Date.now()): MLesson | null {
  if (l.cut) return null;
  const m = model(song);
  const opts: MLesson[] = [];
  const like = (o: { from: number; to: number; hands: HandsChoice }, kind: LessonKind) =>
    lesson(st, { kind, from: o.from, to: o.to, hands: o.hands, wait: l.wait, rung: l.rung, fingers: l.fingers, reps: 1, title: `${Bars(o.from, o.to)}${o.hands !== m.all ? `, ${handName(o.hands)}` : ''}${l.wait ? '' : ', with the beat'}` });
  // Slower: the same stretch on a lower rung.
  if (!l.wait) for (let r = l.rung - 1; r >= 0; r--) opts.push({ ...withRung(l, r), kind: 'spot', reps: 1 });
  // Smaller: each half, never under two bars.
  if (l.to - l.from >= 3) {
    const mid = Math.floor((l.from + l.to) / 2);
    opts.push(like({ from: l.from, to: mid, hands: l.hands }, 'spot'), like({ from: mid + 1, to: l.to, hands: l.hands }, 'spot'));
  }
  // One hand: the harder hand alone, with every finger number.
  if (l.hands === 'both' && m.two) for (const h of m.hands) opts.push({ ...like({ from: l.from, to: l.to, hands: h }, 'hand'), fingers: 'all' });
  let best: { l: MLesson; score: number } | null = null;
  for (const o of opts) {
    const p = chanceOf(song, o, st, now);
    if (p < TARGET - 0.07) continue;
    // Among lead-ins he will manage, the hardest teaches the most: closest to the target.
    const score = fit(p);
    if (!best || score > best.score) best = { l: { ...o, why: 'A smaller step first.' }, score };
  }
  return best?.l ?? null;
}

function bridged(song: Song, st: MasteryState, lessons: MLesson[], now: number): MLesson[] {
  const out: MLesson[] = [];
  let n = 0;
  for (const l of lessons) {
    if (n < MAX_BRIDGES && l.kind !== 'spot' && l.kind !== 'move' && chanceOf(song, l, st, now) < TOO_HARD) {
      const b = bridgeFor(song, st, l, now);
      if (b && !lessons.some(x => x.chunk === b.chunk) && !out.some(x => x.chunk === b.chunk)) { out.push(b); n++; }
    }
    out.push(l);
  }
  return out;
}

function plan(song: Song, st: MasteryState, now: number): MSection {
  const m = model(song);
  const today = dayKey(new Date(now));
  const whole = (wait: boolean, rung: number, title: string) => lesson(st, { kind: 'song', from: m.first, to: m.last, hands: m.all, wait, rung, title });
  if (!m.parts.length) return { title: 'The whole song', why: '', lessons: [lesson(st, { kind: 'song', from: 1, to: 1, hands: m.all, wait: true, title: 'The whole song' })], done: '' };

  // The first section of a day checks what stuck overnight.
  const firstToday = st.session.day !== today || !st.session.runs.length;
  // A mastery check that has come due comes first.
  if (st.crown && !st.crown.forever && now >= st.crown.due) {
    const left = CHECK_GAPS.length - st.crown.checks;
    return {
      title: 'Mastery check', lessons: [whole(false, TOP, 'The whole song, full speed')], done: 'Still yours.',
      why: now > st.crown.due + CHECK_GRACE * DAY ? 'Play it clean once more and it is gold again.' : left === 1 ? 'The last check: keep it and the song is yours for good.' : 'Play it through once, 95% right, to keep it mastered.',
    };
  }
  if (firstToday && st.days.length === 1 && !st.days.includes(today)) {
    return { title: 'The whole song', why: 'One more clean run on another day locks it in.', lessons: [whole(false, TOP, 'The whole song, full speed')], done: 'Played clean on another day: it is yours.' };
  }
  if (firstToday && Object.keys(st.chunks).length) {
    const due = m.parts.filter(p => partLearnt(m, st, p)).map(p => {
      let over = 0;
      for (let b = p.from; b <= p.to; b++) for (const h of m.hands) { const it = st.items[`b${b}:${h}`]; if (it && it.due <= now) over++; }
      return { p, over };
    }).filter(x => x.over > 0).sort((a, b) => b.over - a.over)[0];
    if (due) {
      const top = Math.max(0, topOf(st, ladderKey(due.p.from, due.p.to, m.all)));
      return { title: 'Warm-up', why: 'A quick check of what stuck since last time.', lessons: [lesson(st, { kind: 'review', from: due.p.from, to: due.p.to, hands: m.all, wait: false, rung: top, title: `${Bars(due.p.from, due.p.to)}, with the beat` })], done: 'It stuck. On with the song.' };
    }
  }

  // The song's plan: patterns that come back everywhere first, then the parts in its order.
  const plan = strategyOf(song);
  for (const s of plan.patterns) {
    const sec = patternSection(m, st, s);
    if (sec) return sec;
  }
  const ordered = [...m.parts].sort((a, b) => (plan.order.indexOf(a.n) + 1 || 1e9) - (plan.order.indexOf(b.n) + 1 || 1e9));
  // Learn the song part by part, joining each one to the music before it.
  for (const p of ordered) {
    if (!partLearnt(m, st, p)) return partSection(song, m, st, p, plan.parts.find(x => x.n === p.n), plan.focus);
    const prev = m.order.find(q => q.to + 1 === p.from);
    const prevPart = prev && m.parts.find(q => q.n === prev.of);
    if (prev && prevPart && partLearnt(m, st, prevPart) && !known(st, prev.from, p.to, m.all, true)) {
      const rung = Math.max(0, Math.min(topOf(st, ladderKey(prevPart.from, prevPart.to, m.all)), topOf(st, ladderKey(p.from, p.to, m.all))));
      return {
        title: `Bars ${prev.from}-${p.to}`, why: 'Where two parts meet: the seam is where songs fall apart.', done: 'The parts join up.',
        lessons: [
          lesson(st, { kind: 'join', from: prev.from, to: p.to, hands: m.all, wait: true, title: `${Bars(prev.from, p.to)}, free play` }),
          lesson(st, { kind: 'join', from: prev.from, to: p.to, hands: m.all, wait: false, rung, reps: 2, title: `${Bars(prev.from, p.to)}, with the beat` }),
        ],
      };
    }
  }

  // Every part learnt: the whole song, then each part faster, slowest first.
  if (streakOf(st, chunkKey(m.first, m.last, m.all, true)) < 1) {
    return { title: 'The whole song', why: 'All the parts together, start to finish.', lessons: [whole(true, 0, 'The whole song, free play')], done: 'The whole song, start to finish.' };
  }
  const slow = [...m.parts].map(p => ({ p, t: topOf(st, ladderKey(p.from, p.to, m.all)) })).filter(x => x.t < TOP).sort((a, b) => a.t - b.t)[0];
  if (slow) {
    const lk = ladderKey(slow.p.from, slow.p.to, m.all);
    const r = Math.min(TOP, Math.max(slow.t + 1, st.rung[lk] ?? 0));
    const steps = [lesson(st, { kind: 'beat', from: slow.p.from, to: slow.p.to, hands: m.all, wait: false, rung: r, fingers: 'off', title: `${Bars(slow.p.from, slow.p.to)}, with the beat` })];
    if (r < TOP) steps.push(lesson(st, { kind: 'beat', from: slow.p.from, to: slow.p.to, hands: m.all, wait: false, rung: r + 1, fingers: 'off', title: `${Bars(slow.p.from, slow.p.to)}, with the beat` }));
    return { title: `Part ${slow.p.n}`, why: 'With the metronome, a little faster each time.', lessons: steps, done: `Part ${slow.p.n}, faster.` };
  }
  const wholeLk = ladderKey(m.first, m.last, m.all);
  if (topOf(st, wholeLk) < TOP && !st.days.includes(today)) {
    const r = Math.min(TOP, Math.max(2, topOf(st, wholeLk) + 1, st.rung[wholeLk] ?? 0));
    return { title: 'The whole song', why: 'With the metronome, start to finish.', lessons: [whole(false, r, 'The whole song, with the beat')], done: 'The whole song, with the beat.' };
  }
  if (!st.days.length) return { title: 'The whole song', why: 'Full speed, 95% right: the run that counts.', lessons: [whole(false, TOP, 'The whole song, full speed')], done: 'The whole song at full speed.' };
  const weak = weakestPart(m, st, now) ?? m.parts[0];
  return {
    title: `Part ${weak.n}`, done: 'Sharper still.',
    why: st.days.length >= 2 ? 'Mastered. Keeping your weakest part sharp.' : 'The last step is the whole song again on another day. Until then, your weakest part.',
    lessons: [lesson(st, { kind: 'review', from: weak.from, to: weak.to, hands: m.all, wait: false, rung: TOP, title: `${Bars(weak.from, weak.to)}, full speed` })],
  };
}

// ---------- Learning from a run ----------

/** What one chord of the run showed. */
interface GroupEv { ids: number[]; q: number; wrong: number[]; /** Seconds he waited before it (free play). */ stuck?: number; /** Seconds early or late per note, with the beat. */ offs?: { hand: Hand; off: number }[]; }

/** What a run showed. */
export interface RunVerdict {
  pass: boolean;
  accuracy: number;
  /** A smaller stretch to practise first, when the run went wrong in one place. */
  spot?: { lesson: MLesson; line: string };
  /** Set when it is a good moment to stop for today. */
  rest?: string;
  /** The kind of mistake behind most of a run that did not count (hints.ts). */
  hint?: Diagnosis;
}

/** Where it went wrong, as a stretch of at least two bars: the worst bar and its neighbour, one hand if only one hand slipped. */
function zoomIn(m: Model, st: MasteryState, l: MLesson, song: Song, groups: GroupEv[]): { lesson: MLesson; line: string } | null {
  if (!groups.some(g => g.q <= 0.65)) return null;
  const note = (id: number) => song.notes[id];
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
  const spot = (from: number, to: number, hands: HandsChoice, line: string) => {
    const s = lesson(st, { kind: 'spot', from, to, hands, wait: l.wait, rung: Math.max(0, l.rung - 1), title: `${Bars(from, to)}${hands !== m.all ? `, ${handName(hands)}` : ''}` });
    // With the beat: a step slower, or slower still if the model says that is still too hard.
    return { lesson: l.wait ? s : pickRung(song, st, s, s.rung), line };
  };
  // Each hand knows it but together it falls apart in many places: half the stretch at a time.
  const handsKnown = m.two && m.hands.every(h => known(st, l.from, l.to, h, true));
  if (weakBars.length >= 3 && l.hands === 'both' && handsKnown && l.to - l.from >= 3) {
    const mid = Math.floor((l.from + l.to) / 2);
    const first = weakBars.filter(([b]) => b <= mid).length >= weakBars.filter(([b]) => b > mid).length;
    return spot(first ? l.from : mid + 1, first ? mid : l.to, 'both', 'Each hand knows it: together is the hard part. Half at a time first.');
  }
  const [bar, e] = weakBars[0];
  let from = Math.max(l.from, bar - 1), to = bar;
  if (from === to) to = Math.min(l.to, bar + 1);
  if (to - from < 1) return null;
  let hands: HandsChoice = l.hands;
  if (l.hands === 'both') {
    const r = Math.min(1, ...e.R), lft = Math.min(1, ...e.L);
    if (r <= 0.65 && lft >= 0.85) hands = 'R';
    else if (lft <= 0.65 && r >= 0.85) hands = 'L';
  }
  if (from === l.from && to === l.to && hands === l.hands) return null;
  // Name the movement when the same one keeps going wrong.
  const moves = new Map<string, number>();
  for (const g of groups) if (g.q <= 0.65) for (const id of g.ids) { const k = m.moves.get(id); if (k) moves.set(k, (moves.get(k) ?? 0) + 1); }
  const move = [...moves.entries()].sort((a, b) => b[1] - a[1])[0];
  const what = move && move[1] >= 2 ? `${moveLabel(move[0])} keeps slipping` : `${Bars(bar, bar)} tripped you up`;
  return spot(from, to, hands, `${what}. ${Bars(from, to)} on ${hands === l.hands ? 'their own' : `the ${handName(hands)}`} first.`);
}

/**
 * Takes in a finished run: updates the strengths, the chunk's record and the tempo ladder, finds
 * where it went wrong, and says whether it is time to stop for today.
 */
export function learn(song: Song, l: MLesson, groups: GroupEv[], run: { accuracy: number; cutShort: boolean; rewinds: number }, seen?: Features): RunVerdict {
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
      add(`b${m.barOf(n)}:${n.hand}`, g.q);
      const mv = m.moves.get(i);
      if (mv) add(`m:${mv}`, g.q);
    }
    if (hands.size > 1) add(`t${m.barOf(song.notes[g.ids[0]])}`, g.q);
  }
  for (const [k, a] of Object.entries(acc)) {
    const it = st.items[k] ?? { s: 0.4, n: 0, at: now, h: st.h0, due: now };
    const q = a.sum / a.n;
    // Coming back after a gap: what is left shows how fast it fades for him (memory.ts).
    const away = (now - it.at) / DAY;
    if (it.n > 0 && away >= GAP && a.n >= 2) {
      const r = relearn(it.h, it.s, q, away);
      it.h = r.h;
      st.h0 = typical(st.h0, r.shown);
    }
    it.s += Math.min(0.5, 0.2 + 0.05 * a.n) * (q - it.s);
    it.n += a.n;
    it.at = now;
    // Review just before it fades: sooner for what fades fast, later for what sticks.
    it.due = now + dueIn(it.h) * DAY;
    st.items[k] = it;
  }

  // The chunk's record. A good run is 90% right with at most one slip.
  const wrongs = groups.reduce((a, g) => a + g.wrong.length, 0);
  const pass = run.accuracy >= PASS && !run.cutShort && run.rewinds <= 1;
  // The prediction model learns from what it expected before the run and what happened.
  if (seen && groups.length) observe(seen, pass, { song: id, chunk: l.chunk, kind: l.kind, acc: run.accuracy });
  const perfect = pass && !wrongs && !run.rewinds && run.accuracy >= 0.999;
  const c = st.chunks[l.chunk] ?? { runs: 0, streak: 0, best: 0, last: 0, at: now };
  if (c.runs === 0 && l.kind !== 'review') { st.fast.tries++; if (perfect) st.fast.clean++; }
  c.runs++;
  c.streak = pass ? c.streak + 1 : 0;
  c.best = Math.max(c.best, run.accuracy);
  c.last = run.accuracy;
  c.at = now;
  st.chunks[l.chunk] = c;

  // The tempo ladder: enough good runs climb a rung, a run below the zone steps one down.
  if (!l.wait && !l.cut) {
    const lk = ladderKey(l.from, l.to, l.hands);
    if (pass && c.streak >= Math.min(2, l.reps)) {
      st.top[lk] = Math.max(topOf(st, lk), l.rung);
      st.rung[lk] = Math.min(TOP, Math.max(st.rung[lk] ?? 0, l.rung + 1));
    } else if ((run.accuracy < HARD || run.cutShort) && l.kind !== 'review') {
      st.rung[lk] = Math.max(0, Math.min(st.rung[lk] ?? l.rung, l.rung) - 1);
    }
    // The run that counts: the whole song, full speed, 95% right.
    const counts = pass && run.accuracy >= CLEAN && l.from === m.first && l.to === m.last && l.rung === TOP;
    if (counts && !st.days.includes(today)) st.days.push(today);
    // Mastery checks: the first 100% starts them; a clean run once a check is due keeps it.
    if (counts && !st.crown && st.days.length >= 2) st.crown = { at: now, checks: 0, due: now + CHECK_GAPS[0] * DAY };
    else if (counts && st.crown && !st.crown.forever && now >= st.crown.due) {
      if (now > st.crown.due + CHECK_GRACE * DAY) st.crown = { at: st.crown.at, checks: 0, due: now + CHECK_GAPS[0] * DAY };
      else {
        st.crown.checks++;
        if (st.crown.checks >= CHECK_GAPS.length) st.crown.forever = true;
        else st.crown.due = now + CHECK_GAPS[st.crown.checks] * DAY;
      }
    }
  }

  const spot = pass || l.cut ? null : zoomIn(m, st, l, song, groups);
  // Wrong notes next to the right key point at the hand's position: show the fingers.
  const near = groups.flatMap(g => g.wrong.map(w => Math.min(...g.ids.map(i => Math.abs(song.notes[i].midi - w))))).filter(d => d <= 2).length;
  if (spot && wrongs >= 2 && near / wrongs >= 0.5) spot.lesson.fingers = 'all';

  // Is he still improving today? Four runs in a row with nothing gained, or three getting worse,
  // and it is time to stop: more now would only practise the mistakes.
  if (st.session.day !== today) st.session = { day: today, runs: [], restAt: 0 };
  const after = meterOf(song, st, now).value;
  st.session.runs.push({ acc: run.accuracy, progress: pass || after - before >= 0.002, chunk: l.chunk });
  const recent = st.session.runs.slice(st.session.restAt);
  const flat = recent.length >= 6 && recent.slice(-6).every(r => !r.progress);
  const last3 = recent.slice(-3);
  const worse = recent.length >= 4 && last3.every(r => r.chunk === l.chunk) && last3[1].acc < last3[0].acc && last3[2].acc < last3[1].acc && last3[2].acc < HARD;
  let rest: string | undefined;
  if (flat || worse) {
    st.session.restAt = st.session.runs.length;
    rest = 'A good moment to stop: your playing has levelled off for today, and sleep turns practice into skill. Come back tomorrow.';
  } else if (st.days.length === 1 && st.days[0] === today && pass && l.from === m.first && l.to === m.last && l.rung === TOP) {
    rest = 'The whole song, clean at full speed. Play it like that on another day and it is yours.';
  }

  // Why it went wrong, for a short hint.
  const hint = pass ? null : diagnose(groups.map(g => ({
    notes: g.ids.map(i => ({ midi: song.notes[i].midi, hand: song.notes[i].hand, leap: (m.moves.get(i) ?? '').includes('leap') })),
    wrong: g.wrong, stuck: g.stuck ?? 0, offs: g.offs ?? [], bar: l.cut ? undefined : m.barOf(song.notes[g.ids[0]]),
  })), l.wait);

  saveMastery(id, st);
  return { pass, accuracy: run.accuracy, spot: spot ?? undefined, rest, hint: hint ?? undefined };
}

// ---------- Listening to a run ----------

/**
 * Follows the engine through a run and scores every chord: right first time and without pausing
 * is 1, found after a pause or wrong notes less, missed 0; with the beat, early or late costs a little.
 */
function track(song: Song, l: MLesson, engine: Engine) {
  const seen = featuresOf(song, l);
  // A drill's notes are the song's own: what he plays counts for the bars they come from.
  const real = (ids: number[]) => (l.cut ? ids.map(i => l.cut!.src[i]) : ids);
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
    // The first chord waits for him to get ready: its pause is not hesitation.
    const stuck = free() && firstSettled && gi === cur && waitStart ? (now - waitStart) / 1000 : 0;
    const offs = free() ? [] : g.ids.filter(id => offsets.has(id)).map(id => ({ hand: engine.song.notes[id].hand, off: offsets.get(id)! }));
    if (st.some(s => s === MISS)) q = 0;
    else if (free()) {
      q = 1 - Math.min(0.5, Math.max(0, stuck - 1.5) * 0.15) - Math.min(0.7, wrong.length * 0.35);
    } else {
      const off = Math.max(0, ...g.ids.map(id => Math.abs(offsets.get(id) ?? 0)));
      q = 1 - (off > 0.12 ? 0.25 : 0) - Math.min(0.7, wrong.length * 0.5);
    }
    firstSettled = true;
    groups.push({ ids: real(g.ids), q: Math.max(0, q), wrong, stuck, offs });
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
    finish: (): RunVerdict => {
      check();
      off();
      // Chords he slipped on and never got past (the run stopped first) are failures too.
      for (const [gi, wrong] of wrongAt) {
        const g = engine.groups[gi];
        if (g) groups.push({ ids: real(g.ids), q: 0, wrong });
      }
      const { accuracy } = engine.stats();
      return learn(song, l, groups, { accuracy, cutShort: engine.cutShort, rewinds: engine.rewinds }, seen);
    },
  };
}

// ---------- A section as the lesson screen plays it ----------

export interface MasteryVerdict {
  before: number;
  after: number;
  /** What the section achieved, in a line. */
  line: string;
  /** Set when it is a good moment to stop for today. */
  rest?: string;
  accuracy: number;
}

/** What the lesson does after a run: the same step again, the next one, a smaller stretch first, or the end. */
export interface RepOutcome { kind: 'again' | 'next' | 'insert' | 'done'; pass: boolean; line?: string }

/**
 * With the beat, while he is new to it, the music waits a moment at a note he has not played
 * instead of marking it missed and sending him back: longest on the slowest rung, none from 80%.
 * The run that counts (the whole song, a review, a mastery check) is played for real.
 */
const GRACE = [1.5, 1, 0.5, 0, 0];
const graceOf = (l: MLesson) => (l.wait || l.kind === 'song' || l.kind === 'review' ? 0 : GRACE[l.rung] ?? 0);

const stepOf = (l: MLesson): CourseStep => ({
  id: `m:${l.chunk}`, kind: l.wait ? 'phrase' : 'tempo', title: l.title, short: 'M',
  from: l.from, to: l.to, hands: l.hands, speed: l.speed, wait: l.wait, exact: true, fingers: l.fingers, reps: l.reps, song: l.cut?.song,
  grace: graceOf(l),
});

/**
 * One section of Mastery, Simply Piano style: its steps play one after the other, each until it
 * has its good runs (the dots), with no screens in between. A step that keeps going wrong in one
 * place gets a smaller stretch put in front of it; one that keeps going wrong with the beat slows
 * down; one that will not come right is left for another day rather than drilled wrong.
 */
export class MasterySession {
  readonly steps: CourseStep[];
  readonly lessons: MLesson[];
  /** Good runs per step, for the dots. */
  readonly good: number[];
  private fails: number[];
  readonly title: string;
  readonly why: string;
  private doneLine: string;
  readonly before: number;
  private accs: number[] = [];
  private rest?: string;
  private zoomed = new Set<string>();
  /** Hints shown so far, per kind, and whether the last run already had one. */
  private hinted = new Map<string, number>();
  private lastHinted = false;

  constructor(readonly song: Song) {
    const sec = planSection(song);
    this.lessons = [...sec.lessons];
    this.steps = this.lessons.map(stepOf);
    this.good = this.lessons.map(() => 0);
    this.fails = this.lessons.map(() => 0);
    this.title = sec.title;
    this.why = sec.why;
    this.doneLine = sec.done;
    this.before = meterOf(song).value;
  }

  get section() {
    return { id: 'mastery', title: this.title, bars: '', from: this.steps[0]?.from ?? 1, steps: this.steps, learnt: false, done: 0 };
  }

  track(engine: Engine, i: number) { return track(this.song, this.lessons[i], engine); }

  private put(i: number, l: MLesson) {
    this.lessons.splice(i, 0, l);
    this.steps.splice(i, 0, stepOf(l));
    this.good.splice(i, 0, 0);
    this.fails.splice(i, 0, 0);
  }

  /**
   * A hint after a run that did not count: one line, never two runs in a row, and each kind at
   * most twice a section, so it helps instead of nagging.
   */
  private hint(v: RunVerdict): string | undefined {
    const d = v.hint;
    const shown = d ? this.hinted.get(d.kind) ?? 0 : 0;
    if (!d || this.lastHinted || shown >= 2) { this.lastHinted = false; return undefined; }
    const line = hintLine(d, shown + this.hinted.size);
    if (!line) return undefined;
    this.hinted.set(d.kind, shown + 1);
    this.lastHinted = true;
    return line;
  }

  after(i: number, v: RunVerdict): RepOutcome {
    this.accs.push(v.accuracy);
    if (v.rest) this.rest = v.rest;
    const l = this.lessons[i];
    const last = i >= this.steps.length - 1;
    if (v.pass) {
      this.lastHinted = false;
      this.good[i]++;
      this.fails[i] = 0;
      if (this.good[i] < l.reps) return { kind: 'again', pass: true };
      return { kind: last ? 'done' : 'next', pass: true };
    }
    this.fails[i]++;
    // The model's chance of getting it right if he simply tries again, after what just happened.
    const hopeless = chanceOf(this.song, l) < 0.5;
    // Twice wrong in the same place: that place on its own first, then back.
    if (this.fails[i] >= 2 && v.spot && !this.zoomed.has(l.chunk) && l.kind !== 'spot') {
      this.zoomed.add(l.chunk);
      this.fails[i] = 0;
      this.put(i, v.spot.lesson);
      return { kind: 'insert', pass: false, line: v.spot.line };
    }
    // Three times wrong with the beat (twice when another try looks hopeless): a little slower.
    if ((this.fails[i] >= 3 || (hopeless && this.fails[i] >= 2)) && !l.wait && l.rung > 0) {
      const slower = withRung(l, l.rung - 1);
      this.lessons[i] = slower;
      this.steps[i] = stepOf(slower);
      this.fails[i] = 0;
      return { kind: 'again', pass: false, line: this.hint(v) };
    }
    // Free play that keeps going wrong where no smaller stretch helps: a lead-in once, if one fits.
    if (this.fails[i] >= 2 && hopeless && !this.zoomed.has(`b:${l.chunk}`)) {
      const b = bridgeFor(this.song, loadMastery(this.song.entry.id), l);
      if (b) {
        this.zoomed.add(`b:${l.chunk}`);
        this.fails[i] = 0;
        this.put(i, b);
        return { kind: 'insert', pass: false };
      }
    }
    // Not coming right today: move on rather than practise it wrong.
    if (this.fails[i] >= 4) return { kind: last ? 'done' : 'next', pass: false };
    return { kind: 'again', pass: false, line: this.hint(v) };
  }

  summary(): MasteryVerdict {
    const accuracy = this.accs.length ? this.accs.reduce((a, x) => a + x, 0) / this.accs.length : 0;
    return { before: this.before, after: meterOf(this.song).value, line: this.doneLine, rest: this.rest, accuracy };
  }
}

/** How fast he forgets this song (dev report): his typical half-life and the spread across bars and moves. */
export function memoryReport(id: string, now = Date.now()) {
  const st = loadMastery(id);
  const items = Object.entries(st.items).map(([k, it]) => ({ k, h: Math.round(it.h * 10) / 10, now: Math.round(strength(it, now) * 100) / 100, dueInDays: Math.round(((it.due - now) / DAY) * 10) / 10 }));
  items.sort((a, b) => a.h - b.h);
  return { h0: Math.round(st.h0 * 100) / 100, shortest: items.slice(0, 5), longest: items.slice(-5), due: items.filter(i => i.dueInDays <= 0).length, items: items.length };
}

/** The meter and the next section for a song, kept fresh as he plays. */
export function useMastery(song?: Song) {
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => onMastery(bump), []);
  useEffect(() => onStrategy(bump), []);
  // The song's teaching plan: asked of the planning model once per song, rules until it answers.
  useEffect(() => { if (song) void askStrategy(song); }, [song]);
  return song ? { meter: meterOf(song), next: planSection(song) } : null;
}

// ---------- Standing: where a song sits in his collection ----------

export type Tier = 'none' | 'bronze' | 'silver' | 'gold' | 'forever';
export const TIER_NAME: Record<Tier, string> = { none: 'Learning', bronze: 'Bronze', silver: 'Silver', gold: 'Gold', forever: 'Forever' };

export interface Standing {
  tier: Tier;
  value: number;
  /** Mastered: when the next check is due (ms), and how many are kept. */
  due?: number;
  checks?: number;
  /** A check was missed: silver until he plays it clean again. */
  lapsed?: boolean;
}

/** Bronze at 50%, silver at 75%, gold at 100% while its checks are kept, forever after three. */
export function standingOf(song: Song, now = Date.now()): Standing {
  const st = loadMastery(song.entry.id);
  const value = meterOf(song, st, now).value;
  const c = st.crown;
  if (c?.forever) return { tier: 'forever', value: 1, checks: c.checks };
  if (c && now <= c.due + CHECK_GRACE * DAY) return { tier: 'gold', value, due: c.due, checks: c.checks };
  if (c) return { tier: 'silver', value, lapsed: true, checks: c.checks };
  return { tier: value >= 0.75 ? 'silver' : value >= 0.5 ? 'bronze' : 'none', value };
}
