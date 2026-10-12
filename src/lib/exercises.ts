/**
 * Exercises made on the spot: short pieces written for one skill at his level, so the warm-up
 * always works on what he is weakest at, at just the right difficulty. Also the course's songs
 * (public-domain melodies) written out note by note.
 */
import { assignFingering } from './fingering';
import type { SkillId } from './skills';
import type { Hand, Song, SongNote } from './types';

const PPQ = 480;

/** A note to write: pitch (or several, a chord), length in beats, hand. */
interface W { midi: number | number[]; beats: number; hand: Hand; }

/** Builds a playable song from written notes; each hand is laid out on its own, from beat 0. */
export function writeSong(id: string, title: string, voices: W[][], opts: { bpm?: number; fifths?: number; timeSig?: [number, number]; ceiling?: number } = {}): Song {
  const bpm = opts.bpm ?? 80;
  const secPerTick = 60 / bpm / PPQ;
  const notes: SongNote[] = [];
  for (const voice of voices) {
    let t = 0;
    for (const w of voice) {
      const ticks = Math.round(t * PPQ), dur = Math.round(w.beats * PPQ);
      for (const m of Array.isArray(w.midi) ? w.midi : [w.midi]) {
        if (m > 0) notes.push({ id: 0, midi: m, time: ticks * secPerTick, duration: dur * secPerTick * 0.95, hand: w.hand, velocity: 0.7, ticks, durationTicks: dur });
      }
      t += w.beats;
    }
  }
  notes.sort((a, b) => a.ticks - b.ticks || a.midi - b.midi);
  notes.forEach((n, i) => (n.id = i));
  assignFingering(notes);
  const pitches = notes.map(n => n.midi);
  return {
    entry: { id, title, builtIn: true, composer: 'Practice' },
    notes,
    duration: Math.max(...notes.map(n => n.time + n.duration)),
    firstNoteTime: notes[0].time,
    ppq: PPQ,
    timeSig: opts.timeSig ?? [4, 4],
    fifths: opts.fifths ?? 0,
    ticksToSeconds: t => t * secPerTick,
    hands: (['R', 'L'] as Hand[]).filter(h => notes.some(n => n.hand === h)),
    range: [Math.min(...pitches), Math.max(...pitches)],
    ceiling: opts.ceiling ?? 0.6,
  };
}

// ---------- Random, but the same exercise for the same seed ----------

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
/** The keys of a major scale between lo and hi. */
function scale(lo: number, hi: number, fifths = 0) {
  const tonic = (((fifths * 7) % 12) + 12) % 12;
  const out: number[] = [];
  for (let m = lo; m <= hi; m++) if (MAJOR.includes((((m - tonic) % 12) + 12) % 12)) out.push(m);
  return out;
}

const RHYTHMS: Record<'basic' | 'eighths' | 'dotted' | 'long', number[][]> = {
  long: [[2, 2], [4], [2, 2]],
  basic: [[1, 1, 1, 1], [2, 1, 1], [1, 1, 2], [2, 2], [1, 1, 1, 1]],
  eighths: [[0.5, 0.5, 1, 1, 1], [1, 0.5, 0.5, 1, 1], [0.5, 0.5, 0.5, 0.5, 2], [1, 1, 0.5, 0.5, 1]],
  dotted: [[1.5, 0.5, 1, 1], [1, 1, 1.5, 0.5], [3, 1], [1.5, 0.5, 2]],
};

/** A melody on `pool`: mostly steps, some skips (more at higher `skip`), ending on the home note. */
function melody(r: () => number, pool: number[], bars: number, rhythm: number[][], hand: Hand, skip: number, home: number): W[] {
  const out: W[] = [];
  let i = Math.max(0, pool.indexOf(home));
  for (let b = 0; b < bars; b++) {
    const last = b === bars - 1;
    let beats = rhythm[Math.floor(r() * rhythm.length)];
    if (last) {
      // The last bar lands on the home note, held to the end of the bar.
      const head = beats.length > 1 ? beats.slice(0, Math.ceil(beats.length / 2)) : [];
      beats = [...head, 4 - head.reduce((t, x) => t + x, 0)];
    }
    beats.forEach((d, k) => {
      const end = last && k === beats.length - 1;
      if (end) i = Math.max(0, pool.indexOf(home));
      else if (out.length) {
        const leap = r() < skip;
        const size = leap ? 2 + Math.floor(r() * 3) : 1;
        const dir = r() < 0.5 ? -1 : 1;
        let j = i + dir * size;
        if (j < 0 || j >= pool.length) j = i - dir * size;
        i = Math.max(0, Math.min(pool.length - 1, j));
      }
      out.push({ midi: pool[i], beats: d, hand });
    });
  }
  return out;
}

/** Level 0–3 for a skill from its mastery. */
export function levelFor(m: number) { return m < 0.45 ? 0 : m < 0.65 ? 1 : m < 0.8 ? 2 : 3; }

export const LEVEL_NAME = ['Starter', 'Building', 'Confident', 'Stretch'];

