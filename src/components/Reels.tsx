import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audioContext, loadPiano, pianoReady, playNote, stopAll, unlockAudio } from '../lib/audio';
import { onNote } from '../lib/input';
import { keyLayout, pickRange } from '../lib/keys';
import { isBlack } from '../lib/names';
import { letter, markSeen, timelineOf, type Reel, type ReelTimeline } from '../lib/reels';
import type { Hand, Song } from '../lib/types';
import { IconArrowRight, IconClose, IconKeys, IconPause, IconPlay, IconRestart } from './Icons';
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
        playNote(n.midi, Math.round(20 + n.vel * 100), Math.max(0.1, n.dur), s.start + n.t);
      }
      if (t >= tl.duration) { s.t = tl.duration; s.playing = false; setPlaying(false); onEnd(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, tl]); // eslint-disable-line react-hooks/exhaustive-deps

  return { playing, ready, now, play, pause };
}

interface Lane { hand: Hand; lo: number; hi: number; }

/** Falling notes onto a keyboard, one lane per hand (right above left), drawn every frame. */
function Lanes({ tl, lanes, now, held, flats }: { tl: ReelTimeline; lanes: Lane[]; now: () => number; held: React.RefObject<Set<number>>; flats: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext('2d')!;
    const pal = palette(cv);
    const layouts = lanes.map(l => keyLayout(l.lo, l.hi));
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
        const X = (m: number) => lay[m] ? { x: lay[m].x * W, w: lay[m].w * W } : null;
        // Lane guides at every C, like the lines of a falling-notes screen.
        ctx.fillStyle = pal.lane;
        for (let m = lane.lo; m <= lane.hi; m++) if (m % 12 === 0) { const k = X(m); if (k) ctx.fillRect(k.x, top + 6, 1, fall); }
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
          for (let m = lane.lo; m <= lane.hi; m++) {
            if (isBlack(m) !== black) continue;
            const k = X(m);
            if (!k) continue;
            const h = black ? kbH * 0.62 : kbH;
            const lit = sounding.has(m);
            const litKey = lane.hand === 'R' ? pal.keyR : pal.keyL;
            ctx.fillStyle = mine.has(m) ? pal.ok : lit ? litKey : black ? pal.black : pal.white;
            ctx.strokeStyle = pal.whiteEdge;
            ctx.lineWidth = 1;
            ctx.fillRect(k.x + (black ? 0 : 0.5), kbTop, k.w - (black ? 0 : 1), h);
            if (!black) ctx.strokeRect(k.x + 0.5, kbTop, k.w - 1, h);
            if (lit) {
              const f = sounding.get(m);
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
  }, [tl, lanes, now, held, flats]);
  return <canvas ref={ref} className="reel-lanes" aria-hidden="true" />;
}

/** Where the clock is: the segment, the bar, the note just played, the card showing (changes a few times a second). */
function usePlace(tl: ReelTimeline, now: () => number, playing: boolean) {
  const [place, setPlace] = useState({ seg: -1, playing: false, bar: 0, note: -1, card: tl.cards[0]?.kind as string | undefined });
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const t = now();
      const c = tl.cards.find(x => t >= x.t && t < x.until);
      const card = c?.kind ?? (t >= tl.duration - 0.01 ? 'end' : undefined);
      let note = -1;
      for (let i = 0; i < tl.notes.length && tl.notes[i].t <= t + 0.02; i++) note = i;
      const pass = tl.passes.find(x => t >= x.t && t < x.until);
      const seg = pass?.seg ?? c?.seg ?? -1;
      const n = tl.notes[note];
      const bar = n && n.seg === seg ? n.bar : tl.notes.find(x => x.seg === seg)?.bar ?? 0;
      const next = { seg, playing: !!pass, bar, note, card };
      setPlace(p => (p.seg === next.seg && p.playing === next.playing && p.bar === next.bar && p.note === next.note && p.card === next.card ? p : next));
      if (playing) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [tl, now, playing]);
  return place;
}

interface PlayerProps {
  song: Song;
  reel: Reel;
  index: number;
  count: number;
  active: boolean;
  onPractice: () => void;
  onNext?: () => void;
}

