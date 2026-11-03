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

/** Colours for the canvas, read from the design tokens (a canvas cannot read CSS variables itself). */
function palette() {
  const css = getComputedStyle(document.documentElement);
  const v = (k: string) => css.getPropertyValue(k).trim();
  return {
    R: v('--right'), L: v('--left'), ok: v('--ok'), white: v('--key-white'), whiteEdge: v('--key-edge'), black: v('--key-black'),
    ink: v('--key-ink'), lane: v('--reel-lane'), now: v('--now-line'), fingerInk: v('--on-blue'),
  };
}

const kindLabel = (r: Reel) => (r.kind === 'intro' ? 'Listen' : r.kind === 'L' ? 'Left hand' : r.kind === 'R' ? 'Right hand' : 'Both hands');

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

  useEffect(() => { if (!ready) loadPiano().then(() => setReady(true)).catch(() => setReady(true)); }, [ready]);
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
function Lanes({ tl, lanes, now, held }: { tl: ReelTimeline; lanes: Lane[]; now: () => number; held: React.RefObject<Set<number>> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext('2d')!;
    const pal = palette();
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
          ctx.beginPath();
          ctx.roundRect(k.x + pad, yTop, k.w - pad * 2, yB - yTop, Math.min(8, k.w / 3));
          ctx.fill();
          ctx.globalAlpha = 1;
          if (n.finger && yB - yTop > k.w * 0.8) {
            ctx.fillStyle = pal.fingerInk;
            ctx.font = `900 ${Math.round(Math.min(18, k.w * 0.55))}px Nunito Variable, Nunito, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(n.finger), k.x + k.w / 2, yB - k.w * 0.45);
          }
        }
        // The now line, Simply Piano's glowing bar.
        ctx.fillStyle = pal.now;
        ctx.shadowColor = pal.now;
        ctx.shadowBlur = 12;
        ctx.fillRect(0, kbTop - 3, W, 3);
        ctx.shadowBlur = 0;
        // The keyboard: what sounds is lit in the hand's colour with its finger; what he plays is green.
        const mine = held.current ?? new Set<number>();
        for (const black of [false, true]) {
          for (let m = lane.lo; m <= lane.hi; m++) {
            if (isBlack(m) !== black) continue;
            const k = X(m);
            if (!k) continue;
            const h = black ? kbH * 0.62 : kbH;
            const lit = sounding.has(m);
            ctx.fillStyle = mine.has(m) ? pal.ok : lit ? pal[lane.hand] : black ? pal.black : pal.white;
            ctx.strokeStyle = pal.whiteEdge;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(k.x + (black ? 0 : 0.5), kbTop, k.w - (black ? 0 : 1), h, [0, 0, 5, 5]);
            ctx.fill();
            if (!black) ctx.stroke();
            if (lit) {
              const f = sounding.get(m);
              const r = Math.min(11, k.w * 0.36);
              const cy = kbTop + h - r - 6;
              if (f) {
                ctx.fillStyle = pal.white;
                ctx.beginPath(); ctx.arc(k.x + k.w / 2, cy, r, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = pal.ink;
                ctx.font = `900 ${Math.round(r * 1.25)}px Nunito Variable, Nunito, sans-serif`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(String(f), k.x + k.w / 2, cy + 1);
              }
              if (!black) {
                ctx.fillStyle = pal.fingerInk;
                ctx.font = `900 ${Math.round(Math.min(14, k.w * 0.45))}px Nunito Variable, Nunito, sans-serif`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(letter(m), k.x + k.w / 2, cy - r - 10);
              }
            }
          }
        }
      });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [tl, lanes, now, held]);
  return <canvas ref={ref} className="reel-lanes" aria-hidden="true" />;
}

/** The bar and beat under the clock, for the captions and the strips (changes a few times a second). */
function usePlace(tl: ReelTimeline, now: () => number, playing: boolean) {
  const [place, setPlace] = useState({ pass: -1, bar: 0, note: -1, card: tl.cards[0]?.kind as string | undefined });
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const t = now();
      const card = tl.cards.find(c => t >= c.t && t < c.until)?.kind ?? (t >= tl.duration - 0.01 ? 'end' : undefined);
      let note = -1;
      for (let i = 0; i < tl.notes.length && tl.notes[i].t <= t + 0.02; i++) note = i;
      const n = tl.notes[note];
      const pass = tl.passes.findIndex(p => t >= p.t && t < p.until);
      const next = { pass, bar: n && n.pass === pass ? n.bar : tl.notes.find(x => x.pass === pass)?.bar ?? 0, note, card };
      setPlace(p => (p.pass === next.pass && p.bar === next.bar && p.note === next.note && p.card === next.card ? p : next));
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

/** One reel: a 9 by 16 frame that plays by itself when it is on screen. Tap to pause. */
export function ReelPlayer({ song, reel, index, count, active, onPractice, onNext }: PlayerProps) {
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
  const pass = tl.passes[place.pass];
  const speedLabel = pass ? (pass.speed < 1 ? 'Slow' : 'Full speed') : tl.passes.length > 1 ? 'Slow first' : 'Full speed';
  const cue = [...reel.words.cues].reverse().find(c => c.bar <= place.bar && c.bar >= reel.from) ?? (place.pass >= 0 ? reel.words.cues[0] : undefined);
  // The right hand beat by beat in the current bar, the note now playing marked.
  const groups = useMemo(() => {
    const cur = tl.notes[place.note];
    if (!cur || reel.kind === 'L') return null;
    const inBar = tl.notes.map((n, i) => ({ n, i })).filter(({ n }) => n.hand === 'R' && n.pass === cur.pass && n.bar === cur.bar);
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
    return [...by.values()].map(g => g.map(o => ({ l: letter(o.m), on: Math.abs(tl.notes[o.i].t - curT) < 0.02 || (cur.hand === 'R' && o.i === place.note), past: tl.notes[o.i].t < curT - 0.02 })));
  }, [tl, place.note, reel.kind]);
  const pct = tl.duration ? Math.min(1, clock.now() / tl.duration) : 0;
  const showTitle = place.card === 'title';
  const showSpeed = place.card === 'speed';
  const showEnd = ended || place.card === 'end';

  return (
    <div className={`reel-slide ${active ? 'active' : ''}`}>
      <div className="reel-frame" onClick={toggle} role="group" aria-label={`Video ${index + 1} of ${count}: ${reel.words.title}`}>
        <div className="reel-progress" aria-hidden="true">
          {tl.passes.map((p, i) => {
            const v = clock.now();
            const f = Math.max(0, Math.min(1, (v - p.t) / (p.until - p.t)));
            return <i key={i}><b style={{ width: `${(showEnd ? 1 : f) * 100}%` }} /></i>;
          })}
        </div>
        <header className="reel-head">
          <span className="reel-kicker">{reel.part ? `Part ${reel.part}` : 'The song'}<i>{kindLabel(reel)}</i></span>
          <motion.span key={speedLabel} className={`reel-speed ${pass?.speed === 1 ? 'full' : ''}`} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={SPRING}>{speedLabel}</motion.span>
        </header>
        <h2 className="reel-hook">{reel.words.hook}</h2>
        {reel.chords.length > 1 && (
          <ol className="reel-chords" aria-label="The bass, bar by bar">
            {reel.chords.map((c, i) => (
              <li key={c.bar} className={c.bar === place.bar && place.pass >= 0 ? 'on' : c.bar < place.bar && place.pass >= 0 ? 'past' : ''}>
                {i > 0 && <span className="arrow" aria-hidden="true" />}
                <b>{c.name}</b>
              </li>
            ))}
          </ol>
        )}
        <div className="reel-stage">
          <Lanes tl={tl} lanes={lanes} now={clock.now} held={held} />
        </div>
        <div className="reel-foot">
          {groups && (
            <p className="reel-groups" aria-hidden="true">
              {groups.map((g, i) => <span key={i}>{g.map((x, j) => <b key={j} className={x.on ? 'on' : x.past ? 'past' : ''}>{x.l}</b>)}</span>)}
            </p>
          )}
          <AnimatePresence mode="wait">
            {cue && place.pass >= 0 && (
              <motion.p key={cue.text} className="reel-cue" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }} transition={SOFT}>{cue.text}</motion.p>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {showTitle && (
            <motion.div key="title" className="reel-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div initial={{ y: 24, scale: 0.92 }} animate={{ y: 0, scale: 1 }} transition={SPRING}>
                <small>{reel.words.title}</small>
                <h3>{reel.words.hook}</h3>
                <p>{tl.passes.length > 1 ? 'Slow first, then at full speed' : 'Watch the keys light up'}</p>
              </motion.div>
            </motion.div>
          )}
          {showSpeed && (
            <motion.div key="speed" className="reel-card light" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.h3 initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={SPRING}>Now at full speed</motion.h3>
            </motion.div>
          )}
          {showEnd && (
            <motion.div key="end" className="reel-card end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={e => e.stopPropagation()}>
              <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={SPRING}>
                <small>Your turn</small>
                <h3>{reel.words.tip}</h3>
                <div className="reel-end-actions">
                  <button className="btn go big" onClick={onPractice}><IconKeys size={20} />{reel.kind === 'intro' ? 'Start learning' : 'Practise it'}</button>
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
        <button className="reel-act go" onClick={onPractice} aria-label="Practise this part"><span><IconKeys size={26} /></span>Practise</button>
        <button className="reel-act" onClick={toggle} aria-label={clock.playing ? 'Pause' : 'Play'}><span>{clock.playing ? <IconPause size={24} /> : <IconPlay size={24} />}</span>{clock.playing ? 'Pause' : 'Play'}</button>
        <button className="reel-act" onClick={replay} aria-label="Watch again"><span><IconRestart size={24} /></span>Again</button>
        {onNext && <button className="reel-act" onClick={onNext} aria-label="Next video"><span><IconArrowRight size={24} /></span>Next</button>}
      </aside>
    </div>
  );
}

interface FeedProps {
  song: Song;
  reels: Reel[];
  start: number;
  onClose: () => void;
  onPractice: (reel: Reel, index: number) => void;
}

/** The song's reels in a vertical feed: swipe up for the next one, TikTok style. */
export function ReelFeed({ song, reels, start, onClose, onPractice }: FeedProps) {
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
    <div className="reel-screen">
      <button className="icon-btn reel-close" onClick={onClose} aria-label="Close the videos"><IconClose size={24} /></button>
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
