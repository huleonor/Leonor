import { AnimatePresence, motion } from 'motion/react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { markAppPlayed } from '../lib/input';
import { handsShown, L, N, NOTE_RE, showHands, showStaff, staffShown, videoPrefs } from '../lib/lang';
import { ReelStaff } from './ReelStaff';
import { audioContext, loadPiano, onAudioReset, pianoReady, playNote, playSfx, stopAll, stopSfx, unlockAudio } from '../lib/audio';
import { linkState, onLinkState, onNote, setExpected, setMicRange } from '../lib/input';
// The 3D gloves load on their own (three.js is large), only where WebGL runs.
const Hands3D = lazy(() => import('./Hands3D').then(m => ({ default: m.Hands3D })));
// Asked once, and the test context is let go at once (each one held counts against the browser's few).
let glKnown: boolean | undefined;
const webglOk = () => {
  if (glKnown !== undefined) return glKnown;
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    glKnown = !!gl;
  } catch { glKnown = false; }
  return glKnown;
};
import { keyLayout, pickRange } from '../lib/keys';
import { isBlack } from '../lib/names';
import { explainClips, FALL, fixClip, letter, markSeen, readClip, reelsOf, timelineOf, type Clip, type Reel, type ReelLine, type ReelNote, type ReelTimeline } from '../lib/reels';
import { anyVoice, hush, onVoice, pauseVoice, prepareVoice, resumeVoice, say, setVoiceOn, speaking, unlockVoice, voiceOn } from '../lib/voice';
import type { Hand, Song } from '../lib/types';
import { IconCheck, IconClose, IconExplain, IconHand, IconKeys, IconPlay, IconRestart, IconSheet, IconSpeaker, IconSpeakerOff, IconSpeed } from './Icons';
import { SOFT, SPRING } from './Motion';
import { SectionRow } from './SectionRow';

const LOOK = FALL; // seconds of falling notes above the keys

/** Colours for the canvas, read from the design tokens where the canvas sits (a canvas cannot read CSS variables itself). */
function palette(el: Element) {
  const css = getComputedStyle(el);
  const v = (k: string) => css.getPropertyValue(k).trim();
  return {
    R: v('--right'), L: v('--left'), keyR: v('--right-key'), keyL: v('--left'), inkR: v('--right-ink'), inkL: v('--left-ink'),
    ok: v('--ok'), white: v('--key-white'), whiteEdge: v('--key-edge'), black: v('--key-black'),
    ink: v('--key-ink'), paper: v('--paper'), muted: v('--muted'), bad: v('--mark'), next: v('--marker'), tR: v('--pink-text'), tL: v('--teal-text'), lane: v('--reel-lane'), now: v('--now-line'),
  };
}
const FACE = "'Bricolage Grotesque', 'Helvetica Neue', Helvetica, Arial, sans-serif";

/**
 * The reel's clock: the audio clock while it plays, so the keys and the sound never drift apart.
 * Notes are scheduled on the piano a fifth of a second ahead.
 */
