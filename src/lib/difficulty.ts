/**
 * How hard a stretch of a song is to play, from its own notes, for the videos to set their pace by
 * (the user's choice 2026-11: gentler videos, above all in the hard phases). Each part of the
 * difficulty is measured on its own and kept, so the videos can answer the one that matters:
 *
 * - speed: note groups a second at the real tempo (2 is calm, 7 is busy);
 * - reach: the widest span a hand covers (an octave and more means moving the hand);
 * - leaps: how often a hand jumps a fifth or more in under 0.6 s;
 * - black: the share of black keys;
 * - chords: notes struck at once per hand;
 * - apart: how independent the hands are (one plays while the other holds or rests);
 * - new: the share of the stretch's bars whose shape he has not met yet in the song.
 *
 * `score` folds them into 0 (easy) to 1 (hard).
 */
import { isBlack } from './names';
import type { Hand, SongNote } from './types';

export interface Difficulty {
  score: number;
  speed: number; reach: number; leaps: number; black: number; chords: number; apart: number;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const norm = (x: number, easy: number, hard: number) => clamp01((x - easy) / (hard - easy));

/** The difficulty of these notes, which last `seconds` at the real tempo. */
export function difficultyOf(notes: SongNote[], seconds: number): Difficulty {
  if (!notes.length) return { score: 0, speed: 0, reach: 0, leaps: 0, black: 0, chords: 0, apart: 0 };
  const onsets = new Set(notes.map(n => n.ticks)).size;
  const speed = onsets / Math.max(0.5, seconds);
  let reach = 0, leaps = 0, steps = 0, struck = 0, groups = 0;
  const byHand = new Map<Hand, SongNote[]>();
  for (const n of notes) byHand.set(n.hand, [...(byHand.get(n.hand) ?? []), n]);
  const onsetsOf = new Map<Hand, Set<number>>();
  for (const [h, ns] of byHand) {
    const ms = ns.map(n => n.midi);
    reach = Math.max(reach, Math.max(...ms) - Math.min(...ms));
    // The line a hand leads with: its top note (right) or bottom note (left) at each onset.
    const at = new Map<number, { midi: number; time: number; k: number }>();
    for (const n of ns) {
      const v = at.get(n.ticks);
      at.set(n.ticks, { midi: v ? (h === 'L' ? Math.min(v.midi, n.midi) : Math.max(v.midi, n.midi)) : n.midi, time: n.time, k: (v?.k ?? 0) + 1 });
    }
    const seq = [...at.entries()].sort((a, b) => a[0] - b[0]).map(x => x[1]);
    for (let i = 1; i < seq.length; i++) {
      steps++;
      if (Math.abs(seq[i].midi - seq[i - 1].midi) >= 7 && seq[i].time - seq[i - 1].time < 0.6) leaps++;
    }
    for (const g of seq) { struck += g.k; groups++; }
    onsetsOf.set(h, new Set(at.keys()));
  }
  // Independence: of the onsets while both hands play in this stretch, the share only one hand has.
  let apart = 0;
  const L = onsetsOf.get('L'), R = onsetsOf.get('R');
  if (L?.size && R?.size) {
    const all = new Set([...L, ...R]);
    let one = 0;
    for (const k of all) if (L.has(k) !== R.has(k)) one++;
    apart = one / all.size;
  }
  const d = {
    speed: norm(speed, 2, 7),
    reach: norm(reach, 7, 24),
    leaps: norm(steps ? leaps / steps : 0, 0, 0.35),
    black: notes.filter(n => isBlack(n.midi)).length / notes.length,
    chords: norm(groups ? struck / groups : 1, 1, 3),
    apart: L?.size && R?.size ? norm(apart, 0.2, 0.8) : 0,
  };
  const score = clamp01(0.34 * d.speed + 0.14 * d.reach + 0.2 * d.leaps + 0.08 * d.black + 0.1 * d.chords + 0.14 * d.apart);
  return { score, ...d };
}
