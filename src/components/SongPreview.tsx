/**
 * The Library's preview of a song: its main part (preview.ts) as notes falling onto a strip of
 * keys, in the hands' inks, printed like the videos. Still, it shows the first notes about to land;
 * playing, they fall and sound on the app's piano, once, then it rests again.
 */
import { useEffect, useMemo, useRef } from 'react';
import { audioContext, loadPiano, playNote, stopAll, unlockAudio } from '../lib/audio';
import { isBlack } from '../lib/names';
import { mainPart } from '../lib/preview';
import type { Song } from '../lib/types';

/** Seconds of music on screen above the keys. */
const LOOK = 2.2;
/** The still frame: this long before the main part starts. */
const LEAD = 0.9;

export function SongPreview({ song, playing, onEnd }: { song: Song; playing: boolean; onEnd?: () => void }) {
  const box = useRef<HTMLCanvasElement>(null);
  const part = useMemo(() => mainPart(song), [song]);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;

  useEffect(() => {
    const cv = box.current!;
    const css = getComputedStyle(cv);
    const tok = (n: string) => css.getPropertyValue(n).trim();
    const ink = { R: tok('--right'), L: tok('--left') };
    const keyW = tok('--key-white'), keyB = tok('--key-black'), edge = tok('--key-edge'), lane = tok('--reel-lane');
    // The keys of the part, out to whole white keys with one spare each side.
    let lo = part.lo - 1, hi = part.hi + 1;
    while (isBlack(lo)) lo--;
    while (isBlack(hi)) hi++;
    while (hi - lo < 14) { lo--; hi++; while (isBlack(lo)) lo--; while (isBlack(hi)) hi++; }
    const whites: number[] = [];
    for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites.push(m);

    let raf = 0, start = 0, next = 0, ended = false, go = false;
    const t0 = part.t0 - LEAD;
    const draw = () => {
      const W = cv.clientWidth, H = cv.clientHeight;
      if (!W || !H) { raf = requestAnimationFrame(draw); return; }
      const pr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(W * pr)) { cv.width = Math.round(W * pr); cv.height = Math.round(H * pr); }
      const g = cv.getContext('2d')!;
      g.setTransform(pr, 0, 0, pr, 0, 0);
      g.clearRect(0, 0, W, H);
      const ctx = go ? audioContext() : null;
      const t = ctx ? t0 + (ctx.currentTime - start) : t0;
      if (ctx) {
        // Sound a little ahead on the audio clock, so nothing stutters.
        while (next < part.notes.length && part.notes[next].time < t + 0.25) {
          const n = part.notes[next++];
          playNote(n.midi, Math.round((20 + n.velocity * 90) * 0.85), Math.max(0.1, n.duration), start + (n.time - t0));
        }
        if (!ended && t > part.t1 + 1.2) { ended = true; endRef.current?.(); }
      }
      const kbH = Math.max(18, Math.min(H * 0.26, 40)), kbTop = H - kbH;
      const ww = W / whites.length;
      const X = (m: number) => {
        if (!isBlack(m)) { const i = whites.indexOf(m); return { x: i * ww, w: ww }; }
        const i = whites.indexOf(m - 1);
        return { x: (i + 1) * ww - ww * 0.3, w: ww * 0.6 };
      };
      // Lanes at every C, faint, like the videos.
      g.fillStyle = lane;
      for (const m of whites) if (m % 12 === 0) g.fillRect(X(m).x, 0, 1, kbTop);
      const pps = kbTop / LOOK;
      const sounding = new Map<number, 'L' | 'R'>();
      for (const n of part.notes) {
        if (n.time > t + LOOK || n.time + n.duration < t - 0.05) continue;
        if (n.time <= t && n.time + n.duration > t) sounding.set(n.midi, n.hand);
        const k = X(n.midi);
        const y1 = kbTop - (n.time - t) * pps, y0 = y1 - Math.max(4, n.duration * pps);
        const top = Math.max(0, y0), bot = Math.min(kbTop, y1);
        if (bot <= top) continue;
        const w = Math.max(3, k.w * 0.78), x = k.x + (k.w - w) / 2;
        // The other ink's plate a little off register under it.
        g.fillStyle = n.hand === 'L' ? ink.R : ink.L;
        g.globalAlpha = 0.5;
        g.fillRect(x + 1.5, top + 1.5, w, bot - top);
        g.globalAlpha = 1;
        g.fillStyle = ink[n.hand];
        g.fillRect(x, top, w, bot - top);
      }
      // The keys: white ones, then the black ones over them; a key that sounds takes its hand's ink.
      for (const m of whites) {
        const k = X(m);
        g.fillStyle = sounding.has(m) ? ink[sounding.get(m)!] : keyW;
        g.fillRect(k.x, kbTop, k.w, kbH);
        g.fillStyle = edge;
        g.fillRect(k.x, kbTop, 1, kbH);
      }
      g.fillRect(0, kbTop, W, 2);
      for (let m = lo; m <= hi; m++) {
        if (!isBlack(m)) continue;
        const k = X(m);
        g.fillStyle = sounding.has(m) ? ink[sounding.get(m)!] : keyB;
        g.fillRect(k.x, kbTop, k.w, kbH * 0.6);
      }
      if (playing) raf = requestAnimationFrame(draw);
    };
    let alive = true;
    if (playing) {
      // The clock starts once the piano is there, so no note of the theme is lost (or after a
      // moment without it, silent rather than stuck on a still).
      unlockAudio();
      Promise.race([loadPiano().catch(() => null), new Promise(r => window.setTimeout(r, 2500))]).then(() => { if (alive) { start = audioContext().currentTime + 0.05; go = true; } });
    }
    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(() => { if (!playing) { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); } });
    ro.observe(cv);
    return () => { alive = false; cancelAnimationFrame(raf); ro.disconnect(); if (playing) stopAll(); };
  }, [part, playing]);

  return <canvas ref={box} className="song-preview" aria-hidden="true" />;
}
