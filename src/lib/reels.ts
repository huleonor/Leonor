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
    L: octaves ? `Octaves ${seq}: little finger low, thumb high` : `Bass ${seq}${held ? ', each held for the bar' : ''}`,
    R: sameShape ? `${facts.find(f => f.groups.length)?.groups[0] ?? ''}: ${shapeWords}` : repeats ? `${fig}, again and again` : 'Look for the shapes that come back',
    cues,
    tip: sameShape ? 'Same shape on every chord. Find the top note and the hand knows the rest.' : held ? 'Play on beat 1 and hold until the next one.' : 'Slow first. Land both hands on beat 1 together.',
  };
}

/** What the voice says when no line was written for a phase: its own words, as sentences. */
function ruleTalk(w: PhaseWords, twoHands: boolean): Talk {
  const end = (x: string) => (/[.!?]$/.test(x.trim()) ? x.trim() : `${x.trim()}.`);
  return {
    intro: [w.hook, ...w.tricks].map(end).join(' '),
    L: `Left hand. ${end(w.L)}`,
    R: `Right hand. ${end(w.R)}`,
    both: twoHands ? 'Now both hands together, at full speed.' : 'Now at full speed.',
    outro: end(w.tip),
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
  kind: 'intro' | 'L' | 'R' | 'both' | 'run';
  /** The big line of the video: the idea, or the notes of the step. */
  head: string;
  /** What the voice says. */
  say: string;
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
    return { said: `${cap(shape)}, on every beat. Start with ${listOf(first)}. ${tail}`, head: first.join(' ') };
  }
  const notes: string[] = [];
  for (const g of groups) for (const m of g) { const l = letter(m, flats); if (notes[notes.length - 1] !== l) notes.push(l); }
  return { said: `${listOf(notes.slice(0, 8))}${notes.length > 8 ? ', and on' : ''}.`, head: notes.slice(0, 6).join(' ') };
}

/** The left hand of a stretch in words: its bass notes, as octaves or held when they are. */
function leftWords(facts: BarFacts[]) {
  const bass: string[] = [];
  for (const f of facts) if (bass[bass.length - 1] !== f.chord) bass.push(f.chord);
  const octaves = facts.every(f => f.octave), held = facts.every(f => f.held);
  const what = octaves ? `An octave on ${bass.join(', then ')}` : `The bass: ${listOf(bass)}`;
  return { said: `${what}${held ? ', held for the whole bar' : ''}. ${octaves ? 'Little finger low, thumb on top.' : ''}`.trim(), head: octaves ? `${bass.join(' ')} octaves` : bass.join(' ') };
}

