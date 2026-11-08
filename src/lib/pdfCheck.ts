/**
 * Checking a MIDI file against his printed score (the user's choice 2026-11: "something that checks
 * the PDF"). A converter that turns a PDF into MIDI makes mistakes (a bar shifted, a clef misread, an
 * octave lost); the PDF he bought carries its chord symbols as text (Em7, Am7, D7...). They are read
 * here, on the device, in the order of the music, and lined up with the MIDI's bars; a bar whose
 * notes do not fit the chords written over it is very likely a mistake of the conversion, and he is
 * told which. Only the chord symbols are read, never the notes: nothing of the score is copied, and
 * the file never leaves the device.
 */
import { barGrid } from './bars';
import type { Song } from './types';

export interface ScoreChord { name: string; root: number; pcs: number[]; bass: number }
export interface ScoreCheck {
  /** Chord symbols read from the PDF, and its pages. */
  read: number; pages: number;
  /** Bars of the MIDI that had chord symbols lined up with them, and how many fit them. */
  checked: number; fit: number;
  /** Bars whose notes do not fit their chords, with the chords written there. */
  flagged: { bar: number; chords: string[] }[];
}

/** A PDF he picked where a MIDI was expected, kept until the MIDI comes, to check it then. */
let pendingScore: ArrayBuffer | null = null;
export const keepPendingScore = (data: ArrayBuffer) => { pendingScore = data; };
export const takePendingScore = () => { const d = pendingScore; pendingScore = null; return d; };

const LETTER: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const acc = (s: string) => (s === '#' || s === '♯' ? 1 : s === 'b' || s === '♭' ? -1 : 0);

