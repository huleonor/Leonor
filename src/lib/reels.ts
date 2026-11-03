/**
 * Reels: a song taught in short vertical videos, one pattern at a time, TikTok style, each followed
 * by the practice step that drills it. A reel is never a recorded video: it is drawn live from the
 * song's own notes (keys lighting up with their finger numbers, the notes falling onto them, the
 * real piano sound), so it is always right and works for any MIDI he brings.
 *
 * What a song's reels are comes from the notes (the parts, each hand's pattern, the bass under each
 * bar). The words on them (the hook, a caption per bar, a tip) are written by Claude through
 * api/reels.ts, once per song and version, and kept; until that answers, or without a key, rules
 * measured from the notes write them.
 */
import { splitBars } from './analysis';
import { barIndex, barLength, barStart, type BarGrid } from './bars';
import { buildCourse } from './course';
import { readSong } from './reading';
import { BAR_SCRIPTS, REEL_SCRIPTS, type BarScript } from './reelScripts';
import { strategyOf } from './strategy';
import { cleanWords, type ReelFacts, type ReelWords } from './reelShape';
import type { Hand, Song, SongNote } from './types';

export type { ReelWords } from './reelShape';
export type ReelKind = 'intro' | 'L' | 'R' | 'both';

export interface Reel {
  id: string;
  /** Course part it teaches (0 for the song's opening reel). */
  part: number;
  kind: ReelKind;
  /** Bars it shows, 1-based, inclusive. */
  from: number;
  to: number;
  /** The slow first pass ends on this bar (0: no slow pass). */
  slowTo: number;
  /** Speed of the slow pass. */
  slow: number;
  /** Bass (or chord) letter of each bar it shows, in order. */
  chords: { bar: number; name: string }[];
  words: ReelWords;
  /** The practice step that follows it. */
  practice: { section: string; step?: string };
}

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
/** A note's letter, spelt the way the key spells it (sharps, or flats in a flat key). */
export const letter = (m: number, flats = false) => (flats ? FLATS : SHARPS)[((m % 12) + 12) % 12];

// ---------- What each bar holds ----------

interface BarFacts {
  bar: number;
  /** Bass letter of the bar (lowest left-hand note on its first onset), or the best triad. */
  chord: string;
  /** The left hand opens the bar with an octave. */
  octave: boolean;
  /** The left hand holds its first notes through most of the bar. */
  held: boolean;
  /** Right-hand notes grouped by beat, as letters ("E C A C"). */
  groups: string[];
  /** The same groups as pitches. */
  pitches: number[][];
  /** Right-hand thumb note when the hand moves to a new place. */
  moveTo?: string;
}

const TRIADS: [number[], string][] = [[[0, 4, 7], ''], [[0, 3, 7], 'm']];

/** Best major or minor triad for a set of notes, weighted by length. */
function triadOf(ns: SongNote[], flats: boolean): string {
  const w = new Array(12).fill(0);
  for (const n of ns) w[n.midi % 12] += Math.min(2, n.duration);
  let best = '', score = -1;
  for (let root = 0; root < 12; root++) for (const [iv, q] of TRIADS) {
    const s = iv.reduce((a, i) => a + w[(root + i) % 12], 0) + w[root] * 0.5;
    if (s > score) { score = s; best = letter(root, flats) + q; }
  }
  return best;
}

