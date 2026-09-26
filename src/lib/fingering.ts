/**
 * Automatic fingering (1 = thumb … 5 = little finger), per hand.
 *
 * MIDI files carry no fingering, so it is worked out the way a teacher pencils it in: keep the hand
 * in one five-finger position as long as possible, pass the thumb under (or a finger over) on
 * scales, avoid thumbs and little fingers on black keys, never reuse a finger for a different key
 * straight away. A dynamic programme picks the cheapest finger sequence through each phrase;
 * chords are spread across the hand from their outer note.
 *
 * `cue` marks the notes worth labelling when only some numbers are shown: the start of a phrase
 * and every change of hand position (a crossing, a stretch or a jump).
 */
import type { Hand, SongNote } from './types';

const isBlack = (m: number) => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);

interface Ev { notes: SongNote[]; time: number; anchor: number; }

/** Fingers for a chord, given the finger on its anchor (lowest note for the right hand, highest for the left). */
function spreadChord(ev: Ev, hand: Hand, f0: number): number[] {
  const ns = [...ev.notes].sort((a, b) => (hand === 'R' ? a.midi - b.midi : b.midi - a.midi));
  const out: number[] = [];
  let f = f0;
  ns.forEach((n, i) => {
    if (i > 0) {
      const gap = Math.abs(n.midi - ns[i - 1].midi);
      f = Math.min(5, f + Math.max(1, Math.round(gap / 2.2)));
    }
    out.push(f);
  });
  // Too many notes for the fingers left: squeeze from the top.
  for (let i = out.length - 1; i > 0; i--) if (out[i] <= out[i - 1]) out[i - 1] = Math.max(1, out[i] - 1);
  return out;
}

/** Cost of moving from finger a on note x to finger b on note y (direction normalised to the right hand). */
function moveCost(a: number, x: number, b: number, y: number, hand: Hand): number {
  const d = hand === 'R' ? y - x : x - y; // positive = towards the little finger
  const k = b - a;
  if (d === 0) return a === b ? 0 : 1.5;
  let c = 0;
  if (k === 0) return 6; // same finger, another key
  if (Math.sign(k) === Math.sign(d)) {
    // Natural direction: about two semitones per finger, a bit more between thumb and index.
    const span = Math.abs(k) * 2 + (Math.min(a, b) === 1 ? 1.5 : 0);
    const over = Math.abs(d) - span - 1;
    const under = Math.abs(k) - Math.abs(d); // fingers skipped on a small step
    if (over > 0) c += over * 1.2;
    if (under > 1) c += (under - 1) * 0.8;
  } else {
    // Crossing: thumb under (b = 1 after a finger, going outwards) or a finger over the thumb.
    const thumbUnder = b === 1 && d > 0 && a >= 2 && a <= 4;
    const fingerOver = a === 1 && d < 0 && b >= 2 && b <= 4;
    if (thumbUnder || fingerOver) c += 2 + Math.max(0, Math.abs(d) - 4) * 0.8 + (a === 4 || b === 4 ? 1 : 0);
    else c += 8 + Math.abs(d);
  }
  if (isBlack(y) && b === 1) c += 2.5;
  if (isBlack(y) && b === 5) c += 1;
  if (isBlack(y) && isBlack(x) === false && (b === 1)) c += 1;
  return c;
}

function fingerHand(notes: SongNote[], hand: Hand) {
  if (!notes.length) return;
  // Group into strikes (chords) by start time.
  const evs: Ev[] = [];
  for (const n of notes) {
    const last = evs[evs.length - 1];
    if (last && Math.abs(n.time - last.time) < 0.03) last.notes.push(n);
    else evs.push({ notes: [n], time: n.time, anchor: 0 });
  }
  for (const e of evs) e.anchor = hand === 'R' ? Math.min(...e.notes.map(n => n.midi)) : Math.max(...e.notes.map(n => n.midi));

  // Phrases: a rest of more than a second lets the hand move freely.
  let start = 0;
  for (let i = 1; i <= evs.length; i++) {
    const end = i === evs.length;
    const prevEnd = evs[i - 1].time + Math.max(...evs[i - 1].notes.map(n => n.duration));
    if (end || evs[i].time - prevEnd > 1) {
      solve(evs.slice(start, i), hand);
      start = i;
    }
  }
}

function solve(evs: Ev[], hand: Hand) {
  const F = [1, 2, 3, 4, 5];
  // Anchor finger options: a chord's anchor leaves room for the rest of the chord.
  const allowed = (e: Ev) => F.filter(f => f + e.notes.length - 1 <= 5 || e.notes.length === 1);
  // Top note of a chord (the far side from the anchor), for moving to the next strike.
  const outer = (e: Ev, f: number) => {
    const fs = spreadChord(e, hand, f);
    const ns = [...e.notes].sort((a, b) => (hand === 'R' ? a.midi - b.midi : b.midi - a.midi));
    return { f: fs[fs.length - 1], m: ns[ns.length - 1].midi };
  };
  const cost: number[][] = [];
  const back: number[][] = [];
  evs.forEach((e, i) => {
    cost.push([]); back.push([]);
    for (const f of F) {
      if (!allowed(e).includes(f)) { cost[i][f] = Infinity; continue; }
      const base = (isBlack(e.anchor) && f === 1 ? 2.5 : 0) + (i === 0 ? Math.abs(f - (e.notes.length > 1 ? 1 : 2)) * 0.2 : 0);
      if (i === 0) { cost[i][f] = base; continue; }
      let best = Infinity, arg = 1;
      for (const g of F) {
        if (cost[i - 1][g] === Infinity) continue;
        const prev = evs[i - 1];
        // From the previous strike's nearer edge to this anchor.
        const from = prev.notes.length > 1 ? outer(prev, g) : { f: g, m: prev.anchor };
        const c = cost[i - 1][g] + Math.min(moveCost(g, prev.anchor, f, e.anchor, hand), moveCost(from.f, from.m, f, e.anchor, hand));
        if (c < best) { best = c; arg = g; }
      }
      cost[i][f] = best + base;
      back[i][f] = arg;
    }
  });
  // Walk back the cheapest path.
  const last = evs.length - 1;
  let f = F.reduce((a, b) => (cost[last][b] < cost[last][a] ? b : a), 1);
  const pick: number[] = [];
  for (let i = last; i >= 0; i--) { pick[i] = f; f = back[i][f] ?? 1; }

  evs.forEach((e, i) => {
    const fs = spreadChord(e, hand, pick[i]);
    const ns = [...e.notes].sort((a, b) => (hand === 'R' ? a.midi - b.midi : b.midi - a.midi));
    ns.forEach((n, j) => { n.finger = fs[j]; });
    // Worth a label: first strike, or the hand had to move (crossing, stretch, jump).
    let cue = i === 0;
    if (i > 0) {
      const d = hand === 'R' ? e.anchor - evs[i - 1].anchor : evs[i - 1].anchor - e.anchor;
      const k = pick[i] - pick[i - 1];
      const inPlace = Math.sign(k) === Math.sign(d) && Math.abs(d) <= Math.abs(k) * 2 + 2;
      cue = !(d === 0 && k === 0) && !inPlace;
    }
    for (const n of ns) n.fingerCue = cue;
  });
}

/** Fills `finger` and `fingerCue` on every note. */
export function assignFingering(notes: SongNote[]) {
  for (const hand of ['R', 'L'] as Hand[]) fingerHand(notes.filter(n => n.hand === hand), hand);
}