/** A chord symbol's root and the pitch classes it holds (its tensions too), or null if it is not one. */
export function parseChord(raw: string): ScoreChord | null {
  const s = raw.replace(/\s+/g, '').replace(/[()]/g, '');
  const m = /^([A-G])([#b♯♭]?)(maj|ma|M|min|mi|m|dim|°|aug|\+|sus|ø)?(.*?)(?:\/([A-G])([#b♯♭]?))?$/.exec(s);
  if (!m) return null;
  const root = (LETTER[m[1]] + acc(m[2]) + 12) % 12;
  const q = m[3] ?? '', rest = m[4] ?? '';
  if (rest && !/^[0-9#b♯♭susaddmajMdimaug+]*$/.test(rest)) return null;
  const minor = q === 'm' || q === 'min' || q === 'mi';
  const dim = q === 'dim' || q === '°' || q === 'ø';
  const iv = new Set<number>([0, minor || dim ? 3 : 4, dim ? 6 : q === 'aug' || q === '+' ? 8 : 7]);
  if (q === 'sus' || /sus/.test(rest)) { iv.delete(3); iv.delete(4); iv.add(/sus2/.test(rest) ? 2 : 5); }
  const maj7 = q === 'maj' || q === 'ma' || q === 'M' || /maj/.test(rest);
  if (/13/.test(rest)) { iv.add(9); iv.add(2); iv.add(maj7 ? 11 : 10); }
  else if (/11/.test(rest)) { iv.add(5); iv.add(2); iv.add(maj7 ? 11 : 10); }
  else if (/9/.test(rest)) { iv.add(2); iv.add(maj7 ? 11 : 10); }
  if (/7/.test(rest)) iv.add(maj7 ? 11 : dim && q === 'dim' && !/b5/.test(rest) ? 9 : 10);
  if (q === 'ø' || /b5/.test(rest)) { iv.delete(7); iv.add(6); }
  if (/#5|\+5/.test(rest)) { iv.delete(7); iv.add(8); }
  if (/(^|[^1])6/.test(rest)) iv.add(9);
  if (/b9/.test(rest)) iv.add(1);
  if (/#9/.test(rest)) iv.add(3);
  if (/#11/.test(rest)) iv.add(6);
  const bass = m[5] ? (LETTER[m[5]] + acc(m[6] ?? '') + 12) % 12 : root;
  return { name: raw.replace(/\s+/g, ''), root, pcs: [...iv].map(i => (root + i) % 12), bass };
}

/** The chord symbols of a PDF score, in reading order (page by page, line by line, left to right). */
export async function readScoreChords(data: ArrayBuffer): Promise<{ chords: ScoreChord[]; pages: number }> {
  const pdfjs = await import('pdfjs-dist');
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const chords: ScoreChord[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    // The pieces of the text, with where they sit; a symbol is often split (Em + 7, F + # + m7(b5)).
    const items = (tc.items as { str: string; transform: number[]; width: number }[])
      .filter(i => i.str && i.str.trim())
      .map(i => ({ s: i.str.trim(), x: i.transform[4], y: i.transform[5], w: i.width, size: Math.hypot(i.transform[0], i.transform[1]) }));
    // Lines from the top of the page down, each left to right.
    items.sort((a, b) => (Math.abs(a.y - b.y) > 4 ? b.y - a.y : a.x - b.x));
    const words: { s: string; x: number; y: number; end: number }[] = [];
    for (const it of items) {
      const last = words[words.length - 1];
      if (last && Math.abs(it.y - last.y) <= 4 && it.x - last.end < Math.max(2.5, it.size * 0.25)) { last.s += it.s; last.end = it.x + it.w; }
      else words.push({ s: it.s, x: it.x, y: it.y, end: it.x + it.w });
    }
    for (const w of words) {
      if (!/^[A-G]/.test(w.s) || w.s.length > 14) continue;
      const c = parseChord(w.s);
      // A clef drawn as a letter (with the key signature's sharps after it) sits at the left of each line.
      if (c && !(w.x < 100 && /^[GF][#b♯♭]*$/.test(w.s))) chords.push(c);
    }
  }
  return { chords, pages: doc.numPages };
}

/** How well a bar's notes fit a chord: the share of its sounding time on the chord's notes, and its bass. */
function fitOf(chord: ScoreChord, bar: { pcs: number[]; bass: number | null }) {
  const total = bar.pcs.reduce((a, b) => a + b, 0);
  if (!total) return 0.5;
  const on = chord.pcs.reduce((a, pc) => a + bar.pcs[pc], 0) / total;
  const bassOk = bar.bass === null ? 0.5 : bar.bass === chord.bass || bar.bass === chord.root ? 1 : chord.pcs.includes(bar.bass) ? 0.6 : 0;
  return 0.65 * on + 0.35 * bassOk;
}

/** Lines the chord symbols up with the MIDI's bars and finds the bars that do not fit them. */
export function checkAgainst(song: Song, chords: ScoreChord[], pages: number): ScoreCheck {
  const grid = barGrid(song);
  const m = grid.count;
  const bars = Array.from({ length: m }, (_, i) => {
    const a = grid.starts[i], b = grid.starts[i + 1] ?? Infinity;
    const ns = song.notes.filter(n => n.ticks >= a && n.ticks < b);
    const pcs = new Array(12).fill(0);
    for (const n of ns) pcs[n.midi % 12] += Math.min(n.durationTicks, b - n.ticks);
    const first = ns.length ? Math.min(...ns.map(n => n.ticks)) : 0;
    const low = ns.filter(n => n.ticks - first < song.ppq / 2).sort((x, y) => x.midi - y.midi)[0];
    return { pcs, bass: low ? low.midi % 12 : null };
  });
  const n = chords.length;
  // dp[i][j]: the best alignment of the first i chords with the first j bars. A bar takes up to
  // three chords; a chord can be passed over (a duplicate line of the print, a symbol misread).
  const NEG = -1e9, SKIP = -0.25, KMAX = 3;
  const dp = Array.from({ length: n + 1 }, () => new Float64Array(m + 1).fill(NEG));
  const from = Array.from({ length: n + 1 }, () => new Int32Array(m + 1).fill(-1));
  dp[0][0] = 0;
  for (let i = 0; i <= n; i++) for (let j = 0; j <= m; j++) {
    const cur = dp[i][j];
    if (cur === NEG) continue;
    if (i < n && cur + SKIP > dp[i + 1][j]) { dp[i + 1][j] = cur + SKIP; from[i + 1][j] = i * 8 + 0 + 4; }
    if (j < m) for (let k = 0; k <= KMAX && i + k <= n; k++) {
      let g = k === 0 ? -0.05 : 0;
      for (let q = i; q < i + k; q++) g += fitOf(chords[q], bars[j]) - 0.4;
      if (cur + g > dp[i + k][j + 1]) { dp[i + k][j + 1] = cur + g; from[i + k][j + 1] = i * 8 + k; }
    }
  }
  // Walk back to find which chords each bar took.
  const taken: number[][] = Array.from({ length: m }, () => []);
  let i = n, j = m;
  while (i > 0 || j > 0) {
    const f = from[i][j];
    if (f < 0) break;
    const pi = Math.floor(f / 8), k = f % 8;
    if (k === 4) { i = pi; continue; }
    for (let q = pi; q < pi + k; q++) taken[j - 1].push(q);
    i = pi; j -= 1;
  }
  let checked = 0, fit = 0;
  const flagged: ScoreCheck['flagged'] = [];
  taken.forEach((qs, b) => {
    if (!qs.length || !bars[b].pcs.some(x => x > 0)) return;
    checked++;
    const f = qs.reduce((a, q) => a + fitOf(chords[q], bars[b]), 0) / qs.length;
    if (f >= 0.5) fit++;
    else flagged.push({ bar: b + 1, chords: qs.map(q => chords[q].name) });
  });
  return { read: n, pages, checked, fit, flagged };
}
