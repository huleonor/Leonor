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
import { cleanPhase, type PhaseWords, type Talk } from './reelShape';
import { estimate } from './voice';
import type { Hand, Song, SongNote } from './types';

export type { PhaseWords } from './reelShape';

/** One stretch of a phase video: a hand alone and slow, or both hands. */
export interface Segment {
  /** The opening listen: the phase at full speed under the voice's idea, before the hands are taken apart. */
  listen?: boolean;
  kind: 'L' | 'R' | 'both'; from: number; to: number; speed: number; label: string;
  /** Only this stretch of the bars, in ticks (a pattern: one beat of a figure), played `times` over. */
  ticks?: [number, number];
  times?: number;
}

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
    L: octaves ? `Octaves: ${seq}. Little finger low, thumb high` : `The bass: ${seq}${held ? ', each held for the bar' : ''}`,
    R: sameShape ? `${facts.find(f => f.groups.length)?.groups[0] ?? ''}: ${shapeWords}` : repeats ? `${fig}, again and again` : 'Look for the shapes that come back',
    cues,
    tip: sameShape ? 'Same shape on every chord. Find the top note and the hand knows the rest.' : held ? 'Play on beat 1 and hold until the next one.' : 'Slow first. Land both hands on beat 1 together.',
  };
}

/**
 * What the voice says when no line was written for a phase: its own words, as sentences a teacher
 * would say (note letters always as a list with commas, so the recorded voice can read them).
 */
