/**
 * The course's piece makers. Each takes a level (0–3) and a seed and writes a short piece, so a
 * node on the path is written fresh for him every time, at the level his playing calls for:
 * longer, wider, busier as he gets better, simpler when a skill is slipping.
 *
 * Melodies, rests, waltz time, intervals, scales, five-finger technique, triads, and the
 * accompaniment styles of the last section: Alberti bass, pop, blues, arpeggios and seventh chords.
 */
import { line, melody, RHYTHMS, rng, scale, writeSong, type W } from './exercises';
import type { Hand, Song } from './types';

export type Gen = (lv: number, seed: number) => Song;

const clamp = (lv: number) => Math.max(0, Math.min(3, Math.round(lv)));
const CEILING = [0.6, 0.75, 0.88, 1];
const at = <T,>(xs: T[], lv: number) => xs[Math.min(xs.length - 1, clamp(lv))];
const pick = <T,>(r: () => number, xs: T[]) => xs[Math.floor(r() * xs.length)];
/** "C4 E4 G4" → midi numbers. */
export const notes = (text: string) => line(text, 'R').map(w => w.midi as number);

function out(voices: W[][], lv: number, o: { bpm?: number; fifths?: number; timeSig?: [number, number] } = {}): Song {
  const s = writeSong('gen', 'Lesson', voices, { bpm: o.bpm ?? 80, fifths: o.fifths, timeSig: o.timeSig });
  s.ceiling = CEILING[clamp(lv)];
  return s;
}

// ---------- Melodies ----------

interface Tune {
  hand: Hand;
  /** The notes he reads, per level (each level may widen the range). */
  pool: (lv: number) => number[];
  home: number;
  rhythm?: (lv: number) => number[][];
  rests?: number;
  waltz?: boolean;
  fifths?: number;
  bars?: number;
}
const BASIC = (lv: number) => (lv === 0 ? RHYTHMS.long.concat([[2, 1, 1]]) : RHYTHMS.basic);

/** A melody in one hand: steps first, more skips and longer phrases at higher levels. */
export const tune = (t: Tune): Gen => (lv, seed) => {
  const r = rng(seed);
  const bars = (t.bars ?? 4) + (lv >= 2 ? 2 : 0) + (lv >= 3 ? 2 : 0);
  const rhythm = t.rhythm ? t.rhythm(lv) : t.waltz ? (lv < 2 ? RHYTHMS.waltz : RHYTHMS.waltz.concat(RHYTHMS.waltzDotted)) : BASIC(lv);
  const m = melody(r, t.pool(lv), bars, rhythm, t.hand, 0.1 + lv * 0.1, t.home, t.waltz ? 3 : 4, (t.rests ?? 0) * (0.7 + lv * 0.2));
  return out([m], lv, { fifths: t.fifths, timeSig: t.waltz ? [3, 4] : undefined, bpm: 76 + lv * 6 });
};

/** Melody in the right hand, the left holding or moving under it. */
export const together = (o: { pool: (lv: number) => number[]; lh: (lv: number) => string[] }): Gen => (lv, seed) => {
  const r = rng(seed);
  const bars = 4 + (lv >= 2 ? 2 : 0);
  const rh = melody(r, o.pool(lv), bars, lv < 2 ? RHYTHMS.long.concat(RHYTHMS.basic.slice(0, 2)) : RHYTHMS.basic, 'R', 0.15, 60);
  const shapes = o.lh(lv);
  const lh: W[] = [];
  for (let b = 0; b < bars; b++) lh.push(...line(b === bars - 1 ? shapes[0].split(' ')[0].split(':')[0] + ':4' : shapes[b % shapes.length], 'L'));
  return out([rh, lh], lv, { bpm: 72 + lv * 6 });
};