/** Every video of a song, phase by phase, in the order he watches them. */
export function clipsOf(song: Song): Clip[] {
  const hit = clipCache.get(song);
  if (hit) return hit;
  const reels = reelsOf(song);
  const { bars, grid } = songFacts(song);
  const songBars = splitBars(song).bars;
  const twoHands = song.hands.length === 2;
  const handNotes = (a: number, b: number, h?: Hand) => songBars.slice(a - 1, b).flatMap(x => x.notes).filter(n => !h || n.hand === h).sort((x, y) => x.ticks - y.ticks || x.midi - y.midi);
  // A bar's shape for one hand, whatever note it starts from: its rhythm, and its intervals from the
  // lowest note; for a figure (six notes or more over three pitches or more, like top, middle, low,
  // middle) the order of its pitches from the top, so the same figure over a new chord counts as known.
  const barShape = (bar: number, h?: Hand) => {
    const ns = handNotes(bar, bar, h);
    if (!ns.length) return null;
    const t0 = barStart(grid, bar - 1);
    const pitches = [...new Set(ns.map(n => n.midi))].sort((x, y) => y - x);
    const onsets = new Set(ns.map(n => n.ticks)).size;
    const figure = onsets >= 6 && pitches.length >= 3;
    const low = pitches[pitches.length - 1];
    return `${figure ? 'f' : 'i'}${ns.map(n => `${n.ticks - t0}:${figure ? pitches.indexOf(n.midi) : n.midi - low}`).join(',')}`;
  };
  // Every bar of the stretch already met, for that hand (bars it does not play count as met).
  const known = (a: number, b: number, h: Hand | undefined, set: Set<string>) => {
    let any = false;
    for (let bar = a; bar <= b; bar++) { const x = barShape(bar, h); if (x) { any = true; if (!set.has(x)) return false; } }
    return any;
  };
  const remember = (a: number, b: number, h: Hand | undefined, set: Set<string>) => { for (let bar = a; bar <= b; bar++) { const x = barShape(bar, h); if (x) set.add(x); } };
  const plays = (a: number, b: number, h?: Hand) => handNotes(a, b, h).length > 0;
  const seen = { L: new Set<string>(), R: new Set<string>(), both: new Set<string>() };
  const out: Clip[] = [];
  for (const r of reels) {
    const talk = r.words.talk;
    const mine: Omit<Clip, 'k' | 'of'>[] = [];
    const make = (kind: Clip['kind'], from: number, to: number, speed: number, label: string, head: string, say: string, listen = false): Omit<Clip, 'k' | 'of'> => ({
      ...r, id: `${r.id}-${mine.length + 1}`, phase: r, kind, head, say, from, to,
      segments: [{ kind: kind === 'L' || kind === 'R' ? kind : 'both', from, to, speed, label, listen }],
      chords: r.chords.filter(c => c.bar >= from && c.bar <= to),
    });
    // The idea: the opening of the phase heard once, at its real speed, while the voice explains.
    let a0 = r.from, b0 = r.from;
    while (b0 < r.to && seconds(song, grid, a0, b0 + 1) <= Math.max(6, (talk ? estimate(talk.intro) : 6) - 2)) b0++;
    mine.push(make('intro', a0, b0, 1, 'Listen', r.words.hook, talk?.intro ?? r.words.hook, true));
    // Two bars at a time (four when the bars are short); a last bar alone joins the stretch before it.
    const step = barSeconds(song, grid, r.from) >= 1.6 ? 2 : 4;
    const chunks: [number, number][] = [];
    for (let a = r.from; a <= r.to; a += step) chunks.push([a, Math.min(r.to, a + step - 1)]);
    if (chunks.length > 1 && chunks[chunks.length - 1][0] === chunks[chunks.length - 1][1]) { const last = chunks.pop()!; chunks[chunks.length - 1][1] = last[1]; }
    let firstBoth = true;
    chunks.forEach(([a, b], ci) => {
      const firstChunk = ci === 0;
      const facts = bars.slice(a - 1, b);
      const hR: Hand | undefined = twoHands ? 'R' : undefined;
      // The very same notes again (a repeat in the score): nothing new to show.
      const exact = handNotes(a, b).map(n => `${n.ticks - barStart(grid, a - 1)}:${n.midi}:${n.hand}`).join(',');
      if (seen.both.has(exact)) return;
      const newL = twoHands && plays(a, b, 'L') && !known(a, b, 'L', seen.L);
      const newR = plays(a, b, hR) && !known(a, b, hR, seen.R);
      const where = barsText(a, b);
      if (twoHands && newL) {
        const w = leftWords(facts);
        mine.push(make('L', a, b, SLOW_HAND, 'Left hand, slow', w.head, `${firstChunk && talk?.L ? talk.L : `Left hand, ${where}. ${w.said}`}`));
      }
      if (newR) {
        const w = rightWords(facts, song.fifths < 0);
        mine.push(make('R', a, b, SLOW_HAND, twoHands ? 'Right hand, slow' : 'Slow', w.head, `${firstChunk && talk?.R ? talk.R : `${twoHands ? 'Right hand' : 'Now'}, ${where}. ${w.said}`}`));
      }
      if (twoHands) {
        const bass: string[] = [];
        for (const f of facts) if (bass[bass.length - 1] !== f.chord) bass.push(f.chord);
        const say = !newL && !newR
          ? `Same shapes as before, now starting on ${bass.join(', then ')}. Both hands, slowly.`
          : firstBoth ? `Now put the hands together, slowly. ${cap(where)}. Land them on beat one together.`
            : [`Both hands together now, ${where}. Nice and slow.`, `Put them together. ${cap(where)}, slowly, both hands landing on beat one.`, `Now both hands, ${where}. Take your time.`][ci % 3];
        mine.push(make('both', a, b, SLOW_BOTH, 'Both hands, slow', `Both hands, ${where}`, say));
        firstBoth = false;
      }
      if (twoHands) remember(a, b, 'L', seen.L);
      remember(a, b, hR, seen.R);
      seen.both.add(exact);
    });
    // The whole phase, still below full speed, at most sixteen bars a video (split evenly).
    const len = r.to - r.from + 1, parts = Math.ceil(len / 16), size = Math.ceil(len / parts);
    for (let a = r.from; a <= r.to; a += size) {
      const b = Math.min(r.to, a + size - 1);
      const whole = a === r.from && b === r.to;
      mine.push(make('run', a, b, RUN, 'Three quarter speed', whole ? 'The whole phase' : `Bars ${a} to ${b}`,
        `${whole ? 'Now the whole phase' : `Now ${barsText(a, b)}`}, a little slower than the real thing. ${b === r.to ? (talk?.outro ?? r.words.tip) : 'Keep going.'}`));
    }
    mine.forEach((c, i) => out.push({ ...c, k: i + 1, of: mine.length }));
  }
  clipCache.set(song, out);
  return out;
}