function ruleTalk(w: PhaseWords, twoHands: boolean): Talk {
  const end = (x: string) => (/[.!?]$/.test(x.trim()) ? x.trim() : `${x.trim()}.`);
  const commas = (x: string) => x.replace(/\b([A-G](?:#|b)?m?) (?=[A-G](?:#|b)?m?\b)/g, '$1, ');
  const [left, right] = w.tricks.map(t => t.replace(/^(Left|Right): /, ''));
  const useful = (x?: string) => !!x && !/beat by beat/.test(x);
  const cap1 = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
  const intro = twoHands
    ? [left, useful(right) ? right : ''].filter(Boolean).map(x => end(commas(cap1(x)))).join(' ')
    : useful(w.hook) ? end(commas(w.hook)) : 'Listen first. Then we take it slowly, a few bars at a time.';
  return {
    intro,
    L: `Left hand. ${end(commas(w.L))}`,
    R: /shapes that come back/.test(w.R) ? 'Right hand. Look for the shapes that come back.' : `Right hand. ${end(commas(w.R))}`,
    both: twoHands ? 'Now both hands together, at full speed.' : 'Now at full speed.',
    outro: end(w.tip),
  };
}

// ---------- The written scripts ----------

/** The song's script if it fits these notes: the exact version, or the bass at the fingerprint bars. */
function scriptFor(song: Song, bars: BarFacts[]): PhaseWords[] | null {
  const fits = (sc: (typeof SCRIPTS)[string]) => {
    if (sc.version && sc.version !== readSong(song).version) return false;
    if (sc.fingerprint) {
      const marks = Object.entries(sc.fingerprint);
      const same = marks.filter(([bar, bass]) => bars[Number(bar) - 1]?.chord === bass).length;
      if (same < marks.length * 0.7) return false;
    }
    return !!sc.version || !!sc.fingerprint;
  };
  // The song's own script; or, for a MIDI he added as a new song (not into its slot), the script
  // whose printed score his notes match.
  const own = SCRIPTS[song.entry.slot ?? song.entry.id];
  const s = own && fits(own) ? own : Object.values(SCRIPTS).find(sc => sc.fingerprint && fits(sc));
  if (!s) return null;
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
    const written = (scripted && cleanPhase(p)) || (scripted ? ruleWords(bars.slice(p.from - 1, p.to), i + 1, p.from, p.to, twoHands) : p);
    const words = written.talk ? written : { ...written, talk: ruleTalk(written, twoHands) };
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

// ---------- The videos: each phase in small steps, slow first ----------

/**
 * One short video of the feed. Each phase is cut into small steps he copies as they loop, TikTok
 * style: first the idea (the phase heard once), then two bars at a time, a hand alone and slow
 * (only for a shape he has not met yet), both hands slow, and at the end the whole phase, still
 * below full speed. A shape that comes back (the same notes, or the same shape from another note)
 * is not taught again: only both hands, with the voice saying where it starts now.
 */
export interface Clip extends Reel {
  /** The phase it belongs to. */
  phase: Reel;
  /** Its place in the phase, from 1, and how many the phase has. */
  k: number;
  of: number;
  kind: 'intro' | 'pattern' | 'L' | 'R' | 'both' | 'run';
  /** The big line of the video: the idea, or the notes of the step. */
  head: string;
  /** What the voice says. */
  say: string;
  /** The stretch in words ("bars 3 and 4"). */
  where: string;
  /** What the next video teaches, said at the end so the series carries on ("the left hand"). */
  next?: string;
  /** The step of the phase it teaches (videos of one step share it). */
  step?: number;
  /** A both-hands video of shapes he already knows, and its bass line. */
  knownStep?: boolean;
  bassLine?: string[];
}

// Speeds: a hand alone at half speed, both hands a little faster, the whole phase at three quarters.
const SLOW_HAND = 0.5, SLOW_BOTH = 0.6, RUN = 0.75;

const clipCache = new WeakMap<Song, Clip[]>();

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
const barsText = (a: number, b: number) => (a === b ? `bar ${a}` : b === a + 1 ? `bars ${a} and ${b}` : `bars ${a} to ${b}`);
const listOf = (xs: string[]) => xs.join(', ');

/**
 * The right hand of a stretch in words, the way a teacher says it: a figure that keeps its shape is
 * named once (top, middle, low, middle) with the note that moves; a melody is read note by note.
 */
function rightWords(facts: BarFacts[], flats: boolean) {
  const groups = facts.flatMap(f => f.pitches);
  const RANK = ['top', 'middle', 'low', 'lowest'];
  const contour = (ps: number[]) => { const u = [...new Set(ps)].sort((x, y) => y - x); return ps.map(p => u.indexOf(p)).join(''); };
  const figure = groups.length >= 2 && groups.every(g => g.length >= 3 && contour(g) === contour(groups[0]));
  if (figure) {
    const shape = contour(groups[0]).split('').map(r => RANK[Math.min(3, Number(r))]).join(', ');
    const first = groups[0].map(m => letter(m, flats));
    const moves = groups[0].map((_, i) => new Set(groups.map(g => g[i])).size > 1);
    const tops: string[] = [];
    for (const g of groups) { const l = letter(g[0], flats); if (tops[tops.length - 1] !== l) tops.push(l); }
    const moving = moves.filter(Boolean).length;
    const tail = moving === 0 ? 'The same notes on every beat.' : moves[0] && moving === 1 ? `Only the top note moves: ${listOf(tops.slice(0, 6))}.` : 'The shape stays, the notes move with the chord.';
    return { said: `${cap(shape)}, on every beat. Start with ${listOf(first)}. ${tail}`, head: first.slice(0, 5).join(' ') };
  }
  const notes: string[] = [];
  for (const g of groups) for (const m of g) { const l = letter(m, flats); if (notes[notes.length - 1] !== l) notes.push(l); }
  return { said: `${listOf(notes.slice(0, 8))}${notes.length > 8 ? ', and on' : ''}.`, head: notes.slice(0, 5).join(' ') };
}

/** The left hand of a stretch in words: its bass notes, as octaves or held when they are. */
function leftWords(facts: BarFacts[]) {
  const bass: string[] = [];
  for (const f of facts) if (bass[bass.length - 1] !== f.chord) bass.push(f.chord);
  const octaves = facts.every(f => f.octave), held = facts.every(f => f.held);
  const what = octaves ? `An octave on ${bass.join(', then ')}` : `The bass: ${listOf(bass)}`;
  const simple = octaves ? `The left hand only holds an octave: ${listOf(bass)}. Little finger low, thumb on top.` : `The left hand only holds the bass: ${listOf(bass)}.`;
  return { said: `${what}${held ? ', held for the whole bar' : ''}. ${octaves ? 'Little finger low, thumb on top.' : ''}`.trim(), simple, head: octaves ? `${bass.join(' ')} octaves` : bass.join(' ') };
}

const NUMBER = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const BOTH = ['Both hands together now. Nice and slow.', 'Put them together, slowly, both hands landing on beat one.', 'Now both hands. Take your time.'];

/**
 * Every video of a song, phase by phase, in the order he watches them.
 *
 * A phase is cut into steps by musical phrase: two bars at least, more (up to four) until the step
 * holds enough to learn (a dozen notes and four seconds of music), so no video is one held note. In
 * a step, a hand gets its own slow video only when it plays a shape he has not met and has
 * something to learn in it (six notes over three keys or more); a hand that only holds a note or an
 * octave is said in the both-hands video instead. A run of steps made of shapes he knows becomes
 * one both-hands video (up to eight bars), and the very same notes again get none.
 */
export function clipsOf(song: Song): Clip[] {
  const hit = clipCache.get(song);
  if (hit) return hit;
  const reels = reelsOf(song);
  const { bars, grid } = songFacts(song);
  const songBars = splitBars(song).bars;
  const twoHands = song.hands.length === 2;
  const handNotes = (a: number, b: number, h?: Hand) => songBars.slice(a - 1, b).flatMap(x => x.notes).filter(n => !h || n.hand === h).sort((x, y) => x.ticks - y.ticks || x.midi - y.midi);
  const onsets = (a: number, b: number, h?: Hand) => new Set(handNotes(a, b, h).map(n => n.ticks)).size;
  const keys = (a: number, b: number, h?: Hand) => new Set(handNotes(a, b, h).map(n => n.midi)).size;
  // A bar's shape for one hand, whatever note it starts from: its rhythm, and its intervals from the
  // lowest note; for a figure (six notes or more over three pitches or more, like top, middle, low,
  // middle) the order of its pitches from the top, so the same figure over a new chord counts as known.
  const barShape = (bar: number, h?: Hand) => {
    const ns = handNotes(bar, bar, h);
    if (!ns.length) return null;
    const t0 = barStart(grid, bar - 1);
    const pitches = [...new Set(ns.map(n => n.midi))].sort((x, y) => y - x);
    const on = new Set(ns.map(n => n.ticks)).size;
    const figure = on >= 6 && pitches.length >= 3;
    const low = pitches[pitches.length - 1];
    const shape = new Map<number, string>();
    // The top note of each onset carries the shape (an inner note more or less is the same shape).
    const tops = new Map<number, number>();
    for (const n of ns) { const k = n.ticks - t0; tops.set(k, Math.max(tops.get(k) ?? 0, n.midi)); }
    for (const [k, m] of tops) shape.set(k, figure ? `f${pitches.indexOf(m)}` : `i${m - low}`);
    return { shape, len: barLength(grid, bar - 1) };
  };
  // Near enough the same: three quarters of its onsets land at the same place with the same shape
  // (a bar with one more inner note, or one note changed, is still the shape he knows).
  type Shape = NonNullable<ReturnType<typeof barShape>>;
  const alike = (x: Shape, y: Shape) => {
    if (x.len !== y.len) return false;
    let same = 0;
    for (const [k, v] of x.shape) if (y.shape.get(k) === v) same++;
    return same / Math.max(x.shape.size, y.shape.size) >= 0.75;
  };
  // Every bar of the stretch already met, for that hand (bars it does not play count as met).
  const known = (a: number, b: number, h: Hand | undefined, set: Shape[]) => {
    let any = false;
    for (let bar = a; bar <= b; bar++) { const x = barShape(bar, h); if (x) { any = true; if (!set.some(y => alike(x, y))) return false; } }
    return any;
  };
  const remember = (a: number, b: number, h: Hand | undefined, set: Shape[]) => { for (let bar = a; bar <= b; bar++) { const x = barShape(bar, h); if (x) set.push(x); } };
  const plays = (a: number, b: number, h?: Hand) => handNotes(a, b, h).length > 0;
  // Something to learn for this hand alone: six notes or more, over three keys or more.
  const worth = (a: number, b: number, h?: Hand) => onsets(a, b, h) >= 6 && keys(a, b, h) >= 3;
  const seen = { L: [] as Shape[], R: [] as Shape[], both: new Set<string>() };
  const taught = new Set<string>();
  // Slow enough to follow: about this many notes a second at most, never faster than half speed
  // for a hand (60% for both hands), never slower than 30%.
  const slow = (a: number, b: number, h: Hand | undefined, perSecond: number, most = SLOW_HAND) => {
    const dens = onsets(a, b, h) / Math.max(0.5, seconds(song, grid, a, b));
    return Math.round(Math.max(0.3, Math.min(most, perSecond / Math.max(0.1, dens))) * 20) / 20;
  };
  const flats = song.fifths < 0;
  // The figure a hand plays from this bar: the first beat holding three notes or more over three
  // keys or more, when most beats of the bar repeat its shape (top, middle, low, middle).
  const figureAt = (from: number, to: number, h: Hand | undefined) => {
    for (let bar = from; bar <= to; bar++) {
      const t0 = barStart(grid, bar - 1), len = barLength(grid, bar - 1), beat = song.ppq * 4 / grid.sigs[bar - 1][1];
      const ns = handNotes(bar, bar, h);
      const beats: SongNote[][] = [];
      for (let k = 0; k * beat < len - 1; k++) {
        const on = new Map<number, SongNote>();
        for (const n of ns) if (n.ticks >= t0 + k * beat && n.ticks < t0 + (k + 1) * beat && (!on.get(n.ticks) || n.midi > on.get(n.ticks)!.midi)) on.set(n.ticks, n);
        beats.push([...on.values()].sort((x, y) => x.ticks - y.ticks));
      }
      const shapeOf = (g: SongNote[]) => { const u = [...new Set(g.map(n => n.midi))].sort((x, y) => y - x); return g.map(n => `${n.ticks % beat}:${u.indexOf(n.midi)}`).join(','); };
      const k = beats.findIndex(g => g.length >= 3 && new Set(g.map(n => n.midi)).size >= 3);
      if (k < 0) continue;
      const g = beats[k], shape = shapeOf(g);
      if (beats.filter(x => x.length && shapeOf(x) === shape).length < Math.max(2, beats.length / 2)) continue;
      const names = g.map(n => letter(n.midi, flats));
      const fingers: string[] = [];
      const done = new Set<number>();
      for (const n of g) if (!done.has(n.midi)) { done.add(n.midi); if (n.finger) fingers.push(n.finger === 1 ? `Thumb on ${letter(n.midi, flats)}.` : `Finger ${n.finger} on ${letter(n.midi, flats)}.`); }
      const low = Math.min(...g.map(n => n.midi));
      const where = low >= 84 ? 'high up, two octaves above middle C' : low >= 72 ? 'an octave above middle C' : low >= 60 ? 'just above middle C' : low >= 48 ? 'just below middle C' : low >= 36 ? 'an octave below middle C' : 'low down, two octaves below middle C';
      const say = [`First, just the pattern. ${listOf(names)}.`, fingers.length === done.size ? fingers.join(' ') : '', `It sits ${where}.`].filter(Boolean).join(' ');
      return { bar, ticks: [t0 + k * beat, t0 + (k + 1) * beat] as [number, number], shape, head: names.join(' '), say };
    }
    return undefined;
  };
  const out: Clip[] = [];
  for (const r of reels) {
    const talk = r.words.talk;
    const mine: Omit<Clip, 'k' | 'of'>[] = [];
    const make = (kind: Clip['kind'], from: number, to: number, speed: number, label: string, head: string, say: string, step: number, listen = false, extra?: Partial<Segment>): Omit<Clip, 'k' | 'of'> => ({
      ...r, id: `${r.id}-${mine.length + 1}`, phase: r, kind, head, say, from, to, where: barsText(from, to), step,
      segments: [{ kind: kind === 'L' || kind === 'R' ? kind : 'both', from, to, speed, label, listen, ...extra }],
      chords: r.chords.filter(c => c.bar >= from && c.bar <= to),
    });
    // The idea: the opening of the phase heard once, at its real speed, while the voice explains.
    let a0 = r.from, b0 = r.from;
    while (b0 < r.to && seconds(song, grid, a0, b0 + 1) <= Math.max(6, (talk ? estimate(talk.intro) : 6) - 2)) b0++;
    mine.push(make('intro', a0, b0, 1, 'Listen', r.words.hook, talk?.intro ?? r.words.hook, 0, true));
    // The steps: by phrase, two to four bars, until a step has enough in it.
    const chunks: [number, number][] = [];
    for (let a = r.from; a <= r.to;) {
      let b = Math.min(r.to, a + 1);
      while (b < r.to && b - a + 1 < 4 && (onsets(a, b) < 12 || seconds(song, grid, a, b) < 4)) b++;
      chunks.push([a, b]);
      a = b + 1;
    }
    const tail = chunks[chunks.length - 1];
    if (chunks.length > 1 && (tail[0] === tail[1] || onsets(tail[0], tail[1]) < 8) && tail[1] - chunks[chunks.length - 2][0] < 5) { chunks.pop(); chunks[chunks.length - 1][1] = tail[1]; }
    let firstBoth = true, said = 0;
    chunks.forEach(([a, b], ci) => {
      const first = ci === 0;
      const facts = bars.slice(a - 1, b);
      const hR: Hand | undefined = twoHands ? 'R' : undefined;
      // The very same notes again (a repeat in the score): nothing new to show.
      const exact = handNotes(a, b).map(n => `${n.ticks - barStart(grid, a - 1)}:${n.midi}:${n.hand}`).join(',');
      if (seen.both.has(exact)) return;
      const newL = twoHands && plays(a, b, 'L') && !known(a, b, 'L', seen.L);
      const newR = plays(a, b, hR) && !known(a, b, hR, seen.R);
      const soloL = newL && worth(a, b, 'L'), soloR = newR && worth(a, b, hR);
      const lw = leftWords(facts), rw = rightWords(facts, song.fifths < 0);
      // When the step opens with a bar he knows, the voice starts from the new one.
      const freshFrom = (h: Hand | undefined, set: Shape[]) => { for (let bar = a; bar <= b; bar++) if (!known(bar, bar, h, set)) return bar; return a; };
      const fromL = twoHands ? freshFrom('L', seen.L) : a, fromR = freshFrom(hR, seen.R);
      const knownBars = (from: number) => (from - a === 1 ? 'You know the first bar already. Here is the new one.' : 'You know the first bars already. Here is the new part.');
      const lLine = first && talk?.L ? talk.L : fromL > a ? `Left hand. ${knownBars(fromL)} ${leftWords(bars.slice(fromL - 1, b)).said}` : `Left hand. ${lw.said}`;
      const rNew = fromR > a ? rightWords(bars.slice(fromR - 1, b), song.fifths < 0).said : '';
      const rLine = first && talk?.R ? talk.R : `${twoHands ? 'Right hand' : 'Slowly now'}. ${rNew ? `${knownBars(fromR)} ${rNew}` : rw.said}`;
      // A new figure is taught on its own first: one beat of it, slowly, four times, its keys named.
      const patternOf = (h: Hand | undefined, from: number) => {
        const pat = figureAt(from, b, h);
        if (!pat || taught.has(`${h}:${pat.shape}`)) return;
        taught.add(`${h}:${pat.shape}`);
        const extra = { ticks: pat.ticks, times: 4, kind: (h ?? 'both') as Segment['kind'] };
        const m = make('pattern', pat.bar, pat.bar, slow(pat.bar, pat.bar, h, 2), h === 'L' ? 'Left hand pattern, slow' : twoHands ? 'Right hand pattern, slow' : 'The pattern, slow', pat.head, pat.say, ci, false, extra);
        mine.push(m);
      };
      if (soloL) { patternOf('L', fromL); mine.push(make('L', a, b, slow(a, b, 'L', 2.5), 'Left hand, slow', lw.head, lLine, ci)); }
      if (soloR) { patternOf(hR, fromR); mine.push(make('R', a, b, slow(a, b, hR, 2.5), twoHands ? 'Right hand, slow' : 'Slow', rw.head, rLine, ci)); }
      // Only the right hand plays here and it had its own video: nothing to put together.
      const together = twoHands && plays(a, b, 'L') && plays(a, b, hR);
      if (twoHands && (together || !(soloL || soloR))) {
        // What a simple hand does is said here, in the both-hands video.
        const folded = [newL && !soloL ? (first && talk?.L ? talk.L : lw.simple) : '',
          newR && !soloR ? (first && talk?.R ? talk.R : `The right hand is simple here. ${rw.said}`) : ''].filter(Boolean);
        const bass: string[] = [];
        for (const f of facts) if (bass[bass.length - 1] !== f.chord) bass.push(f.chord);
        const knownStep = !newL && !newR;
        const prev = mine[mine.length - 1];
        // Shapes he knows, right after shapes he knows: one longer video instead of several.
        if (knownStep && prev?.kind === 'both' && prev.knownStep && prev.to === a - 1 && b - prev.from < 8) {
          const merged = make('both', prev.from, b, slow(prev.from, b, undefined, 3, SLOW_BOTH), 'Both hands, slow', prev.head, '', prev.step ?? ci);
          const chords = [...(prev.bassLine ?? []), ...bass].filter((x, i, xs) => xs[i - 1] !== x);
          mine[mine.length - 1] = { ...merged, id: prev.id, knownStep: true, bassLine: chords, say: `Same shapes as before, now on new chords: ${listOf(chords.slice(0, 6))}. Both hands, slowly.` };
        } else {
          const say = knownStep
            ? `Same shapes as before, now on new chords: ${listOf(bass.slice(0, 6))}. Both hands, slowly.`
            : folded.length
              ? `${folded.join(' ')} ${folded.length < 2 ? (soloL || soloR ? 'Now both hands, slowly.' : 'Both hands, slowly.') : ''}`.trim()
              : firstBoth ? 'Now put the hands together, slowly. Land them on beat one together.' : BOTH[said++ % BOTH.length];
          // The head shows the keys: the right hand's first notes (or the bass when only it plays).
          mine.push({ ...make('both', a, b, slow(a, b, undefined, 3, SLOW_BOTH), 'Both hands, slow', plays(a, b, hR) ? rw.head : lw.head, say, ci), knownStep, bassLine: bass });
        }
        firstBoth = false;
      }
      if (twoHands) remember(a, b, 'L', seen.L);
      remember(a, b, hR, seen.R);
      seen.both.add(exact);
    });
    // The whole phase, still below full speed, at most sixteen bars a video (split evenly).
    const len = r.to - r.from + 1, parts = Math.ceil(len / 16), size = Math.ceil(len / parts);
    for (let a = r.from, part = 0; a <= r.to; a += size, part++) {
      const b = Math.min(r.to, a + size - 1);
      const what = parts === 1 ? 'the whole phase' : part === 0 ? 'the first part of the phase' : b === r.to ? 'the end of the phase' : 'the middle of the phase';
      mine.push(make('run', a, b, RUN, 'Three quarter speed', parts === 1 ? 'The whole phase' : `Bars ${a} to ${b}`,
        `Now ${what}, a little slower than the real thing. ${b === r.to ? (talk?.outro ?? r.words.tip) : 'Keep going.'}`, 100 + part));
    }
    mine.forEach((c, i) => out.push({ ...c, k: i + 1, of: mine.length }));
  }
  // Each video says what the next one teaches, so the series reads as one lesson.
  const about = (c: Clip, before: Clip) => {
    if (c.kind === 'intro') return `phase ${NUMBER[c.n] ?? c.n}${SCRIPTS[song.entry.slot ?? song.entry.id] && !/^phase \d/i.test(c.words.title) ? `, ${c.words.title.toLowerCase()}` : ''}`;
    if (c.kind === 'run') return c.from === c.phase.from ? 'the whole phase, a little faster' : 'the next part of the phase';
    if (c.kind === 'pattern') return c.segments[0].kind === 'L' ? 'the left hand pattern' : twoHands ? 'the right hand pattern' : 'the pattern';
    const further = c.step !== before.step ? ', a bit further on' : '';
    return `${c.kind === 'L' ? 'the left hand' : c.kind === 'R' ? (twoHands ? 'the right hand' : 'the next bars') : 'both hands together'}${further}`;
  };
  out.forEach((c, i) => { if (out[i + 1]) c.next = about(out[i + 1], c); });
  clipCache.set(song, out);
  return out;
}

// ---------- Timeline: what plays when ----------

export interface ReelNote { t: number; dur: number; midi: number; hand: Hand; finger?: number; vel: number; seg: number; bar: number; /** Beat of the bar, from 0. */ beat: number; /** In "Train with me": he plays it, the piano only guides. */ train?: boolean; }
export interface ReelCard { t: number; until: number; kind: 'title' | 'end'; }
/** A line the voice says, from this time; `until` is about when it ends. */
export interface ReelLine { t: number; until: number; text: string; seg?: number }
/** A sound effect on a visible action (HyperFrames' rule: few and exact). */
export interface ReelSfx { t: number; name: 'whoosh-short' | 'whoosh' | 'pop' | 'click-soft' | 'riser' | 'impact'; gain: number }
export interface ReelTimeline {
  notes: ReelNote[]; cards: ReelCard[]; lines: ReelLine[]; sfx: ReelSfx[];
  passes: { t: number; until: number; speed: number; seg: number }[];
  /** "Train with me": the count-in, then the same music for him to play along with. */
  countIn?: { t: number; beat: number; n: number };
  train?: { t: number; until: number };
  /** Where the video stops by itself for him to practise on his own ("two more times"). */
  hold?: { t: number; reps: number };
  duration: number; lo: Record<Hand, number>; hi: Record<Hand, number>;
  /** Where a loop starts again. */ loopFrom: number;
}

// A video teaches in four beats: the voice explains (keys lit as it names them) while the notes
// fall in; the music, slow; "Train with me": a count-in and the same music again for him to play
// along, the piano only guiding; then it stops by itself for him to practise on his own, two more
// times, and says what comes next. The idea (first video of a phase) is only heard.
const TITLE = 3, BREATH = 1, REST = 1.2, LEAD = 0.35;
/** Seconds a note takes to fall onto the keys in a video (Reels.tsx draws this much ahead). */
export const FALL = 2;
const TURN = ['Your turn. Play it with me.', 'Now you. Play along with me.', 'Your turn, together with me.'];
const PRACTISE = ['Now pause, and play it two more times on your own.', 'Pause here, and practise it two more times.', 'Your turn alone now. Two more times.'];

export function timelineOf(song: Song, clip: Clip): ReelTimeline {
  const { grid } = splitBars(song);
  const at = (bar: number) => song.ticksToSeconds(barStart(grid, bar - 1));
  const placeOf = (ticks: number) => { const i = barIndex(grid, ticks); return { bar: i + 1, beat: Math.floor((ticks - barStart(grid, i)) / (song.ppq * 4 / grid.sigs[i][1]) + 1e-6) }; };
  const notes: ReelNote[] = [], cards: ReelCard[] = [], lines: ReelLine[] = [], passes: ReelTimeline['passes'] = [], sfx: ReelSfx[] = [];
  const line = (t: number, text: string, seg?: number) => { const d = estimate(text); lines.push({ t, until: t + d, text, seg }); return d; };
  let t = 0;
  const said = line(0.3, clip.say, clip.kind === 'intro' ? undefined : 0);
  sfx.push({ t: 0.05, name: clip.k % 2 ? 'whoosh-short' : 'whoosh', gain: 0.35 });
  if (clip.kind === 'intro') { cards.push({ t: 0, until: TITLE, kind: 'title' }); t = TITLE; }
  const sg = clip.segments[0];
  const hands: Hand[] = sg.kind === 'both' ? song.hands : [sg.kind];
  const [tLo, tHi] = sg.ticks ?? [barStart(grid, sg.from - 1), barStart(grid, sg.to)];
  const ns = song.notes.filter(n => hands.includes(n.hand) && n.ticks >= tLo - 1 && n.ticks < tHi - 1);
  const start = song.ticksToSeconds(tLo);
  // A pattern loops in time (its beat, again and again); a stretch lets its last notes ring.
  const period = (song.ticksToSeconds(tHi) - start) / sg.speed;
  const times = sg.times ?? 1;
  const end = sg.ticks ? song.ticksToSeconds(tHi) : Math.max(at(sg.to + 1), ...ns.map(n => n.time + n.duration));
  const length = sg.ticks ? period * times : (end - start) / sg.speed;
  const lay = (t0: number, train = false) => {
    for (let k = 0; k < times; k++) for (const n of ns) {
      const dur = sg.ticks ? Math.min(n.duration, song.ticksToSeconds(tHi) - n.time) : n.duration;
      notes.push({ t: t0 + LEAD + k * period + (n.time - start) / sg.speed, dur: Math.max(0.08, dur / sg.speed), midi: n.midi, hand: n.hand, finger: n.finger, vel: n.velocity, seg: 0, ...placeOf(n.ticks), train });
    }
  };
  // The payoff (the whole phase): a riser into an impact as the music starts.
  // 1. The voice explains while the notes fall in; 2. the music.
  const breath = clip.kind === 'intro' ? 0.2 : Math.min(5, Math.max(BREATH, said * 0.6));
  const passStart = t;
  t += breath;
  if (clip.kind === 'run') { sfx.push({ t: t + LEAD - 2.4, name: 'riser', gain: 0.22 }, { t: t + LEAD - 0.02, name: 'impact', gain: 0.25 }); }
  lay(t);
  let until = t + LEAD + length;
  passes.push({ t: passStart, until, speed: sg.speed, seg: 0 });
  if (clip.kind === 'intro') {
    t = Math.max(until, 0.3 + said) + REST;
    const lo0 = { R: 127, L: 127 } as Record<Hand, number>, hi0 = { R: 0, L: 0 } as Record<Hand, number>;
    for (const n of notes) { lo0[n.hand] = Math.min(lo0[n.hand], n.midi); hi0[n.hand] = Math.max(hi0[n.hand], n.midi); }
    return { notes, cards, lines, sfx, passes, duration: t, lo: lo0, hi: hi0, loopFrom: passStart };
  }
  // 3. Train with me: "your turn", a bar of count-in on the beat, the same music again for him.
  t = Math.max(until, 0.3 + said) + 0.5;
  const turn = line(t, TURN[clip.k % TURN.length], 0);
  const beat = Math.max(0.45, Math.min(1, song.ticksToSeconds(song.ppq) / sg.speed));
  // Count 1, 2, 3 (the user's choice), then the notes start falling in silence (no more clicks
  // after the 3), landing on the beat the count set.
  const n = 3;
  const ci = t + turn + 0.2;
  const fallBeats = Math.ceil(FALL / beat);
  for (let k = 0; k < n; k++) sfx.push({ t: ci + k * beat, name: 'click-soft', gain: k === 0 ? 0.6 : 0.4 });
  const trainStart = ci + (n + fallBeats) * beat - LEAD;
  lay(trainStart, true);
  until = trainStart + LEAD + length;
  passes.push({ t: ci, until, speed: sg.speed, seg: 0 });
  // 4. It stops by itself for him to practise alone; then it says what comes next.
  const holdAt = until + 0.8;
  line(holdAt - 0.6, PRACTISE[clip.k % PRACTISE.length], 0);
  const after = holdAt + 0.3;
  const nextLine = clip.next ? `Nice. Next up, ${clip.next}. Swipe up.` : 'Nice. That is this phase. Now practise it in the lessons.';
  const nextSaid = line(after, nextLine, 0);
  const duration = after + nextSaid + REST;
  const lo = { R: 127, L: 127 } as Record<Hand, number>, hi = { R: 0, L: 0 } as Record<Hand, number>;
  for (const x of notes) { lo[x.hand] = Math.min(lo[x.hand], x.midi); hi[x.hand] = Math.max(hi[x.hand], x.midi); }
  // The loop is Train with me again: the count-in and his turn, without the voice.
  return { notes, cards, lines, sfx, passes, countIn: { t: ci, beat, n }, train: { t: trainStart + LEAD, until }, hold: { t: holdAt, reps: 2 }, duration, lo, hi, loopFrom: ci - 0.2 };
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