function barFacts(song: Song, notes: SongNote[], bar: number, beatTicks: number, startTicks: number, barTicks: number, prevThumb?: number): BarFacts & { thumb?: number } {
  const L = notes.filter(n => n.hand === 'L');
  const R = notes.filter(n => n.hand === 'R');
  let chord = triadOf(notes, song.fifths < 0);
  let octave = false, held = false;
  if (L.length) {
    const first = Math.min(...L.map(n => n.ticks));
    const opening = L.filter(n => n.ticks === first).sort((a, b) => a.midi - b.midi);
    chord = letter(opening[0].midi, song.fifths < 0);
    octave = opening.length === 2 && opening[1].midi - opening[0].midi === 12;
    held = opening[0].durationTicks >= barTicks * 0.7;
  }
  // Right hand: the top note of each onset, grouped by beat.
  const groups: string[] = [];
  const pitches: number[][] = [];
  const onsets = new Map<number, SongNote[]>();
  for (const n of R) onsets.set(n.ticks, [...(onsets.get(n.ticks) ?? []), n]);
  const sorted = [...onsets.entries()].sort((a, b) => a[0] - b[0]);
  for (const [t, g] of sorted) {
    const beat = Math.floor((t - startTicks) / beatTicks + 1e-6);
    const top = g.reduce((a, b) => (b.midi > a.midi ? b : a));
    groups[beat] = groups[beat] ? `${groups[beat]} ${letter(top.midi, song.fifths < 0)}` : letter(top.midi, song.fifths < 0);
    (pitches[beat] ??= []).push(top.midi);
  }
  // Where the thumb sits: the note played with finger 1, if any.
  const thumbNote = R.find(n => n.finger === 1);
  const thumb = thumbNote?.midi;
  const moveTo = thumb !== undefined && prevThumb !== undefined && thumb !== prevThumb ? letter(thumb, song.fifths < 0) : undefined;
  return { bar, chord, octave, held, groups: groups.filter(Boolean), pitches: pitches.filter(Boolean), moveTo, thumb };
}

function songFacts(song: Song) {
  const { bars, grid } = splitBars(song);
  const out: BarFacts[] = [];
  let thumb: number | undefined;
  for (const b of bars) {
    const beatTicks = song.ppq * 4 / grid.sigs[b.index][1];
    const f = barFacts(song, b.notes, b.index + 1, beatTicks, barStart(grid, b.index), barLength(grid, b.index), thumb);
    if (f.thumb !== undefined) thumb = f.thumb;
    out.push(f);
  }
  return { bars: out, grid };
}

/** Seconds a bar lasts at full speed (from the song's own tempo map). */
export function barSeconds(song: Song, grid: BarGrid, bar: number) {
  return song.ticksToSeconds(barStart(grid, bar)) - song.ticksToSeconds(barStart(grid, bar - 1));
}

// ---------- The rules' words ----------

const shortSeq = (xs: string[]) => {
  // "F G A E" for a sequence; a run of the same letter shows once.
  const out: string[] = [];
  for (const x of xs) if (out[out.length - 1] !== x) out.push(x);
  return out.slice(0, 6).join(' ');
};

