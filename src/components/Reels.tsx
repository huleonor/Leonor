import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audioContext, loadPiano, pianoReady, playNote, stopAll, unlockAudio } from '../lib/audio';
import { onNote } from '../lib/input';
import { keyLayout, pickRange } from '../lib/keys';
import { isBlack } from '../lib/names';
import { letter, markSeen, timelineOf, type Clip, type ReelLine, type ReelTimeline } from '../lib/reels';
import { hush, onVoice, pauseVoice, resumeVoice, say, setVoiceOn, speaking, unlockVoice, voiceOn, voiceSupported } from '../lib/voice';
import type { Hand, Song } from '../lib/types';
import { IconArrowDown, IconClose, IconKeys, IconPause, IconPlay, IconRestart, IconSpeaker, IconSpeakerOff } from './Icons';
import { SOFT, SPRING } from './Motion';

const LOOK = 2.4; // seconds of falling notes above the keys

/** Colours for the canvas, read from the design tokens where the canvas sits (a canvas cannot read CSS variables itself). */
function palette(el: Element) {
  const css = getComputedStyle(el);
  const v = (k: string) => css.getPropertyValue(k).trim();
  return {
    R: v('--right'), L: v('--left'), keyR: v('--right-key'), keyL: v('--left'), inkR: v('--right-ink'), inkL: v('--left-ink'),
    ok: v('--ok'), white: v('--key-white'), whiteEdge: v('--key-edge'), black: v('--key-black'),
    ink: v('--key-ink'), paper: v('--paper'), lane: v('--reel-lane'), now: v('--now-line'),
  };
}
const FACE = "'Radio Canada Big', 'Radio Canada', sans-serif";

/**
 * The reel's clock: the audio clock while it plays, so the keys and the sound never drift apart.
 * Notes are scheduled on the piano a fifth of a second ahead.
 */
