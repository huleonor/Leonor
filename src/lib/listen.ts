/**
 * Hear one section of a song (the section buttons of the Song tab and the paused video): its bars
 * played on the app's piano at their real speed, scheduled a little ahead on the audio clock so
 * nothing stutters. Every note is marked as the app's while it sounds, so the microphone never takes
 * it for his playing. One section sounds at a time; starting another, or `stopListening`, ends it.
 */
import { audioContext, loadPiano, playNote, stopAll, unlockAudio } from './audio';
import { barGrid } from './bars';
import { markAppPlayed } from './input';
import type { Song } from './types';

let current: { stop: () => void; key: string } | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach(f => f());

/** Which section sounds now ("song-id:from-to"), or null. */
export const listening = () => current?.key ?? null;
export function onListening(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

export function stopListening() {
  if (!current) return;
  current.stop();
  current = null;
  changed();
}

/** Plays bars `from` to `to` (1-based, inclusive) and calls back when they end. */
export async function listenBars(song: Song, from: number, to: number) {
  stopListening();
  const key = `${song.entry.id}:${from}-${to}`;
  const grid = barGrid(song);
  const a = grid.starts[from - 1] ?? 0, b = grid.starts[to] ?? Infinity;
  const notes = song.notes.filter(n => n.ticks >= a && n.ticks < b).sort((x, y) => x.time - y.time);
  if (!notes.length) return;
  const timers: number[] = [];
  let alive = true;
  current = { key, stop: () => { alive = false; timers.forEach(t => window.clearTimeout(t)); stopAll(); } };
  changed();
  unlockAudio();
  // The piano first (or after a moment without it, silent rather than stuck).
  await Promise.race([loadPiano().catch(() => null), new Promise(r => window.setTimeout(r, 2500))]);
  if (!alive) return;
  const ctx = audioContext();
  const t0 = notes[0].time, start = ctx.currentTime + 0.1;
  let next = 0;
  // Fed in small batches half a second ahead, so stopping is immediate.
  const feed = () => {
    if (!alive) return;
    const now = ctx.currentTime - start + t0;
    while (next < notes.length && notes[next].time < now + 0.5) {
      const n = notes[next++];
      const at = start + (n.time - t0);
      playNote(n.midi, Math.round((20 + n.velocity * 90) * 0.85), Math.max(0.1, n.duration), at);
      const ms = Math.max(0, (at - ctx.currentTime) * 1000);
      timers.push(window.setTimeout(() => markAppPlayed(n.midi), ms));
    }
    const end = notes.reduce((m, n) => Math.max(m, n.time + n.duration), 0);
    if (now > end + 0.3) { if (current?.key === key) { current = null; changed(); } return; }
    timers.push(window.setTimeout(feed, 120));
  };
  feed();
}