/** A short exercise for one skill at one level. Same seed, same exercise. */
export function makeExercise(skill: SkillId, level: number, seed = Date.now()): Song {
  const song = writeExercise(skill, level, seed);
  // A level-n exercise played well proves the next level up, no further.
  song.ceiling = [0.6, 0.75, 0.88, 1][level];
  return song;
}

function writeExercise(skill: SkillId, level: number, seed: number): Song {
  const r = rng(seed);
  const bars = 4 + Math.min(2, level);
  const id = `ex:${skill}`;
  const title = EXERCISE_TITLE[skill];
  const skipFor = [0.1, 0.2, 0.3, 0.4][level];
  switch (skill) {
    case 'bass': {
      const [lo, hi] = [[48, 55], [48, 60], [41, 60], [40, 64]][level];
      const pool = scale(lo, hi);
      return writeSong(id, title, [melody(r, pool, bars, RHYTHMS.basic, 'L', skipFor, 48)]);
    }
    case 'ledger': {
      const [lo, hi] = [[57, 64], [55, 67], [53, 72], [50, 74]][level];
      const pool = scale(lo, hi).concat(level >= 2 ? scale(79, 86) : []);
      return writeSong(id, title, [melody(r, pool.sort((a, b) => a - b), bars, RHYTHMS.basic, 'R', 0.15 + level * 0.1, 60)]);
    }
    case 'accidentals': {
      const fifths = [1, -1, 2, -2][level];
      const pool = scale(62, 74, fifths);
      const home = pool.find(m => ((m - (((fifths * 7) % 12) + 12) % 12) % 12) === 0) ?? pool[0];
      return writeSong(id, title, [melody(r, pool, bars, RHYTHMS.basic, 'R', skipFor, home)], { fifths });
    }
    case 'eighths':
      return writeSong(id, title, [melody(r, scale(60, 67 + level * 2), bars, RHYTHMS.eighths, 'R', skipFor, 60)]);
    case 'dotted':
      return writeSong(id, title, [melody(r, scale(60, 67 + level * 2), bars, RHYTHMS.dotted, 'R', skipFor, 60)]);
    case 'leaps':
      return writeSong(id, title, [melody(r, scale(60, 72 + level * 2), bars, RHYTHMS.basic, 'R', 0.55 + level * 0.1, 60)]);
    case 'rhythm':
      return writeSong(id, title, [melody(r, scale(60, 67), bars, level < 1 ? RHYTHMS.long : RHYTHMS.basic.concat(level > 1 ? RHYTHMS.eighths : []), 'R', 0.1, 60)]);
    case 'together': {
      const rh = melody(r, scale(60, 67 + level * 2), bars, level < 2 ? RHYTHMS.basic : RHYTHMS.basic.concat(RHYTHMS.eighths), 'R', skipFor, 60);
      const lh: W[] = [];
      for (let b = 0; b < bars; b++) {
        const last = b === bars - 1;
        if (level === 0 || last) lh.push({ midi: 48, beats: 4, hand: 'L' });
        else if (level === 1) lh.push({ midi: 48, beats: 2, hand: 'L' }, { midi: 55, beats: 2, hand: 'L' });
        else for (const m of [48, 52, 55, 52]) lh.push({ midi: m, beats: 1, hand: 'L' });
      }
      return writeSong(id, title, [rh, lh]);
    }
    case 'chords': {
      const shapes = level === 0 ? [[48, 55]] : [[48, 52, 55], [48, 53, 57], [47, 50, 55]];
      const rh = melody(r, scale(60, 67), bars, RHYTHMS.long, 'R', 0.15, 64);
      const lh: W[] = [];
      for (let b = 0; b < bars; b++) {
        const c = b === bars - 1 ? shapes[0] : shapes[Math.floor(r() * shapes.length)];
        if (level < 2 || b === bars - 1) lh.push({ midi: c, beats: 4, hand: 'L' });
        else lh.push({ midi: c, beats: 2, hand: 'L' }, { midi: shapes[Math.floor(r() * shapes.length)], beats: 2, hand: 'L' });
      }
      return writeSong(id, title, [rh, lh]);
    }
    case 'treble':
    default: {
      const [lo, hi] = [[60, 67], [60, 72], [57, 76], [55, 81]][level];
      const pool = scale(lo, hi);
      return writeSong(id, title, [melody(r, pool, bars, RHYTHMS.basic, 'R', skipFor, 60)]);
    }
  }
}

export const EXERCISE_TITLE: Record<SkillId, string> = {
  treble: 'Treble clef reading', bass: 'Bass clef reading', ledger: 'Ledger lines', accidentals: 'Sharps and flats',
  rhythm: 'Steady beat', eighths: 'Eighth notes', dotted: 'Dotted rhythms', together: 'Hands together', chords: 'Chords', leaps: 'Leaps',
};

// ---------- Course songs, written out ----------

