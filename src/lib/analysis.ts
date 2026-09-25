/**
 * Reads a song the way a teacher would before a lesson: what repeats, what the left hand keeps
 * doing, which chords come round, where the hands sit, and which bars will be hard. Each finding
 * becomes a tip, and most tips come with a stretch of bars to practise.
 */
import { noteName } from './names';
import type { Hand, HandsChoice, Song, SongNote } from './types';

export type TipKind = 'repeat' | 'left' | 'chords' | 'position' | 'tricky' | 'key' | 'rhythm' | 'plan';

export interface Tip {
  kind: TipKind;
  title: string;
  body: string;
  /** Bars to practise (1-based, inclusive), with the hands and speed that suit them. */
  practice?: { from: number; to: number; hands?: HandsChoice; speed?: number };
}

export interface Analysis {
  bars: number;
  uniqueBars: number;
  tips: Tip[];
}

const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const MAJOR_BY_FIFTHS: Record<number, number> = { 0: 0, 1: 7, 2: 2, 3: 9, 4: 4, 5: 11, 6: 6, 7: 1, [-1]: 5, [-2]: 10, [-3]: 3, [-4]: 8, [-5]: 1, [-6]: 6, [-7]: 11 };
const ORDER_SHARPS = [5, 0, 7, 2, 9, 4, 11];
const ORDER_FLATS = [11, 4, 9, 2, 7, 0, 5];
const CHORDS: { suffix: string; tones: number[] }[] = [
  { suffix: '', tones: [0, 4, 7] },
  { suffix: 'm', tones: [0, 3, 7] },
  { suffix: 'sus4', tones: [0, 5, 7] },
  { suffix: 'dim', tones: [0, 3, 6] },
];

const pcName = (pc: number, flats: boolean) => (flats ? FLAT_NAMES : SHARP_NAMES)[((pc % 12) + 12) % 12];
const range = (a: number, b: number) => (a === b ? `bar ${a}` : `bars ${a}–${b}`);
const pct = (x: number) => `${Math.round(x * 100)}%`;
const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

interface Bar {
  index: number;
  notes: SongNote[];
  /** Class of bars that sound (almost) the same; -1 when the bar is silent. */
  cls: number;
  /** Per hand: class of bars with the same shape, whatever note it starts on. */
  shape: Record<Hand, number>;
}

type Tokens = Map<string, number>;

function tokens(notes: SongNote[], start: number, q: number, relative: boolean): Tokens {
  const low = relative && notes.length ? Math.min(...notes.map(n => n.midi)) : 0;
  const t: Tokens = new Map();
  for (const n of notes) {
    const k = `${Math.round((n.ticks - start) / q)}:${n.midi - low}`;
    t.set(k, (t.get(k) ?? 0) + 1);
  }
  return t;
}

/** Share of notes two bars have in common (same place in the bar, same key). */
function similarity(a: Tokens, b: Tokens) {
  let inter = 0, na = 0, nb = 0;
  for (const [k, v] of a) { na += v; inter += Math.min(v, b.get(k) ?? 0); }
  for (const v of b.values()) nb += v;
  return inter / Math.max(na, nb, 1);
}

/** Group bars that are at least 80% the same: players hear a slight variation as "the same bar". */
function classify(items: (Tokens | null)[]): number[] {
  const reps: Tokens[] = [];
  return items.map(t => {
    if (!t || !t.size) return -1;
    const i = reps.findIndex(r => similarity(r, t) >= 0.8);
    if (i >= 0) return i;
    reps.push(t);
    return reps.length - 1;
  });
}

function splitBars(song: Song): { bars: Bar[]; measureTicks: number } {
  const [num, den] = song.timeSig;
  const measureTicks = song.ppq * 4 * (num / den);
  const q = song.ppq / 4;
  const last = Math.max(...song.notes.map(n => n.ticks));
  const count = Math.floor(last / measureTicks + 1e-6) + 1;
  const bars: Bar[] = Array.from({ length: count }, (_, i) => ({ index: i, notes: [], cls: -1, shape: { R: -1, L: -1 } }));
  for (const n of song.notes) bars[Math.min(count - 1, Math.floor(n.ticks / measureTicks + 1e-6))].notes.push(n);
  const start = (b: Bar) => b.index * measureTicks;
  classify(bars.map(b => tokens(b.notes, start(b), q, false))).forEach((c, i) => (bars[i].cls = c));
  for (const h of ['R', 'L'] as Hand[]) {
    classify(bars.map(b => tokens(b.notes.filter(n => n.hand === h), start(b), q, true))).forEach((c, i) => (bars[i].shape[h] = c));
  }
  return { bars, measureTicks };
}

