import { useEffect } from 'react';
import { playClick } from './audio';
import type { Engine } from './engine';

const KEY = 'hugos-piano:metronome';
export const metronomeOn = () => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } };
export const setMetronome = (on: boolean) => { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* ignore */ } };

/**
 * Ticks the beat while the music runs in tempo, Simply Piano style: one tick per count of the count-in,
 * then one per beat, accented on the first beat of each bar. Silent while listening or waiting.
 */
export function useMetronome(engine: Engine, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const song = engine.song;
    // Each bar ticks in its own metre (a piece can change it): compound time (6/8, 9/8, 12/8) is
    // felt in dotted quarters, and beat 1 of every bar is accented.
    const beatOf = (t: number) => {
      let bar = 0;
      while (bar + 1 < engine.measureTimes.length && engine.measureTimes[bar + 1] <= t + 1e-3) bar++;
      const [num, den] = engine.barSigs[Math.min(bar, engine.barSigs.length - 1)] ?? song.timeSig;
      const step = den === 8 && num % 3 === 0 && num > 3 ? 3 : 1;
      const beatSec = song.ticksToSeconds(song.ppq * 4 / den * step);
      return { bar, beat: Math.floor((t - (engine.measureTimes[bar] ?? 0)) / Math.max(1e-3, beatSec) + 1e-6) };
    };
    let raf = 0, lastBeat = -1, lastCount = -1;
    const frame = () => {
      if (engine.playing && !engine.opts.listen && !engine.opts.wait && !engine.opts.follow) {
        if (engine.countdown > 0) {
          // The count-in, a bar in tempo: accent on its first count.
          const c = engine.countNumber();
          if (c !== lastCount) { lastCount = c; playClick(c === 1); }
          // The music starts on beat 1 right after: always tick it.
          lastBeat = -1;
        } else {
          const { bar, beat } = beatOf(engine.time + 0.01);
          const key = bar * 1000 + beat;
          lastCount = -1;
          if (key !== lastBeat && engine.time >= 0) { lastBeat = key; playClick(beat === 0); }
        }
      } else { lastBeat = -1; lastCount = -1; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [engine, enabled]);
}