const LETTER: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** "F#4" → 66, "Bb3" → 58. */
const pitch = (name: string) => {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`Bad note ${name}`);
  return (Number(m[3]) + 1) * 12 + LETTER[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
};
/** "E4 E4 F4 G4:2 C3+E3+G3:4 r" → notes; `:n` is the length in beats (1 when left out), `+` a chord, `r` a rest. */
export function line(text: string, hand: Hand, shift = 0): W[] {
  return text.trim().split(/\s+/).map(tok => {
    const [p, b] = tok.split(':');
    const midi = p === 'r' ? 0 : p.includes('+') ? p.split('+').map(x => pitch(x) + shift) : pitch(p) + shift;
    return { midi, beats: b ? Number(b) : 1, hand } as W;
  });
}

const MARY = 'E4 D4 C4 D4 E4 E4 E4:2 D4 D4 D4:2 E4 G4 G4:2 E4 D4 C4 D4 E4 E4 E4 E4 D4 D4 E4 D4 C4:4';
const ODE = 'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4:1.5 D4:0.5 D4:2 E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4:1.5 C4:0.5 C4:2';
const LUNE = 'C4 C4 C4 D4 E4:2 D4:2 C4 E4 D4 D4 C4:4 C4 C4 C4 D4 E4:2 D4:2 C4 E4 D4 D4 C4:4';
const ODE_BASS = 'C3:2 G3:2 C3:2 G3:2 C3:2 G3:2 G3:2 C3:2 C3:2 G3:2 C3:2 G3:2 C3:2 G3:2 G3:2 C3:2';

const FRERE = 'C4 D4 E4 C4 C4 D4 E4 C4 E4 F4 G4:2 E4 F4 G4:2 G4:0.5 A4:0.5 G4:0.5 F4:0.5 E4 C4 G4:0.5 A4:0.5 G4:0.5 F4:0.5 E4 C4 C4 G3 C4:2 C4 G3 C4:2';
const TWINKLE = 'C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2 G4 G4 F4 F4 E4 E4 D4:2 G4 G4 F4 F4 E4 E4 D4:2 C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2';
const [C, F, G] = ['C3+E3+G3', 'C3+F3+A3', 'B2+D3+G3'];
const TWINKLE_LH = [`${C}:4`, `${F}:2 ${C}:2`, `${F}:2 ${C}:2`, `${G}:2 ${C}:2`, `${C}:2 ${G}:2`, `${C}:2 ${G}:2`, `${C}:2 ${G}:2`, `${C}:2 ${G}:2`, `${C}:4`, `${F}:2 ${C}:2`, `${F}:2 ${C}:2`, `${G}:2 ${C}:2`].join(' ');
const MINUET = 'D5 G4:0.5 A4:0.5 B4:0.5 C5:0.5 D5 G4 G4 E5 C5:0.5 D5:0.5 E5:0.5 F#5:0.5 G5 G4 G4 C5 D5:0.5 C5:0.5 B4:0.5 A4:0.5 B4 C5:0.5 B4:0.5 A4:0.5 G4:0.5 F#4 G4:0.5 A4:0.5 B4:0.5 G4:0.5 A4:3';
const MINUET_LH = 'G3:2 A3 B3:3 C4:3 B3:3 A3:3 G3:3 D4 B3 G3 D4:2 D3';
const GRACE = 'r:2 G3 C4:2 E4:0.5 C4:0.5 E4:2 D4 C4:2 A3 G3:2 G3 C4:2 E4:0.5 C4:0.5 E4:2 D4:0.5 E4:0.5 G4:3 G4:2 r';

export const COURSE_SONGS = {
  mary: () => writeSong('path:mary', 'Mary Had a Little Lamb', [line(MARY, 'R')], { bpm: 90, ceiling: 0.65 }),
  ode: () => writeSong('path:ode', 'Ode to Joy', [line(ODE, 'R')], { bpm: 90, ceiling: 0.7 }),
  lune: () => writeSong('path:lune', 'Au clair de la lune', [line(LUNE, 'L', -12)], { bpm: 84, ceiling: 0.65 }),
  odeBoth: () => writeSong('path:ode-both', 'Ode to Joy, both hands', [line(ODE, 'R'), line(ODE_BASS, 'L')], { bpm: 90, ceiling: 0.75 }),
  frere: () => writeSong('path:frere', 'Frère Jacques', [line(FRERE, 'R')], { bpm: 96, ceiling: 0.75 }),
  twinkle: () => writeSong('path:twinkle', 'Twinkle, Twinkle, Little Star', [line(TWINKLE, 'R'), line(TWINKLE_LH, 'L')], { bpm: 88, ceiling: 0.8 }),
  minuet: () => writeSong('path:minuet', 'Minuet in G', [line(MINUET, 'R'), line(MINUET_LH, 'L')], { bpm: 92, fifths: 1, timeSig: [3, 4], ceiling: 0.88 }),
  grace: () => writeSong('path:grace', 'Amazing Grace', [line(GRACE, 'R')], { bpm: 80, timeSig: [3, 4], ceiling: 0.8 }),
};
