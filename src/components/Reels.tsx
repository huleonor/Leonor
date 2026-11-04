import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audioContext, loadPiano, pianoReady, playNote, playSfx, stopAll, stopSfx, unlockAudio } from '../lib/audio';
import { linkState, onLinkState, onNote } from '../lib/input';
import { keyLayout, pickRange } from '../lib/keys';
import { isBlack } from '../lib/names';
import { FALL, letter, markSeen, timelineOf, type Clip, type ReelLine, type ReelNote, type ReelTimeline } from '../lib/reels';
import { anyVoice, hush, onVoice, pauseVoice, prepareVoice, resumeVoice, say, setVoiceOn, speaking, unlockVoice, voiceOn } from '../lib/voice';
import type { Hand, Song } from '../lib/types';
import { IconArrowDown, IconCheck, IconClose, IconKeys, IconPause, IconPlay, IconRestart, IconSpeaker, IconSpeakerOff } from './Icons';
import { SOFT, SPRING } from './Motion';

const LOOK = FALL; // seconds of falling notes above the keys

/** Colours for the canvas, read from the design tokens where the canvas sits (a canvas cannot read CSS variables itself). */
function palette(el: Element) {
  const css = getComputedStyle(el);
  const v = (k: string) => css.getPropertyValue(k).trim();
  return {
    R: v('--right'), L: v('--left'), keyR: v('--right-key'), keyL: v('--left'), inkR: v('--right-ink'), inkL: v('--left-ink'),
    ok: v('--ok'), white: v('--key-white'), whiteEdge: v('--key-edge'), black: v('--key-black'),
    ink: v('--key-ink'), paper: v('--paper'), tR: v('--pink-text'), tL: v('--teal-text'), lane: v('--reel-lane'), now: v('--now-line'),
  };
}
const FACE = "'Helvetica Neue', Helvetica, Arial, sans-serif";

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

  // The reel starts once the piano is loaded, or after three seconds without it (it plays silent
  // until the sound arrives, rather than leaving him waiting on a still frame).
  useEffect(() => {
    if (ready) return;
    loadPiano().then(() => setReady(true)).catch(() => setReady(true));
    const t = window.setTimeout(() => setReady(true), 3000);
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
        playNote(n.midi, Math.round((20 + n.vel * 100) * (n.train ? 0.4 : speaking() ? 0.7 : 1)), Math.max(0.1, n.dur), s.start + n.t);
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
function Lanes({ tl, range, now, held, flats, named, namedUntil }: { tl: ReelTimeline; range: [number, number]; now: () => number; held: React.RefObject<Set<number>>; flats: boolean; named: React.RefObject<Map<number, number>>; namedUntil: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext('2d')!;
    const pal = palette(cv);
    const [lo, hi] = range;
    const [wLo, wHi] = pickRange(lo - 7, hi + 7, 30);
    const lay = keyLayout(wLo, wHi);
    const frame: [number, number] = [lay[lo]?.x ?? 0, (lay[hi]?.x ?? 1) + (lay[hi]?.w ?? 0)];
    // Which hand plays each key in this video (for the colour of a key the voice names).
    const handOf = new Map<number, Hand>();
    for (const n of tl.notes) if (!handOf.has(n.midi)) handOf.set(n.midi, n.hand);
    let raf = 0;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const W = cv.clientWidth, H = cv.clientHeight;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const t = now();
      const z = inOut(Math.max(0, Math.min(1, (t - 0.15) / 0.9)));
      const v0 = frame[0] * z, v1 = 1 + (frame[1] - 1) * z;
      const X = (m: number) => lay[m] ? { x: ((lay[m].x - v0) / (v1 - v0)) * W, w: (lay[m].w / (v1 - v0)) * W } : null;
      const unitW = (X(60)?.w ?? W / 20);
      const kbH = Math.min(H * 0.36, unitW * 5.2);
      const kbTop = H - kbH;
      const fall = kbTop - 4, pps = fall / LOOK;
      const colour = (h: Hand) => (h === 'L' ? pal.L : pal.R);
      // Octave guides at every C.
      ctx.fillStyle = pal.lane;
      for (let m = wLo; m <= wHi; m++) if (m % 12 === 0) { const k = X(m); if (k) ctx.fillRect(k.x, 0, 1, fall); }
      // The notes.
      const sounding = new Map<number, ReelNote>();
      for (const n of tl.notes) {
        if (n.t > t + LOOK || n.t + n.dur < t - 0.05) continue;
        // His turn's notes start falling only once the count-in (1, 2, 3) is over.
        if (n.train && tl.countIn && t < tl.countIn.t + tl.countIn.n * tl.countIn.beat) continue;
        const k = X(n.midi);
        if (!k) continue;
        const on = n.t <= t && n.t + n.dur > t;
        if (on) sounding.set(n.midi, n);
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
          ctx.font = `900 ${Math.round(Math.min(17, bw * 0.55))}px ${FACE}`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
          ctx.fillText(letter(n.midi, flats), k.x + k.w / 2, yB - 7);
        }
      }
      // The now line.
      ctx.fillStyle = pal.now;
      ctx.fillRect(0, kbTop - 4, W, 3);
      // The keys.
      const naming = t < namedUntil ? named.current ?? new Map<number, number>() : new Map<number, number>();
      const mine = held.current ?? new Set<number>();
      for (const black of [false, true]) {
        for (let m = wLo; m <= wHi; m++) {
          if (isBlack(m) !== black) continue;
          const k = X(m);
          if (!k || k.x + k.w < -2 || k.x > W + 2) continue;
          const h = black ? kbH * 0.62 : kbH;
          const s = sounding.get(m), order = naming.get(m), hand = s?.hand ?? handOf.get(m) ?? (m < 60 ? 'L' : 'R');
          ctx.fillStyle = mine.has(m) ? pal.ok : s ? colour(s.hand) : black ? pal.black : pal.white;
          ctx.fillRect(k.x + (black ? 0 : 0.5), kbTop, k.w - (black ? 0 : 1), h);
          if (!black) { ctx.strokeStyle = pal.whiteEdge; ctx.lineWidth = 1; ctx.strokeRect(k.x + 0.5, kbTop, k.w - 1, h); }
          if (!s && order !== undefined) { ctx.strokeStyle = colour(hand); ctx.lineWidth = Math.max(3, k.w * 0.12); ctx.strokeRect(k.x + 3, kbTop + 3, k.w - 6, h - 6); }
          if (s || order !== undefined) {
            ctx.fillStyle = mine.has(m) ? pal.paper : s ? pal.ink : hand === 'L' ? pal.tL : pal.tR;
            ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.font = `900 ${Math.round(Math.min(22, k.w * 0.5))}px ${FACE}`;
            ctx.fillText(letter(m, flats), k.x + k.w / 2, kbTop + h - 10);
            const top = s?.finger ?? order;
            if (top) { ctx.font = `700 ${Math.round(Math.min(15, k.w * 0.36))}px ${FACE}`; ctx.fillText(String(top), k.x + k.w / 2, kbTop + 20); }
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
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [tl, range, now, held, flats, named, namedUntil]);
  return <canvas ref={ref} className="reel-lanes" aria-hidden="true" />;
}

/** Where the clock is: the segment, the bar, the note just played, the card showing (changes a few times a second). */
function usePlace(tl: ReelTimeline, now: () => number, playing: boolean) {
  const [place, setPlace] = useState({ seg: -1, playing: false, bar: 0, note: -1, card: tl.cards[0]?.kind as string | undefined, line: -1, count: 0, train: false });
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
      const ci = tl.countIn;
      const count = ci && t >= ci.t && t < ci.t + ci.n * ci.beat ? Math.floor((t - ci.t) / ci.beat) + 1 : 0;
      const train = !!ci && t >= ci.t && (!tl.train || t < tl.train.until + 0.5);
      const next = { seg, playing: !!pass, bar, note, card, line, count, train };
      setPlace(p => (p.seg === next.seg && p.playing === next.playing && p.bar === next.bar && p.note === next.note && p.card === next.card && p.line === next.line && p.count === next.count && p.train === next.train ? p : next));
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
          <motion.span key={i} className={i === at ? 'on' : i < at ? 'past' : ''} initial={{ opacity: 0, filter: 'blur(6px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} transition={{ duration: 0.13, delay: j * 0.07, ease: ARRIVE }}>{words[i].w} </motion.span>
        ))}
      </motion.p>
    </AnimatePresence>
  );
}

interface PlayerProps {
  song: Song;
  reel: Clip;
  index: number;
  count: number;
  active: boolean;
  onPractice: () => void;
  onNext?: () => void;
}

/**
 * One small step of the song as a TikTok-style video: it plays by itself when it is on screen and
 * loops until he scrolls on, so he copies it on his piano as many times as he likes. The voice
 * says it once; the loops are the music alone. Tap to pause.
 */
export function ReelPlayer({ song, reel, active, onPractice, onNext }: PlayerProps) {
  const tl = useMemo(() => timelineOf(song, reel), [song, reel]);
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
    markSeen(song.entry.id, reel.id);
    if (reel.k === reel.of) markSeen(song.entry.id, reel.phase.id);
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
  const release = () => { setHolding(false); setReps(0); unlockAudio(); if (tl.hold) clock.play(tl.hold.t + 0.01); };
  const trainAgain = () => { setHolding(false); setReps(0); unlockAudio(); if (tl.countIn) clock.play(tl.countIn.t - 0.2); };
  useEffect(() => { if (!active) { setHolding(false); setReps(0); } }, [active]);
  // Is a piano connected? Then his runs are counted; otherwise he says when he is done.
  const anyOn = (st: ReturnType<typeof linkState>) => Object.values(st).some(x => x.status === 'on');
  const [inputOn, setInputOn] = useState(() => anyOn(linkState()));
  useEffect(() => onLinkState(st => setInputOn(anyOn(st))), []);
  // His runs, note group by note group: a clean run is every group in order with at most two slips.
  const groupsToPlay = useMemo(() => {
    const out: { t: number; ms: Set<number> }[] = [];
    for (const n of tl.notes) if (n.train) { const g = out[out.length - 1]; if (g && Math.abs(g.t - n.t) < 0.03) g.ms.add(n.midi); else out.push({ t: n.t, ms: new Set([n.midi]) }); }
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
  useEffect(() => { follow.current = { i: 0, have: new Set() }; }, [tl]);
  useEffect(() => {
    if (!active || !inputOn || !tl.train || !groupsToPlay.length) return;
    const c = () => clockRef.current!;
    const off = onNote(e => {
      if (e.type !== 'on') return;
      const f = follow.current, g = groupsToPlay[f.i];
      if (!g || c().now() < g.t - 0.45) return;
      if (!g.ms.has(e.midi)) return;
      f.have.add(e.midi);
      if (![...g.ms].every(m => f.have.has(m))) return;
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
      if (g && !waitingRef.current && c().playing && t > g.t + 0.25 && t < g.t + 1.5) {
        waitingRef.current = true;
        waitRef.current = new Map([...g.ms].map((m, k) => [m, k + 1]));
        setWaitingFor(g.ms);
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
  const held = useRef(new Set<number>());
  useEffect(() => { if (!active) setLoops(0); }, [active]);

  // Keys he plays along light up green on the reel's keyboard.
  useEffect(() => {
    if (!active) return;
    return onNote(e => { if (e.type === 'on') held.current.add(e.midi); else held.current.delete(e.midi); });
  }, [active]);

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
        const m = /^([A-G](?:#|b)?)[,.:;]?$/.exec(w);
        if (!m) continue;
        let i = tl.notes.findIndex((x, k) => k >= ptr && letter(x.midi, flats) === m[1]);
        if (i < 0) i = tl.notes.findIndex(x => letter(x.midi, flats) === m[1]);
        if (i < 0) continue;
        ptr = i + 1;
        if (!map.has(tl.notes[i].midi)) map.set(tl.notes[i].midi, ++n);
      }
    }
    named.current = map;
  }, [sayLine, spoken.at, spoken.words, tl, song.fifths]);
  const firstNote = tl.notes[0]?.t ?? 0;
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
  const bar = place.playing && place.bar ? place.bar : seg.from;
  const showTitle = place.card === 'title' && loops === 0;
  // Where in the teaching the video is: the count-in, his turn, or the music shown.
  const beatNo = place.count;
  const counting = beatNo > 0;
  const training = place.train;
  const label = waitingFor ? `Your turn: play ${[...waitingFor].map(m => letter(m, song.fifths < 0)).join(' ')}` : holding ? 'On your own' : training ? (loops > 0 ? `Train with me, round ${loops + 1}` : 'Train with me') : seg.label;

  return (
    <div className={`reel-slide ${active ? 'active' : ''}`}>
      <div className="reel-frame" onClick={toggle} role="group" aria-label={`Phase ${reel.n}, video ${reel.k} of ${reel.of}: ${reel.head}`}>
        <div className="reel-progress" aria-hidden="true">
          {Array.from({ length: reel.of }, (_, i) => <i key={i}><b style={{ width: `${i < reel.k - 1 ? 100 : i === reel.k - 1 ? pct * 100 : 0}%` }} /></i>)}
        </div>
        {/* Set like the Für Elise TikToks: the step's kicker small, its notes huge, nothing else. */}
        <header className="reel-head">
          <motion.p key={label} className="reel-kicker" initial={{ opacity: 0, filter: 'blur(6px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} transition={{ duration: 0.18, ease: ARRIVE }}>{label}</motion.p>
          <h2 className={`reel-hook hand-${seg.kind} ${reel.head.split(' ').some(x => !/^[A-G](?:#|b)?m?$/.test(x) && x !== 'octaves') ? 'words' : ''}`}>{reel.head.split(' ').map((x, i) => <motion.span key={`${reel.id}-${i}`} initial={{ opacity: 0, filter: 'blur(6px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} transition={{ duration: 0.13, delay: 0.1 + i * 0.067, ease: ARRIVE }}>{x} </motion.span>)}</h2>
          <p className="reel-meta">Phase {reel.n}, {reel.k} of {reel.of}. Bar {bar}</p>
        </header>
        <div className="reel-stage">
          <Lanes tl={tl} range={range} now={clock.now} held={held} flats={song.fifths < 0} named={waitingFor ? waitRef : named} namedUntil={waitingFor ? Infinity : firstNote} />
        </div>
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

        <AnimatePresence>
          {showTitle && (
            <motion.div key="title" className="reel-card" initial={{ opacity: 1 }} exit={{ opacity: 0, filter: 'blur(8px)', transition: { duration: 0.18, ease: LEAVE } }}>
              <div>
                <motion.small initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>Phase {reel.n}: {w.title}</motion.small>
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
        {!clock.ready && active && <span className="reel-loading" role="status">Loading the piano</span>}
        {/* Scrub: drag along the bottom to go back to any moment, like TikTok. */}
        <div className="reel-scrub" role="slider" aria-label="Where in the video" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)} tabIndex={0}
          onClick={e => e.stopPropagation()}
          onKeyDown={e => { if (e.key === 'ArrowLeft') clock.seek(clock.now() - 2); if (e.key === 'ArrowRight') clock.seek(clock.now() + 2); }}
          onPointerDown={e => { e.stopPropagation(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); hush(); const r = e.currentTarget.getBoundingClientRect(); clock.seek(pass.t + (pass.until - pass.t) * ((e.clientX - r.left) / r.width)); }}
          onPointerMove={e => { if (!e.buttons) return; const r = e.currentTarget.getBoundingClientRect(); clock.seek(pass.t + (pass.until - pass.t) * Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))); }}>
          <span className="reel-time" aria-hidden="true" style={{ transform: `scaleX(${pct})` }} />
        </div>
      </div>

      {/* The actions show only when he pauses, sliding in from the edge, so the video stays clear. */}
      <AnimatePresence>
        {active && !clock.playing && !holding && !waitingFor && (
          <motion.aside key="side" className="reel-side" initial={{ x: 70, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 70, opacity: 0, transition: { duration: 0.14, ease: LEAVE } }} transition={{ duration: 0.3, ease: ARRIVE }}>
            <button className="reel-act go" onClick={onPractice} aria-label={`Practise phase ${reel.n}`}><span><IconKeys size={26} /></span>Practise</button>
            <button className="reel-act" onClick={toggle} aria-label={clock.playing ? 'Pause' : 'Play'}><span>{clock.playing ? <IconPause size={24} /> : <IconPlay size={24} />}</span>{clock.playing ? 'Pause' : 'Play'}</button>
            <button className="reel-act" onClick={replay} aria-label="From the start, with the voice"><span><IconRestart size={24} /></span>Again</button>
            {anyVoice() && (
              <button className="reel-act" onClick={e => { e.stopPropagation(); unlockVoice(); setVoiceOn(!voice.on); }} aria-pressed={voice.on} aria-label={voice.on ? 'Turn the voice off' : 'Turn the voice on'}>
                <span>{voice.on ? <IconSpeaker size={24} /> : <IconSpeakerOff size={24} />}</span>Voice
              </button>
            )}
            {onNext && <button className="reel-act" onClick={onNext} aria-label="Next video"><span><IconArrowDown size={24} /></span>Next</button>}
          </motion.aside>
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
  const held = useRef(new Set<number>()), named = useRef(new Map<number, number>());
  const seg = reel.segments[0];
  const words = reel.head.split(' ').some(x => !/^[A-G](?:#|b)?m?$/.test(x) && x !== 'octaves');
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
  onActive?: (index: number) => void;
}

/** The song's reels in a vertical feed: swipe up for the next one, TikTok style. */
export function ReelFeed({ embedded, song, reels, start, onClose, onPractice, onActive }: FeedProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(start);
  useEffect(() => {
    const el = ref.current!;
    el.scrollTo({ top: start * el.clientHeight });
    const io = new IntersectionObserver(es => {
      for (const e of es) if (e.isIntersecting && e.intersectionRatio > 0.6) setActive(Number((e.target as HTMLElement).dataset.i));
    }, { root: el, threshold: [0.6] });
    el.querySelectorAll('[data-i]').forEach(s => io.observe(s));
    return () => io.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { onActive?.(active); }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  const goTo = (i: number) => { const el = ref.current!; el.scrollTo({ top: i * el.clientHeight, behavior: 'smooth' }); };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' && active < reels.length - 1) { e.preventDefault(); goTo(active + 1); }
      if (e.key === 'ArrowUp' && active > 0) { e.preventDefault(); goTo(active - 1); }
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [active, reels.length, onClose]);

  return (
    <div className={`reel-screen ${embedded ? 'embedded' : ''}`}>
      {!embedded && <button className="icon-btn reel-close" onClick={onClose} aria-label="Close the videos"><IconClose size={24} /></button>}
      <span className="reel-count" aria-live="polite">{active + 1}/{reels.length}</span>
      <div className="reel-feed" ref={ref}>
        {reels.map((r, i) => (
          <section key={r.id} data-i={i} className="reel-snap">
            {Math.abs(i - active) <= 1 && (
              <ReelPlayer song={song} reel={r} index={i} count={reels.length} active={i === active}
                onPractice={() => onPractice(r, i)} onNext={i < reels.length - 1 ? () => goTo(i + 1) : undefined} />
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
