import type { Hand, Song, SongNote } from './types';

/** One written symbol (note, chord or rest) in the generated ABC, with where it sits in the text. */
export interface AbcToken {
  start: number;
  ids: number[];
  time: number;
  hand: Hand;
  /** Tied continuation of an earlier token (same notes). */
  cont: boolean;
  rest: boolean;
  measure: number;
  line: number;
}

export interface AbcScore {
  abc: string;
  tokens: AbcToken[];
  measuresPerLine: number;
  firstMeasure: number;
  lineCount: number;
  /** The staves top to bottom, as abcjs numbers its voices (abcjs-v0, abcjs-v1). */
  voices: { hand: Hand; clef: 'treble' | 'bass' }[];
}

const DURATIONS = [24, 16, 12, 8, 6, 4, 3, 2, 1]; // in 16ths, all writable as one symbol
const NATURAL: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const SHARPS = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLATS = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
const KEY_NAME: Record<number, string> = {
  [-7]: 'Cb', [-6]: 'Gb', [-5]: 'Db', [-4]: 'Ab', [-3]: 'Eb', [-2]: 'Bb', [-1]: 'F',
  0: 'C', 1: 'G', 2: 'D', 3: 'A', 4: 'E', 5: 'B', 6: 'F#', 7: 'C#',
};

function keyAccidentals(fifths: number): Record<string, number> {
  const acc: Record<string, number> = { C: 0, D: 0, E: 0, F: 0, G: 0, A: 0, B: 0 };
  if (fifths > 0) SHARPS.slice(0, fifths).forEach(l => (acc[l] = 1));
  else FLATS.slice(0, -fifths).forEach(l => (acc[l] = -1));
  return acc;
}

/** Spell a MIDI pitch in ABC, printing an accidental only when the key or the bar needs it. */
function spell(midi: number, fifths: number, keyAcc: Record<string, number>, bar: Map<string, number>): string {
  const pc = ((midi % 12) + 12) % 12;
  const cands: { l: string; alt: number }[] = [];
  for (const l of LETTERS) {
    let alt = pc - NATURAL[l];
    if (alt > 6) alt -= 12;
    if (alt < -6) alt += 12;
    if (Math.abs(alt) <= 1) cands.push({ l, alt });
  }
  const c = cands.find(c => c.alt === keyAcc[c.l])
    ?? cands.find(c => c.alt === 0)
    ?? cands.find(c => c.alt === (fifths >= 0 ? 1 : -1))
    ?? cands[0];
  const octave = Math.floor((midi - c.alt) / 12) - 1;
  const k = c.l + octave;
  const current = bar.has(k) ? bar.get(k)! : keyAcc[c.l];
  let acc = '';
  if (c.alt !== current) {
    acc = c.alt === 1 ? '^' : c.alt === -1 ? '_' : '=';
    bar.set(k, c.alt);
  }
  const letter = octave >= 5 ? c.l.toLowerCase() + "'".repeat(octave - 5) : c.l + ','.repeat(Math.max(0, 4 - octave));
  return acc + letter;
}

interface Event { qs: number; dur: number; notes: SongNote[]; }

export interface ScoreOptions {
  /** Only these bars (1-based, inclusive): a lesson's section. */
  from?: number;
  to?: number;
  title?: string;
  composer?: string;
  /** Section labels to box above the bar where each section starts (1-based bars). */
  sections?: { bar: number; label: string }[];
  /** A one-hand lesson step: the other staff stays empty, as in Simply Piano. */
  only?: Hand;
  /** Space between the two staves of the grand staff (abcjs units): Simply Piano keeps them well apart. */
  staffSep?: number;
}

