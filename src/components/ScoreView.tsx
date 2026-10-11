import { useEffect, useRef, useState } from 'react';
import { buildScore, density } from '../lib/abc';
import type { Engine } from '../lib/engine';
import { cursorAt, engrave } from '../lib/engrave';
import { pressDots } from '../lib/pressDots';
import type { FingerMode } from '../lib/types';

interface Props {
  engine: Engine;
  fingers: FingerMode;
  feedback: boolean;
  /** Keep the line the cursor is on at the top of the page. */
  follow: boolean;
  title: string;
  composer?: string;
  /** Boxed labels where each section starts, matching the Teach me strip. */
  sections?: { bar: number; label: string }[];
  /** Tapped a note while stopped: start from there. */
  onSeek: (time: number) => void;
}

/** The whole song as printed sheet music, lines down the page, with a cursor that follows the music. */
export function ScoreView({ engine, fingers, feedback, follow, title, composer, sections, onSeek }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const pillsRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const width = size.w;
  const feedbackRef = useRef(feedback);
  const followRef = useRef(follow);
  const repaint = useRef<() => void>(() => {});
  feedbackRef.current = feedback;
  followRef.current = follow;

  useEffect(() => { repaint.current(); }, [feedback]);

  useEffect(() => {
    const el = hostRef.current!;
    const ro = new ResizeObserver(() => setSize({ w: Math.round(el.clientWidth), h: Math.round(el.clientHeight) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (width < 200) return;
    const host = hostRef.current!, paper = paperRef.current!, cursor = cursorRef.current!, glow = glowRef.current!;
    const song = engine.song;
    const pageW = Math.min(width - 24, 1100);
    // Read from the music stand: a grand-staff system (about 190 units) fills most of the card's
    // height, and a line holds only as many bars as stay roomy at that size.
    const scale = Math.max(0.9, Math.min(1.45, (size.h - 40) / 190));
    const perBar = Math.max(240, density(song) * 34 + 80) * scale;
    const mpl = Math.max(1, Math.min(4, Math.floor(pageW / perBar)));
    const score = buildScore(song, mpl, fingers, { sections });
    const eg = engrave(host, paper, engine, score, {
      staffwidth: (pageW - 30) / scale,
      scale,
      fit: true,
      feedback: () => feedbackRef.current,
      onClickNote: start => {
        if (engine.playing && !engine.waiting) return;
        const tk = eg.tokenAt(start);
        if (tk) onSeek(tk.time);
      },
    });
    repaint.current = eg.paintAll;
    // Section labels: abcjs boxes them square; draw them as padded pills like Simply Piano's "Intro".
    const pills = pillsRef.current!;
    pills.replaceChildren();
    const hostBox = host.getBoundingClientRect();
    paper.querySelectorAll<SVGGElement>('.abcjs-part').forEach(g => {
      const t = g.querySelector('text');
      if (!t) return;
      const r = t.getBoundingClientRect();
      const pill = document.createElement('span');
      pill.className = 'part-pill';
      pill.textContent = t.textContent ?? '';
      pill.style.transform = `translate(${r.left - hostBox.left + host.scrollLeft - 6}px, ${r.top - hostBox.top + host.scrollTop - 6}px)`;
      pills.appendChild(pill);
      g.style.visibility = 'hidden';
    });
    eg.paintAll();
    const offDots = pressDots(engine, eg, dotsRef.current!);
    const off = engine.on(e => {
      if (e.type !== 'status') return;
      if (e.ids === 'all') eg.paintAll(); else eg.paintIds(e.ids);
    });

    let raf = 0, lastLine = -1, lastStop = -1;
    const frame = () => {
      eg.paintTies(engine.time);
      const c = cursorAt(eg.stops, engine.time, eg.lines);
      if (c) {
        const box = eg.lines[c.line] ?? { top: 0, bottom: 120, right: 0 };
        cursor.style.transform = `translate(${c.x - 3}px, ${box.top - 12}px)`;
        cursor.style.height = `${box.bottom - box.top + 24}px`;
        // The notes swell as the cursor reaches them.
        const stop = eg.stops[c.i];
        if (c.i !== lastStop && engine.playing && stop && engine.time >= stop.time - 1e-3) { lastStop = c.i; eg.pulse(stop); }
        // Stuck: a soft light over the notes to play, while the keyboard shows the keys.
        const stuck = engine.hintVisible() && stop && engine.time >= stop.time - 1e-3;
        glow.classList.toggle('on', !!stuck);
        if (stuck) {
          glow.style.transform = `translate(${stop.x - 28}px, ${box.top - 20}px)`;
          glow.style.height = `${box.bottom - box.top + 40}px`;
        }
        if (c.line !== lastLine) {
          lastLine = c.line;
          if (followRef.current) host.scrollTo({ top: c.line === 0 ? 0 : Math.max(0, box.top - 36), behavior: 'smooth' });
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); off(); offDots(); repaint.current = () => {}; };
  }, [engine, width, size.h, fingers, title, composer, sections]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="score" ref={hostRef}>
      <div className="score-page">
        <header className="score-head"><h1>{title}</h1>{composer && <p>{composer}</p>}</header>
        <div ref={paperRef} />
      </div>
      <div ref={pillsRef} aria-hidden="true" />
      <div ref={glowRef} className="stuck-glow" aria-hidden="true" />
      <div ref={cursorRef} className="score-cursor" aria-hidden="true" />
      <div ref={dotsRef} className="press-dots" aria-hidden="true" />
    </div>
  );
}