function ruleWords(kind: ReelKind, facts: BarFacts[], part: number, title: string): ReelWords {
  const seq = shortSeq(facts.map(f => f.chord));
  const cues: { bar: number; text: string }[] = [];
  if (kind === 'intro') {
    return {
      title,
      hook: 'Listen first: this is where we are going',
      cues: facts.slice(0, 1).map(f => ({ bar: f.bar, text: 'Watch the keys light up as it plays' })),
      tip: 'Every part comes as a short video, then you play it yourself.',
    };
  }
  if (kind === 'L') {
    const octaves = facts.filter(f => f.octave).length >= facts.length / 2;
    for (const f of facts) {
      cues.push({
        bar: f.bar,
        text: f.octave ? `Octave on ${f.chord}: little finger 5 low, thumb high, together` : `Bass on ${f.chord}${f.held ? ', hold it for the whole bar' : ''}`,
      });
    }
    return {
      title: `Part ${part}: left hand`,
      hook: octaves ? `Four octaves carry it: ${seq}` : `The bass line: ${seq}`,
      cues,
      tip: facts.some(f => f.held) ? 'Play on beat 1 and hold until the next one.' : 'Keep the hand loose and let the wrist move it.',
    };
  }
  if (kind === 'R') {
    // A figure that comes back beat after beat: the same notes, or the same shape (which note is
    // high, middle, low) on whatever notes the chord gives it.
    const all = facts.flatMap(f => f.groups);
    const count = (xs: string[]) => { const m = new Map<string, number>(); xs.forEach(x => m.set(x, (m.get(x) ?? 0) + 1)); return [...m.entries()].sort((a, b) => b[1] - a[1])[0]; };
    const [fig, figN] = count(all) ?? ['', 0];
    const contour = (ps: number[]) => { const u = [...new Set(ps)].sort((a, b) => b - a); return ps.map(p => u.indexOf(p)).join(''); };
    const shapes = facts.flatMap(f => f.pitches).filter(ps => ps.length >= 3).map(contour);
    const [shape, shapeN] = count(shapes) ?? ['', 0];
    const repeats = figN >= all.length * 0.6;
    const sameShape = !repeats && shapeN >= all.length * 0.6;
    const RANK = ['top', 'middle', 'low', 'lowest'];
    const shapeWords = shape.split('').map(r => RANK[Math.min(3, Number(r))]).join(', ');
    for (const f of facts) {
      if (!f.groups.length) continue;
      const text = f.moveTo ? `Move the hand: thumb on ${f.moveTo}`
        : sameShape ? `${f.groups[0]}: ${shapeWords}`
        : repeats ? `${f.groups.length === 1 ? 'Once' : `${f.groups.length} times`}: ${f.groups[0]}`
        : `One little group on each beat`;
      cues.push({ bar: f.bar, text });
    }
    return {
      title: `Part ${part}: right hand`,
      hook: repeats ? `One pattern, again and again: ${fig}` : sameShape ? `One shape all the way: ${shapeWords}` : 'The right hand, beat by beat',
      cues,
      tip: sameShape ? 'Same shape on every chord. Find the first note and the hand knows the rest.' : repeats ? 'Keep the hand still over the keys and let the pattern roll.' : 'Look for the shapes that come back.',
    };
  }
  for (const f of facts) cues.push({ bar: f.bar, text: `Left ${f.chord} on beat 1, the right hand keeps going` });
  return {
    title: `Part ${part}: both hands`,
    hook: 'Now put them together',
    cues,
    tip: 'Slow is fine. Land both hands on beat 1 together.',
  };
}

// ---------- The reels of a song ----------

/** Fit a reel in about 30 seconds: a slow pass of the first bars, then the whole stretch at full speed. */
function fitPasses(song: Song, grid: BarGrid, from: number, to: number) {
  const secs = (a: number, b: number) => { let s = 0; for (let x = a; x <= b; x++) s += barSeconds(song, grid, x); return s; };
  let real = to;
  while (real > from && secs(from, real) > 16) real--;
  const slow = secs(from, from) > 6 ? 0.75 : 0.6;
  let slowTo = Math.min(real, from + 3);
  while (slowTo > from && secs(from, slowTo) / slow > 14) slowTo--;
  return { real, slowTo, slow };
}

const cache = new WeakMap<Song, Reel[]>();

