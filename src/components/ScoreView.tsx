import { useEffect, useRef, useState } from 'react';
import { buildScore, density } from '../lib/abc';
import type { Engine } from '../lib/engine';
import { cursorAt, engrave } from '../lib/engrave';
import type { FingerMode } from '../lib/types';

interface Props {
  engine: Engine;
  fingers: FingerMode;
  feedback: boolean;
  /** Keep the line the cursor is on at the top of the page. */
  follow: boolean;
  title: string;
  composer?: string;
  /** Tapped a note while stopped: start from there. */
  onSeek: (time: number) => void;
}

/** The whole song as printed sheet music, lines down the page, with a cursor that follows the music. */
export function ScoreView({ engine, fingers, feedback, follow, title, composer, onSeek }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const feedbackRef = useRef(feedback);
  const followRef = useRef(follow);
  const repaint = useRef<() => void>(() => {});
  feedbackRef.current = feedback;
  followRef.current = follow;

  useEffect(() => { repaint.current(); }, [feedback]);

  useEffect(() => {
    const el = hostRef.current!;
    const ro = new ResizeObserver(() => setWidth(Math.round(el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (width < 200) return;
    const host = hostRef.current!, paper = paperRef.current!, cursor = cursorRef.current!;
    const song = engine.song;
    const pageW = Math.min(width - 24, 1100);
    const scale = pageW < 640 ? 0.9 : 1.05;
    const perBar = Math.max(150, density(song) * 26 + 50) * scale;
    const mpl = Math.max(1, Math.min(5, Math.floor(pageW / perBar)));
    const score = buildScore(song, mpl, fingers, { title, composer });
    const eg = engrave(host, paper, engine, score, {
      staffwidth: pageW / scale - 16,
      scale,
      feedback: () => feedbackRef.current,
      onClickNote: start => {
        if (engine.playing && !engine.waiting) return;
        const tk = eg.tokenAt(start);
        if (tk) onSeek(tk.time);
      },
    });
    repaint.current = eg.paintAll;
    eg.paintAll();
    const off = engine.on(e => {
      if (e.type !== 'status') return;
      if (e.ids === 'all') eg.paintAll(); else eg.paintIds(e.ids);
    });

    let raf = 0, lastLine = -1;
    const frame = () => {
      eg.paintTies(engine.time);
      const c = cursorAt(eg.stops, engine.time);
      if (c) {
        const box = eg.lines[c.line] ?? { top: 0, bottom: 120 };
        cursor.style.transform = `translate(${c.x - 3}px, ${box.top - 12}px)`;
        cursor.style.height = `${box.bottom - box.top + 24}px`;
        if (c.line !== lastLine) {
          lastLine = c.line;
          if (followRef.current) host.scrollTo({ top: c.line === 0 ? 0 : Math.max(0, box.top - 70), behavior: 'smooth' });
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); off(); repaint.current = () => {}; };
  }, [engine, width, fingers, title, composer]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="score" ref={hostRef}>
      <div className="score-page"><div ref={paperRef} /></div>
      <div ref={cursorRef} className="score-cursor" aria-hidden="true" />
    </div>
  );
}