export function buildScore(song: Song, measuresPerLine: number, fingers: 'off' | 'some' | 'all' = 'off', opts: ScoreOptions = {}): AbcScore {
  const [num, den] = song.timeSig;
  const grid = song.ppq / 4; // one 16th note in ticks
  const measureUnits = Math.max(1, Math.round((num * 16) / den));
  const beatUnits = den === 8 && num % 3 === 0 ? 6 : Math.max(1, 16 / den);
  const q = (ticks: number) => Math.round(ticks / grid);
  const keyAcc = keyAccidentals(song.fifths);

  const firstQ = Math.min(...song.notes.map(n => q(n.ticks)));
  const lastQ = Math.max(...song.notes.map(n => q(n.ticks + n.durationTicks)));
  const firstMeasure = opts.from ? opts.from - 1 : Math.floor(firstQ / measureUnits);
  const totalMeasures = opts.to ?? Math.ceil(Math.max(lastQ, firstQ + 1) / measureUnits);
  const startQ = firstMeasure * measureUnits, endQ = totalMeasures * measureUnits;
  const hands = song.hands;

  const measures: Record<Hand, string[]> = { R: [], L: [] };
  const toks: Record<Hand, { rel: number; tok: Omit<AbcToken, 'start'> }[][]> = { R: [], L: [] };

  for (const hand of hands) {
    const ms = measures[hand] = new Array(totalMeasures).fill('');
    const ts = toks[hand] = Array.from({ length: totalMeasures }, () => [] as { rel: number; tok: Omit<AbcToken, 'start'> }[]);
    const bars = Array.from({ length: totalMeasures }, () => new Map<string, number>());

    const byStart = new Map<number, { qs: number; end: number; notes: SongNote[] }>();
    for (const n of song.notes) {
      if (n.hand !== hand || (opts.only && n.hand !== opts.only)) continue;
      const qs = q(n.ticks);
      if (qs < startQ || qs >= endQ) continue;
      const qe = Math.min(endQ, Math.max(qs + 1, q(n.ticks + n.durationTicks)));
      const o = byStart.get(qs);
      if (o) { o.notes.push(n); o.end = Math.max(o.end, qe); } else byStart.set(qs, { qs, end: qe, notes: [n] });
    }
    const onsets = [...byStart.values()].sort((a, b) => a.qs - b.qs);
    const events: Event[] = onsets.map((o, i) => ({
      qs: o.qs,
      dur: Math.max(1, Math.min(o.end, onsets[i + 1]?.qs ?? Infinity) - o.qs),
      notes: o.notes.sort((a, b) => a.midi - b.midi),
    }));

    const emit = (start: number, len: number, ev: Event | null) => {
      let first = true;
      while (len > 0) {
        const m = Math.floor(start / measureUnits);
        let pos = start % measureUnits;
        const take = Math.min(len, measureUnits - pos);
        let remaining = take;
        while (remaining > 0) {
          // Break at the beat when a long value would straddle it mid-beat.
          const toBeat = beatUnits - (pos % beatUnits);
          const limit = pos % beatUnits !== 0 && remaining > toBeat ? toBeat : remaining;
          const d = DURATIONS.find(x => x <= limit)!;
          const durStr = d === 1 ? '' : String(d);
          const last = remaining - d === 0 && len - take === 0;
          let text: string;
          if (ev) {
            const pitches = ev.notes.map(n => spell(n.midi, song.fifths, keyAcc, bars[m]));
            // Fingering on a single note's first written segment: above the note for the right hand,
            // below it for the left, as piano music prints it, so a left-hand number never sits
            // up among the chords that follow it.
            const fn = ev.notes.length === 1 && first ? ev.notes[0] : null;
            const fingerMark = fn?.finger && (fingers === 'all' || (fingers === 'some' && fn.fingerCue)) ? `"${hand === 'L' ? '_' : '^'}${fn.finger}"` : '';
            text = fingerMark + (pitches.length > 1 ? `[${pitches.join('')}]` : pitches[0]) + durStr + (last ? '' : '-');
          } else {
            text = (opts.only && opts.only !== hand ? 'x' : 'z') + durStr;
          }
          const sep = ms[m].length && pos % beatUnits === 0 ? ' ' : '';
          ts[m].push({
            rel: ms[m].length + sep.length,
            tok: {
              ids: ev ? ev.notes.map(n => n.id) : [], time: song.ticksToSeconds((m * measureUnits + pos) * grid),
              hand, cont: !first, rest: !ev, measure: m, line: Math.floor((m - firstMeasure) / measuresPerLine),
            },
          });
          ms[m] += sep + text;
          first = false;
          pos += d;
          remaining -= d;
        }
        start += take;
        len -= take;
      }
    };

    let cursor = firstMeasure * measureUnits;
    for (const ev of events) {
      if (ev.qs > cursor) emit(cursor, ev.qs - cursor, null);
      emit(ev.qs, ev.dur, ev);
      cursor = ev.qs + ev.dur;
    }
    if (cursor < totalMeasures * measureUnits) emit(cursor, totalMeasures * measureUnits - cursor, null);
  }

  const lAvg = song.notes.filter(n => n.hand === 'L').reduce((s, n, _, a) => s + n.midi / a.length, 0);
  const lClef = lAvg > 57 ? 'treble' : 'bass';
  const rAvg = song.notes.filter(n => n.hand === 'R').reduce((s, n, _, a) => s + n.midi / a.length, 0);
  const rClef = rAvg && rAvg < 55 ? 'bass' : 'treble';

  let abc = `X:1\n${opts.title ? `T:${opts.title.replace(/\n/g, ' ')}\n` : ''}${opts.composer ? `C:${opts.composer.replace(/\n/g, ' ')}\n` : ''}M:${num}/${den}\nL:1/16\n`;
  if (opts.sections?.length) abc += '%%partsbox true\n';
  if (opts.staffSep) abc += `%%sysstaffsep ${opts.staffSep}\n`;
  if (hands.length === 2) abc += '%%score {R | L}\n';
  if (hands.includes('R')) abc += `V:R clef=${rClef}\n`;
  if (hands.includes('L')) abc += `V:L clef=${lClef}\n`;
  abc += `K:${KEY_NAME[song.fifths] ?? 'C'}\n`;

  const tokens: AbcToken[] = [];
  let lineCount = 0;
  for (let s = firstMeasure; s < totalMeasures; s += measuresPerLine) {
    const end = Math.min(totalMeasures, s + measuresPerLine);
    for (const hand of hands) {
      abc += `[V:${hand}] `;
      for (let m = s; m < end; m++) {
        const part = hand === hands[0] ? opts.sections?.find(sc => sc.bar === m + 1) : undefined;
        if (part) abc += `[P:${part.label.replace(/[\]\n]/g, ' ')}]`;
        const base = abc.length;
        for (const { rel, tok } of toks[hand][m]) tokens.push({ ...tok, start: base + rel });
        abc += measures[hand][m] + (m === totalMeasures - 1 ? ' |]' : ' | ');
      }
      abc += '\n';
    }
    lineCount++;
  }

  tokens.sort((a, b) => a.time - b.time || a.start - b.start);
  const voices = (['R', 'L'] as const).filter(h => hands.includes(h)).map(hand => ({ hand, clef: (hand === 'R' ? rClef : lClef) as 'treble' | 'bass' }));
  return { abc, tokens, measuresPerLine, firstMeasure, lineCount, voices };
}

/** How many symbols per bar, on average, for the busier hand. */
export function density(song: Song): number {
  const [num, den] = song.timeSig;
  const measureTicks = song.ppq * 4 * (num / den);
  const bars = Math.max(1, Math.ceil(Math.max(...song.notes.map(n => n.ticks + n.durationTicks)) / measureTicks));
  const onsets = (h: Hand) => new Set(song.notes.filter(n => n.hand === h).map(n => Math.round(n.ticks / (song.ppq / 4)))).size;
  return Math.max(onsets('R'), onsets('L')) / bars;
}