/** Longest stretches of bars that come back unchanged, most useful first. */
function findRepeats(sigs: string[]): { len: number; starts: number[] }[] {
  const covered = new Array(sigs.length).fill(false);
  const found: { len: number; starts: number[] }[] = [];
  for (let round = 0; round < 3; round++) {
    let best: { len: number; starts: number[] } | null = null;
    for (const len of [8, 4, 2]) {
      const seen = new Map<string, number[]>();
      for (let i = 0; i + len <= sigs.length; i++) {
        const slice = sigs.slice(i, i + len);
        if (slice.some(s => s === '-1') || covered.slice(i, i + len).some(Boolean)) continue;
        const key = slice.join('#');
        const list = seen.get(key) ?? [];
        if (!list.length || i >= list[list.length - 1] + len) list.push(i);
        seen.set(key, list);
      }
      for (const starts of seen.values()) {
        if (starts.length < 2) continue;
        if (!best || starts.length * len > best.starts.length * best.len) best = { len, starts };
      }
    }
    if (!best) break;
    found.push(best);
    for (const s of best.starts) for (let k = s; k < s + best.len; k++) covered[k] = true;
  }
  return found;
}

function chordOf(notes: SongNote[], flats: boolean): string | null {
  if (notes.length < 2) return null;
  const w = new Array(12).fill(0);
  for (const n of notes) w[n.midi % 12] += Math.min(n.duration, 2) + 0.1;
  const bass = Math.min(...notes.map(n => n.midi)) % 12;
  let best = -Infinity, name: string | null = null;
  for (let root = 0; root < 12; root++) {
    for (const c of CHORDS) {
      const tones = c.tones.map(t => (root + t) % 12);
      let s = 0;
      for (let pc = 0; pc < 12; pc++) s += tones.includes(pc) ? w[pc] : -0.6 * w[pc];
      if (bass === root) s += 0.25 * Math.max(...w);
      if (c.suffix === 'sus4' || c.suffix === 'dim') s -= 0.15 * Math.max(...w);
      if (s > best) { best = s; name = pcName(root, flats) + c.suffix; }
    }
  }
  return name;
}

/** Hand positions: a new one starts when the hand would have to stretch past a seventh. */
function positions(notes: SongNote[], barOf: (n: SongNote) => number) {
  const out: { lo: number; hi: number; bar: number }[] = [];
  let lo = Infinity, hi = -Infinity, bar = 0;
  for (const n of notes) {
    const nlo = Math.min(lo, n.midi), nhi = Math.max(hi, n.midi);
    if (nhi - nlo > 10 && lo !== Infinity) {
      out.push({ lo, hi, bar });
      lo = n.midi; hi = n.midi; bar = barOf(n);
    } else {
      if (lo === Infinity) bar = barOf(n);
      lo = nlo; hi = nhi;
    }
  }
  if (lo !== Infinity) out.push({ lo, hi, bar });
  return out;
}

function keyName(song: Song): { name: string; tonic: number; minor: boolean; flats: boolean } {
  const fifths = Math.max(-7, Math.min(7, song.fifths));
  const major = MAJOR_BY_FIFTHS[fifths];
  const minorTonic = (major + 9) % 12;
  const w = new Array(12).fill(0);
  for (const n of song.notes) w[n.midi % 12] += Math.min(n.duration, 2);
  // The last bass note and the weight of each tonic decide between the major key and its relative minor.
  const lastBass = [...song.notes].reverse().find(n => n.hand === 'L') ?? song.notes[song.notes.length - 1];
  let minorScore = w[minorTonic] - w[major];
  if (lastBass.midi % 12 === minorTonic) minorScore += Math.max(...w) * 0.3;
  if (lastBass.midi % 12 === major) minorScore -= Math.max(...w) * 0.3;
  const minor = minorScore > 0;
  const flats = fifths < 0;
  const tonic = minor ? minorTonic : major;
  return { name: `${pcName(tonic, flats)} ${minor ? 'minor' : 'major'}`, tonic, minor, flats };
}

