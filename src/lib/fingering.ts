/**
 * Automatic fingering (1 = thumb … 5 = little finger), per hand.
 *
 * MIDI files carry no fingering, so it is worked out the way a teacher pencils it in: keep the hand
 * in one five-finger position as long as possible, measure stretches in white keys against each
 * finger pair's comfortable span, pass the thumb under (or a finger over) on scales, avoid thumbs
 * and little fingers on black keys, never reuse a finger for a different key straight away. A dynamic programme picks the cheapest finger sequence through each phrase;
 * chords are spread across the hand from their outer note.
 *
 * `cue` marks the notes worth labelling when only some numbers are shown: the start of a phrase
 * and every change of hand position (a crossing, a stretch or a jump).
 */
import type { Hand, SongNote } from './types';

const isBlack = (m: number) => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);

// Where a key sits counted in white keys (a black key halfway between its neighbours): hands
// measure stretches in white keys, so C–E is a third whatever the accidentals.
const WHITE_POS = [0, 0.5, 1, 1.5, 2, 3, 3.5, 4, 4.5, 5, 5.5, 6];
const pos = (m: number) => Math.floor(m / 12) * 7 + WHITE_POS[((m % 12) + 12) % 12];

// Comfortable spans between two fingers of one hand, in white keys (after Parncutt et al. 1997,
// scaled for an adult hand): [smallest, largest]. Beyond them the hand stretches or cramps.
const COMFORT: Record<string, [number, number]> = {
  '1-2': [1, 2.5], '1-3': [2, 3.5], '1-4': [3, 5], '1-5': [4, 7],
  '2-3': [1, 2], '2-4': [2, 3], '2-5': [3, 4.5],
  '3-4': [1, 1.5], '3-5': [2, 3], '4-5': [1, 1.5],
};

interface Ev { notes: SongNote[]; time: number; anchor: number; }

/**
 * Fingers for a chord, given the finger on its anchor (lowest note for the right hand, highest for
 * the left): each note takes the finger as many white keys away as it is, squeezed into the fingers
 * left, so C–E–G is 1-3-5 and C–E 1-3.
 */
function spreadChord(ev: Ev, hand: Hand, f0: number): number[] {
  const ns = [...ev.notes].sort((a, b) => (hand === 'R' ? a.midi - b.midi : b.midi - a.midi));
  const offs = ns.map(n => Math.abs(pos(n.midi) - pos(ns[0].midi)));
  const room = 5 - f0;
  const far = offs[offs.length - 1];
  const out = offs.map((o, i) => {
    if (i === 0) return f0;
    // Wide chords (an octave, a sixth) put the outer note on the little finger and share out the rest.
    const f = far > room ? f0 + Math.round((o / far) * room) : f0 + Math.round(o);
    return Math.min(5, Math.max(f0 + 1, f));
  });
  if (far > room && ns.length > 1) out[out.length - 1] = 5;
  // Keep the fingers strictly in order, squeezing down from the top.
  for (let i = 1; i < out.length; i++) if (out[i] <= out[i - 1]) out[i] = Math.min(5, out[i - 1] + 1);
  for (let i = out.length - 1; i > 0; i--) if (out[i] <= out[i - 1]) out[i - 1] = Math.max(1, out[i] - 1);
  return out;
}

/**
 * Cost of moving from finger a on note x to finger b on note y, `dt` seconds later. A stretch past
 * the pair's comfort is paid by the time there is: with a quarter of a second or more the hand can
 * move over instead (a relocation, the same for any pair), quicker than that the fingers must reach
 * it, and two keys past comfort is beyond a hand (the quality check found 2 and 5 asked to span an
 * octave in an eighth of a second, where 1 and 5 reach it).
 */