/**
 * One phase of the song as a TikTok-style video: a 9 by 16 frame that plays by itself when it is
 * on screen. The idea and its tricks, the left hand slow, the right hand slow, both hands at full
 * speed, then the tip. Tap to pause.
 */
export function ReelPlayer({ song, reel, count, active, onPractice, onNext }: PlayerProps) {
  const tl = useMemo(() => timelineOf(song, reel), [song, reel]);
  const lanes = useMemo<Lane[]>(() => (['R', 'L'] as Hand[]).filter(h => tl.hi[h] > 0).map(h => {
    const [lo, hi] = pickRange(tl.lo[h], tl.hi[h], 14);
    return { hand: h, lo, hi };
  }), [tl]);
  const [ended, setEnded] = useState(false);
  const clock = useReelClock(tl, active, () => { setEnded(true); markSeen(song.entry.id, reel.id); });
  const place = usePlace(tl, clock.now, clock.playing);
  const held = useRef(new Set<number>());

  // Keys he plays along light up green on the reel's keyboard.
  useEffect(() => {
    if (!active) return;
    return onNote(e => { if (e.type === 'on') held.current.add(e.midi); else held.current.delete(e.midi); });
  }, [active]);
  useEffect(() => { if (clock.playing) setEnded(false); }, [clock.playing]);

  const toggle = () => { if (clock.playing) clock.pause(); else { unlockAudio(); clock.play(); } };
  const replay = () => { unlockAudio(); setEnded(false); clock.play(0); };
  const w = reel.words;
  const seg = reel.segments[place.seg];
  const handLine = seg?.kind === 'L' ? w.L : seg?.kind === 'R' ? w.R : undefined;
  // While both hands play: the caption of the bar (or the one just before it), else the tricks in turn.
  const cue = useMemo(() => {
    if (!seg || !place.playing) return undefined;
    if (handLine) return handLine;
    for (let b = place.bar; b >= Math.max(seg.from, place.bar - 1); b--) if (w.cues[b]) return w.cues[b];
    return w.tricks.length ? w.tricks[Math.floor((place.bar - seg.from) / 2) % w.tricks.length] : undefined;
  }, [seg, place.playing, place.bar, handLine, w]);
  const chords = seg ? reel.chords.filter(c => c.bar >= seg.from && c.bar <= seg.to) : reel.chords.slice(0, 8);
  // The right hand beat by beat in the current bar, the note now playing marked.
  const groups = useMemo(() => {
    const cur = tl.notes[place.note];
    if (!cur || !seg || seg.kind === 'L') return null;
    const inBar = tl.notes.map((n, i) => ({ n, i })).filter(({ n }) => n.hand === 'R' && n.seg === cur.seg && n.bar === cur.bar);
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
  }, [tl, place.note, seg, song.fifths]);
  const pct = tl.duration ? Math.min(1, clock.now() / tl.duration) : 0;
  const bar = place.playing && place.bar ? place.bar : seg?.from ?? reel.from;
  const showTitle = place.card === 'title';
  const showLabel = place.card === 'label' && seg;
  const showEnd = ended || place.card === 'end';

  return (
    <div className={`reel-slide ${active ? 'active' : ''}`}>
      <div className="reel-frame" onClick={toggle} role="group" aria-label={`Phase ${reel.n} of ${count}: ${w.title}`}>
        <div className="reel-progress" aria-hidden="true">
          {tl.passes.map((p, i) => {
            const v = clock.now();
            const f = Math.max(0, Math.min(1, (v - p.t) / (p.until - p.t)));
            return <i key={i}><b style={{ width: `${(showEnd ? 1 : f) * 100}%` }} /></i>;
          })}
        </div>
        <header className="reel-head">
          {/* The bar being played, set as big as a poster's date: the one number to follow. */}
          <motion.b className="reel-bar" key={bar} initial={{ y: 6, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }} transition={SPRING} aria-label={`Bar ${bar}`}>{String(bar).padStart(2, '0')}</motion.b>
          <span className="reel-where">
            <small>Phase {reel.n} of {count}</small>
            <span>{w.title}</span>
            {seg && <motion.span key={seg.label} className={`reel-speed hand-${seg.kind}`} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={SPRING}>{seg.label}</motion.span>}
          </span>
        </header>
        <h2 className="reel-hook">{w.hook}</h2>
        {chords.length > 1 && (
          <ol className="reel-chords" aria-label="The bass, bar by bar">
            {chords.map((c, i) => (
              <li key={c.bar} className={c.bar === place.bar && place.playing ? 'on' : c.bar < place.bar && place.playing ? 'past' : ''}>
                {i > 0 && <span className="arrow" aria-hidden="true" />}
                <b>{c.name}</b>
              </li>
            ))}
          </ol>
        )}
        <div className="reel-stage">
          <Lanes tl={tl} lanes={lanes} now={clock.now} held={held} flats={song.fifths < 0} />
        </div>
        <div className="reel-foot">
          {groups && (
            <p className="reel-groups" aria-hidden="true">
              {groups.map((g, i) => <span key={i}>{g.map((x, j) => <b key={j} className={x.on ? 'on' : x.past ? 'past' : ''}>{x.l}</b>)}</span>)}
            </p>
          )}
          <AnimatePresence mode="wait">
            {cue && (
              <motion.p key={cue} className="reel-cue" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }} transition={SOFT}>{cue}</motion.p>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {showTitle && (
            <motion.div key="title" className="reel-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div initial={{ y: 24, scale: 0.92 }} animate={{ y: 0, scale: 1 }} transition={SPRING}>
                <small>Phase {reel.n} of {count}: {w.title}</small>
                <h3>{w.hook}</h3>
                <ul className="reel-tricks">{w.tricks.map(t => <li key={t}>{t}</li>)}</ul>
              </motion.div>
            </motion.div>
          )}
          {showLabel && (
            <motion.div key={`label-${place.seg}`} className="reel-card light" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={SPRING}>
                <h3 className={`reel-label hand-${seg.kind}`}>{seg.label}</h3>
              </motion.div>
            </motion.div>
          )}
          {showEnd && (
            <motion.div key="end" className="reel-card end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={e => e.stopPropagation()}>
              <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={SPRING}>
                <small>Your turn</small>
                <h3>{w.tip}</h3>
                <div className="reel-end-actions">
                  <button className="btn go big" onClick={onPractice}><IconKeys size={20} />Practise this phase</button>
                  {onNext && <button className="btn ghost-light" onClick={onNext}><IconArrowRight size={18} />Next phase</button>}
                  <button className="btn ghost-light" onClick={replay}><IconRestart size={18} />Watch again</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {active && !clock.playing && !showEnd && clock.ready && (
            <motion.span className="reel-paused" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={SPRING} aria-hidden="true"><IconPlay size={34} /></motion.span>
          )}
        </AnimatePresence>
        {!clock.ready && active && <span className="reel-loading" role="status">Loading the piano</span>}
        <span className="reel-time" aria-hidden="true" style={{ transform: `scaleX(${pct})` }} />
      </div>

      <aside className="reel-side">
        <button className="reel-act go" onClick={onPractice} aria-label="Practise this phase"><span><IconKeys size={26} /></span>Practise</button>
        <button className="reel-act" onClick={toggle} aria-label={clock.playing ? 'Pause' : 'Play'}><span>{clock.playing ? <IconPause size={24} /> : <IconPlay size={24} />}</span>{clock.playing ? 'Pause' : 'Play'}</button>
        <button className="reel-act" onClick={replay} aria-label="Watch again"><span><IconRestart size={24} /></span>Again</button>
        {onNext && <button className="reel-act" onClick={onNext} aria-label="Next phase"><span><IconArrowRight size={24} /></span>Next</button>}
      </aside>
    </div>
  );
}

interface FeedProps {
  /** Inside the Watch tab (no close button, the tab bar stays), instead of over the whole app. */
  embedded?: boolean;
  song: Song;
  reels: Reel[];
  start: number;
  onClose: () => void;
  onPractice: (reel: Reel, index: number) => void;
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
