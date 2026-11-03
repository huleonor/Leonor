/**
 * Where every bar of a song starts, following its time signatures: a piece can change metre
 * (Interstellar Experience has two bars of 3/4 in its 4/4), so a bar's length is not one number.
 * Everything that cuts a song into bars (the parts, the reels, the score, the metronome, Mastery)
 * goes through this grid.
 */
import type { Song } from './types';

export interface BarGrid {
  /** Tick where each bar starts; one more entry than `count` closes the last bar. */
  starts: number[];
  /** Each bar's time signature. */
  sigs: [number, number][];
  /** Bars up to the last note that starts in the song. */
  count: number;
}

const cache = new WeakMap<Song, BarGrid>();

const barTicks = (ppq: number, [num, den]: [number, number]) => Math.round(ppq * 4 * (num / den));

/** The song's time signature at each change, the first at tick 0. */
function changes(song: Song): { ticks: number; sig: [number, number] }[] {
  const list = (song.meter ?? []).filter(m => m.ticks > 0).sort((a, b) => a.ticks - b.ticks);
  return [{ ticks: 0, sig: song.timeSig }, ...list];
}

export function barGrid(song: Song): BarGrid {
  const hit = cache.get(song);
  if (hit) return hit;
  const ch = changes(song);
  const lastOnset = song.notes.length ? Math.max(...song.notes.map(n => n.ticks)) : 0;
  const lastEnd = song.notes.length ? Math.max(...song.notes.map(n => n.ticks + n.durationTicks)) : 0;
  const starts: number[] = [0], sigs: [number, number][] = [];
  let at = 0, c = 0;
  // Bars until past the last sound, plus one spare so callers can always close the last bar.
  while (starts.length < 100000) {
    while (c + 1 < ch.length && ch[c + 1].ticks <= at + 1) c++;
    const sig = ch[c].sig;
    sigs.push(sig);
    at += barTicks(song.ppq, sig);
    starts.push(at);
    if (at > lastEnd && at > lastOnset) break;
  }
  let count = 0;
  while (count < sigs.length && starts[count] <= lastOnset + 1e-6) count++;
  const grid = { starts, sigs, count: Math.max(1, count) };
  cache.set(song, grid);
  return grid;
}

/** The bar (0-based) a tick falls in. */
export function barIndex(grid: BarGrid, ticks: number): number {
  let lo = 0, hi = grid.sigs.length - 1;
  const t = ticks + 1e-6;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (grid.starts[mid] <= t) lo = mid; else hi = mid - 1;
  }
  return lo;
}

/** A bar's length in ticks (0-based bar). */
export const barLength = (grid: BarGrid, i: number) => grid.starts[Math.min(i + 1, grid.starts.length - 1)] - grid.starts[Math.min(i, grid.starts.length - 1)];

/** Tick where a bar starts (0-based, past the end clamps to the end). */
export const barStart = (grid: BarGrid, i: number) => grid.starts[Math.max(0, Math.min(i, grid.starts.length - 1))];