export function analyseSong(song: Song): Analysis {
  const { bars, measureTicks } = splitBars(song);
  const tips: Tip[] = [];
  const barOf = (n: SongNote) => Math.min(bars.length, Math.floor(n.ticks / measureTicks + 1e-6) + 1);
  const playing = bars.filter(b => b.notes.length);
  const unique = new Set(playing.map(b => b.cls)).size;
  const twoHands = song.hands.length === 2;
  const key = keyName(song);

  // Repeats: the biggest shortcut to memorising anything.
  const repeats = findRepeats(bars.map(b => String(b.cls)));
  const coveredBars = repeats.reduce((s, r) => s + r.len * r.starts.length, 0);
  const letters = ['A', 'B', 'C'];
  if (repeats.length) {
    const lines = repeats.map((r, i) => {
      const at = r.starts.map(s => s + 1);
      return `Part ${letters[i]} (${range(at[0], at[0] + r.len - 1)}) comes back ${r.starts.length} times: bars ${at.join(', ')}.`;
    });
    tips.push({
      kind: 'repeat',
      title: `${pct(coveredBars / Math.max(1, playing.length))} of the song is repeats`,
      body: `${lines.join(' ')} Learn each part once and you know most of the piece.`,
      practice: { from: repeats[0].starts[0] + 1, to: repeats[0].starts[0] + repeats[0].len },
    });
  }
  if (playing.length >= 8 && unique <= playing.length * 0.7) {
    tips.push({
      kind: 'repeat',
      title: `Only ${unique} different bars`,
      body: `The song is ${playing.length} bars long, but only ${unique} of them are really different. The rest are copies (or near copies) of bars you already know.`,
    });
  }

  // Accompaniment patterns: most film scores keep one shape and only change the note it starts on.
  const degree = (st: number) => ({ 0: 'root', 3: '3rd', 4: '3rd', 7: '5th', 12: 'octave', 15: '10th', 16: '10th', 19: '12th', 24: '2 octaves' } as Record<number, string>)[st] ?? `+${st}`;
  const handsToCheck: Hand[] = twoHands ? ['L', 'R'] : [];
  for (const h of handsToCheck) {
    const hBars = playing.filter(b => b.shape[h] >= 0);
    const counts = new Map<number, number[]>();
    for (const b of hBars) counts.set(b.shape[h], [...(counts.get(b.shape[h]) ?? []), b.index + 1]);
    const top = [...counts.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    if (!top || top[1].length < 3 || top[1].length / hBars.length < 0.3) continue;
    const sample = bars[top[1][0] - 1].notes.filter(n => n.hand === h);
    const low = Math.min(...sample.map(n => n.midi));
    const stacked = new Set(sample.map(n => n.ticks)).size < sample.length * 0.6;
    const steps = [...new Set(sample.map(n => n.midi - low))].sort((a, b) => a - b);
    const shapeText = stacked
      ? `the same chord shape (${steps.map(degree).join(' + ')})`
      : `the same pattern (${sample.slice(0, 8).map(n => degree(n.midi - low)).join(' – ')}${sample.length > 8 ? ' …' : ''})`;
    const hand = h === 'L' ? 'Left hand' : 'Right hand';
    tips.push({
      kind: 'left',
      title: `${hand} repeats one pattern in ${pct(top[1].length / hBars.length)} of the bars`,
      body: `It plays ${shapeText}; only the starting note moves. Get the shape into your fingers with the ${h === 'L' ? 'left' : 'right'} hand alone, then just follow where it starts.`,
      practice: { from: top[1][0], to: Math.min(top[1][0] + 1, bars.length), hands: h, speed: 0.6 },
    });
  }

  // Chords: naming the progression turns a wall of notes into four words.
  const names = playing.map(b => chordOf(b.notes, key.flats));
  const seq = names.filter((n): n is string => !!n);
  if (seq.length >= 4) {
    let period = 0;
    for (let p = 1; p <= 8 && !period; p++) {
      let same = 0, total = 0;
      for (let i = 0; i + p < seq.length; i++) { total++; if (seq[i] === seq[i + p]) same++; }
      if (total >= p * 2 && same / total >= 0.7) period = p;
    }
    const loop = period ? seq.slice(0, period) : [...new Set(seq)].slice(0, 6);
    tips.push({
      kind: 'chords',
      title: period ? `The chords go round every ${plural(period, 'bar')}` : 'The main chords',
      body: period
        ? `${loop.join(' – ')}, over and over. Say the chord names as you play; when you get lost, find the next chord and carry on.`
        : `${loop.join(', ')} carry most of the song. Knowing them helps you hear where each hand is going.`,
    });
  }

  // Where the right hand sits: thumb notes to aim for.
  const rNotes = song.notes.filter(n => n.hand === (twoHands ? 'R' : song.hands[0]));
  const pos = positions(rNotes, barOf);
  if (pos.length && pos.length <= 8) {
    const hand = twoHands ? 'Right hand' : song.hands[0] === 'L' ? 'Left hand' : 'Your hand';
    const list = pos.slice(0, 4).map(p => `${noteName(p.lo, 'letters', true)} (from bar ${p.bar})`).join(', ');
    tips.push({
      kind: 'position',
      title: pos.length === 1 ? `${hand} never has to move` : `${hand} uses ${pos.length} positions`,
      body: pos.length === 1
        ? `Everything sits between ${noteName(pos[0].lo, 'letters', true)} and ${noteName(pos[0].hi, 'letters', true)}. Put your thumb on ${noteName(pos[0].lo, 'letters', true)} and leave it there.`
        : `Thumb on ${list}${pos.length > 4 ? ', …' : ''}. Practise the moves between positions on their own.`,
    });
  } else if (pos.length > 8) {
    const jumps = rNotes.slice(1).map((n, i) => ({ n, leap: Math.abs(n.midi - rNotes[i].midi) }))
      .filter(j => j.leap >= 9)
      .filter((j, i, all) => all.findIndex(k => barOf(k.n) === barOf(j.n)) === i)
      .slice(0, 3);
    if (jumps.length) {
      tips.push({
        kind: 'position',
        title: 'Watch the jumps',
        body: `The ${twoHands ? 'right' : ''} hand leaps in ${jumps.map(j => `bar ${barOf(j.n)} (to ${noteName(j.n.midi, 'letters', true)})`).join(', ')}. Look ahead to the landing note before you jump.`,
        practice: { from: barOf(jumps[0].n), to: barOf(jumps[0].n), speed: 0.6 },
      });
    }
  }

  // Tricky bars: fast runs, big leaps, thick chords.
  const scoreBar = (b: Bar) => {
    if (!b.notes.length) return 0;
    let worst = 0;
    for (const h of ['R', 'L'] as Hand[]) {
      const ns = b.notes.filter(n => n.hand === h);
      if (!ns.length) continue;
      const onsets = [...new Set(ns.map(n => n.ticks))].length;
      const span = Math.max(0.5, ns[ns.length - 1].time - ns[0].time);
      const nps = onsets / span;
      let leap = 0;
      for (let i = 1; i < ns.length; i++) leap = Math.max(leap, Math.abs(ns[i].midi - ns[i - 1].midi));
      const thick = Math.max(...[...new Set(ns.map(n => n.ticks))].map(t => ns.filter(n => n.ticks === t).length));
      worst = Math.max(worst, nps + leap / 5 + thick * 0.6);
    }
    return worst;
  };
  const scored = playing.map(b => ({ bar: b.index + 1, s: scoreBar(b) }));
  const mean = scored.reduce((a, b) => a + b.s, 0) / Math.max(1, scored.length);
  const hard = scored.filter(x => x.s > mean * 1.45).sort((a, b) => b.s - a.s).slice(0, 4).map(x => x.bar).sort((a, b) => a - b);
  if (hard.length) {
    const groups: [number, number][] = [];
    for (const b of hard) {
      const g = groups[groups.length - 1];
      if (g && b - g[1] <= 1) g[1] = b; else groups.push([b, b]);
    }
    const [from, to] = groups[0];
    tips.push({
      kind: 'tricky',
      title: `Hardest spot: ${range(from, to)}`,
      body: `${groups.map(g => range(g[0], g[1])).join(', ')} ${groups.length > 1 || from !== to ? 'are' : 'is'} busier than the rest. Loop ${from === to ? 'it' : 'them'} slowly with Wait on until they feel easy, then speed up.`,
      practice: { from: Math.max(1, from - 1), to, speed: 0.6 },
    });
  }

  // Key: which black keys to expect.
  const accidentals = key.flats ? ORDER_FLATS.slice(0, -song.fifths) : ORDER_SHARPS.slice(0, song.fifths);
  const blackUsed = [1, 3, 6, 8, 10].filter(pc => {
    const share = song.notes.filter(n => n.midi % 12 === pc).length / song.notes.length;
    return share > 0.02;
  });
  tips.push({
    kind: 'key',
    title: `Key: ${key.name}`,
    body: accidentals.length
      ? `${plural(accidentals.length, key.flats ? 'flat' : 'sharp')}: ${accidentals.map(pc => pcName(pc + (key.flats ? -1 : 1), key.flats)).join(', ')}. ${blackUsed.length ? `Black keys you will use: ${blackUsed.map(pc => pcName(pc, key.flats)).join(', ')}.` : 'Mostly white keys.'} Warm up with the ${key.name} scale.`
      : `${blackUsed.length ? `No sharps or flats in the key; black keys appear only as passing notes (${blackUsed.map(pc => pcName(pc, key.flats)).join(', ')}).` : 'White keys only.'} Warm up with the ${key.name} scale.`,
  });

  // Rhythm: what to count.
  const rOn = [...new Set(rNotes.map(n => n.ticks))].sort((a, b) => a - b);
  const gaps = new Map<number, number>();
  for (let i = 1; i < rOn.length; i++) {
    const beats = Math.round(((rOn[i] - rOn[i - 1]) / song.ppq) * 12) / 12;
    if (beats > 0 && beats <= 2) gaps.set(beats, (gaps.get(beats) ?? 0) + 1);
  }
  const common = [...gaps.entries()].sort((a, b) => b[1] - a[1])[0];
  if (common && common[1] / Math.max(1, rOn.length) > 0.4) {
    const b = common[0];
    const label = b === 0.5 ? ['steady eighth notes', '“1 and 2 and”'] : b === 1 ? ['one note per beat', '“1, 2, 3, 4”'] : b === 0.25 ? ['running sixteenth notes', '“1 e and a”'] : Math.abs(b - 1 / 3) < 0.01 ? ['triplets', '“1-trip-let 2-trip-let”'] : b === 2 ? ['long half notes', 'two beats each'] : null;
    if (label) {
      tips.push({
        kind: 'rhythm',
        title: `Rhythm: ${label[0]}`,
        body: `Most of the melody moves in ${label[0]}. Count ${label[1]} out loud the first few times.`,
      });
    }
  }

  // A plan that puts it all together.
  const steps: string[] = [];
  if (twoHands) steps.push('Left hand alone at 0.6× with Wait on');
  if (repeats.length) steps.push(`Part A (${range(repeats[0].starts[0] + 1, repeats[0].starts[0] + repeats[0].len)}) right hand, then hands together`);
  if (hard.length) steps.push(`Loop the hardest spot at 0.6×`);
  steps.push('Whole song at 0.8×, then 1× once you pass 90%');
  tips.unshift({
    kind: 'plan',
    title: 'Practice plan',
    body: steps.map((s, i) => `${i + 1}. ${s}.`).join(' '),
  });

  return { bars: bars.length, uniqueBars: unique, tips };
}

/** Song seconds for a 1-based bar range, using the engine's bar lines. */
export function barsToTime(measureTimes: number[], from: number, to: number) {
  const a = measureTimes[Math.max(0, from - 1)] ?? 0;
  const b = measureTimes[Math.min(measureTimes.length - 1, to)] ?? measureTimes[measureTimes.length - 1];
  return { from: a, to: b };
}
