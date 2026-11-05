/**
 * A song's main part, for the Library preview: the stretch of bars that comes back most often (its
 * theme), from the first time it is heard, about eight to fourteen seconds of it; a song with no
 * stretch that comes back starts at its first note.
 */
import { findRepeats, splitBars } from './analysis';
import { barStart } from './bars';
import type { Song, SongNote } from './types';

export interface MainPart { t0: number; t1: number; notes: SongNote[]; lo: number; hi: number }

const cache = new WeakMap<Song, MainPart>();

export function mainPart(song: Song): MainPart {
  const hit = cache.get(song);
  if (hit) return hit;
  const { bars, grid } = splitBars(song);
  const at = (bar: number) => song.ticksToSeconds(barStart(grid, bar));
  let first = bars.findIndex(b => b.notes.length > 0);
  if (first < 0) first = 0;
  const best = findRepeats(bars.map(b => String(b.cls)))[0];
  const startBar = best ? best.starts[0] : first;
  const t0 = Math.max(song.firstNoteTime, at(startBar));
  // Whole bars from there, until at least eight seconds and at most fourteen.
  let end = startBar + (best ? best.len : 4);
  while (end < grid.count && at(end) - t0 < 8) end++;
  while (end > startBar + 1 && at(end) - t0 > 14) end--;
  const t1 = Math.min(song.duration, Math.max(t0 + 4, at(end)));
  const notes = song.notes.filter(n => n.time >= t0 - 0.02 && n.time < t1);
  const ms = notes.length ? notes.map(n => n.midi) : [60, 72];
  const part = { t0, t1, notes, lo: Math.min(...ms), hi: Math.max(...ms) };
  cache.set(song, part);
  return part;
}
