/**
 * Reels: a song taught in short vertical videos, TikTok style, one per phase of the music (where
 * the music changes: the opening pattern, the melody, the build...). Each video explains that
 * phase's patterns and tricks: a title card with the idea, the left hand alone and slow, the right
 * hand alone and slow, then both hands at full speed with a caption on the bars that need one, and
 * a tip at the end. A reel is never a recorded video: it is drawn live from the song's own notes
 * (keys lighting up with their finger numbers, the notes falling onto them, the real piano sound),
 * so it is always right and works for any MIDI he brings.
 *
 * The phases and their words are written by hand after reading the score (reelScripts.ts); a song
 * without a script gets phases cut from its course parts and words the rules write from the notes.
 */
import { splitBars } from './analysis';
import { barIndex, barLength, barStart, type BarGrid } from './bars';
import { buildCourse } from './course';
import { readSong } from './reading';
import { SCRIPTS } from './reelScripts';
import { cleanPhase, type PhaseWords } from './reelShape';
import type { Hand, Song, SongNote } from './types';

export type { PhaseWords } from './reelShape';

/** One stretch of a phase video: a hand alone and slow, or both hands. */
export interface Segment { kind: 'L' | 'R' | 'both'; from: number; to: number; speed: number; label: string; }

export interface Reel {
  id: string;
  /** Phase number, from 1. */
  n: number;
  /** Bars of the phase, 1-based, inclusive. */
  from: number;
  to: number;
  words: PhaseWords;
  segments: Segment[];
  /** Bass (or chord) letter of every bar of the phase. */
  chords: { bar: number; name: string }[];
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

// ---------- The rules' phases and words ----------

const shortSeq = (xs: string[]) => {
  // "F G A E" for a sequence; a run of the same letter shows once.
  const out: string[] = [];
  for (const x of xs) if (out[out.length - 1] !== x) out.push(x);
  return out.slice(0, 6).join(' ');
};

/** The phases of a song without a script: its course parts, grouped into at most seven. */
function rulePhases(song: Song): { from: number; to: number }[] {
  const parts = buildCourse(song).parts;
  if (!parts.length) return [];
  const size = Math.max(1, Math.ceil(parts.length / 7));
  const out: { from: number; to: number }[] = [];
  for (let i = 0; i < parts.length; i += size) out.push({ from: parts[i].from, to: parts[Math.min(parts.length, i + size) - 1].to });
  return out;
}

/** Words measured from the notes: the bass line, the right hand's shape, a tip. */
function ruleWords(facts: BarFacts[], n: number, from: number, to: number, twoHands: boolean): PhaseWords {
  const seq = shortSeq(facts.map(f => f.chord));
  const octaves = facts.filter(f => f.octave).length >= facts.length / 2;
  const held = facts.some(f => f.held);
  const all = facts.flatMap(f => f.groups);
  const count = (xs: string[]) => { const m = new Map<string, number>(); xs.forEach(x => m.set(x, (m.get(x) ?? 0) + 1)); return [...m.entries()].sort((a, b) => b[1] - a[1])[0]; };
  const [fig, figN] = count(all) ?? ['', 0];
  const contour = (ps: number[]) => { const u = [...new Set(ps)].sort((a, b) => b - a); return ps.map(p => u.indexOf(p)).join(''); };
  const [shape, shapeN] = count(facts.flatMap(f => f.pitches).filter(ps => ps.length >= 3).map(contour)) ?? ['', 0];
  const repeats = !!fig && figN >= all.length * 0.6;
  const sameShape = !repeats && !!shape && shapeN >= all.length * 0.6;
  const RANK = ['top', 'middle', 'low', 'lowest'];
  const shapeWords = shape.split('').map(r => RANK[Math.min(3, Number(r))]).join(', ');
  const right = repeats ? `One pattern, again and again: ${fig}` : sameShape ? `One shape on every beat: ${shapeWords}` : 'The right hand, beat by beat';
  const left = octaves ? `Octaves carry it: ${seq}` : `The bass line: ${seq}`;
  const cues: Record<number, string> = {};
  for (const f of facts) if (f.moveTo) cues[f.bar] = `Move the right hand: thumb on ${f.moveTo}`;
  return {
    from, to,
    title: `Phase ${n}`,
    hook: twoHands ? (repeats || sameShape ? right : left) : right,
    tricks: twoHands ? [`Left: ${left.charAt(0).toLowerCase()}${left.slice(1)}`, `Right: ${right.charAt(0).toLowerCase()}${right.slice(1)}`] : [right],
    L: octaves ? `Octaves ${seq}: little finger low, thumb high` : `Bass ${seq}${held ? ', each held for the bar' : ''}`,
    R: sameShape ? `${facts.find(f => f.groups.length)?.groups[0] ?? ''}: ${shapeWords}` : repeats ? `${fig}, again and again` : 'Look for the shapes that come back',
    cues,
    tip: sameShape ? 'Same shape on every chord. Find the top note and the hand knows the rest.' : held ? 'Play on beat 1 and hold until the next one.' : 'Slow first. Land both hands on beat 1 together.',
  };
}

// ---------- The written scripts ----------

/** The song's script if it fits these notes: the exact version, or the bass at the fingerprint bars. */
function scriptFor(song: Song, bars: BarFacts[]): PhaseWords[] | null {
  const s = SCRIPTS[song.entry.slot ?? song.entry.id];
  if (!s) return null;
  if (s.version && s.version !== readSong(song).version) return null;
  if (s.fingerprint) {
    const marks = Object.entries(s.fingerprint);
    const same = marks.filter(([bar, bass]) => bars[Number(bar) - 1]?.chord === bass).length;
    if (same < marks.length * 0.7) return null;
  }
  const phases = s.phases.filter(p => p.from <= bars.length).map(p => ({ ...p, to: Math.min(p.to, bars.length) }));
  return phases.length ? phases : null;
}

// ---------- The reels of a song ----------

/** Seconds from the start of bar a to the end of bar b at full speed. */
function seconds(song: Song, grid: BarGrid, a: number, b: number) {
  return song.ticksToSeconds(barStart(grid, b)) - song.ticksToSeconds(barStart(grid, a - 1));
}

const cache = new WeakMap<Song, Reel[]>();

/** One reel per phase, in order. */
export function reelsOf(song: Song): Reel[] {
  const hit = cache.get(song);
  if (hit) return hit;
  const { bars, grid } = songFacts(song);
  const songBars = splitBars(song).bars;
  const twoHands = song.hands.length === 2;
  const scripted = scriptFor(song, bars);
  const phases = scripted ?? rulePhases(song).map((p, i) => ruleWords(bars.slice(p.from - 1, p.to), i + 1, p.from, p.to, twoHands));
  const plays = (bar: number, h: Hand) => songBars[bar - 1]?.notes.some(n => n.hand === h);
  // A stretch that fits its time: from the first bar the hand plays, as many bars as the budget allows.
  const fit = (from: number, to: number, speed: number, budget: number, maxBars: number, h?: Hand) => {
    let a = from;
    if (h) while (a < to && !plays(a, h)) a++;
    let b = a;
    while (b < to && b - a + 1 < maxBars && seconds(song, grid, a, b + 1) / speed <= budget) b++;
    return { from: a, to: b };
  };
  const reels = phases.map((p, i): Reel => {
    const words = (scripted && cleanPhase(p)) || (scripted ? ruleWords(bars.slice(p.from - 1, p.to), i + 1, p.from, p.to, twoHands) : p);
    const segments: Segment[] = [];
    if (twoHands) {
      for (const h of ['L', 'R'] as Hand[]) {
        if (!bars.slice(p.from - 1, p.to).length || !songBars.slice(p.from - 1, p.to).some(b => b.notes.some(n => n.hand === h))) continue;
        segments.push({ kind: h, ...fit(p.from, p.to, 0.7, 10, 2, h), speed: 0.7, label: h === 'L' ? 'Left hand, slow' : 'Right hand, slow' });
      }
    } else {
      segments.push({ kind: 'both', ...fit(p.from, p.to, 0.7, 10, 2), speed: 0.7, label: 'Slow' });
    }
    segments.push({ kind: 'both', ...fit(p.from, p.to, 1, 20, 12), speed: 1, label: twoHands ? 'Both hands' : 'Full speed' });
    return {
      id: `phase-${i + 1}`, n: i + 1, from: p.from, to: p.to, words, segments,
      chords: bars.slice(p.from - 1, p.to).map(f => ({ bar: f.bar, name: f.chord })),
    };
  });
  cache.set(song, reels);
  return reels;
}

// ---------- Timeline: what plays when ----------

export interface ReelNote { t: number; dur: number; midi: number; hand: Hand; finger?: number; vel: number; seg: number; bar: number; /** Beat of the bar, from 0. */ beat: number; }
export interface ReelCard { t: number; until: number; kind: 'title' | 'label' | 'end'; seg?: number; }
export interface ReelTimeline { notes: ReelNote[]; cards: ReelCard[]; passes: { t: number; until: number; speed: number; seg: number }[]; duration: number; lo: Record<Hand, number>; hi: Record<Hand, number>; }

const TITLE = 3, LABEL = 1.4, END = 3, LEAD = 0.35;

export function timelineOf(song: Song, reel: Reel): ReelTimeline {
  const { grid } = splitBars(song);
  const at = (bar: number) => song.ticksToSeconds(barStart(grid, bar - 1));
  const placeOf = (ticks: number) => { const i = barIndex(grid, ticks); return { bar: i + 1, beat: Math.floor((ticks - barStart(grid, i)) / (song.ppq * 4 / grid.sigs[i][1]) + 1e-6) }; };
  const notes: ReelNote[] = [], cards: ReelCard[] = [], passes: ReelTimeline['passes'] = [];
  let t = 0;
  cards.push({ t, until: TITLE, kind: 'title' });
  t = TITLE;
  reel.segments.forEach((sg, k) => {
    cards.push({ t, until: t + LABEL, kind: 'label', seg: k });
    t += LABEL;
    const hands: Hand[] = sg.kind === 'both' ? song.hands : [sg.kind];
    const ns = song.notes.filter(n => hands.includes(n.hand) && n.ticks >= barStart(grid, sg.from - 1) - 1 && n.ticks < barStart(grid, sg.to) - 1);
    const start = at(sg.from);
    const end = Math.max(at(sg.to + 1), ...ns.map(n => n.time + n.duration));
    for (const n of ns) notes.push({ t: t + LEAD + (n.time - start) / sg.speed, dur: n.duration / sg.speed, midi: n.midi, hand: n.hand, finger: n.finger, vel: n.velocity, seg: k, ...placeOf(n.ticks) });
    const until = t + LEAD + (end - start) / sg.speed;
    passes.push({ t, until, speed: sg.speed, seg: k });
    t = until;
  });
  cards.push({ t, until: t + END, kind: 'end' });
  t += END;
  const lo = { R: 127, L: 127 } as Record<Hand, number>, hi = { R: 0, L: 0 } as Record<Hand, number>;
  for (const n of notes) { lo[n.hand] = Math.min(lo[n.hand], n.midi); hi[n.hand] = Math.max(hi[n.hand], n.midi); }
  return { notes, cards, passes, duration: t, lo, hi };
}

/** What every bar holds, to write a script from (window.__reelFacts in the dev console). */
export function reelFacts(song: Song) {
  const { bars } = songFacts(song);
  return {
    phases: reelsOf(song).map(r => ({ n: r.n, from: r.from, to: r.to, title: r.words.title, segments: r.segments })),
    bars: bars.map(f => ({ bar: f.bar, bass: f.chord, octave: f.octave, held: f.held, right: f.groups.join(' | '), moveTo: f.moveTo })),
  };
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