function moveCost(a: number, x: number, b: number, y: number, hand: Hand, dt = 1): number {
  // Distance in white keys, positive towards the little finger.
  const d = hand === 'R' ? pos(y) - pos(x) : pos(x) - pos(y);
  let c = 0;
  if (x === y) return a === b ? 0 : 1; // a repeated key: any finger, the same one is easiest
  // The same finger on another key: a jolt, unless there is time to move the hand for a leap.
  if (a === b) return dt >= 0.3 && Math.abs(d) >= 3 ? 2.5 + Math.abs(d) * 0.25 : 5 + Math.abs(d);
  const k = b - a;
  if (Math.sign(k) === Math.sign(d)) {
    const [lo, hi] = COMFORT[`${Math.min(a, b)}-${Math.max(a, b)}`];
    const s = Math.abs(d);
    if (s > hi) {
      const ex = s - hi, reach = ex * 1.6 + Math.max(0, ex - 1) * (dt < 0.25 ? 4 : 1.5);
      c += dt >= 0.25 ? Math.min(reach, 2 + s * 0.25) : reach; // stretch, or move the hand
    }
    if (s < lo) c += (lo - s) * 1.2; // cramp
  } else {
    // Crossing: only the thumb passes under, or a finger (2, 3, 4) over the thumb.
    const thumbUnder = b === 1 && a >= 2 && a <= 4;
    const fingerOver = a === 1 && b >= 2 && b <= 4;
    if (thumbUnder || fingerOver) {
      const f = thumbUnder ? a : b;
      c += 2.5 + Math.max(0, Math.abs(d) - (f === 2 ? 1.5 : 3)) * 1.5 + (f === 4 ? 1.5 : 0);
      // Crossing onto a black key is easier for the finger, harder for the thumb.
      if (fingerOver && isBlack(y)) c -= 0.5;
      if (thumbUnder && isBlack(y)) c += 1.5;
    } else c += 10 + Math.abs(d);
  }
  if (isBlack(y) && b === 1) c += isBlack(x) ? 1 : 2.5;
  if (isBlack(y) && b === 5) c += 1;
  // Fingers 3 and 4 are the weak pair: avoid using them back to back.
  if ((a === 3 && b === 4) || (a === 4 && b === 3)) c += 0.5;
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
  // A wide chord (a sixth or more, an octave) is played thumb and little finger: the thumb on the anchor.
  const wide = (e: Ev) => e.notes.length > 1 && Math.abs(pos(Math.max(...e.notes.map(n => n.midi))) - pos(Math.min(...e.notes.map(n => n.midi)))) >= 5;
  const allowed = (e: Ev) => (wide(e) ? [1] : F.filter(f => f + e.notes.length - 1 <= 5 || e.notes.length === 1));
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
      const base = (isBlack(e.anchor) && f === 1 ? 2.5 : 0) + (i === 0 ? (f - 1) * 0.1 : 0);
      if (i === 0) { cost[i][f] = base; continue; }
      let best = Infinity, arg = 1;
      for (const g of F) {
        if (cost[i - 1][g] === Infinity) continue;
        const prev = evs[i - 1];
        // From the previous strike's nearer edge to this anchor.
        const from = prev.notes.length > 1 ? outer(prev, g) : { f: g, m: prev.anchor };
        const dt = e.time - prev.time;
        const c = cost[i - 1][g] + Math.min(moveCost(g, prev.anchor, f, e.anchor, hand, dt), moveCost(from.f, from.m, f, e.anchor, hand, dt));
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
      const d = hand === 'R' ? pos(e.anchor) - pos(evs[i - 1].anchor) : pos(evs[i - 1].anchor) - pos(e.anchor);
      const k = pick[i] - pick[i - 1];
      const inPlace = k !== 0 && Math.sign(k) === Math.sign(d) && Math.abs(d) <= COMFORT[`${Math.min(pick[i], pick[i - 1])}-${Math.max(pick[i], pick[i - 1])}`][1];
      cue = !(d === 0 && k === 0) && !inPlace;
    }
    for (const n of ns) n.fingerCue = cue;
  });
}

/** Fills `finger` and `fingerCue` on every note. */
export function assignFingering(notes: SongNote[]) {
  for (const hand of ['R', 'L'] as Hand[]) fingerHand(notes.filter(n => n.hand === hand), hand);
}

/**
 * How playable the fingering is (dev check, `await window.__fingerCheck('song-id')`): every change
 * from one strike to the next, per hand, measured against the comfortable span of the two fingers.
 * Impossible: more than two white keys past it within 0.25 s, with no time for the hand to move.
 * A relocation: past it with time for the hand to move. A chord wider than a ninth is impossible too.
 */
export function fingerReport(notes: SongNote[]) {
  const out: Record<string, { strikes: number; impossible: number; relocations: number; wideChords: number; worst: string[] }> = {};
  for (const hand of ['R', 'L'] as Hand[]) {
    const ns = notes.filter(n => n.hand === hand && n.finger).sort((a, b) => a.time - b.time);
    const evs: SongNote[][] = [];
    for (const n of ns) { const l = evs[evs.length - 1]; if (l && Math.abs(n.time - l[0].time) < 0.03) l.push(n); else evs.push([n]); }
    const r = { strikes: evs.length, impossible: 0, relocations: 0, wideChords: 0, worst: [] as string[] };
    for (let i = 0; i < evs.length; i++) {
      const e = evs[i];
      if (e.length > 1 && Math.max(...e.map(n => pos(n.midi))) - Math.min(...e.map(n => pos(n.midi))) > 8) r.wideChords++;
      if (!i) continue;
      const p = evs[i - 1], dt = e[0].time - p[0].time;
      let worst = 0, what = '';
      for (const a of p) for (const b of e) {
        if (a.finger === b.finger || a.midi === b.midi) continue;
        const d = hand === 'R' ? pos(b.midi) - pos(a.midi) : pos(a.midi) - pos(b.midi);
        const k = b.finger! - a.finger!;
        if (Math.sign(k) !== Math.sign(d)) continue;
        const ex = Math.abs(d) - COMFORT[`${Math.min(a.finger!, b.finger!)}-${Math.max(a.finger!, b.finger!)}`][1];
        const held = a.time + a.duration > b.time + 0.05;
        if (ex > 2 && dt < 0.25 && ex > worst) { worst = ex; what = `${a.midi}/${a.finger} > ${b.midi}/${b.finger} at ${b.time.toFixed(1)} s${held ? ' held' : ''}`; }
        else if (ex > 2 && !held) r.relocations++;
      }
      if (worst) { r.impossible++; if (r.worst.length < 6) r.worst.push(what); }
    }
    out[hand] = r;
  }
  return out;
}