/** The song's reels in the order to watch them: the opening, then per part each hand and both. */
export function reelsOf(song: Song): Reel[] {
  const hit = cache.get(song);
  if (hit) return hit;
  const course = buildCourse(song);
  const { bars, grid } = songFacts(song);
  const songBars = splitBars(song).bars;
  const plan = strategyOf(song);
  const twoHands = song.hands.length === 2;
  const stored = scriptOf(song);
  const byBar = barScriptOf(song, bars);
  const reels: Reel[] = [];
  const add = (r: Omit<Reel, 'words' | 'chords'>, title: string) => {
    const facts = bars.slice(r.from - 1, r.to);
    const rules = ruleWords(r.kind, facts, r.part, title);
    const words = stored?.[r.id] ?? byBar?.(r, rules) ?? rules;
    reels.push({ ...r, words, chords: facts.map(f => ({ bar: f.bar, name: f.chord })) });
  };

  const firstPart = course.parts[0];
  if (firstPart) {
    const p = fitPasses(song, grid, firstPart.from, Math.min(course.parts[course.parts.length - 1].to, firstPart.from + 7));
    add({ id: 'intro', part: 0, kind: 'intro', from: firstPart.from, to: p.real, slowTo: 0, slow: 1, practice: { section: `p${firstPart.n}` } }, song.entry.title);
  }
  for (const part of course.parts) {
    if (part.sameAs) continue;
    const steps = course.steps.filter(s => s.part === part.n);
    const stepFor = (h: 'L' | 'R' | 'both') => steps.find(s => s.hands === h)?.id ?? steps[0]?.id;
    const p = fitPasses(song, grid, part.from, part.to);
    const lead = plan.parts.find(x => x.n === part.n)?.lead ?? 'R';
    const hands: Hand[] = twoHands ? (lead === 'L' ? ['L', 'R'] : ['R', 'L']) : song.hands;
    for (const h of hands) {
      // A hand's reel starts where that hand comes in: no bars of silence to watch.
      let from = part.from;
      while (from < part.to && !songBars[from - 1]?.notes.some(n => n.hand === h)) from++;
      const q = from === part.from ? p : fitPasses(song, grid, from, part.to);
      add({ id: `p${part.n}-${h}`, part: part.n, kind: twoHands ? h : 'both', from, to: q.real, slowTo: q.slowTo, slow: q.slow, practice: { section: `p${part.n}`, step: stepFor(twoHands ? h : 'both') } }, `Part ${part.n}`);
    }
    if (twoHands) {
      add({ id: `p${part.n}-both`, part: part.n, kind: 'both', from: part.from, to: p.real, slowTo: p.slowTo, slow: p.slow, practice: { section: `p${part.n}`, step: stepFor('both') } }, `Part ${part.n}`);
    }
  }
  cache.set(song, reels);
  return reels;
}

// ---------- Timeline: what plays when ----------

export interface ReelNote { t: number; dur: number; midi: number; hand: Hand; finger?: number; vel: number; pass: number; bar: number; /** Beat of the bar, from 0. */ beat: number; }
export interface ReelCard { t: number; until: number; kind: 'title' | 'speed' | 'end'; }
export interface ReelTimeline { notes: ReelNote[]; cards: ReelCard[]; passes: { t: number; until: number; speed: number }[]; duration: number; lo: Record<Hand, number>; hi: Record<Hand, number>; }

const TITLE = 2.2, GAP = 1.8, END = 2.5, LEAD = 0.35;

export function timelineOf(song: Song, reel: Reel): ReelTimeline {
  const { grid } = splitBars(song);
  const at = (bar: number) => song.ticksToSeconds(barStart(grid, bar - 1));
  const hands: Hand[] = reel.kind === 'L' ? ['L'] : reel.kind === 'R' ? ['R'] : song.hands;
  const notesIn = (a: number, b: number) => song.notes.filter(n => hands.includes(n.hand) && n.ticks >= barStart(grid, a - 1) - 1 && n.ticks < barStart(grid, b) - 1);
  const placeOf = (ticks: number) => { const i = barIndex(grid, ticks); return { bar: i + 1, beat: Math.floor((ticks - barStart(grid, i)) / (song.ppq * 4 / grid.sigs[i][1]) + 1e-6) }; };
  const notes: ReelNote[] = [], cards: ReelCard[] = [], passes: ReelTimeline['passes'] = [];
  let t = 0;
  cards.push({ t, until: TITLE, kind: 'title' });
  t = TITLE;
  const pass = (a: number, b: number, speed: number, k: number) => {
    const start = at(a);
    const ns = notesIn(a, b);
    const end = Math.max(at(b + 1), ...ns.map(n => n.time + n.duration));
    for (const n of ns) {
      notes.push({ t: t + LEAD + (n.time - start) / speed, dur: n.duration / speed, midi: n.midi, hand: n.hand, finger: n.finger, vel: n.velocity, pass: k, ...placeOf(n.ticks) });
    }
    const until = t + LEAD + (end - start) / speed;
    passes.push({ t, until, speed });
    t = until;
  };
  if (reel.slowTo && reel.slow < 1) {
    pass(reel.from, reel.slowTo, reel.slow, 0);
    cards.push({ t, until: t + GAP, kind: 'speed' });
    t += GAP;
  }
  pass(reel.from, reel.to, 1, passes.length);
  cards.push({ t, until: t + END, kind: 'end' });
  t += END;
  const lo = { R: 127, L: 127 } as Record<Hand, number>, hi = { R: 0, L: 0 } as Record<Hand, number>;
  for (const n of notes) { lo[n.hand] = Math.min(lo[n.hand], n.midi); hi[n.hand] = Math.max(hi[n.hand], n.midi); }
  return { notes, cards, passes, duration: t, lo, hi };
}

