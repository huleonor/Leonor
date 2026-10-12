import { useEffect } from 'react';
import { playClick } from './audio';
import type { Engine } from './engine';

const KEY = 'hugos-piano:metronome';
export const metronomeOn = () => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } };
export const setMetronome = (on: boolean) => { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* ignore */ } };

/**
 * Ticks the beat while the music runs in tempo, Simply Piano style: one tick per count-in second,
 * then one per beat, accented on the first beat of each bar. Silent while listening or waiting.
 */
export function useMetronome(engine: Engine, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const song = engine.song;
    const [num, den] = song.timeSig;
    const beatTicks = song.ppq * 4 / den;
    // Compound time (6/8, 9/8, 12/8) is felt in dotted quarters.
    const step = den === 8 && num % 3 === 0 && num > 3 ? 3 : 1;
    const beatSec = song.ticksToSeconds(beatTicks * step);
    const perBar = step === 3 ? num / 3 : num;
    let raf = 0, lastBeat = -1, lastCount = -1;
    const frame = () => {
      if (engine.playing && !engine.opts.listen && !engine.opts.wait && !engine.opts.follow) {
        if (engine.countdown > 0) {
          const c = Math.ceil(engine.countdown);
          if (c !== lastCount) { lastCount = c; playClick(c === 3); }
        } else {
          const beat = Math.floor((engine.time + 0.01) / beatSec);
          if (beat !== lastBeat && engine.time >= 0) { lastBeat = beat; playClick(beat % perBar === 0); }
        }
      } else { lastBeat = -1; lastCount = -1; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [engine, enabled]);
}
