/**
 * How each song is taught. When a song is opened the app asks the planning model (api/plan.ts) to
 * read the score and write the fastest way to master it; the answer is kept per song and version,
 * so it is asked once. Until it arrives, or when it cannot be reached, rules measured from the
 * notes write the plan, so Mastery always has one.
 */
import { scoreBar, splitBars } from './analysis';
import { readSong, type Reading } from './reading';
import { checkStrategy, type HandMode, type Strategy, type Stretch } from './strategyShape';
import type { Hand, Song } from './types';

export type { Strategy } from './strategyShape';

const KEY = (id: string) => `hugos-piano:strategy:${id}`;
const readings = new WeakMap<Song, Reading>();
const local = new WeakMap<Song, Strategy>();
const asked = new Set<string>();
const listeners = new Set<() => void>();

export function onStrategy(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

function readingOf(song: Song) {
  let r = readings.get(song);
  if (!r) { r = readSong(song); readings.set(song, r); }
  return r;
}

function stored(song: Song): Strategy | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY(song.entry.id)) ?? 'null') as Strategy | null;
    return s && s.version === readingOf(song).version ? s : null;
  } catch { return null; }
}

/** The plan to follow now: the model's when it has one, the rules' otherwise. */
export function strategyOf(song: Song): Strategy {
  const s = stored(song);
  if (s) return s;
  let l = local.get(song);
  if (!l) { l = ruleStrategy(song, readingOf(song)); local.set(song, l); }
  return l;
}

/** Ask the model for this song's plan, once per version; quietly keeps the rules' plan on failure. */
export async function askStrategy(song: Song): Promise<void> {
  const reading = readingOf(song);
  const tag = `${song.entry.id}:${reading.version}`;
  // A Groq plan is a test plan: asked again each time the app opens, so Claude's replaces it once it has a key.
  const have = stored(song);
  if ((have?.source === 'ai' && !have.by?.startsWith('groq:')) || asked.has(tag)) return;
  asked.add(tag);
  try {
    const res = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reading: reading.text, shape: { bars: reading.bars, hands: reading.hands, parts: reading.parts } }),
    });
    if (!res.ok) return;
    const plan = checkStrategy(await res.json(), reading, 'ai', reading.version);
    if (!plan) return;
    localStorage.setItem(KEY(song.entry.id), JSON.stringify(plan));
    listeners.forEach(fn => fn());
  } catch { /* offline or no server: the rules' plan stays */ }
}

// ---------- The rules' plan ----------

/**
 * Measured from the notes: a hand that keeps one shape through much of the song is a pattern to
 * learn first; hands that rarely land together go one at a time through the whole part, the busier
 * one leading; hands that mostly land together start together; the busiest bars are drilled early;
 * dense parts start slower with the beat.
 */
export function ruleStrategy(song: Song, reading: Reading): Strategy {
  const { bars } = splitBars(song);
  const two = song.hands.length === 2;
  const own = reading.parts.filter(p => !p.sameAs);
  const measure = song.ppq * 4 * (song.timeSig[0] / song.timeSig[1]);
  const barOf = (t: number) => Math.floor(t / measure + 1e-6) + 1;
  const notesIn = (h: Hand, from: number, to: number) => song.notes.filter(n => n.hand === h && barOf(n.ticks) >= from && barOf(n.ticks) <= to);

  // Patterns: a figure of one or two bars that fills at least a third of the bars a hand plays.
  const patterns: Stretch[] = [];
  if (two) for (const h of song.hands) {
    const plays = (i: number) => !!bars[i]?.notes.some(n => n.hand === h);
    const playing = bars.filter((_, i) => plays(i)).length;
    let best: { from: number; len: number; cover: number; n: number } | null = null;
    for (const len of [2, 1]) {
      const seen = new Map<string, number[]>();
      for (let i = 0; i + len <= bars.length; i++) {
        if (![...Array(len).keys()].every(k => plays(i + k))) continue;
        const key = [...Array(len).keys()].map(k => bars[i + k].shape[h]).join(',');
        const at = seen.get(key) ?? [];
        // Count only occurrences that do not overlap the last one.
        if (!at.length || i >= at[at.length - 1] + len) seen.set(key, [...at, i]);
      }
      for (const at of seen.values()) {
        const cover = (at.length * len) / Math.max(1, playing);
        if (at.length >= 3 && cover >= 0.33 && (!best || cover > best.cover + 0.05)) best = { from: at[0] + 1, len, cover, n: at.length };
      }
    }
    if (best) patterns.push({ from: best.from, to: Math.min(reading.bars, best.from + Math.max(1, best.len - 1)), hand: h, why: `The ${h === 'R' ? 'right' : 'left'} hand plays this figure ${best.n} times, ${Math.round(best.cover * 100)}% of its bars.` });
  }

  const parts = own.map(p => {
    const r = notesIn('R', p.from, p.to), l = notesIn('L', p.from, p.to);
    let hands: HandMode = 'hand-by-phrase';
    let lead: Hand = song.hands[0];
    if (two && r.length && l.length) {
      const rOn = new Set(r.map(n => n.ticks));
      const lOn = [...new Set(l.map(n => n.ticks))];
      const together = lOn.filter(t => rOn.has(t)).length / Math.max(1, lOn.length);
      lead = r.length >= l.length ? 'R' : 'L';
      const ratio = Math.max(r.length, l.length) / Math.max(1, Math.min(r.length, l.length));
      if (together >= 0.8) hands = 'together';
      else if (together < 0.35 && ratio >= 1.8) hands = 'lead-hand-first';
    }
    const size = p.to - p.from + 1;
    const phrases: number[] = [];
    for (let b = p.from; b <= p.to; b += 4) phrases.push(b);
    if (phrases.length > 1 && p.to + 1 - phrases[phrases.length - 1] < 2) phrases.pop();
    const perBar = (r.length + l.length) / size;
    const rung = (perBar > 10 ? 0 : 1) as 0 | 1;
    return { n: p.n, phrases, hands, lead, rung };
  });

  // Hard spots: bars far busier than the song's usual, two bars each, at most four.
  const scores = bars.map(b => scoreBar(b));
  const sorted = scores.filter(s => s > 0).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const focus: Stretch[] = [];
  for (const i of scores.map((s, i) => [s, i] as const).filter(([s]) => s > median * 1.6 && s > 3).sort((a, b) => b[0] - a[0]).map(([, i]) => i)) {
    const from = Math.max(1, Math.min(i + 1, reading.bars - 1));
    if (focus.some(f => from <= f.to + 1 && from + 1 >= f.from - 1)) continue;
    focus.push({ from, to: from + 1, hand: 'both', why: 'Much busier than the rest of the song.' });
    if (focus.length >= 4) break;
  }

  const raw = { summary: 'Rules from the notes.', order: own.map(p => p.n), parts, patterns, focus };
  return checkStrategy(raw, reading, 'rules', reading.version)!;
}