function useReelClock(tl: ReelTimeline, active: boolean, onEnd: () => void, onHold?: () => boolean) {
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(pianoReady());
  const state = useRef({ t: 0, start: 0, next: 0, nextSfx: 0, playing: false, held: false });
  const holdRef = useRef(onHold);
  holdRef.current = onHold;
  const now = useCallback(() => (state.current.playing ? audioContext().currentTime - state.current.start : state.current.t), []);

  const play = (from?: number) => {
    const s = state.current;
    if (from !== undefined) s.t = from;
    if (s.t >= tl.duration - 0.05) s.t = 0;
    s.start = audioContext().currentTime - s.t;
    s.next = tl.notes.findIndex(n => n.t >= s.t - 0.01);
    if (s.next < 0) s.next = tl.notes.length;
    s.nextSfx = tl.sfx.findIndex(x => x.t >= s.t - 0.01);
    if (s.nextSfx < 0) s.nextSfx = tl.sfx.length;
    if (!tl.hold || s.t < tl.hold.t - 0.01) s.held = false;
    s.playing = true;
    setPlaying(true);
  };
  const pause = () => {
    const s = state.current;
    if (!s.playing) return;
    s.t = now();
    s.playing = false;
    stopAll();
    stopSfx();
    setPlaying(false);
  };
  // Leaving the page pauses the video; a rebuilt audio clock (audio.ts) pauses it too, so the
  // picture never jumps. He taps play to go on.
  useEffect(() => {
    const hide = () => { if (document.hidden) pause(); };
    document.addEventListener('visibilitychange', hide);
    const off = onAudioReset(() => pause());
    return () => { document.removeEventListener('visibilitychange', hide); off(); };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // The reel starts once the piano is loaded (it loads from the moment the app opens), or after
  // twelve seconds without it, on a slow connection (it plays silent until the sound arrives).
  useEffect(() => {
    if (ready) return;
    loadPiano().then(() => setReady(true)).catch(() => setReady(true));
    const t = window.setTimeout(() => setReady(true), 12000);
    return () => window.clearTimeout(t);
  }, [ready]);
  useEffect(() => {
    if (active && ready) { unlockAudio(); play(0); }
    if (!active) { pause(); state.current.t = 0; }
    return () => { if (state.current.playing) { state.current.playing = false; stopAll(); } };
  }, [active, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Schedules the notes coming up and stops at the end.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const s = state.current;
      const t = now();
      while (s.next < tl.notes.length && tl.notes[s.next].t < t + 0.2) {
        const n = tl.notes[s.next++];
        // The piano steps back a little while the voice talks, like music under a voice-over;
        // in Train with me it only guides, quietly, while he plays.
        // Without his piano connected he is only watching: the piano stays at its guiding level.
        const playsAlong = Object.values(linkState()).some(x => x.status === 'on');
        playNote(n.midi, Math.round((20 + n.vel * 100) * (n.train ? (playsAlong ? n.guide ?? 0.75 : 0.85) : speaking() ? 0.7 : 1)), Math.max(0.1, n.dur), s.start + n.t);
        // The microphone must not take the video's own piano for his playing (the green keys he
        // saw while not playing): each note is marked as the app's while it sounds.
        const at = (s.start + n.t - audioContext().currentTime) * 1000, midi = n.midi;
        for (let k = 0; k * 400 < n.dur * 1000 + 400; k++) window.setTimeout(() => markAppPlayed(midi), Math.max(0, at + k * 400));
      }
      while (s.nextSfx < tl.sfx.length && tl.sfx[s.nextSfx].t < t + 0.2) {
        const x = tl.sfx[s.nextSfx++];
        if (x.t >= t - 0.1) playSfx(x.name, x.gain, s.start + x.t);
      }
      // It stops by itself for him to practise on his own (unless the player says to go on).
      if (tl.hold && !s.held && t >= tl.hold.t) {
        s.held = true;
        if (holdRef.current?.() !== false) { s.t = tl.hold.t; s.playing = false; stopAll(); setPlaying(false); return; }
      }
      if (t >= tl.duration) { s.t = tl.duration; s.playing = false; setPlaying(false); onEnd(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, tl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scrubbing, TikTok style: jump anywhere in the video and play on from there.
  const seek = (to: number) => { const s = state.current; if (s.playing) { s.playing = false; stopAll(); } play(Math.max(0, Math.min(tl.duration - 0.05, to))); };

  return { playing, ready, now, play, pause, seek };
}


/** The camera's ease both ways (power2.inOut), for a move that starts and lands. */
const inOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);

/** Falling notes onto a keyboard, one lane per hand (right above left), drawn every frame. */
/**
 * The video's picture, drawn as the Für Elise TikToks are (HyperFrames): one keyboard for both
 * hands, the notes falling onto it in the hand's colour with their letter, from the clock alone,
 * so any moment is the same picture (it can be scrubbed). The camera opens wide and pushes in on
 * the video's keys over the first second. While the voice names notes, each key is outlined in its
 * hand's colour and numbered in order, before it sounds; a key that sounds fills with the colour,
 * its letter at the bottom and its finger at the top, and a short flash rises from it; a note for
 * him to play (Train with me) falls open; a key he plays lights green.
 */
/** A key he pressed on his piano: right or wrong, and when (for the mark that rises from it). */
export type Press = { midi: number; ok: boolean; at: number };

/** Where the flat keyboard is this frame, for the 3D gloves drawn over it (Gloves3D.tsx). */
export type KeysGeom = { X: (m: number) => { x: number; w: number } | null; kbTop: number; kbH: number; kbBot: number; unitW: number; W: number; H: number;
  /** On a keyboard cut in two, which half a key is in (0 the left hand's, 1 the right's). */
  side?: (m: number) => 0 | 1 };

function Lanes({ tl, range, now, held, flats, named, namedUntil, presses, shape, jump, hands, flatHands = true, geom, fallOn = true }: { fallOn?: boolean; tl: ReelTimeline; range: [number, number]; now: () => number; held: React.RefObject<Map<number, boolean>>; flats: boolean; named: React.RefObject<Map<number, number>>; namedUntil: number; presses?: React.RefObject<Press[]>; shape?: boolean; jump?: [number, number]; hands?: boolean; flatHands?: boolean; geom?: React.RefObject<KeysGeom | null> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  // Read on the staff instead (the user's choice 2026-11: the staff or the falling notes, not both):
  // the keys and the hands stay, the falling notes, their guides and the now line go.
  const fallRef = useRef(fallOn);
  fallRef.current = fallOn;
  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext('2d')!;
    const pal = palette(cv);
    const [lo, hi] = range;
    // With the hands on a wide screen the keys are kept narrow enough for a hand of real proportions
    // (about four white keys across its knuckles, eight from the wrist to the tips) to sit under
    // them and span an octave; on a computer a few keys across the whole width left it no room.
    const W0 = cv.clientWidth || 1, H0 = cv.clientHeight || 1;
    const minWhites = hands && W0 > H0 ? Math.ceil(W0 / (H0 * 0.105)) : 0;
    let [wLo, wHi] = pickRange(lo - 7, hi + 7, Math.max(30, Math.ceil((minWhites * 12) / 7) + 4));
    let lay = keyLayout(wLo, wHi);
    let frame: [number, number] = [lay[lo]?.x ?? 0, (lay[hi]?.x ?? 1) + (lay[hi]?.w ?? 0)];
    let split = false;
    // The halves of a keyboard cut in two, in the layout's own units: where the left one ends, where
    // the right one starts, and a white key's width.
    let cut = { aEnd: 0, bStart: 0, unit: 0, gap: 0, follow: false };
    const whitesIn = (x: [number, number]) => { let k = 0; for (let m = x[0]; m <= x[1]; m++) if (!isBlack(m)) k++; return k; };
    const needFrac = minWhites ? Math.min(1, minWhites / whitesIn([wLo, wHi])) : 0;
    if (frame[1] - frame[0] < needFrac) {
      const c = (frame[0] + frame[1]) / 2;
      frame = [Math.max(0, Math.min(1 - needFrac, c - needFrac / 2)), 0];
      frame[1] = frame[0] + needFrac;
    }
    // Two hands far apart: one keyboard so wide that every key gets thin and hard to read. Then it
    // is cut in two, the left hand's keys and the right hand's side by side with a gap between,
    // each as big as it can be (the keys in between are left out).
    const of = (h: Hand) => tl.notes.filter(n => n.hand === h).map(n => n.midi);
    const ls = of('L'), rs = of('R');
    if (ls.length && rs.length && hi - lo > 26) {
      // Just the keys each hand plays, a white key either side (not whole octaves).
      const tight = (ms: number[]): [number, number] => {
        let a = Math.min(...ms) - 1, z = Math.max(...ms) + 1;
        while (isBlack(a)) a--;
        while (isBlack(z)) z++;
        return [Math.max(21, a), Math.min(108, z)];
      };
      const A = tight(ls), B = tight(rs);
      if (A[1] < B[0] - 4) {
        const whites = whitesIn;
        // Room for the hands on a wide screen: more keys outside each hand's own.
        while (minWhites && whites(A) + whites(B) + 1.2 < minWhites && (A[0] > 21 || B[1] < 108)) {
          if (A[0] > 21) { A[0]--; while (isBlack(A[0]) && A[0] > 21) A[0]--; }
          if (whites(A) + whites(B) + 1.2 >= minWhites) break;
          if (B[1] < 108) { B[1]++; while (isBlack(B[1]) && B[1] < 108) B[1]++; }
        }
        const wa = whites(A), wb = whites(B), gap = 1.2, total = wa + wb + gap;
        const la = keyLayout(A[0], A[1]), lb = keyLayout(B[0], B[1]);
        const both: Record<number, { x: number; w: number; black: boolean }> = {};
        for (const [m, g] of Object.entries(la)) both[Number(m)] = { ...g, x: g.x * wa / total, w: g.w * wa / total };
        for (const [m, g] of Object.entries(lb)) both[Number(m)] = { ...g, x: (wa + gap + g.x * wb) / total, w: g.w * wb / total };
        lay = both; wLo = A[0]; wHi = B[1]; frame = [0, 1]; split = true;
        // A long stretch (a section heard through, the whole section): each half has more keys than
        // it can show big, so each half gets its own camera on its own hand (below).
        cut = { aEnd: wa / total, bStart: (wa + gap) / total, unit: 1 / total, gap: gap / total, follow: wa > 11 || wb > 11 };
      }
    }
    // Which hand plays each key in this video (for the colour of a key the voice names).
    const handOf = new Map<number, Hand>();
    for (const n of tl.notes) if (!handOf.has(n.midi)) handOf.set(n.midi, n.hand);
    let raf = 0;
    // The gloves move like hands: every part eases towards where it should be (a spring), so
    // they glide from key to key and from pointing to playing. Kept between frames.
    const glove: Record<Hand, { fx: number[]; wx: number; point: number; px: number; seen: boolean }> = {
      L: { fx: [0, 0, 0, 0, 0, 0], wx: 0, point: 0, px: 0, seen: false },
      R: { fx: [0, 0, 0, 0, 0, 0], wx: 0, point: 0, px: 0, seen: false },
    };
    let lastFrame = performance.now();
    const buffer = document.createElement('canvas');
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const W = cv.clientWidth, H = cv.clientHeight;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const t = now();
      const z = inOut(Math.max(0, Math.min(1, (t - 0.15) / 0.9)));
      // The camera follows the hand without shaking: the video is cut in blocks of 2.4 s, each
      // framing the notes it holds (never tighter than six tenths of the video's own frame, never on
      // a keyboard cut in two), and the camera moves from one block's frame to the next in one slow
      // glide over the last 0.8 s of the block, then holds still. The same picture at the same time.
      const BLOCK = 2.4, GLIDE = 0.8;
      const blockFrame = (bi: number): [number, number] => {
        let mn = Infinity, mx = -Infinity;
        for (const n of tl.notes) if (n.t >= bi * BLOCK - 0.3 && n.t <= (bi + 1) * BLOCK + 0.6 && lay[n.midi]) { mn = Math.min(mn, lay[n.midi].x); mx = Math.max(mx, lay[n.midi].x + lay[n.midi].w); }
        if (mn === Infinity) return frame;
        const fw = frame[1] - frame[0], minW = Math.max(fw * 0.6, split ? 0 : needFrac), pad = (mx - mn) * 0.15 + 0.01;
        let w0 = mn - pad, w1 = mx + pad;
        if (w1 - w0 < minW) { const c = (w0 + w1) / 2; w0 = c - minW / 2; w1 = c + minW / 2; }
        if (w0 < frame[0]) { w1 += frame[0] - w0; w0 = frame[0]; }
        if (w1 > frame[1]) { w0 -= w1 - frame[1]; w1 = frame[1]; }
        return [w0, w1];
      };
      let f0 = frame[0], f1 = frame[1];
      if (!split) {
        const bi = Math.max(0, Math.floor(t / BLOCK));
        const [a0, a1] = blockFrame(bi), [b0, b1] = blockFrame(bi + 1);
        const e = inOut(Math.max(0, Math.min(1, (t - (bi + 1) * BLOCK + GLIDE) / GLIDE)));
        f0 = a0 + (b0 - a0) * e; f1 = a1 + (b1 - a1) * e;
      }
      const v0 = f0 * z, v1 = 1 + (f1 - 1) * z;
      let X = (m: number) => lay[m] ? { x: ((lay[m].x - v0) / (v1 - v0)) * W, w: (lay[m].w / (v1 - v0)) * W } : null;
      const side = (m: number): 0 | 1 => (lay[m] && lay[m].x < cut.aEnd + 1e-6 ? 0 : 1);
      if (split && cut.follow) {
        // Each half follows its own hand, block by block like the single camera: its notes framed,
        // at least nine white keys, gliding to the next block's frame; the screen is shared out by
        // how many keys each shows, and a key outside its half's window is not drawn.
        const halfFrame = (bi: number, s0: 0 | 1): [number, number] => {
          const lo0 = s0 ? cut.bStart : 0, hi0 = s0 ? 1 : cut.aEnd;
          let mn = Infinity, mx = -Infinity;
          for (const n of tl.notes) if (n.t >= bi * BLOCK - 0.3 && n.t <= (bi + 1) * BLOCK + 0.6 && lay[n.midi] && side(n.midi) === s0) { mn = Math.min(mn, lay[n.midi].x); mx = Math.max(mx, lay[n.midi].x + lay[n.midi].w); }
          const minW = Math.min(hi0 - lo0, cut.unit * 9);
          if (mn === Infinity) { mn = lo0; mx = lo0 + minW; }
          let w0 = mn - cut.unit, w1 = mx + cut.unit;
          if (w1 - w0 < minW) { const c = (w0 + w1) / 2; w0 = c - minW / 2; w1 = c + minW / 2; }
          if (w0 < lo0) { w1 += lo0 - w0; w0 = lo0; }
          if (w1 > hi0) { w0 -= w1 - hi0; w1 = hi0; }
          return [Math.max(lo0, w0), Math.min(hi0, w1)];
        };
        const bi = Math.max(0, Math.floor(t / BLOCK));
        const e = inOut(Math.max(0, Math.min(1, (t - (bi + 1) * BLOCK + GLIDE) / GLIDE)));
        const glide = (s0: 0 | 1): [number, number] => { const [a0, a1] = halfFrame(bi, s0), [b0, b1] = halfFrame(bi + 1, s0); return [a0 + (b0 - a0) * e, a1 + (b1 - a1) * e]; };
        const [la0, la1] = glide(0), [lb0, lb1] = glide(1);
        const total = (la1 - la0) + (lb1 - lb0) + cut.gap;
        const sA = (W * (la1 - la0)) / total, sB = sA + (W * cut.gap) / total, k = W / total;
        X = (m: number) => {
          const g = lay[m];
          if (!g) return null;
          const s0 = side(m), w0 = s0 ? lb0 : la0, w1 = s0 ? lb1 : la1;
          if (g.x + g.w < w0 - 1e-6 || g.x > w1 + 1e-6) return null;
          return { x: (s0 ? sB : 0) + (g.x - w0) * k, w: g.w * k };
        };
      }
      const unitW = (X(60)?.w ?? W / 20);
      // The keyboard's height is set from the video's own frame (not the moving camera), so it never
      // pumps as the camera moves; with the gloves on, a strip under the keys holds their palms.
      const frameUnit = ((lay[60]?.w ?? 1 / 20) / Math.max(0.05, (1 + (frame[1] - 1) * z) - frame[0] * z)) * W;
      const palmH = hands ? Math.min(H * 0.16, 90) : 0;
      const kbH = Math.min((H - palmH) * 0.36, Math.max(frameUnit * 5.2, (H - palmH) * 0.24));
      const kbBot = H - palmH;
      const kbTop = kbBot - kbH;
      if (geom) geom.current = { X, kbTop, kbH, kbBot, unitW, W, H, side: split ? side : undefined };
      const fall = kbTop - 4, pps = fall / LOOK;
      const colour = (h: Hand) => (h === 'L' ? pal.L : pal.R);
      // Octave guides at every C.
      ctx.fillStyle = pal.lane;
      if (fallRef.current) for (let m = wLo; m <= wHi; m++) if (m % 12 === 0) { const k = X(m); if (k) ctx.fillRect(k.x, 0, 1, fall); }
      // The notes.
      const sounding = new Map<number, ReelNote>();
      for (const n of tl.notes) {
        if (n.t > t + LOOK || n.t + n.dur < t - 0.05) continue;
        // His turn's notes start falling only once the count-in (1, 2, 3) is over.
        const nci = n.train ? tl.countIns?.[n.round ?? 0] ?? tl.countIn : undefined;
        if (nci && t < nci.t + nci.n * nci.beat) continue;
        const k = X(n.midi);
        if (!k) continue;
        const on = n.t <= t && n.t + n.dur > t;
        if (on) sounding.set(n.midi, n);
        if (!fallRef.current) continue;
        const yBottom = kbTop - 4 - (n.t - t) * pps;
        const yTop = Math.max(0, yBottom - Math.max(14, n.dur * pps - 3));
        const yB = Math.min(kbTop - 4, yBottom);
        if (yB <= yTop) continue;
        const pad = k.w * 0.1, bw = k.w - pad * 2;
        if (n.train) {
          // His turn: the note drawn open, for him to fill by playing it.
          ctx.strokeStyle = colour(n.hand); ctx.lineWidth = 3;
          ctx.strokeRect(k.x + pad + 1.5, yTop + 1.5, bw - 3, yB - yTop - 3);
        } else {
          // Printed like a risograph: the other ink's plate a little off register under the note.
          ctx.globalAlpha = 0.45;
          ctx.fillStyle = n.hand === 'L' ? pal.R : pal.L;
          ctx.fillRect(k.x + pad + 3, yTop + 2, bw, yB - yTop);
          ctx.globalAlpha = 1;
          ctx.fillStyle = colour(n.hand);
          ctx.fillRect(k.x + pad, yTop, bw, yB - yTop);
        }
        if (yB - yTop > 24 && bw > 12) {
          ctx.fillStyle = n.train ? (n.hand === 'L' ? pal.tL : pal.tR) : pal.ink;
          ctx.font = `900 ${Math.round(Math.max(12, Math.min(22, bw * 0.62)))}px ${FACE}`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
          ctx.fillText(N(letter(n.midi, flats)), k.x + k.w / 2, yB - 7);
        }
      }
      // A jump: an arc over the keys from the key he leaves to the key he lands on, with its head.
      if (jump) {
        const a = X(jump[0]), b = X(jump[1]);
        if (a && b) {
          const x0 = a.x + a.w / 2, x1 = b.x + b.w / 2, y = kbTop - 18, h = Math.min(90, Math.abs(x1 - x0) * 0.45 + 20);
          ctx.save(); ctx.strokeStyle = pal.ink; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(x0, y); ctx.quadraticCurveTo((x0 + x1) / 2, y - h, x1, y); ctx.stroke();
          ctx.setLineDash([]); ctx.fillStyle = pal.ink;
          const dir = Math.sign(x1 - x0) || 1;
          ctx.beginPath(); ctx.moveTo(x1, y + 2); ctx.lineTo(x1 - 12 * dir, y - 12); ctx.lineTo(x1 + 4 * dir, y - 14); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
      }
      // The now line.
      ctx.fillStyle = pal.now;
      if (fallRef.current) ctx.fillRect(0, kbTop - 4, W, 3);
      // The keyboard counts the beat while the music plays: 1 2 3 4, the beat it is on marked.
      const last = [...tl.notes].reverse().find(n => n.t <= t && n.t > t - 1.2);
      if (last) {
        const beats = tl.beats ?? 4;
        ctx.font = `700 15px 'JetBrains Mono', 'Courier New', Courier, monospace`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
        for (let i = 0; i < beats; i++) {
          const x = 16 + i * 24, y = kbTop - 20;
          if (i === last.beat % beats) { ctx.fillStyle = pal.next; ctx.fillRect(x - 10, y - 10, 20, 20); }
          ctx.fillStyle = i === last.beat % beats ? pal.ink : pal.muted;
          ctx.fillText(String(i + 1), x, y + 1);
        }
        ctx.textBaseline = 'alphabetic';
      }
      // The keys.
      const naming = t < namedUntil ? named.current ?? new Map<number, number>() : new Map<number, number>();
      const mine = held.current ?? new Map<number, boolean>();
      for (const black of [false, true]) {
        for (let m = wLo; m <= wHi; m++) {
          if (isBlack(m) !== black) continue;
          const k = X(m);
          if (!k || k.x + k.w < -2 || k.x > W + 2) continue;
          const h = black ? kbH * 0.62 : kbH;
          const s = sounding.get(m), order = naming.get(m), hand = s?.hand ?? handOf.get(m) ?? (m < 60 ? 'L' : 'R');
          // His own keys: green when right, red when wrong, whatever the video is doing.
          ctx.fillStyle = mine.has(m) ? (mine.get(m) ? pal.ok : pal.bad) : s ? colour(s.hand) : black ? pal.black : pal.white;
          ctx.fillRect(k.x + (black ? 0 : 0.5), kbTop, k.w - (black ? 0 : 1), h);
          if (!black) { ctx.strokeStyle = pal.whiteEdge; ctx.lineWidth = 1; ctx.strokeRect(k.x + 0.5, kbTop, k.w - 1, h); }
          if (!s && order !== undefined) { ctx.strokeStyle = colour(hand); ctx.lineWidth = Math.max(3, k.w * 0.12); ctx.strokeRect(k.x + 3, kbTop + 3, k.w - 6, h - 6); }
          if (s || order !== undefined) {
            ctx.fillStyle = mine.has(m) ? pal.paper : s ? pal.ink : hand === 'L' ? pal.tL : pal.tR;
            ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.font = `900 ${Math.round(Math.max(11, Math.min(22, k.w * 0.5)))}px ${FACE}`;
            ctx.fillText(N(letter(m, flats)), k.x + k.w / 2, kbTop + h - 10);
            const top = s?.finger ?? order;
            if (top) { ctx.font = `700 ${Math.round(Math.min(15, k.w * 0.36))}px ${FACE}`; ctx.fillText(String(top), k.x + k.w / 2, kbTop + 20); }
          } else if (!black && m % 12 === 0) {
            // Every C is marked small with its octave (C3, C4 is middle C, C5) to find the place.
            ctx.fillStyle = mine.has(m) ? pal.paper : pal.muted;
            ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.font = `700 ${Math.round(Math.max(9, Math.min(13, k.w * 0.42)))}px 'JetBrains Mono', 'Courier New', Courier, monospace`;
            ctx.fillText(`${N("C")}${m / 12 - 1}`, k.x + k.w / 2, kbTop + h - 8);
          }
        }
      }
      // A key struck: a short flash rising from it (0.3 s), the hit made visible.
      for (const n of tl.notes) {
        const a = t - n.t;
        if (a < 0 || a > 0.3) continue;
        const k = X(n.midi);
        if (!k) continue;
        const e = 1 - Math.pow(2, -10 * (a / 0.3));
        ctx.globalAlpha = 0.3 * (1 - e);
        ctx.fillStyle = colour(n.hand);
        ctx.fillRect(k.x - k.w * 0.3 * e, kbTop - 16 - 40 * e, k.w * (1 + 0.6 * e), 12 + 40 * e);
        ctx.globalAlpha = 1;
      }
      // Ghost gloves, the hands of the voice that teaches (the user's choice 2026-11, like the ghost
      // hands of a VR piano, as white cartoon gloves): seen from his side of the piano, each a palm
      // in front of the keys and five fingers bending up onto them. Playing, each finger moves over
      // the key it plays next (from the notes' fingering) and presses as its note sounds; while the
      // voice names the keys, the hand turns to point with the index finger at the key being named,
      // the other fingers curled. Every part glides on a spring; drawn as one outlined silhouette,
      // a little see-through so the keys show through it.
      if (hands && flatHands && cv.width > 0 && cv.height > 0) {
        const nowMs = performance.now(), dt = Math.min(0.1, (nowMs - lastFrame) / 1000);
        lastFrame = nowMs;
        const k = 1 - Math.exp(-dt * 11);
        const fw = Math.max(16, Math.min(unitW * 0.8, 38));
        if (buffer.width !== cv.width || buffer.height !== cv.height) { buffer.width = cv.width; buffer.height = cv.height; }
        const g = buffer.getContext('2d')!;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, W, H);
        const naming = t < namedUntil && named.current && named.current.size ? [...named.current.entries()].sort((x, y) => y[1] - x[1])[0][0] : undefined;
        for (const h of ['L', 'R'] as Hand[]) {
          const mine = tl.notes.filter(n => n.hand === h && n.finger);
          if (!mine.length) continue;
          const dir = h === 'R' ? 1 : -1;
          // Where each finger should be: over its next key (or its last one).
          const want: (number | undefined)[] = [];
          for (let f = 1; f <= 5; f++) {
            const ns = mine.filter(n => n.finger === f);
            const next = ns.find(n => n.t + n.dur > t) ?? ns[ns.length - 1];
            const key = next && X(next.midi);
            if (key) want[f] = key.x + key.w / 2;
          }
          for (let f = 1; f <= 5; f++) if (want[f] === undefined) {
            let best: number | undefined, bd = 9;
            for (let q = 1; q <= 5; q++) if (want[q] !== undefined && Math.abs(q - f) < bd) { bd = Math.abs(q - f); best = want[q]! + (f - q) * dir * unitW; }
            want[f] = best;
          }
          if (want.slice(1).some(x => x === undefined)) continue;
          const st = glove[h];
          const pointKey = naming !== undefined && (handOf.get(naming) ?? (naming < 60 ? 'L' : 'R')) === h ? X(naming) : null;
          const pointTo = pointKey ? pointKey.x + pointKey.w / 2 : undefined;
          if (!st.seen) { for (let f = 1; f <= 5; f++) st.fx[f] = want[f]!; st.wx = (want[2]! + want[4]!) / 2; st.px = pointTo ?? want[2]!; st.seen = true; }
          for (let f = 1; f <= 5; f++) st.fx[f] += (want[f]! - st.fx[f]) * k;
          st.point += ((pointTo !== undefined ? 1 : 0) - st.point) * k;
          if (pointTo !== undefined) st.px += (pointTo - st.px) * k;
          // The wrist under the middle of the hand; when pointing it follows the index finger.
          const playW = (st.fx[2] + st.fx[4]) / 2, pointW = st.px - dir * fw * 1.3;
          st.wx += (playW + (pointW - playW) * st.point - st.wx) * k;
          const p = st.point;
          const knY = kbBot + palmH * 0.1, wristY = H + fw;
          const fingers: { f: number; kx: number; tx: number; ty: number; press: boolean }[] = [];
          for (let f = 1; f <= 5; f++) {
            const press = p < 0.5 && mine.some(n => n.finger === f && n.t <= t && n.t + n.dur > t);
            const reach = f === 1 ? 0.22 : f === 5 ? 0.36 : f === 3 ? 0.5 : 0.45;
            let tx = st.fx[f], ty = kbBot - kbH * reach + (press ? kbH * 0.07 : 0);
            // Pointing: the index finger goes out to the key, the others curl in towards the palm.
            if (f === 2) { tx += (st.px - tx) * p; ty += (kbBot - kbH * 0.62 - ty) * p; }
            else { const curl = p * 0.75; ty += (knY - fw * 0.4 - ty) * curl; tx += (st.wx + (f - 2.5) * dir * fw * 0.55 - tx) * curl; }
            // The knuckles follow the fingers (less splayed), the thumb's root lower and further out.
            const kx = st.wx + (tx - st.wx) * (f === 1 ? 0.85 : 0.72);
            fingers.push({ f, kx, tx, ty: f === 1 ? Math.max(ty, knY - kbH * 0.35) : ty, press });
          }
          const spread = fingers.map(x => x.kx);
          const lo = Math.min(...spread) - fw * 0.7, hi = Math.max(...spread) + fw * 0.7;
          const path = (o: number) => {
            // Palm: from the knuckles down to the wrist.
            g.beginPath();
            g.moveTo(lo - o, knY - fw * 0.2);
            g.quadraticCurveTo(lo - o, knY - fw * 0.7 - o, (lo + hi) / 2, knY - fw * 0.75 - o);
            g.quadraticCurveTo(hi + o, knY - fw * 0.7 - o, hi + o, knY - fw * 0.2);
            g.quadraticCurveTo(hi + o, wristY, (lo + hi) / 2 + (hi - lo) * 0.32 + o, wristY + o);
            g.lineTo((lo + hi) / 2 - (hi - lo) * 0.32 - o, wristY + o);
            g.quadraticCurveTo(lo - o, wristY, lo - o, knY - fw * 0.2);
            g.closePath();
          };
          const finger = (x: { f: number; kx: number; tx: number; ty: number }, w: number) => {
            g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
            g.beginPath(); g.moveTo(x.kx, knY + (x.f === 1 ? fw * 0.8 : 0));
            g.quadraticCurveTo(x.kx + (x.tx - x.kx) * 0.3, (knY + x.ty) / 2 - fw * 0.2, x.tx, x.ty + fw / 2);
            g.stroke();
          };
          // Outline first (ink, a little wider), then the white over it: one clean silhouette.
          g.strokeStyle = pal.ink; g.fillStyle = pal.ink;
          path(2.5); g.fill();
          for (const x of fingers) finger(x, fw + 5);
          g.strokeStyle = pal.white; g.fillStyle = pal.white;
          path(0); g.fill();
          for (const x of fingers) finger(x, fw);
          // Fingertips that press, in the hand's colour; the cuff at the wrist.
          for (const x of fingers) if (x.press) { g.fillStyle = h === 'L' ? pal.L : pal.R; g.beginPath(); g.arc(x.tx, x.ty + fw / 2, fw * 0.32, 0, Math.PI * 2); g.fill(); }
          g.fillStyle = h === 'L' ? pal.L : pal.R; g.strokeStyle = pal.ink; g.lineWidth = 2.5;
          const cw = (hi - lo) * 0.66, cy = H - Math.max(10, palmH * 0.22);
          g.beginPath(); g.roundRect((lo + hi) / 2 - cw / 2, cy, cw, 40, 8); g.fill(); g.stroke();
          // Finger numbers on the tips while playing.
          if (p < 0.5) {
            g.fillStyle = pal.ink; g.font = `700 ${Math.round(Math.max(10, fw * 0.48))}px 'JetBrains Mono', 'Courier New', Courier, monospace`;
            g.textAlign = 'center'; g.textBaseline = 'middle';
            for (const x of fingers) if (!x.press) g.fillText(String(x.f), x.tx, x.ty + fw * 0.55);
          }
        }
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 0.9; ctx.drawImage(buffer, 0, 0); ctx.restore();
      }
      // Each key he presses sends up a small mark in green or red with its letter, so he sees what
      // he played (and if it was right) even while the voice explains.
      for (const p of presses?.current ?? []) {
        const a = (performance.now() - p.at) / 800;
        const k = X(p.midi);
        if (a > 1 || !k) continue;
        const e = 1 - Math.pow(1 - a, 3);
        const bw = Math.max(18, k.w * 0.9), bh = 22;
        ctx.globalAlpha = 1 - a * a;
        ctx.fillStyle = p.ok ? pal.ok : pal.bad;
        ctx.fillRect(k.x + k.w / 2 - bw / 2, kbTop - 30 - 70 * e, bw, bh);
        ctx.fillStyle = pal.paper;
        ctx.font = `900 13px ${FACE}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(N(letter(p.midi, flats)), k.x + k.w / 2, kbTop - 30 - 70 * e + bh / 2 + 1);
        ctx.textBaseline = 'alphabetic';
        ctx.globalAlpha = 1;
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [tl, range, now, held, flats, named, namedUntil, presses, shape, jump, hands, flatHands, geom]);
  return <canvas ref={ref} className="reel-lanes" aria-hidden="true" />;
}

/** Where the clock is: the segment, the bar, the note just played, the card showing (changes a few times a second). */
function usePlace(tl: ReelTimeline, now: () => number, playing: boolean) {
  const [place, setPlace] = useState({ seg: -1, playing: false, bar: 0, note: -1, card: tl.cards[0]?.kind as string | undefined, line: -1, count: 0, train: false, round: 0 });
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const t = now();
      const c = tl.cards.find(x => t >= x.t && t < x.until);
      const card = c?.kind ?? (t >= tl.duration - 0.01 ? 'end' : undefined);
      let note = -1;
      for (let i = 0; i < tl.notes.length && tl.notes[i].t <= t + 0.02; i++) note = i;
      const pass = tl.passes.find(x => t >= x.t && t < x.until);
      const seg = pass?.seg ?? -1;
      const n = tl.notes[note];
      const bar = n && n.seg === seg ? n.bar : tl.notes.find(x => x.seg === seg)?.bar ?? 0;
      // The voice line being said (its caption stays a moment after the voice ends).
      let line = -1;
      tl.lines.forEach((l, i) => { if (t >= l.t && t < l.until + 0.8) line = i; });
      // Train with me: the beat of the count-in (1 to 4, 0 outside it), and whether it is his turn.
      const cis = tl.countIns ?? (tl.countIn ? [tl.countIn] : []);
      let count = 0, round = 0;
      cis.forEach((ci, i) => { if (t >= ci.t - 0.2) round = i + 1; if (t >= ci.t && t < ci.t + ci.n * ci.beat) count = Math.floor((t - ci.t) / ci.beat) + 1; });
      const train = !!cis.length && t >= cis[0].t && (!tl.train || t < tl.train.until + 0.5);
      const next = { seg, playing: !!pass, bar, note, card, line, count, train, round };
      setPlace(p => (p.seg === next.seg && p.playing === next.playing && p.bar === next.bar && p.note === next.note && p.card === next.card && p.line === next.line && p.count === next.count && p.train === next.train && p.round === next.round ? p : next));
      if (playing) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [tl, now, playing]);
  return place;
}

/** The voice: each line is said when the clock reaches it; it pauses with the reel and stops when the reel leaves. */
function useNarration(tl: ReelTimeline, line: number, playing: boolean, active: boolean, epoch = 0) {
  const word = useRef({ line: -1, char: -1 });
  const said = useRef(-1);
  const [on, setOn] = useState(voiceOn);
  useEffect(() => onVoice(() => setOn(voiceOn())), []);
  useEffect(() => {
    if (!active || !on) return;
    // Each line is said once per play-through, in order; the loops after it are the music alone.
    if (line < 0 || line <= said.current || !playing) return;
    said.current = line;
    word.current = { line, char: -1 };
    say(tl.lines[line].text, c => { word.current = { line, char: c }; });
  }, [line, playing, active, on, tl]);
  // From the start again (Again): the voice says it again.
  useEffect(() => { said.current = -1; }, [epoch]);
  useEffect(() => { if (!active) return; if (playing) resumeVoice(); else pauseVoice(); }, [playing, active]);
  useEffect(() => { if (!active) { hush(); said.current = -1; } return () => hush(); }, [active]);
  return { word, on };
}

/** A line's words with where each starts, for the captions and for the keys the voice names. */
function wordsOf(text: string) {
  const out: { w: string; at: number }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push({ w: m[0], at: m.index });
  return out;
}

/** The word the voice is on: from its own word marks, or from the clock when it gives none. */
function useWordAt(line: ReelLine | undefined, index: number, now: () => number, word: React.RefObject<{ line: number; char: number }>) {
  const words = useMemo(() => (line ? wordsOf(line.text) : []), [line]);
  const [at, setAt] = useState(-1);
  useEffect(() => {
    if (!line) { setAt(-1); return; }
    let raf = 0;
    const tick = () => {
      const w = word.current;
      let i: number;
      if (w && w.line === index && w.char >= 0) {
        i = 0;
        while (i + 1 < words.length && words[i + 1].at <= w.char) i++;
      } else {
        const f = (now() - line.t) / Math.max(0.5, line.until - line.t);
        i = f < 0 ? -1 : Math.min(words.length - 1, Math.floor(f * words.length));
      }
      setAt(i);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [line, index, now, word, words]);
  return { words, at };
}

// Eases by role (measured craft, after HyperFrames): arrivals land on a long tail, exits are short.
const ARRIVE = [0.16, 1, 0.3, 1] as const; // expo.out
const LEAVE = [0.4, 0, 1, 1] as const;

/**
 * The caption of what the voice is saying, TikTok style: groups of three to five words, broken
 * at a comma or a full stop; each word blurs in as it comes (0.13 s, 70 ms apart), the word being
 * said lit, and the group leaves in 0.12 s before the next.
 */
// Kinetic captions: the words that carry the lesson (a note, a finger, a shape, an action) set big,
// the little words small, so a line reads at a glance like a TikTok caption.
const SMALL = new Set(['the', 'a', 'an', 'and', 'on', 'of', 'to', 'it', 'is', 'in', 'for', 'with', 'at', 'then', 'now', 'just', 'here', 'you', 'your', 'its', 'one', 'by', 'up',
  'o', 'os', 'as', 'e', 'de', 'do', 'da', 'dos', 'das', 'no', 'na', 'nos', 'nas', 'em', 'um', 'uma', 'com', 'para', 'por', 'ao', 'à', 'que', 'se', 'te', 'tu', 'só', 'já', 'aqui', 'agora', 'depois', 'é', 'mais']);
const BIG = new RegExp(`^(${NOTE_RE}|thumb|finger|[1-5]|top|middle|low|lowest|octave|both|left|right|pattern|pause|slowly|together|turn|again|scale|chord|leap|polegar|dedo|cima|meio|baixo|oitava|duas|esquerda|direita|padrão|pausa|devagar|juntas|vez|outra|escala|acorde|salto)$`, 'i');
function weight(w: string) {
  const bare = w.replace(/[.,:;!?]/g, '');
  return BIG.test(bare) ? 'big' : SMALL.has(bare.toLowerCase()) ? 'small' : '';
}

function Caption({ words, at, index }: { words: { w: string }[]; at: number; index: number }) {
  const chunks = useMemo(() => {
    const out: number[][] = [];
    let cur: number[] = [];
    words.forEach((x, i) => {
      cur.push(i);
      if (cur.length >= 5 || (cur.length >= 3 && /[.,:;!?]$/.test(x.w))) { out.push(cur); cur = []; }
    });
    if (cur.length) out.push(cur);
    return out;
  }, [words]);
  const chunk = Math.max(0, chunks.findIndex(c => c.includes(Math.max(0, at))));
  return (
    <AnimatePresence mode="wait">
      <motion.p key={`${index}-${chunk}`} className="reel-say" exit={{ opacity: 0, filter: 'blur(4px)', transition: { duration: 0.12, ease: LEAVE } }}>
        {(chunks[chunk] ?? []).map((i, j) => (
          <motion.span key={i} className={`${i === at ? 'on' : i < at ? 'past' : ''} ${weight(words[i].w)}`} initial={{ opacity: 0, filter: 'blur(6px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} transition={{ duration: 0.13, delay: j * 0.07, ease: ARRIVE }}>{words[i].w} </motion.span>
        ))}
      </motion.p>
    </AnimatePresence>
  );
}

interface PlayerProps {
  song: Song;
  reel: Clip;
  /** The song's sections, shown while paused to go to another (Intro, Verse 1, ...). */
  sections?: Reel[];
  onSection?: (r: Reel) => void;
  /** Speed chosen from the paused video: slower, normal, faster (Settings, Videos, Speed). */
  onSpeed?: (v: number) => void;
  index: number;
  count: number;
  active: boolean;
  onPractice: () => void;
  onNext?: () => void;
  /** "Explain it slower": the part taken apart into small, slower videos, put right after this one. */
  onExplain?: () => void;
  /** Open Settings, where the piano is connected. */
  onPiano?: () => void;
  /** How fast the videos go for him (see timelineOf). */
  pace?: number;
  /** How Train with me went on his piano, once per video. */
  onResult?: (r: ReelResult) => void;
}

/** What his piano told about a video: clean, poor, and the place he kept missing. */
export type ReelResult = { perfect: boolean; poor: boolean; fix?: { ticks: number; ms: number[] } };

/**
 * One small step of the song as a TikTok-style video: it plays by itself when it is on screen and
 * loops until he scrolls on, so he copies it on his piano as many times as he likes. The voice
 * says it once; the loops are the music alone. Tap to pause.
 */
export function ReelPlayer({ song, reel, active, onPiano, onExplain, pace = 1, onResult, sections, onSection, onSpeed }: PlayerProps) {
  // The pace is taken when the video comes on screen, so it never changes under him.
  // A speed chosen from the paused video takes effect at once (speedN), from the start of the video.
  const [speedN, setSpeedN] = useState(0);
  const paceAt = useMemo(() => pace * videoPrefs.pace, [reel, active, speedN]); // eslint-disable-line react-hooks/exhaustive-deps
  const tl = useMemo(() => timelineOf(song, reel, paceAt), [song, reel, paceAt]);
  // One keyboard for both hands, framed on this video's notes.
  const range = useMemo<[number, number]>(() => {
    const ms = tl.notes.map(n => n.midi);
    return ms.length ? pickRange(Math.min(...ms), Math.max(...ms), 14) : [60, 76];
  }, [tl]);
  const [loops, setLoops] = useState(0);
  const [epoch, setEpoch] = useState(0);
  const clockRef = useRef<ReturnType<typeof useReelClock> | null>(null);
  // Practise on his own: the video stops by itself and counts his clean runs (two, then it goes on).
  const [holding, setHolding] = useState(false);
  const [reps, setReps] = useState(0);
  const loopsRef = useRef(0);
  loopsRef.current = loops;
  const clock = useReelClock(tl, active, () => {
    // The first time through, what his piano showed tells the next videos how to go.
    if (loopsRef.current === 0) report();
    // A section played through (Hear) is not part of the series: it never counts as watched.
    if (!reel.id.endsWith('-listen')) {
      markSeen(song.entry.id, reel.id);
      if (reel.k === reel.of) markSeen(song.entry.id, reel.phase.id);
    }
    setLoops(n => n + 1);
    // TikTok: it starts again by itself, from Train with me.
    window.setTimeout(() => clockRef.current?.play(tl.loopFrom), 0);
  }, () => {
    // Only the first time through; the loops after it keep going.
    if (loopsRef.current > 0) return false;
    setReps(0);
    setHolding(true);
    return true;
  });
  clockRef.current = clock;
  const place = usePlace(tl, clock.now, clock.playing);
  const voice = useNarration(tl, place.line, clock.playing || holding, active, epoch);
  // What Train with me showed of his playing: where the video had to wait for him and where he hit
  // a wrong key, counted per note group, told once when the video goes on (to adapt the next ones).
  const trouble = useRef({ waits: 0, wrong: 0, played: 0, at: new Map<string, { n: number; ticks: number; ms: number[] }>(), told: false });
  useEffect(() => { trouble.current = { waits: 0, wrong: 0, played: 0, at: new Map(), told: false }; }, [tl]);
  // Leaving a video he played along with also tells how it went.
  useEffect(() => { if (!active) report(); }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  const report = () => {
    const tr = trouble.current;
    if (tr.told || !anyOn(linkState()) || !groupsToPlay.length || tr.played < 3) return;
    tr.told = true;
    const worst = [...tr.at.values()].sort((x, y) => y.n - x.n)[0];
    const misses = tr.waits + tr.wrong;
    const rounds = tl.countIns?.length ?? 1;
    onResult?.({ perfect: tr.waits <= rounds && tr.wrong <= rounds, poor: misses >= Math.max(4, groupsToPlay.length * 0.3), fix: worst && worst.n >= 2 ? { ticks: worst.ticks, ms: worst.ms } : undefined });
  };
  const release = () => { report(); setHolding(false); setReps(0); unlockAudio(); if (tl.hold) clock.play(tl.hold.t + 0.01); };
  const trainAgain = () => { setHolding(false); setReps(0); unlockAudio(); if (tl.countIn) clock.play(tl.countIn.t - 0.2); };
  useEffect(() => { if (!active) { setHolding(false); setReps(0); } }, [active]);
  // Is a piano connected? Then his runs are counted; otherwise he says when he is done.
  const anyOn = (st: ReturnType<typeof linkState>) => Object.values(st).some(x => x.status === 'on');
  const [inputOn, setInputOn] = useState(() => anyOn(linkState()));
  useEffect(() => onLinkState(st => setInputOn(anyOn(st))), []);
  // His runs, note group by note group: a clean run is every group in order with at most two slips.
  const groupsToPlay = useMemo(() => {
    const out: { t: number; ms: Set<number>; ticks: number; round: number }[] = [];
    for (const n of tl.notes) if (n.train) { const g = out[out.length - 1]; if (g && Math.abs(g.t - n.t) < 0.03) g.ms.add(n.midi); else out.push({ t: n.t, ms: new Set([n.midi]), ticks: n.ticks, round: n.round ?? 0 }); }
    return out;
  }, [tl]);
  // The voice's lines are made ahead (the natural voice), this video's first when it is on screen.
  useEffect(() => { prepareVoice(tl.lines.map(l => l.text), active); }, [tl, active]);

  // Train with me waits for him: with a piano connected, the video stops at a note he has not
  // played by the time it should sound (a quarter of a second of grace) and goes on the moment he
  // plays it, so it follows him at his pace and moves on its own when he is on time.
  const [waitingFor, setWaitingFor] = useState<Set<number> | null>(null);
  const waitRef = useRef<Map<number, number>>(new Map());
  const waitingRef = useRef(false);
  const follow = useRef({ i: 0, have: new Set<number>() });
  useEffect(() => { follow.current = { i: 0, have: new Set() }; roundHits.current = []; }, [tl]);
  // After each round of Train with me, with his piano: how many note groups he played on time, so
  // he sees it come into his hands round by round.
  const roundHits = useRef<number[]>([]);
  const waitSince = useRef(0);
  const [verdict, setVerdict] = useState<{ round: number; ok: number; of: number; silent?: 'mic' | 'keys' } | null>(null);
  // Every key his piano sent during the round, to tell an honest "I did not hear your piano" from a
  // round that went badly (the 2026-11 audit: errors that say what happened).
  const heard = useRef(0);
  useEffect(() => (active ? onNote(e => { if (e.type === 'on') heard.current++; }) : undefined), [active]);
  const lastRound = useRef(0);
  useEffect(() => {
    const prev = lastRound.current, now = place.train ? place.round : 0;
    lastRound.current = now;
    // Round `prev` is over: the next one began, or Train with me ended.
    if (!active || !inputOn || loops > 0 || prev < 1 || (now !== 0 && now !== prev + 1)) return;
    const r = prev - 1, of = groupsToPlay.filter(g => g.round === r).length, ok = Math.min(of, roundHits.current[r] ?? 0);
    const keys = heard.current;
    heard.current = 0;
    if (!of) return;
    // Not a single key from his piano in the whole round: say what is wrong, not "0 of 20".
    const on = Object.entries(linkState()).find(([, x]) => x.status === 'on')?.[0];
    setVerdict({ round: prev, ok, of, silent: keys === 0 ? (on === 'mic' ? 'mic' : 'keys') : undefined });
    if (ok >= of * 0.8) playSfx('pop', 0.4);
  }, [place.round, place.train]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!verdict) return; const id = window.setTimeout(() => setVerdict(null), verdict.silent ? 5000 : 2600); return () => window.clearTimeout(id); }, [verdict]);
  useEffect(() => {
    if (!active || !inputOn || !tl.train || !groupsToPlay.length) return;
    const waits = videoPrefs.wait;
    const c = () => clockRef.current!;
    const off = onNote(e => {
      if (e.type !== 'on') return;
      const f = follow.current, g = groupsToPlay[f.i];
      if (!g || c().now() < g.t - 0.45) return;
      if (!g.ms.has(e.midi)) return;
      f.have.add(e.midi);
      if (![...g.ms].every(m => f.have.has(m))) return;
      // On time: played as it sounded, or within half a second of the video stopping for it.
      if (!waitingRef.current || performance.now() - waitSince.current < 500) roundHits.current[g.round] = (roundHits.current[g.round] ?? 0) + 1;
      f.i++; f.have.clear();
      if (waitingRef.current) { waitingRef.current = false; waitRef.current = new Map(); setWaitingFor(null); c().play(Math.max(g.t, c().now()) + 0.01); }
    });
    let raf = 0;
    const tick = () => {
      const f = follow.current, t = c().now();
      // A new pass of Train with me (a loop, or Again) starts again from its first group.
      if (f.i > 0 && t < groupsToPlay[0].t - 0.5) { f.i = 0; f.have.clear(); }
      while (f.i < groupsToPlay.length && groupsToPlay[f.i].t < t - 1.5) { f.i++; f.have.clear(); }
      const g = groupsToPlay[f.i];
      if (waits && g && !waitingRef.current && c().playing && t > g.t + 0.25 && t < g.t + 1.5) {
        waitingRef.current = true;
        waitSince.current = performance.now();
        waitRef.current = new Map([...g.ms].map((m, k) => [m, k + 1]));
        setWaitingFor(g.ms);
        if (import.meta.env.DEV) (window as unknown as { __waiting?: number[] }).__waiting = [...g.ms];
        if (loopsRef.current === 0) { const k = `${g.ticks}`; trouble.current.waits++; trouble.current.at.set(k, { n: (trouble.current.at.get(k)?.n ?? 0) + 1, ticks: g.ticks, ms: [...g.ms] }); }
        c().pause();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { off(); cancelAnimationFrame(raf); };
  }, [active, inputOn, tl, groupsToPlay]);
  useEffect(() => { if (!active) { waitingRef.current = false; waitRef.current = new Map(); setWaitingFor(null); } }, [active]);
  const run = useRef({ i: 0, have: new Set<number>(), slips: 0 });
  useEffect(() => {
    if (!active || !holding || !groupsToPlay.length) return;
    run.current = { i: 0, have: new Set(), slips: 0 };
    return onNote(e => {
      if (e.type !== 'on') return;
      const r = run.current, g = groupsToPlay[r.i];
      if (!g) return;
      if (g.ms.has(e.midi)) {
        r.have.add(e.midi);
        if ([...g.ms].every(m => r.have.has(m))) { r.i++; r.have.clear(); }
        if (r.i >= groupsToPlay.length) { r.i = 0; r.slips = 0; playSfx('pop', 0.5); setReps(x => x + 1); }
      } else if (r.i > 0 || groupsToPlay[0].ms.has(e.midi) === false) {
        r.slips++;
        if (r.slips > 2) { r.i = 0; r.have.clear(); r.slips = 0; }
      }
    });
  }, [active, holding, groupsToPlay]);
  // Two clean runs: well done, and the video goes on by itself.
  useEffect(() => {
    if (!holding || !tl.hold || reps < tl.hold.reps) return;
    const id = window.setTimeout(release, 900);
    return () => window.clearTimeout(id);
  }, [reps, holding]); // eslint-disable-line react-hooks/exhaustive-deps
  const held = useRef(new Map<number, boolean>());
  const presses = useRef<Press[]>([]);
  const [score, setScore] = useState({ ok: 0, bad: 0 });
  useEffect(() => { if (!active) setScore({ ok: 0, bad: 0 }); }, [active]);
  useEffect(() => { if (!active) setLoops(0); }, [active]);

  // Keys he plays along light up green on the reel's keyboard.
  useEffect(() => {
    if (!active) return;
    // Right or wrong at any moment, even while the voice explains: in Train with me, a key of a note
    // group due about now (half a second either way); otherwise any key this video teaches.
    const keys = new Set(tl.notes.map(n => n.midi));
    return onNote(e => {
      if (e.type !== 'on') { held.current.delete(e.midi); return; }
      const t = clockRef.current?.now() ?? 0;
      const turn = tl.train && t >= (tl.countIn?.t ?? tl.train.t) && t <= tl.train.until + 0.5;
      const ok = turn ? tl.notes.some(n => n.train && n.midi === e.midi && Math.abs(n.t - t) < 0.5) || (waitingRef.current && (waitRef.current?.has(e.midi) ?? false)) : keys.has(e.midi);
      held.current.set(e.midi, ok);
      if (turn) trouble.current.played++;
      if (turn && !ok && loopsRef.current === 0) {
        const g = groupsToPlay.reduce((best, x) => (Math.abs(x.t - t) < Math.abs(best.t - t) ? x : best), groupsToPlay[0]);
        if (g) { const k = `${g.ticks}`; trouble.current.wrong++; trouble.current.at.set(k, { n: (trouble.current.at.get(k)?.n ?? 0) + 1, ticks: g.ticks, ms: [...g.ms] }); }
      }
      // A microphone sends no key-up: its keys go dark again on their own.
      if (e.source === 'mic') window.setTimeout(() => held.current.delete(e.midi), 500);
      presses.current = [...presses.current.filter(p => performance.now() - p.at < 900), { midi: e.midi, ok, at: performance.now() }];
      setScore(x => (ok ? { ...x, ok: x.ok + 1 } : { ...x, bad: x.bad + 1 }));
    });
  }, [active, tl, groupsToPlay]);

  const toggle = () => { unlockVoice(); if (clock.playing) clock.pause(); else { unlockAudio(); clock.play(); } };
  const replay = () => { unlockAudio(); unlockVoice(); hush(); setLoops(0); setEpoch(e => e + 1); clock.play(0); };
  const sayLine = place.line >= 0 && loops === 0 ? tl.lines[place.line] : undefined;
  const spoken = useWordAt(sayLine, place.line, clock.now, voice.word);
  // The keys the voice has named so far, numbered in the order it named them (E, C, A, C: 1 2 3 4),
  // lit before the music plays them: the explanation drawn on the keyboard as it is said.
  const named = useRef(new Map<number, number>());
  useEffect(() => {
    const map = new Map<number, number>();
    if (sayLine && spoken.at >= 0) {
      const flats = song.fifths < 0;
      let ptr = 0, n = 0;
      for (const { w } of spoken.words.slice(0, spoken.at + 1)) {
        const m = new RegExp(`^(${NOTE_RE.replace('m?', '')})[,.:;]?$`).exec(w);
        if (!m) continue;
        let i = tl.notes.findIndex((x, k) => k >= ptr && N(letter(x.midi, flats)) === m[1]);
        if (i < 0) i = tl.notes.findIndex(x => N(letter(x.midi, flats)) === m[1]);
        if (i < 0) continue;
        ptr = i + 1;
        if (!map.has(tl.notes[i].midi)) map.set(tl.notes[i].midi, ++n);
      }
    }
    named.current = map;
  }, [sayLine, spoken.at, spoken.words, tl, song.fifths]);
  // The drawn hands on the keys, on unless he turns them off (kept on this device).
  // The gloves on the keys, on unless he turns them off (kept on this device).
  const [handsOn, setHandsOn] = useState(handsShown);
  useEffect(() => { const on = () => setHandsOn(handsShown()); window.addEventListener('leonor:hands', on); return () => window.removeEventListener('leonor:hands', on); }, []);
  const toggleHands = () => showHands(!handsOn);
  const [staffOn, setStaffOn] = useState(staffShown);
  useEffect(() => { const on = () => setStaffOn(staffShown()); window.addEventListener('leonor:staff', on); return () => window.removeEventListener('leonor:staff', on); }, []);
  const staffOnly = reel.segments[0].kind === 'L' || reel.segments[0].kind === 'R' ? reel.segments[0].kind as Hand : undefined;
  const firstNote = tl.notes[0]?.t ?? 0;
  // The gloves in 3D over the flat video where WebGL runs (the flat ones elsewhere).
  const use3d = useMemo(() => webglOk(), []);
  const geomRef = useRef<KeysGeom | null>(null);
  // A jump video: the key it leaves and the key it lands on, for the arc over the keys.
  const jumpKeys = useMemo<[number, number] | undefined>(() => {
    if (reel.kind !== 'jump') return undefined;
    const on: number[] = [];
    for (const n of tl.notes) if (!n.train && !on.includes(n.t)) on.push(n.t);
    const at = (x: number) => tl.notes.filter(n => n.t === x).reduce((a, b) => (b.midi > a.midi ? b : a)).midi;
    return on.length > 1 ? [at(on[0]), at(on[1])] : undefined;
  }, [reel, tl]);
  const w = reel.words;
  const seg = reel.segments[0];
  // While both hands play the whole phase: the caption of the bar (or the one just before it).
  const cue = useMemo(() => {
    if (!place.playing || (reel.kind !== 'run' && reel.kind !== 'both')) return undefined;
    for (let b = place.bar; b >= Math.max(seg.from, place.bar - 1); b--) if (w.cues[b]) return w.cues[b];
    return undefined;
  }, [place.playing, place.bar, reel.kind, seg.from, w]);
  const pass = tl.passes[0];
  const pct = pass ? Math.max(0, Math.min(1, (clock.now() - pass.t) / (pass.until - pass.t))) : 0;
  const showTitle = place.card === 'title' && loops === 0;
  // Where in the teaching the video is: the count-in, his turn, or the music shown.
  const beatNo = place.count;
  const counting = beatNo > 0;
  const training = place.train;
  const label = waitingFor ? L(`Your turn: play ${[...waitingFor].map(m => letter(m, song.fifths < 0)).join(' ')}`, `A tua vez: toca ${[...waitingFor].map(m => N(letter(m, song.fifths < 0))).join(' ')}`) : holding ? L('On your own', 'Sozinho') : training ? (loops > 0 ? L('Train with me, again', 'Treina comigo, outra vez') : (tl.countIns?.length ?? 1) > 1 ? L(`Train with me, ${place.round} of ${tl.countIns!.length}`, `Treina comigo, ${place.round} de ${tl.countIns!.length}`) : L('Train with me', 'Treina comigo')) : seg.label;

  // While a video plays nothing sits over it: the menu, the piano chip and the actions show only
  // when he pauses (the user's choice 2026-11).
  const paused = active && !clock.playing && !holding && !waitingFor;
  // The microphone hears better knowing what to listen for (the bench: 80% of notes right blind,
  // 92% told): while the video is on screen, the notes due about now and the keys it uses.
  useEffect(() => {
    if (!active) return;
    const ms = tl.notes.map(n => n.midi);
    if (ms.length) setMicRange(Math.min(...ms), Math.max(...ms));
    const id = window.setInterval(() => {
      const t = clock.now();
      setExpected([...new Set(tl.notes.filter(n => n.t > t - 0.3 && n.t < t + 0.6).map(n => n.midi))], false);
    }, 100);
    return () => { window.clearInterval(id); setExpected([]); setMicRange(21, 108); };
  }, [active, tl]); // eslint-disable-line react-hooks/exhaustive-deps

  // The Explain chip comes five seconds into the video: a timer of its own, so it shows even when
  // nothing else on screen changes at that moment.
  const [explainReady, setExplainReady] = useState(false);
  useEffect(() => {
    if (!active) { setExplainReady(false); return; }
    if (explainReady || !clock.playing) return;
    const id = window.setTimeout(() => setExplainReady(true), Math.max(0, 5 - clock.now()) * 1000);
    return () => window.clearTimeout(id);
  }, [active, clock.playing, explainReady]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    root.classList.toggle('reel-playing', !paused);
    return () => root.classList.remove('reel-playing');
  }, [active, paused]);

  return (
    <div className={`reel-slide ${active ? 'active' : ''}`}>
      <div className="reel-frame" onClick={toggle} role="group" aria-label={L(`${reel.phase.section}, video ${reel.k} of ${reel.of}: ${reel.head}`, `${reel.phase.section}, vídeo ${reel.k} de ${reel.of}: ${reel.head}`)}>
        <div className="reel-progress" aria-hidden="true">
          {Array.from({ length: reel.of }, (_, i) => <i key={i}><b style={{ width: `${i < reel.k - 1 ? 100 : i === reel.k - 1 ? pct * 100 : 0}%` }} /></i>)}
        </div>
        {/* Set like the Für Elise TikToks: the step's kicker small, its notes huge, nothing else. */}
        <header className="reel-head">
          <motion.p key={label} className="reel-kicker" initial={{ opacity: 0, filter: 'blur(6px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} transition={{ duration: 0.18, ease: ARRIVE }}>{label}</motion.p>
          <h2 className={`reel-hook hand-${seg.kind} ${reel.head.split(' ').some(x => !new RegExp(`^${NOTE_RE}$`).test(x) && x !== 'octaves' && x !== 'oitavas') ? 'words' : ''}`}>{reel.head.split(' ').map((x, i) => <motion.span key={`${reel.id}-${i}`} initial={{ opacity: 0, filter: 'blur(6px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} transition={{ duration: 0.13, delay: 0.1 + i * 0.067, ease: ARRIVE }}>{x} </motion.span>)}</h2>
          {(paused || (inputOn && score.ok + score.bad > 0)) && (
            <p className="reel-meta">{paused && L(`${reel.phase.section}, ${reel.k} of ${reel.of}`, `${reel.phase.section}, ${reel.k} de ${reel.of}`)}{inputOn && score.ok + score.bad > 0 && <span className="reel-score" aria-live="polite">{paused ? '. ' : ''}{L('Your keys: ', 'As tuas teclas: ')}<b className="ok">{score.ok} {L('right', 'certas')}</b>, <b className="bad">{score.bad} {L('wrong', 'erradas')}</b></span>}</p>
          )}
        </header>
        <div className={`reel-stage ${staffOn ? 'on-staff' : ''}`}>
          {/* The staff in place of the falling notes (his choice): big like the lessons' page, on
              the bars being played, over the keys and the hands. */}
          {staffOn && active && <ReelStaff song={song} from={reel.from} to={reel.to} only={staffOnly} tl={tl} now={clock.now} playing={!paused} named={waitingFor ? waitRef : named} namedUntil={waitingFor ? Infinity : firstNote} geom={geomRef} />}
          <Lanes fallOn={!staffOn} tl={tl} range={range} now={clock.now} held={held} presses={presses} hands={handsOn} flatHands={!use3d} geom={geomRef} shape={reel.kind === 'pattern' || reel.kind === 'L' || reel.kind === 'R' || reel.kind === 'fix'} jump={jumpKeys} flats={song.fifths < 0} named={waitingFor ? waitRef : named} namedUntil={waitingFor ? Infinity : firstNote} />
          {use3d && handsOn && <Suspense fallback={null}><Hands3D tl={tl} now={clock.now} geom={geomRef} named={waitingFor ? waitRef : named} namedUntil={waitingFor ? Infinity : firstNote} /></Suspense>}
          {/* The caption floats over the falling notes, never under the keys (it pushed them up). */}
          <div className="reel-foot">
            {sayLine && !showTitle ? (
              <Caption words={spoken.words} at={spoken.at} index={place.line} />
            ) : (
              <AnimatePresence mode="wait">
                {cue && (
                  <motion.p key={cue} className="reel-cue" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }} transition={SOFT}>{cue}</motion.p>
                )}
              </AnimatePresence>
            )}
          </div>
        </div>

        <AnimatePresence>
          {showTitle && (
            <motion.div key="title" className="reel-card" initial={{ opacity: 1 }} exit={{ opacity: 0, filter: 'blur(8px)', transition: { duration: 0.18, ease: LEAVE } }}>
              <div>
                <motion.small initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>{reel.phase.section === w.title ? reel.phase.section : `${reel.phase.section}: ${w.title}`}</motion.small>
                {/* The idea lands word by word, then holds dead still. */}
                <h3>{w.hook.split(' ').map((x, i) => <motion.span key={i} style={{ display: 'inline-block' }} initial={{ opacity: 0, filter: 'blur(6px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} transition={{ duration: 0.13, delay: 0.1 + i * 0.067, ease: ARRIVE }}>{x}&nbsp;</motion.span>)}</h3>
                {sayLine && <Caption words={spoken.words} at={spoken.at} index={place.line} />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {counting && (
            <motion.span key={beatNo} className="reel-countin" aria-live="polite" initial={{ opacity: 0, scale: 1.2, filter: 'blur(8px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={{ duration: 0.18, ease: ARRIVE }}>{beatNo}</motion.span>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {verdict && (
            <motion.p key={`verdict-${verdict.round}`} className={`reel-verdict ${verdict.silent ? 'silent' : verdict.ok >= verdict.of * 0.8 ? 'good' : ''}`} role="status"
              initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }} transition={SPRING}>
              {verdict.silent === 'mic'
                ? L('I did not hear your piano. Bring the phone closer or play a little louder.', 'Não ouvi o teu piano. Aproxima o telemóvel ou toca um pouco mais forte.')
                : verdict.silent === 'keys'
                  ? L('No notes came from your piano. Check the cable or Bluetooth in Settings.', 'Não chegaram notas do teu piano. Vê o cabo ou o Bluetooth nas Definições.')
                  : L(`Round ${verdict.round}: ${verdict.ok} of ${verdict.of} on time`, `Ronda ${verdict.round}: ${verdict.ok} de ${verdict.of} a tempo`)}
            </motion.p>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {holding && tl.hold && (
            <motion.div key="hold" className="reel-hold" role="dialog" aria-label="Practise it on your own" onClick={e => e.stopPropagation()}
              initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0, filter: 'blur(6px)', transition: { duration: 0.15 } }} transition={{ duration: 0.35, ease: ARRIVE }}>
              <small>Pause and practise</small>
              <h3>Play it {tl.hold.reps} more times</h3>
              <ol className="reel-reps" aria-label={`${Math.min(reps, tl.hold.reps)} of ${tl.hold.reps} done`}>
                {Array.from({ length: tl.hold.reps }, (_, i) => (
                  <motion.li key={`${i}-${i < reps}`} className={i < reps ? 'on' : ''} initial={i < reps ? { scale: 0.6 } : false} animate={{ scale: 1 }} transition={{ duration: 0.25, ease: ARRIVE }}>{i < reps ? <IconCheck size={20} /> : i + 1}</motion.li>
                ))}
              </ol>
              <p>{inputOn ? 'Play it on your piano: every clean run counts by itself.' : 'Play it on your piano, then tap Done.'}</p>
              <div className="reel-hold-actions">
                <button className="btn go" onClick={release}>Done</button>
                <button className="btn" onClick={trainAgain}><IconRestart size={16} />Train with me again</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {active && !clock.playing && !holding && !waitingFor && clock.ready && (
            <motion.span className="reel-paused" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={SPRING} aria-hidden="true"><IconPlay size={34} /></motion.span>
          )}
        </AnimatePresence>
        {/* Explain it slower: discreet, a moment into the video, only while it plays (paused, the piano chip has its place). */}
        <AnimatePresence>
          {onExplain && active && clock.ready && clock.playing && !holding && !waitingFor && reel.kind !== 'intro' && reel.kind !== 'explain' && explainReady && (
            <motion.button key="explain" className="reel-explain" onClick={e => { e.stopPropagation(); onExplain(); }} aria-label={L('Explain this part slower, piece by piece', 'Explicar esta parte mais devagar, por partes')}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={{ duration: 0.3, ease: ARRIVE }}>
              <IconExplain size={16} />{L('Explain', 'Explicar')}
            </motion.button>
          )}
        </AnimatePresence>
        {!clock.ready && active && <span className="reel-loading" role="status">{L('Loading the piano', 'A carregar o piano')}</span>}
        {/* His piano: a key icon with a dot (green when connected) to connect it, and, once he plays
            along, how many keys were right and how many wrong in this video. */}
        <AnimatePresence>
          {paused && (
            <motion.button key="piano" className={`reel-piano ${inputOn ? 'on' : ''}`} onClick={e => { e.stopPropagation(); onPiano?.(); }} aria-label={inputOn ? L('Piano connected. Open settings', 'Piano ligado. Abrir as definições') : L('Connect your piano', 'Ligar o teu piano')}
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={{ duration: 0.25, ease: ARRIVE }}>
              <IconKeys size={20} /><i aria-hidden="true" />
              {!inputOn && <span className="reel-connect">{L('Connect', 'Ligar')}</span>}
            </motion.button>
          )}
        </AnimatePresence>
        {/* Scrub: drag along the bottom to go back to any moment, like TikTok. */}
        <div className="reel-scrub" role="slider" aria-label={L('Where in the video', 'Onde no vídeo')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)} tabIndex={0}
          onClick={e => e.stopPropagation()}
          onKeyDown={e => { if (e.key === 'ArrowLeft') clock.seek(clock.now() - 2); if (e.key === 'ArrowRight') clock.seek(clock.now() + 2); }}
          onPointerDown={e => { e.stopPropagation(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); hush(); const r = e.currentTarget.getBoundingClientRect(); clock.seek(pass.t + (pass.until - pass.t) * ((e.clientX - r.left) / r.width)); }}
          onPointerMove={e => { if (!e.buttons) return; const r = e.currentTarget.getBoundingClientRect(); clock.seek(pass.t + (pass.until - pass.t) * Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))); }}>
          <span className="reel-time" aria-hidden="true" style={{ transform: `scaleX(${pct})` }} />
        </div>
      </div>

      {/* The actions show only when he pauses, sliding in from the edge, so the video stays clear. */}
      <AnimatePresence>
        {paused && (
          <motion.aside key="side" className="reel-side" initial={{ x: 70, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 70, opacity: 0, transition: { duration: 0.14, ease: LEAVE } }} transition={{ duration: 0.3, ease: ARRIVE }}>
            <button className="reel-act" onClick={replay} aria-label={L('From the start, with the voice', 'Do início, com a voz')}><span><IconRestart size={24} /></span>{L('Again', 'Outra vez')}</button>
            {anyVoice() && (
              <button className="reel-act" onClick={e => { e.stopPropagation(); unlockVoice(); setVoiceOn(!voice.on); }} aria-pressed={voice.on} aria-label={voice.on ? L('Turn the voice off', 'Desligar a voz') : L('Turn the voice on', 'Ligar a voz')}>
                <span>{voice.on ? <IconSpeaker size={24} /> : <IconSpeakerOff size={24} />}</span>{L('Voice', 'Voz')}
              </button>
            )}
            {onSpeed && (() => {
              const v = videoPrefs.pace, next = v < 0.9 ? 1 : v < 1.1 ? 1.2 : 0.8;
              const name = v < 0.9 ? L('Slower', 'Mais lento') : v < 1.1 ? L('Normal', 'Normal') : L('Faster', 'Mais rápido');
              return (
                <button className="reel-act" onClick={e => { e.stopPropagation(); onSpeed(next); setSpeedN(x => x + 1); window.setTimeout(replay, 0); }}
                  aria-label={L(`Speed: ${name}. Tap to change`, `Velocidade: ${name}. Toca para mudar`)}><span><IconSpeed size={24} /></span>{name}</button>
              );
            })()}
            <button className="reel-act" onClick={e => { e.stopPropagation(); showStaff(!staffOn); }} aria-pressed={staffOn} aria-label={staffOn ? L('Back to the falling notes', 'Voltar às notas a cair') : L('Read it on the staff', 'Ler na pauta')}><span><IconSheet size={24} /></span>{staffOn ? L('Notes', 'Notas') : L('Staff', 'Pauta')}</button>
            <button className="reel-act" onClick={e => { e.stopPropagation(); toggleHands(); }} aria-pressed={handsOn} aria-label={handsOn ? L('Hide the hands on the keys', 'Esconder as mãos nas teclas') : L('Show the hands on the keys', 'Mostrar as mãos nas teclas')}><span><IconHand size={24} /></span>{L('Hands', 'Mãos')}</button>
          </motion.aside>
        )}
        {paused && sections && sections.length > 1 && onSection && (
          <motion.div key="sections" className="reel-sections" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0, transition: { duration: 0.14, ease: LEAVE } }} transition={{ duration: 0.3, ease: ARRIVE }}>
            <SectionRow song={song} sections={sections} current={reel.phase.id} onEnter={onSection} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * A still of a video for the home page: its kicker, its notes, and one frame of its keyboard with
 * the notes falling onto it (drawn by the same canvas, the clock stopped a moment into the music).
 */
export function ReelPreview({ song, reel }: { song: Song; reel: Clip }) {
  const tl = useMemo(() => timelineOf(song, reel), [song, reel]);
  const range = useMemo<[number, number]>(() => {
    const ms = tl.notes.map(n => n.midi);
    return ms.length ? pickRange(Math.min(...ms), Math.max(...ms), 14) : [60, 76];
  }, [tl]);
  const at = (tl.notes.find(n => !n.train)?.t ?? 0) + 0.6;
  const now = useCallback(() => at, [at]);
  const held = useRef(new Map<number, boolean>()), named = useRef(new Map<number, number>());
  const seg = reel.segments[0];
  const words = reel.head.split(' ').some(x => !new RegExp(`^${NOTE_RE}$`).test(x) && x !== 'octaves' && x !== 'oitavas');
  return (
    <div className="reel-preview reel-slide" aria-hidden="true">
      <div className="reel-preview-head">
        <p className="reel-kicker">{seg.label}</p>
        <p className={`reel-hook hand-${seg.kind} ${words ? 'words' : ''}`}>{reel.head}</p>
      </div>
      <div className="reel-preview-stage"><Lanes tl={tl} range={range} now={now} held={held} flats={song.fifths < 0} named={named} namedUntil={0} /></div>
    </div>
  );
}

interface FeedProps {
  /** Inside the Watch tab (no close button, the tab bar stays), instead of over the whole app. */
  embedded?: boolean;
  song: Song;
  reels: Clip[];
  start: number;
  onClose: () => void;
  onPractice: (reel: Clip, index: number) => void;
  /** The video on screen changed (to remember where he was, for the home page). */
  onActive?: (index: number, clip: Clip) => void;
  onPiano?: () => void;
  onSpeed?: (v: number) => void;
  /** A staff item of the course (kind 'read'): the lesson page for its bars, and when it is done. */
  practice?: (clip: Clip, done: () => void) => React.ReactNode;
}

/** The song's reels in a vertical feed: swipe up for the next one, TikTok style. */
const PACE = 'leonor:pace:';
const readPace = (id: string) => { try { return Number(localStorage.getItem(PACE + id)) || 1; } catch { return 1; } };

export function ReelFeed({ embedded, song, reels, start, onClose, onPractice, onActive, onPiano, onSpeed, practice }: FeedProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(start);
  // The feed follows him: videos it skips when he plays clean, fix-this-spot videos it adds where he
  // keeps missing, and a pace (kept per song) that rises with clean videos and falls with poor ones.
  const [items, setItems] = useState(reels);
  const [pace, setPace] = useState(() => readPace(song.entry.id));
  useEffect(() => { ref.current!.scrollTo({ top: start * ref.current!.clientHeight }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = ref.current!;
    const io = new IntersectionObserver(es => {
      for (const e of es) if (e.isIntersecting && e.intersectionRatio > 0.6) setActive(Number((e.target as HTMLElement).dataset.i));
    }, { root: el, threshold: [0.6] });
    el.querySelectorAll('[data-i]').forEach(s => io.observe(s));
    return () => io.disconnect();
  }, [items]);
  useEffect(() => { if (items[active]) onActive?.(active, items[active]); }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  const goTo = (i: number, smooth = true) => { const el = ref.current!; el.scrollTo({ top: i * el.clientHeight, behavior: smooth ? 'smooth' : 'auto' }); };
  // The sections of the song, to jump from a paused video to the first video of another.
  const sections = useMemo(() => reelsOf(song), [song]);
  const toSection = (r: Reel) => { const i = items.findIndex(c => c.phase.id === r.id); if (i >= 0) goTo(i, false); };
  const result = (i: number, r: ReelResult) => {
    const p = Math.round(Math.max(0.7, Math.min(1.3, pace * (r.perfect ? 1.1 : r.poor ? 0.85 : 1))) * 100) / 100;
    setPace(p);
    try { localStorage.setItem(PACE + song.entry.id, String(p)); } catch { /* only for this visit */ }
    setItems(list => {
      const cur = list[i];
      if (!cur) return list;
      let out = list;
      // Clean: the hands-alone videos of the next step go, straight to both hands.
      if (r.perfect) {
        const next = list[i + 1];
        if (next && next.step !== cur.step && ['pattern', 'jump', 'L', 'R'].includes(next.kind)) {
          let j = i + 1;
          while (out[j] && out[j].step === next.step && out[j].phase.id === next.phase.id && ['pattern', 'jump', 'L', 'R'].includes(out[j].kind)) j++;
          if (out[j]) out = [...out.slice(0, i + 1), ...out.slice(j)];
        }
      }
      // Not clean on a both-hands video (the only hand's in a one-hand piece): the same bars on the
      // staff come next, practice mixed in where it is needed.
      if (!r.perfect && (cur.kind === 'both' || (song.hands.length < 2 && cur.kind === 'R'))) {
        const rd = readClip(cur);
        if (!out.some(x => x.id === rd.id)) out = [...out.slice(0, i + 1), rd, ...out.slice(i + 1)];
      }
      // The same place missed again and again: a video for just that spot comes next.
      if (r.fix && cur.kind !== 'fix' && cur.kind !== 'explain') {
        const fix = fixClip(song, cur, r.fix.ticks, r.fix.ms);
        if (!out.some(x => x.id === fix.id)) out = [...out.slice(0, i + 1), fix, ...out.slice(i + 1)];
      }
      return out;
    });
  };
  // Explain it slower: the part in small pieces, each hand then both, slower; then the part again.
  const explain = (i: number) => {
    setItems(list => {
      const cur = list[i];
      if (!cur || list[i + 1]?.id.startsWith(`${cur.id}-explain-`)) return list;
      const parts = explainClips(song, cur);
      return [...list.slice(0, i + 1), ...parts, { ...cur, id: `${cur.id}-again` }, ...list.slice(i + 1)];
    });
    window.setTimeout(() => goTo(i + 1), 60);
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' && active < items.length - 1) { e.preventDefault(); goTo(active + 1); }
      if (e.key === 'ArrowUp' && active > 0) { e.preventDefault(); goTo(active - 1); }
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [active, items.length, onClose]);

  return (
    <div className={`reel-screen ${embedded ? 'embedded' : ''}`}>
      {!embedded && <button className="icon-btn reel-close" onClick={onClose} aria-label={L('Close the videos', 'Fechar os vídeos')}><IconClose size={24} /></button>}
      <span className="reel-count" aria-live="polite">{active + 1}/{items.length}</span>
      <div className="reel-feed" ref={ref}>
        {items.map((r, i) => (
          <section key={r.id} data-i={i} className="reel-snap">
            {r.kind === 'read' ? (
              i === active && practice
                ? <ReadSlide key={`${r.id}-${song.entry.id}`} render={done => practice(r, () => { markSeen(song.entry.id, r.id); done(); })} />
                : <ReadStill clip={r} />
            ) : Math.abs(i - active) <= 1 && (
              <ReelPlayer song={song} reel={r} index={i} count={items.length} active={i === active} onPiano={onPiano} pace={pace} onResult={x => result(i, x)} sections={items.length > 1 ? sections : undefined} onSection={toSection} onSpeed={onSpeed}
                onPractice={() => onPractice(r, i)} onNext={i < items.length - 1 ? () => goTo(i + 1) : undefined} onExplain={() => explain(i)} />
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

/**
 * A staff item of the course in the feed: the lesson page for the bars the video just taught.
 * Passed, it says so and waits: he moves on by scrolling (the user's choice 2026-11).
 */
function ReadSlide({ render }: { render: (done: () => void) => React.ReactNode }) {
  const [done, setDone] = useState(false);
  return (
    <div className="read-slide">
      {render(() => setDone(true))}
      <AnimatePresence>
        {done && <motion.p className="read-next" role="status" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.3, ease: ARRIVE }}>{L('Nice. Swipe up for the next.', 'Boa. Desliza para cima para o seguinte.')}</motion.p>}
      </AnimatePresence>
    </div>
  );
}

/** The staff item while it is not on screen: what it is, so the scroll shows the next thing. */
function ReadStill({ clip }: { clip: Clip }) {
  return (
    <div className="read-still">
      <p className="read-still-kicker">{L('On the staff', 'Na pauta')}</p>
      <h2>{L('Read it on the staff', 'Lê na pauta')}</h2>
      <p className="fine">{clip.phase.section}, {clip.where}</p>
    </div>
  );
}