// ---------- Timeline: what plays when ----------

export interface ReelNote { t: number; dur: number; midi: number; hand: Hand; finger?: number; vel: number; seg: number; bar: number; /** Beat of the bar, from 0. */ beat: number; }
export interface ReelCard { t: number; until: number; kind: 'title' | 'end'; }
/** A line the voice says, from this time; `until` is about when it ends. */
export interface ReelLine { t: number; until: number; text: string; seg?: number }
export interface ReelTimeline { notes: ReelNote[]; cards: ReelCard[]; lines: ReelLine[]; passes: { t: number; until: number; speed: number; seg: number }[]; duration: number; lo: Record<Hand, number>; hi: Record<Hand, number>; /** Where a loop starts again. */ loopFrom: number; }

// A video: the idea's title for a moment (first video of a phase), a breath while the voice
// starts and the notes already fall in, the music, and a second of rest before it loops.
const TITLE = 3, BREATH = 1, REST = 1.2, LEAD = 0.35;

export function timelineOf(song: Song, clip: Clip): ReelTimeline {
  const { grid } = splitBars(song);
  const at = (bar: number) => song.ticksToSeconds(barStart(grid, bar - 1));
  const placeOf = (ticks: number) => { const i = barIndex(grid, ticks); return { bar: i + 1, beat: Math.floor((ticks - barStart(grid, i)) / (song.ppq * 4 / grid.sigs[i][1]) + 1e-6) }; };
  const notes: ReelNote[] = [], cards: ReelCard[] = [], lines: ReelLine[] = [], passes: ReelTimeline['passes'] = [];
  let t = 0;
  const said = estimate(clip.say);
  lines.push({ t: 0.3, until: 0.3 + said, text: clip.say, seg: clip.kind === 'intro' ? undefined : 0 });
  if (clip.kind === 'intro') { cards.push({ t: 0, until: TITLE, kind: 'title' }); t = TITLE; }
  const sg = clip.segments[0];
  const hands: Hand[] = sg.kind === 'both' ? song.hands : [sg.kind];
  const ns = song.notes.filter(n => hands.includes(n.hand) && n.ticks >= barStart(grid, sg.from - 1) - 1 && n.ticks < barStart(grid, sg.to) - 1);
  const start = at(sg.from);
  const end = Math.max(at(sg.to + 1), ...ns.map(n => n.time + n.duration));
  const length = (end - start) / sg.speed;
  // The voice mostly speaks before the notes land, the rest over the music.
  const breath = clip.kind === 'intro' ? 0.2 : Math.min(5, Math.max(BREATH, said * 0.6));
  const passStart = t;
  t += breath;
  for (const n of ns) notes.push({ t: t + LEAD + (n.time - start) / sg.speed, dur: n.duration / sg.speed, midi: n.midi, hand: n.hand, finger: n.finger, vel: n.velocity, seg: 0, ...placeOf(n.ticks) });
  const until = t + LEAD + length;
  passes.push({ t: passStart, until, speed: sg.speed, seg: 0 });
  t = Math.max(until, 0.3 + said) + REST;
  const lo = { R: 127, L: 127 } as Record<Hand, number>, hi = { R: 0, L: 0 } as Record<Hand, number>;
  for (const n of notes) { lo[n.hand] = Math.min(lo[n.hand], n.midi); hi[n.hand] = Math.max(hi[n.hand], n.midi); }
  // It loops from the music (the breath before it, without the voice), TikTok style.
  return { notes, cards, lines, passes, duration: t, lo, hi, loopFrom: passStart + (clip.kind === 'intro' ? 0 : breath - 0.6) };
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