function useReelClock(tl: ReelTimeline, active: boolean, onEnd: () => void) {
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(pianoReady());
  const state = useRef({ t: 0, start: 0, next: 0, playing: false });
  const now = useCallback(() => (state.current.playing ? audioContext().currentTime - state.current.start : state.current.t), []);

  const play = (from?: number) => {
    const s = state.current;
    if (from !== undefined) s.t = from;
    if (s.t >= tl.duration - 0.05) s.t = 0;
    s.start = audioContext().currentTime - s.t;
    s.next = tl.notes.findIndex(n => n.t >= s.t - 0.01);
    if (s.next < 0) s.next = tl.notes.length;
    s.playing = true;
    setPlaying(true);
  };
  const pause = () => {
    const s = state.current;
    if (!s.playing) return;
    s.t = now();
    s.playing = false;
    stopAll();
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
        // The piano steps back a little while the voice talks, like music under a voice-over.
        playNote(n.midi, Math.round((20 + n.vel * 100) * (speaking() ? 0.7 : 1)), Math.max(0.1, n.dur), s.start + n.t);
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

interface Lane { hand: Hand; lo: number; hi: number; }

/** The camera's ease both ways (power2.inOut), for a move that starts and lands. */
const inOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);

/** Falling notes onto a keyboard, one lane per hand (right above left), drawn every frame. */
/**
 * Falling notes onto a keyboard, one lane per hand (right above left), drawn every frame from the
 * clock, so any moment of the video is the same picture (it can be scrubbed). The camera opens
 * wide on the keyboard and pushes in on the keys the video is about; while the voice names notes,
 * each key lights as it is named, numbered in order, before the music plays them.
 */
function Lanes({ tl, lanes, now, held, flats, named, namedUntil }: { tl: ReelTimeline; lanes: Lane[]; now: () => number; held: React.RefObject<Set<number>>; flats: boolean; named: React.RefObject<Map<number, number>>; namedUntil: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext('2d')!;
    const pal = palette(cv);
    // Each lane is laid out wide (a few keys of context on each side) and framed on its own keys.
    const wide = lanes.map(l => pickRange(l.lo - 7, l.hi + 7, 30));
    const layouts = wide.map(([lo, hi]) => keyLayout(lo, hi));
    const frames = lanes.map((l, i) => { const lay = layouts[i]; return [lay[l.lo]?.x ?? 0, (lay[l.hi]?.x ?? 1) + (lay[l.hi]?.w ?? 0)] as [number, number]; });
    let raf = 0;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const W = cv.clientWidth, H = cv.clientHeight;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const t = now();
      const laneH = H / lanes.length;
      lanes.forEach((lane, li) => {
        const top = li * laneH;
        const kbH = Math.min(laneH * 0.42, W * 0.34);
        const kbTop = top + laneH - kbH - 4;
        const fall = kbTop - top - 6;
        const pps = fall / LOOK;
        const lay = layouts[li];
        // The push in: from the wide keyboard to the lane's own keys over the first second.
        const z = inOut(Math.max(0, Math.min(1, (t - 0.15) / 0.9)));
        const v0 = frames[li][0] * z, v1 = 1 + (frames[li][1] - 1) * z;
        const X = (m: number) => lay[m] ? { x: ((lay[m].x - v0) / (v1 - v0)) * W, w: (lay[m].w / (v1 - v0)) * W } : null;
        const [wLo, wHi] = wide[li];
        const naming = t < namedUntil ? named.current ?? new Map<number, number>() : new Map<number, number>();
        // Lane guides at every C, like the lines of a falling-notes screen.
        ctx.fillStyle = pal.lane;
        for (let m = wLo; m <= wHi; m++) if (m % 12 === 0) { const k = X(m); if (k) ctx.fillRect(k.x, top + 6, 1, fall); }
        // The notes.
        const sounding = new Map<number, number | undefined>();
        for (const n of tl.notes) {
          if (n.hand !== lane.hand) continue;
          if (n.t > t + LOOK || n.t + n.dur < t - 0.05) continue;
          const k = X(n.midi);
          if (!k) continue;
          const on = n.t <= t && n.t + n.dur > t;
          if (on) sounding.set(n.midi, n.finger);
          const yBottom = kbTop - (n.t - t) * pps;
          const yTop = Math.max(top + 6, yBottom - Math.max(8, n.dur * pps - 2));
          const yB = Math.min(kbTop, yBottom);
          if (yB <= yTop) continue;
          const pad = k.w * 0.12;
          ctx.globalAlpha = on ? 1 : 0.88;
          ctx.fillStyle = pal[lane.hand];
          ctx.fillRect(k.x + pad, yTop, k.w - pad * 2, yB - yTop);
          ctx.globalAlpha = 1;
          if (n.finger && yB - yTop > k.w * 0.8) {
            ctx.fillStyle = lane.hand === 'R' ? pal.inkR : pal.inkL;
            ctx.font = `700 ${Math.round(Math.min(18, k.w * 0.55))}px ${FACE}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(n.finger), k.x + k.w / 2, yB - k.w * 0.45);
          }
        }
        // The now line: a plain rule where the notes land.
        ctx.fillStyle = pal.now;
        ctx.fillRect(0, kbTop - 3, W, 2);
        // The keyboard: what sounds is lit in the hand's colour with its finger; what he plays is green.
        const mine = held.current ?? new Set<number>();
        for (const black of [false, true]) {
          for (let m = wLo; m <= wHi; m++) {
            if (isBlack(m) !== black) continue;
            const k = X(m);
            if (!k) continue;
            const h = black ? kbH * 0.62 : kbH;
            const order = naming.get(m);
            const lit = sounding.has(m) || order !== undefined;
            const litKey = lane.hand === 'R' ? pal.keyR : pal.keyL;
            ctx.fillStyle = mine.has(m) ? pal.ok : lit ? litKey : black ? pal.black : pal.white;
            ctx.strokeStyle = pal.whiteEdge;
            ctx.lineWidth = 1;
            ctx.fillRect(k.x + (black ? 0 : 0.5), kbTop, k.w - (black ? 0 : 1), h);
            if (!black) ctx.strokeRect(k.x + 0.5, kbTop, k.w - 1, h);
            if (lit) {
              const f = sounding.has(m) ? sounding.get(m) : order;
              const r = Math.min(11, k.w * 0.36);
              const cy = kbTop + h - r - 6;
              if (f) {
                ctx.fillStyle = pal.ink;
                ctx.fillRect(k.x + k.w / 2 - r, cy - r, r * 2, r * 2);
                ctx.fillStyle = pal.paper;
                ctx.font = `700 ${Math.round(r * 1.25)}px ${FACE}`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(String(f), k.x + k.w / 2, cy + 1);
              }
              if (!black) {
                ctx.fillStyle = lane.hand === 'R' ? pal.ink : pal.inkL;
                ctx.font = `700 ${Math.round(Math.min(14, k.w * 0.45))}px ${FACE}`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(letter(m, flats), k.x + k.w / 2, cy - r - 10);
              }
            }
          }
        }
      });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [tl, lanes, now, held, flats, named, namedUntil]);
  return <canvas ref={ref} className="reel-lanes" aria-hidden="true" />;
}

/** Where the clock is: the segment, the bar, the note just played, the card showing (changes a few times a second). */
function usePlace(tl: ReelTimeline, now: () => number, playing: boolean) {
  const [place, setPlace] = useState({ seg: -1, playing: false, bar: 0, note: -1, card: tl.cards[0]?.kind as string | undefined, line: -1 });
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
      const next = { seg, playing: !!pass, bar, note, card, line };
      setPlace(p => (p.seg === next.seg && p.playing === next.playing && p.bar === next.bar && p.note === next.note && p.card === next.card && p.line === next.line ? p : next));
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
    if (line < 0 || line === said.current || !playing) return;
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
  const lanes = useMemo<Lane[]>(() => (['R', 'L'] as Hand[]).filter(h => tl.hi[h] > 0).map(h => {
    const [lo, hi] = pickRange(tl.lo[h], tl.hi[h], 14);
    return { hand: h, lo, hi };
  }), [tl]);
  const [loops, setLoops] = useState(0);
  const [epoch, setEpoch] = useState(0);
  const clockRef = useRef<{ play: (from?: number) => void } | null>(null);
  const clock = useReelClock(tl, active, () => {
    markSeen(song.entry.id, reel.id);
    if (reel.k === reel.of) markSeen(song.entry.id, reel.phase.id);
    setLoops(n => n + 1);
    // TikTok: it starts again by itself, from the music.
    window.setTimeout(() => clockRef.current?.play(tl.loopFrom), 0);
  });
  clockRef.current = clock;
  const place = usePlace(tl, clock.now, clock.playing);
  const voice = useNarration(tl, place.line, clock.playing, active, epoch);
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
  const chords = reel.chords;
  // The right hand beat by beat in the current bar, the note now playing marked.
  const groups = useMemo(() => {
    const cur = tl.notes[place.note];
    if (!cur || seg.kind === 'L') return null;
    const inBar = tl.notes.map((n, i) => ({ n, i })).filter(({ n }) => n.hand === 'R' && n.bar === cur.bar);
    if (!inBar.length) return null;
    const onsets: { i: number; m: number; beat: number }[] = [];
    for (const { n, i } of inBar) {
      const last = onsets[onsets.length - 1];
      if (last && Math.abs(tl.notes[last.i].t - n.t) < 0.02) { if (n.midi > last.m) { last.m = n.midi; last.i = i; } continue; }
      onsets.push({ i, m: n.midi, beat: n.beat });
    }
    const by = new Map<number, typeof onsets>();
    for (const o of onsets) by.set(o.beat, [...(by.get(o.beat) ?? []), o]);
    const curT = cur.t;
    return [...by.values()].map(g => g.map(o => ({ l: letter(o.m, song.fifths < 0), on: Math.abs(tl.notes[o.i].t - curT) < 0.02 || (cur.hand === 'R' && o.i === place.note), past: tl.notes[o.i].t < curT - 0.02 })));
  }, [tl, place.note, seg.kind, song.fifths]);
  const pass = tl.passes[0];
  const pct = pass ? Math.max(0, Math.min(1, (clock.now() - pass.t) / (pass.until - pass.t))) : 0;
  const bar = place.playing && place.bar ? place.bar : seg.from;
  const showTitle = place.card === 'title' && loops === 0;

  return (
    <div className={`reel-slide ${active ? 'active' : ''}`}>
      <div className="reel-frame" onClick={toggle} role="group" aria-label={`Phase ${reel.n}, video ${reel.k} of ${reel.of}: ${reel.head}`}>
        <div className="reel-progress" aria-hidden="true">
          {Array.from({ length: reel.of }, (_, i) => <i key={i}><b style={{ width: `${i < reel.k - 1 ? 100 : i === reel.k - 1 ? pct * 100 : 0}%` }} /></i>)}
        </div>
        <header className="reel-head">
          {/* The bar being played, set as big as a poster's date: the one number to follow. */}
          <motion.b className="reel-bar" key={bar} initial={{ y: 8, opacity: 0, filter: 'blur(4px)' }} animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }} transition={{ duration: 0.35, ease: ARRIVE }} aria-label={`Bar ${bar}`}>{String(bar).padStart(2, '0')}</motion.b>
          <span className="reel-where">
            <small>Phase {reel.n}, {reel.k} of {reel.of}</small>
            <span>{w.title}</span>
            <motion.span key={seg.label} className={`reel-speed hand-${seg.kind}`} initial={{ opacity: 0, filter: 'blur(4px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} transition={{ duration: 0.2, ease: ARRIVE }}>{seg.label}</motion.span>
            {loops > 0 && <motion.small key={loops} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25, ease: ARRIVE }}>Round {loops + 1}</motion.small>}
          </span>
        </header>
        <h2 className="reel-hook">{reel.head}</h2>
        {chords.length > 1 && (
          <ol className="reel-chords" aria-label="The bass, bar by bar">
            {chords.map(c => (
              <li key={c.bar} className={c.bar === place.bar && place.playing ? 'on' : c.bar < place.bar && place.playing ? 'past' : ''}><b>{c.name}</b></li>
            ))}
          </ol>
        )}
        <div className="reel-stage">
          <Lanes tl={tl} lanes={lanes} now={clock.now} held={held} flats={song.fifths < 0} named={named} namedUntil={firstNote} />
        </div>
        <div className="reel-foot">
          {groups && (
            <p className="reel-groups" aria-hidden="true">
              {groups.map((g, i) => <span key={i}>{g.map((x, j) => <b key={j} className={x.on ? 'on' : x.past ? 'past' : ''}>{x.l}</b>)}</span>)}
            </p>
          )}
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
          {active && !clock.playing && clock.ready && (
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

      <aside className="reel-side">
        <button className="reel-act go" onClick={onPractice} aria-label={`Practise phase ${reel.n}`}><span><IconKeys size={26} /></span>Practise</button>
        <button className="reel-act" onClick={toggle} aria-label={clock.playing ? 'Pause' : 'Play'}><span>{clock.playing ? <IconPause size={24} /> : <IconPlay size={24} />}</span>{clock.playing ? 'Pause' : 'Play'}</button>
        <button className="reel-act" onClick={replay} aria-label="From the start, with the voice"><span><IconRestart size={24} /></span>Again</button>
        {voiceSupported() && (
          <button className="reel-act" onClick={e => { e.stopPropagation(); unlockVoice(); setVoiceOn(!voice.on); }} aria-pressed={voice.on} aria-label={voice.on ? 'Turn the voice off' : 'Turn the voice on'}>
            <span>{voice.on ? <IconSpeaker size={24} /> : <IconSpeakerOff size={24} />}</span>Voice
          </button>
        )}
        {onNext && <button className="reel-act" onClick={onNext} aria-label="Next video"><span><IconArrowDown size={24} /></span>Next</button>}
      </aside>
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
}

/** The song's reels in a vertical feed: swipe up for the next one, TikTok style. */
export function ReelFeed({ embedded, song, reels, start, onClose, onPractice }: FeedProps) {
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
