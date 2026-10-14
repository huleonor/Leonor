/**
 * Why a run went wrong, and one short line that helps. The diagnosis reads what the engine saw
 * (which keys he pressed instead, how long he waited, how far off the beat each note was) and
 * names the one kind of mistake behind most of it. The line comes from the bank below: written
 * ahead of time and reviewed by hand, never made up while he plays. No model, no network.
 *
 * A hint shows only after a run that did not count, at most one at a time, and not the same kind
 * over and over (MasterySession keeps track).
 */
import type { Hand } from './types';

export type HintKind = 'neighbour' | 'octave' | 'leap' | 'misread' | 'stall' | 'early' | 'late' | 'together';

/** What one chord of a run showed, as the diagnosis needs it. */
export interface HintEv {
  /** The chord's notes: pitch and hand. */
  notes: { midi: number; hand: Hand; leap: boolean }[];
  /** Keys pressed instead. */
  wrong: number[];
  /** Seconds he waited before it (free play). */
  stuck: number;
  /** Seconds early (negative) or late of each note, with the beat. */
  offs: { hand: Hand; off: number }[];
  /** Bar of the song, or undefined in a drill cut from several places. */
  bar?: number;
}

export interface Diagnosis { kind: HintKind; hand?: Hand; /** Bar of the song it is about; none in a drill cut from several places. */ bar?: number; }

/**
 * The bank. Short, plain, one idea each, in the voice of a teacher next to him. Placeholders:
 * {hand} (left hand / right hand), {bar}, {landmark} (a note to read from, in that hand's clef).
 */
export const HINTS: Record<HintKind, string[]> = {
  neighbour: [
    'One key off. Put the {hand} in place before you press.',
    'Close, just next door. Check the finger number in bar {bar}.',
    'Your {hand} sits one key off. Find the first key, the rest follow.',
  ],
  octave: [
    'Right note, wrong octave. Look how high it sits on the staff.',
    'Same letter, other place. Check if it is above or below.',
  ],
  leap: [
    'Before the jump, look where you land. Then move the whole hand.',
    'Eyes first, then hand: find the landing key early.',
    'Jump with the arm, not the fingers, and land on the finger number.',
  ],
  misread: [
    'Read it from a note you know: {landmark}.',
    'Count lines and spaces from {landmark}.',
  ],
  stall: [
    'While a note sounds, read the next one.',
    'Look one note ahead of your fingers.',
    'Name the next note in your head before you need it.',
  ],
  early: [
    'You are ahead of the click. Let the beat lead.',
    'A little rushed. Wait for the click, then play.',
  ],
  late: [
    'A little behind the click. Move your hand during the note before.',
    'Read ahead so you are ready on the beat.',
  ],
  together: [
    'Both hands land together. Press them at the same moment.',
    'Make the two hands one: lower them at the same time.',
  ],
};

const LANDMARK: Record<Hand, string> = { R: 'the G line of the treble clef', L: 'the F line of the bass clef' };
const HAND: Record<Hand, string> = { R: 'right hand', L: 'left hand' };

/** Fewer than this many signs of one kind is not a pattern. */
const ENOUGH = 2;

/** The one kind of mistake behind most of a run, or null when nothing stands out. */
export function diagnose(evs: HintEv[], wait: boolean): Diagnosis | null {
  const tally = new Map<HintKind, { n: number; bars: Map<number, number>; hands: Map<Hand, number> }>();
  const add = (kind: HintKind, bar: number | undefined, hand?: Hand) => {
    const t = tally.get(kind) ?? { n: 0, bars: new Map(), hands: new Map() };
    t.n++;
    if (bar !== undefined) t.bars.set(bar, (t.bars.get(bar) ?? 0) + 1);
    if (hand) t.hands.set(hand, (t.hands.get(hand) ?? 0) + 1);
    tally.set(kind, t);
  };
  for (const e of evs) {
    for (const w of e.wrong) {
      const near = e.notes.reduce((a, n) => (Math.abs(n.midi - w) < Math.abs(a.midi - w) ? n : a), e.notes[0]);
      if (!near) continue;
      const d = Math.abs(near.midi - w);
      if (d === 12 || d === 24) add('octave', e.bar, near.hand);
      else if (d <= 2) add('neighbour', e.bar, near.hand);
      else if (near.leap) add('leap', e.bar, near.hand);
      else add('misread', e.bar, near.hand);
    }
    if (wait) {
      if (!e.wrong.length && e.stuck > 3) add('stall', e.bar, e.notes[0]?.hand);
    } else if (e.offs.length) {
      const mean = e.offs.reduce((a, o) => a + o.off, 0) / e.offs.length;
      if (mean < -0.1) add('early', e.bar);
      else if (mean > 0.1) add('late', e.bar);
      const hands = new Set(e.offs.map(o => o.hand));
      if (hands.size > 1) {
        const offs = e.offs.map(o => o.off);
        if (Math.max(...offs) - Math.min(...offs) > 0.08) add('together', e.bar);
      }
    }
  }
  // Wrong keys say more than timing: they win a tie.
  const order: HintKind[] = ['leap', 'neighbour', 'octave', 'misread', 'together', 'stall', 'late', 'early'];
  let best: { kind: HintKind; n: number } | null = null;
  for (const kind of order) {
    const t = tally.get(kind);
    if (t && t.n >= ENOUGH && (!best || t.n > best.n)) best = { kind, n: t.n };
  }
  if (!best) return null;
  const t = tally.get(best.kind)!;
  const top = <K,>(m: Map<K, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return { kind: best.kind, hand: top(t.hands), bar: top(t.bars) };
}

/** The line for a diagnosis; `n` picks the variant, so the same kind does not read the same each time. */
export function hintLine(d: Diagnosis, n = 0): string {
  const lines = HINTS[d.kind].filter(l => (d.bar !== undefined || !l.includes('{bar}')) && (d.hand || !/\{(hand|landmark)\}/.test(l)));
  if (!lines.length) return '';
  const hand = d.hand ?? 'R';
  return lines[n % lines.length]
    .replace('{hand}', HAND[hand])
    .replace('{bar}', String(d.bar))
    .replace('{landmark}', LANDMARK[hand]);
}