/** Moves of a given size: 2nds (steps), 3rds (skips), up to 5ths, on the white keys from C. */
export const intervals = (sizes: number[]): Gen => (lv, seed) => {
  const r = rng(seed);
  const pool = scale(55, 77);
  const allowed = sizes.slice(0, Math.max(1, Math.min(sizes.length, 1 + lv)));
  let i = pool.indexOf(60);
  const w: W[] = [];
  const bars = 4 + (lv >= 2 ? 2 : 0);
  for (let b = 0; b < bars; b++) {
    const beats = b === bars - 1 ? [2, 2] : lv === 0 ? [2, 2] : pick(r, [[1, 1, 2], [1, 1, 1, 1], [2, 1, 1]]);
    beats.forEach((d, k) => {
      if (b === bars - 1 && k === beats.length - 1) i = pool.indexOf(60);
      else if (w.length) {
        const size = pick(r, allowed) - 1;
        let j = i + (r() < 0.5 ? -size : size);
        if (j < pool.indexOf(57) || j > pool.indexOf(74)) j = i + (j > i ? -size : size);
        i = Math.max(0, Math.min(pool.length - 1, j));
      }
      w.push({ midi: pool[i], beats: d, hand: 'R' });
    });
  }
  return out([w], lv);
};

// ---------- Technique ----------

const tonicOf = (fifths: number, hand: Hand) => {
  const pc = (((fifths * 7) % 12) + 12) % 12;
  const base = hand === 'R' ? 60 : 48;
  return base + pc - (pc > 7 ? 12 : 0);
};

/** A major scale, up and down: one octave in quarters, then eighths, then two octaves. */
export const scaleRun = (fifths: number, hand: Hand): Gen => lv => {
  const t = tonicOf(fifths, hand);
  const octaves = lv >= 3 ? 2 : 1;
  const up = scale(t, t + 12 * octaves, fifths);
  const seq = [...up, ...up.slice(0, -1).reverse()];
  const d = lv >= 2 ? 0.5 : 1;
  const w: W[] = seq.map((m, k) => ({ midi: m, beats: k === seq.length - 1 ? 4 - ((seq.length - 1) * d) % 4 : d, hand }));
  return out([w], lv, { fifths, bpm: 66 + lv * 8 });
};

/** The C blues scale: C E♭ F F♯ G B♭ C. */
export const bluesScale = (hand: Hand): Gen => lv => {
  const t = hand === 'R' ? 60 : 48;
  const one = [0, 3, 5, 6, 7, 10, 12].map(x => t + x);
  const up = lv >= 3 ? [...one, ...one.slice(1).map(x => x + 12)] : one;
  const seq = [...up, ...up.slice(0, -1).reverse()];
  const d = lv >= 2 ? 0.5 : 1;
  const w: W[] = seq.map((m, k) => ({ midi: m, beats: k === seq.length - 1 ? 4 - ((seq.length - 1) * d) % 4 : d, hand }));
  return out([w], lv, { bpm: 72 + lv * 8 });
};

/** Five-finger patterns, Hanon style: 1-2-3-4-5-4-3-2 moving up a step each bar. */
export const fiveFinger = (hand: Hand, kind: 'run' | 'thirds' = 'run'): Gen => lv => {
  const pool = scale(hand === 'R' ? 60 : 48, hand === 'R' ? 84 : 72);
  const shape = kind === 'run' ? [0, 1, 2, 3, 4, 3, 2, 1] : [0, 2, 1, 3, 2, 4, 3, 1];
  const d = lv >= 1 ? 0.5 : 1;
  const bars = lv === 0 ? 2 : 2 + lv;
  const w: W[] = [];
  for (let b = 0; b < bars; b++) for (const s of shape) w.push({ midi: pool[b + s], beats: d, hand });
  w.push({ midi: pool[0], beats: 4, hand });
  return out([w], lv, { bpm: 66 + lv * 10 });
};

/** Both hands in mirror: they start on C and move apart and back together. */
export const contrary: Gen = lv => {
  const rh = scale(60, 67), lh = scale(41, 48).reverse();
  const shape = [0, 1, 2, 3, 4, 3, 2, 1, 0];
  const d = lv >= 2 ? 0.5 : 1;
  const reps = lv >= 1 ? 2 : 1;
  const R: W[] = [], L: W[] = [];
  for (let k = 0; k < reps; k++) for (const s of shape.slice(0, -1)) { R.push({ midi: rh[s], beats: d, hand: 'R' }); L.push({ midi: lh[s], beats: d, hand: 'L' }); }
  R.push({ midi: 60, beats: 4, hand: 'R' }); L.push({ midi: 48, beats: 4, hand: 'L' });
  return out([R, L], lv, { bpm: 66 + lv * 8 });
};