// ---------- The written scripts ----------

/**
 * The words on a song's reels, written by hand after reading its score bar by bar (the bank in
 * reelScripts.ts), for the exact version of the notes they were written for: another MIDI file of
 * the same piece gets the rules' words. A reel the bank leaves out, or a line too long for the
 * screen, falls back to the rules too.
 */
function scriptOf(song: Song): Record<string, ReelWords> | null {
  const s = REEL_SCRIPTS[song.entry.slot ?? song.entry.id];
  if (!s || s.version !== readSong(song).version) return null;
  const out: Record<string, ReelWords> = {};
  for (const [id, w] of Object.entries(s.reels)) { const c = cleanWords(w); if (c) out[id] = c; }
  return out;
}

/**
 * A script written from a printed score, by bar number (BAR_SCRIPTS): it fits any MIDI file of that
 * score, however its parts are cut, as long as the bass of the file's bars matches the score's (so
 * another arrangement of the same piece never gets the wrong words). Each reel takes the hook and
 * tip of the section it starts in, for its hand, and the cues of its own bars.
 */
function barScriptOf(song: Song, bars: BarFacts[]): ((r: Omit<Reel, 'words' | 'chords'>, rules: ReelWords) => ReelWords | undefined) | null {
  const s: BarScript | undefined = BAR_SCRIPTS[song.entry.slot ?? song.entry.id];
  if (!s) return null;
  const marks = Object.entries(s.fingerprint);
  const same = marks.filter(([bar, bass]) => bars[Number(bar) - 1]?.chord === bass).length;
  if (same < marks.length * 0.7) return null;
  return (r, rules) => {
    if (r.kind === 'intro') return cleanWords({ ...s.intro, title: song.entry.title }) ?? undefined;
    const sec = s.sections.find(x => r.from >= x.from && r.from <= x.to);
    if (!sec) return undefined;
    const cues = Object.entries(s.cues[r.kind]).map(([bar, text]) => ({ bar: Number(bar), text })).filter(c => c.bar >= r.from && c.bar <= r.to);
    return cleanWords({ title: rules.title, hook: sec[r.kind].hook, tip: sec[r.kind].tip, cues: cues.length ? cues : rules.cues }) ?? undefined;
  };
}

/** What each reel shows, bar by bar: what the scripts are written from (see scripts/reel-facts). */
export function reelFacts(song: Song): ReelFacts[] {
  const { bars } = songFacts(song);
  return reelsOf(song).map(r => ({
    id: r.id, kind: r.kind, part: r.part, from: r.from, to: r.to,
    bars: bars.slice(r.from - 1, r.to).map(f => ({ bar: f.bar, bass: f.chord, octave: f.octave, held: f.held, right: f.groups.join(' | '), moveTo: f.moveTo })),
  }));
}

// ---------- What he has watched ----------

const SEEN = 'hugos-piano:reels-seen';
const seenListeners = new Set<() => void>();
export function seenReels(songId: string): string[] {
  try { return (JSON.parse(localStorage.getItem(SEEN) ?? '{}') as Record<string, string[]>)[songId] ?? []; } catch { return []; }
}
export function markSeen(songId: string, reelId: string) {
  try {
    const all = JSON.parse(localStorage.getItem(SEEN) ?? '{}') as Record<string, string[]>;
    const list = all[songId] ?? [];
    if (list.includes(reelId)) return;
    all[songId] = [...list, reelId];
    localStorage.setItem(SEEN, JSON.stringify(all));
    seenListeners.forEach(fn => fn());
  } catch { /* storage blocked: nothing to remember */ }
}
export function onSeen(fn: () => void) { seenListeners.add(fn); return () => { seenListeners.delete(fn); }; }
