/**
 * The score as text, for the model that plans how a song is taught (api/plan.ts): every bar with
 * each hand's notes (pitch, place in the bar, length), the parts and their repeats, and what can
 * be measured exactly (how busy each hand is, how often the hands play together, the widest leap,
 * the bars each hand repeats). The model reads the music; the numbers keep it honest.
 */
import { keyName, scoreBar, splitBars } from './analysis';
import { buildCourse } from './course';
import type { Hand, Song, SongNote } from './types';

const LETTERS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const pitch = (m: number) => `${LETTERS[m % 12]}${Math.floor(m / 12) - 1}`;
const num = (x: number) => String(Math.round(x * 100) / 100);

export interface Reading {
  /** Changes when the music changes: plans are kept per song and version. */
  version: string;
  bars: number;
  hands: Hand[];
  parts: { n: number; from: number; to: number; sameAs?: number }[];
  text: string;
}

function hashOf(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/** One hand in one bar: chords in brackets, each at its beat (from 1) with its length in beats. */
function handLine(ns: SongNote[], start: number, beat: number) {
  const at = new Map<number, SongNote[]>();
  for (const n of ns) at.set(n.ticks, [...(at.get(n.ticks) ?? []), n]);
  return [...at.entries()].sort((a, b) => a[0] - b[0]).map(([t, g]) => {
    const ps = g.sort((a, b) => a.midi - b.midi).map(n => pitch(n.midi));
    const len = Math.max(...g.map(n => n.durationTicks)) / beat;
    return `${num(1 + (t - start) / beat)}:${ps.length > 1 ? `[${ps.join(' ')}]` : ps[0]}/${num(len)}`;
  }).join(' ');
}

export function readSong(song: Song): Reading {
  const { bars, measureTicks } = splitBars(song);
  const course = buildCourse(song);
  const beat = song.ppq * 4 / song.timeSig[1];
  const key = keyName(song);
  const firstGap = song.notes.length > 1 ? song.ticksToSeconds(beat) - song.ticksToSeconds(0) : 0.5;
  const bpm = Math.round(60 / Math.max(0.05, firstGap));
  const lines: string[] = [];
  lines.push(`Title: ${song.entry.title}${song.entry.composer ? ` (${song.entry.composer})` : ''}`);
  lines.push(`Key: ${key.name}. Time: ${song.timeSig[0]}/${song.timeSig[1]}. Tempo: about ${bpm} beats a minute. Bars: ${bars.length}. Hands: ${song.hands.join(' and ')}.`);
  lines.push('Parts (bars, inclusive; "same as" means it repeats an earlier part):');
  for (const p of course.parts) lines.push(`  Part ${p.n}: bars ${p.from}-${p.to}${p.sameAs ? `, same as part ${p.sameAs}` : ''}`);

  // Measured per hand over the whole song.
  lines.push('Measured:');
  for (const h of song.hands) {
    const ns = song.notes.filter(n => n.hand === h);
    const playing = bars.filter(b => b.notes.some(n => n.hand === h));
    const shapes = new Map<number, number[]>();
    for (const b of playing) shapes.set(b.shape[h], [...(shapes.get(b.shape[h]) ?? []), b.index + 1]);
    const top = [...shapes.values()].filter(v => v.length > 1).sort((a, b) => b.length - a.length).slice(0, 4);
    let leap = 0;
    for (let i = 1; i < ns.length; i++) leap = Math.max(leap, Math.abs(ns[i].midi - ns[i - 1].midi));
    lines.push(`  ${h === 'R' ? 'Right' : 'Left'} hand: ${ns.length} notes in ${playing.length} bars, ${num(ns.length / Math.max(1, playing.length))} a bar, widest leap ${leap} semitones, range ${pitch(Math.min(...ns.map(n => n.midi)))}-${pitch(Math.max(...ns.map(n => n.midi)))}.`);
    for (const t of top) lines.push(`    Same shape (any transposition) in bars ${t.join(', ')}`);
  }
  if (song.hands.length === 2) {
    const r = new Set(song.notes.filter(n => n.hand === 'R').map(n => n.ticks));
    const l = [...new Set(song.notes.filter(n => n.hand === 'L').map(n => n.ticks))];
    const both = l.filter(t => r.has(t)).length;
    lines.push(`  Left-hand onsets that land with a right-hand onset: ${Math.round(100 * both / Math.max(1, l.length))}%.`);
  }

  lines.push('Bars (beat:pitch/length in beats; [ ] is a chord; - is rest; difficulty is a busy-ness score):');
  for (const b of bars) {
    const start = b.index * measureTicks;
    const parts = song.hands.map(h => {
      const ns = b.notes.filter(n => n.hand === h);
      return `${h}: ${ns.length ? handLine(ns, start, beat) : '-'}`;
    });
    lines.push(`  ${b.index + 1} (difficulty ${num(scoreBar(b))}) ${parts.join(' | ')}`);
  }
  const text = lines.join('\n');
  return {
    version: hashOf(text), bars: bars.length, hands: song.hands,
    parts: course.parts.map(p => ({ n: p.n, from: p.from, to: p.to, sameAs: p.sameAs })), text,
  };
}