// ---------- Chords ----------

const LETTER: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const QUALITY: Record<string, number[]> = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], dim: [0, 3, 6] };
/** "Am" → [pitch class of the root, intervals]. */
function chordOf(name: string): [number, number[]] {
  const m = /^([A-G])([#b]?)(.*)$/.exec(name)!;
  return [(LETTER[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12, QUALITY[m[3]] ?? QUALITY['']];
}
/** The chord in root position with its root at or above `lo`. */
export function voice(name: string, lo: number): number[] {
  const [root, ivs] = chordOf(name);
  const r0 = lo + ((root - lo) % 12 + 12) % 12;
  return ivs.map(i => r0 + i);
}
/** Jazz shells for the left hand: root, 3rd and 7th. */
const shell = (name: string, lo: number) => { const v = voice(name, lo); return v.length > 3 ? [v[0], v[1], v[3]] : v; };

/** Triads, held or broken, in one hand, and with a tune over them at higher levels. */
export const triads = (prog: string[], hand: Hand, broken = false): Gen => (lv, seed) => {
  const r = rng(seed);
  const lo = hand === 'R' ? 60 : 43;
  const bars = prog.length + (lv >= 2 ? prog.length : 0);
  const w: W[] = [];
  for (let b = 0; b < bars; b++) {
    const c = voice(b === bars - 1 ? prog[0] : prog[b % prog.length], lo);
    if (broken || lv >= 2) {
      const order = pick(r, [[0, 1, 2, 1], [0, 2, 1, 2], [0, 1, 2, 2]]);
      if (b === bars - 1) w.push({ midi: c, beats: 4, hand });
      else for (const k of order) w.push({ midi: c[k], beats: 1, hand });
    } else if (lv === 1 && b < bars - 1) w.push({ midi: c, beats: 2, hand }, { midi: c, beats: 2, hand });
    else w.push({ midi: c, beats: 4, hand });
  }
  return out([w], lv, { bpm: 70 + lv * 6 });
};

/** A tune on the chord tones of a progression, in the right hand. */
function tuneOver(r: () => number, prog: string[], lv: number, fifths = 0, bar = 4, lo = 60, hi = 76): W[] {
  const pool = scale(lo, hi, fifths);
  const rh: W[] = [];
  let prev = 64;
  prog.forEach((name, b) => {
    const last = b === prog.length - 1;
    const pattern = last || lv === 0 ? [bar]
      : bar === 3 ? pick(r, lv === 1 ? [[2, 1], [1, 2]] : lv === 2 ? RHYTHMS.waltz : RHYTHMS.waltzDotted)
      : lv === 1 ? pick(r, [[2, 2], [3, 1], [2, 1, 1]]) : lv === 2 ? pick(r, [[1, 1, 2], [1, 1, 1, 1], [2, 1, 1]]) : pick(r, [[1, 0.5, 0.5, 2], [0.5, 0.5, 1, 1, 1], [1, 1, 0.5, 0.5, 1]]);
    const tones = voice(name, lo - 12).flatMap(x => [x, x + 12, x + 24]).filter(x => x >= lo && x <= hi);
    pattern.forEach((d, k) => {
      let m: number;
      if (last) m = tones.filter(x => x % 12 === voice(prog[0], 0)[0] % 12).sort((a, c) => Math.abs(a - prev) - Math.abs(c - prev))[0] ?? 60;
      else if (k === 0 || r() < 0.4) m = tones.sort((a, c) => Math.abs(a - prev) - Math.abs(c - prev))[Math.floor(r() * 2)];
      else { const i = pool.indexOf(prev); m = pool[Math.max(0, Math.min(pool.length - 1, (i < 0 ? 2 : i) + (r() < 0.5 ? -1 : 1)))]; }
      rh.push({ midi: m, beats: d, hand: 'R' });
      prev = m;
    });
  });
  return rh;
}

export type Style = 'hold' | 'roots' | 'alberti' | 'pop' | 'blues' | 'arp' | 'jazz' | 'waltz';

/** One bar of left hand in a style, for one chord. */
function leftBar(style: Style, name: string, last: boolean): W[] {
  const L = (midi: number | number[], beats: number): W => ({ midi, beats, hand: 'L' });
  const c = voice(name, 43);
  const close = voice(name, 48);
  if (last) return [L(style === 'jazz' ? shell(name, 43) : style === 'roots' || style === 'blues' ? [c[0], c[0] + 7] : c.slice(0, 3), style === 'waltz' ? 3 : 4)];
  switch (style) {
    case 'roots': return [L(c[0], 2), L(c[0] + 7, 2)];
    case 'alberti': return [close[0], close[2], close[1], close[2], close[0], close[2], close[1], close[2]].map(m => L(m, 0.5));
    case 'pop': return [L([c[0], c[0] + 12], 1.5), L(c[0] + 7, 0.5), L([c[0], c[0] + 12], 2)];
    case 'blues': return [L([c[0], c[0] + 7], 1), L([c[0], c[0] + 9], 1), L([c[0], c[0] + 7], 1), L([c[0], c[0] + 9], 1)];
    case 'arp': return [c[0], c[0] + 7, c[0] + 12, c[1] + 12, c[0] + 12, c[0] + 7, c[0], c[0] + 7].map(m => L(m, 0.5));
    case 'jazz': return [L(shell(name, 43), 2), L(shell(name, 43), 2)];
    case 'waltz': return [L(c[0], 1), L(close.slice(1), 1), L(close.slice(1), 1)];
    case 'hold':
    default: return [L(c.slice(0, 3), 4)];
  }
}

/** A tune over a left-hand style. Level 0 keeps the tune in long notes; the left hand is the lesson. */
export const accompany = (style: Style, progs: string[][], o: { fifths?: number; bpm?: number } = {}): Gen => (lv, seed) => {
  const r = rng(seed);
  const prog = at(progs, lv);
  const lh = prog.flatMap((name, b) => leftBar(style, name, b === prog.length - 1));
  let rh = tuneOver(r, prog, lv, o.fifths ?? 0, style === 'waltz' ? 3 : 4);
  if (style === 'blues') {
    // Riffs on the blues scale over the 12 bars, a call and its answer.
    const bl = [60, 63, 65, 66, 67, 70, 72];
    rh = prog.flatMap((_, b) => {
      if (b === prog.length - 1) return [{ midi: 60, beats: 4, hand: 'R' as Hand }];
      const call = pick(r, [[0, 1, 2, 4], [4, 5, 4, 1], [6, 5, 4, 2], [0, 1, 3, 4]]);
      return lv === 0 || b % 2 === 1 ? [{ midi: bl[call[0]], beats: 2, hand: 'R' as Hand }, { midi: 0, beats: 2, hand: 'R' as Hand }]
        : call.map(k => ({ midi: bl[k], beats: 1, hand: 'R' as Hand }));
    });
  }
  return out([rh, lh], lv, { fifths: o.fifths, timeSig: style === 'waltz' ? [3, 4] : undefined, bpm: (o.bpm ?? 72) + lv * 6 });
};

/** A left-hand pattern on its own, to learn it before a tune goes on top. */
export const leftAlone = (style: Style, progs: string[][]): Gen => lv => {
  const prog = at(progs, lv);
  return out([prog.flatMap((name, b) => leftBar(style, name, b === prog.length - 1))], lv, { timeSig: style === 'waltz' ? [3, 4] : undefined, bpm: 66 + lv * 6 });
};

/** Arpeggios: a chord's notes one after another, over one or two octaves. */
export const arpeggio = (chords: string[], hand: Hand): Gen => lv => {
  const w: W[] = [];
  const lo = hand === 'R' ? 60 : 48;
  const d = lv >= 2 ? 0.5 : 1;
  for (const name of chords.slice(0, 1 + Math.min(chords.length - 1, lv))) {
    const c = voice(name, lo);
    const up = lv >= 3 ? [...c, ...c.map(x => x + 12), c[0] + 24] : [...c, c[0] + 12];
    for (const m of [...up, ...up.slice(1, -1).reverse()]) w.push({ midi: m, beats: d, hand });
  }
  const total = w.reduce((t, x) => t + x.beats, 0);
  w.push({ midi: lo, beats: 4 - (total % 4) || 4, hand });
  return out([w], lv, { bpm: 66 + lv * 8 });
};
