import { Midi } from '@tonejs/midi';
import { assignFingering } from './fingering';
import type { Hand, Song, SongEntry, SongNote } from './types';

type Track = Midi['tracks'][number];

const KEY_NAMES = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
const MAJOR_TONIC_FIFTHS: Record<number, number> = { 0: 0, 7: 1, 2: 2, 9: 3, 4: 4, 11: 5, 6: 6, 1: -5, 8: -4, 3: -3, 10: -2, 5: -1 };
const KK_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KK_MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function handFromName(name: string): Hand | null {
  if (/right|\brh\b|direita|treble|melod|upper|soprano/i.test(name)) return 'R';
  if (/left|\blh\b|esquerda|bass|baixo|lower/i.test(name)) return 'L';
  return null;
}

const avgPitch = (t: Track) => t.notes.reduce((s, n) => s + n.midi, 0) / t.notes.length;

/** Krumhansl-Schmuckler key finding, weighted by note duration. */
function estimateFifths(notes: SongNote[]): number {
  const hist = new Array(12).fill(0);
  for (const n of notes) hist[n.midi % 12] += Math.min(n.duration, 2);
  const corr = (profile: number[], tonic: number) => {
    const xs = profile.map((_, i) => profile[(i - tonic + 12) % 12]);
    const mx = xs.reduce((a, b) => a + b) / 12, my = hist.reduce((a, b) => a + b) / 12;
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < 12; i++) { num += (xs[i] - mx) * (hist[i] - my); dx += (xs[i] - mx) ** 2; dy += (hist[i] - my) ** 2; }
    return num / Math.sqrt(dx * dy || 1);
  };
  let best = -Infinity, fifths = 0;
  for (let t = 0; t < 12; t++) {
    const maj = corr(KK_MAJOR, t), min = corr(KK_MINOR, t);
    if (maj > best) { best = maj; fifths = MAJOR_TONIC_FIFTHS[t]; }
    if (min > best) { best = min; fifths = MAJOR_TONIC_FIFTHS[(t + 3) % 12]; }
  }
  return fifths;
}

/**
 * Accompaniment written in the right-hand track (a common shortcut in arrangements, as in the
 * opening bars of Gymnopédie No. 1): a chord of three or more notes, all at or below G4, struck
 * while a left-hand note is still sounding, belongs to the left hand.
 */
function tidyHands(notes: SongNote[]) {
  const byTick = new Map<number, SongNote[]>();
  for (const n of notes) if (n.hand === 'R') byTick.set(n.ticks, [...(byTick.get(n.ticks) ?? []), n]);
  const left = notes.filter(n => n.hand === 'L');
  for (const [t, chord] of byTick) {
    if (chord.length < 3 || chord.some(n => n.midi > 67)) continue;
    const allRightHere = notes.filter(n => n.hand === 'R' && n.ticks === t).length === chord.length;
    const leftSounding = left.some(l => l.ticks <= t && l.ticks + l.durationTicks > t);
    if (allRightHere && leftSounding) chord.forEach(n => (n.hand = 'L'));
  }
}

const NOTE_BEATS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8];
/**
 * Performed MIDI lets notes go a little early (a half note played as 1.8 beats); printed, that
 * becomes a half tied to a dotted thirty-second. A note up to a quarter short of a plain value is
 * written as that value, as long as it does not run into the next note in the same hand.
 */
function snapDurations(notes: SongNote[], ppq: number, toSec: (t: number) => number) {
  for (const hand of ['R', 'L'] as Hand[]) {
    const own = notes.filter(n => n.hand === hand);
    const onsets = [...new Set(own.map(n => n.ticks))].sort((a, b) => a - b);
    for (const n of own) {
      const beats = n.durationTicks / ppq;
      const want = NOTE_BEATS.find(c => c >= beats - 1e-6);
      if (!want || want - beats > want * 0.25) continue;
      const next = onsets.find(o => o > n.ticks);
      const ticks = Math.round(want * ppq);
      if (next !== undefined && n.ticks + ticks > next) continue;
      n.durationTicks = ticks;
      n.duration = Math.max(0.05, toSec(n.ticks + ticks) - n.time);
    }
  }
}

export function parseSong(buf: ArrayBuffer, entry: SongEntry): Song {
  let midi: Midi;
  try {
    midi = new Midi(buf);
  } catch {
    throw new Error('err.badFile');
  }
  const tracks = midi.tracks.filter(t => t.notes.length > 0 && t.channel !== 9);
  if (!tracks.length) throw new Error('err.noNotes');

  const assigned: { n: Track['notes'][number]; hand: Hand }[] = [];
  const byPitch = (t: Track) => t.notes.forEach(n => assigned.push({ n, hand: n.midi >= 60 ? 'R' : 'L' }));
  const names = tracks.map(t => handFromName(t.name));

  if (tracks.length >= 2 && names.every(Boolean) && names.includes('R') && names.includes('L')) {
    tracks.forEach((t, i) => t.notes.forEach(n => assigned.push({ n, hand: names[i]! })));
  } else if (tracks.length === 2) {
    const [a, b] = tracks;
    const aHand: Hand = avgPitch(a) >= avgPitch(b) ? 'R' : 'L';
    a.notes.forEach(n => assigned.push({ n, hand: aHand }));
    b.notes.forEach(n => assigned.push({ n, hand: aHand === 'R' ? 'L' : 'R' }));
  } else {
    tracks.forEach(byPitch);
  }

  assigned.sort((x, y) => x.n.time - y.n.time || x.n.midi - y.n.midi);
  // Drop exact duplicates (same pitch, same start) that some exports contain.
  const seen = new Set<string>();
  const notes: SongNote[] = [];
  for (const { n, hand } of assigned) {
    const k = `${n.midi}:${n.ticks}`;
    if (seen.has(k)) continue;
    seen.add(k);
    notes.push({
      id: notes.length, midi: n.midi, time: n.time, duration: Math.max(n.duration, 0.05), hand,
      velocity: n.velocity, ticks: n.ticks, durationTicks: Math.max(n.durationTicks, 1),
    });
  }

  tidyHands(notes);
  snapDurations(notes, midi.header.ppq, t => midi.header.ticksToSeconds(t));
  assignFingering(notes);

  const ks = midi.header.keySignatures[0];
  const fifths = ks && KEY_NAMES.includes(ks.key) ? KEY_NAMES.indexOf(ks.key) - 7 : estimateFifths(notes);
  const ts = midi.header.timeSignatures[0]?.timeSignature;
  const pitches = notes.map(n => n.midi);

  return {
    entry,
    notes,
    duration: Math.max(...notes.map(n => n.time + n.duration)),
    firstNoteTime: notes[0].time,
    ppq: midi.header.ppq,
    timeSig: entry.timeSig ?? (ts && ts.length >= 2 ? [ts[0], ts[1]] : [4, 4]),
    // A piece that changes metre keeps its changes (unless the slot overrides the signature).
    meter: entry.timeSig ? undefined : midi.header.timeSignatures.filter(t => t.ticks > 0 && t.timeSignature.length >= 2).map(t => ({ ticks: t.ticks, sig: [t.timeSignature[0], t.timeSignature[1]] as [number, number] })),
    fifths,
    ticksToSeconds: t => midi.header.ticksToSeconds(t),
    hands: (['R', 'L'] as Hand[]).filter(h => notes.some(n => n.hand === h)),
    range: [Math.min(...pitches), Math.max(...pitches)],
  };
}
