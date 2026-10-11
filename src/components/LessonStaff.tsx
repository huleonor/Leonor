import { useEffect, useRef, useState } from 'react';
import { buildScore, density } from '../lib/abc';
import type { Engine } from '../lib/engine';
import { cursorAt, engrave } from '../lib/engrave';
import { pressDots } from '../lib/pressDots';

interface Props {
  engine: Engine;
  from: number;
  to: number;
  feedback: boolean;
  /** One-hand step: only that hand's notes are printed. */
  only?: 'R' | 'L';
}

/**
 * One section as a single engraved line that slides left as he plays, Simply Piano style: the notes
 * to play next sit under a soft beam of light at a third of the width, fingers printed over them.
 */
export function LessonStaff({ engine, from, to, feedback, only }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const nowRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const feedbackRef = useRef(feedback);
  feedbackRef.current = feedback;

  useEffect(() => {
    const el = hostRef.current!;
    const ro = new ResizeObserver(() => setSize({ w: Math.round(el.clientWidth), h: Math.round(el.clientHeight) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (size.w < 200 || size.h < 80) return;
    const line = lineRef.current!, paper = paperRef.current!, glow = glowRef.current!, now = nowRef.current!;
    const song = engine.song;
    const bars = to - from + 1;
    // Big, like Simply Piano: the grand staff (about 125 units from the treble's top line to the
    // bass's bottom line) fills the stage, a few notes to the screen.
    const scale = Math.max(1, Math.min(2.4, (size.h - 70) / 125));
    const perBar = Math.max(170, density(song) * 34 + 60);
    const score = buildScore(song, bars, 'all', { from, to, only });
    const eg = engrave(line, paper, engine, score, {
      staffwidth: bars * perBar,
      scale,
      feedback: () => feedbackRef.current,
    });
    eg.paintAll();
    let nextIds: number[] = [];
    const repaintNext = () => {
      const ids = engine.groups[engine.gi]?.ids ?? [];
      eg.paintIds([...nextIds, ...ids]);
      nextIds = ids;
    };
    const off = engine.on(e => {
      if (e.type === 'status') { if (e.ids === 'all') eg.paintAll(); else eg.paintIds(e.ids); repaintNext(); }
      if (e.type === 'state') repaintNext();
    });
    repaintNext();
    const dots = document.createElement('div');
    dots.className = 'press-dots';
    line.appendChild(dots);
    const offDots = pressDots(engine, eg, dots);

    // Centre the staff in the stage.
    const svgH = paper.getBoundingClientRect().height;
    line.style.top = `${Math.max(0, (size.h - svgH) / 2)}px`;

    let raf = 0, offset = -1, hint = false, lastStop = -1;
    const anchor = size.w * 0.3;
    glow.style.transform = `translateX(${anchor - 40}px)`;
    // The "now" line, like Simply Piano's: across the staff, where the notes to play arrive.
    const box = eg.lines[0];
    const top = parseFloat(line.style.top) || 0;
    if (box) { now.style.transform = `translate(${anchor - 16}px, ${top + box.top - 14}px)`; now.style.height = `${box.bottom - box.top + 28}px`; }
    const frame = () => {
      eg.paintTies(engine.time);
      if (engine.hintVisible() !== hint) { hint = !hint; repaintNext(); }
      const c = cursorAt(eg.stops, engine.time);
      if (c) {
        const target = c.x - anchor;
        offset = offset < 0 ? target : offset + (target - offset) * 0.18;
        line.style.transform = `translateX(${-offset}px)`;
        const at = eg.stops[c.i];
        if (c.i !== lastStop && engine.playing && at && engine.time >= at.time - 1e-3) { lastStop = c.i; eg.pulse(at); }
        // Stuck: the beam of light where the music is brightens and breathes.
        glow.classList.toggle('on', hint && !!at);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); off(); offDots(); dots.remove(); };
  }, [engine, from, to, only, size.w, size.h]);

  return (
    <div className="lesson-staff" ref={hostRef}>
      <div className="lesson-line" ref={lineRef}><div ref={paperRef} /></div>
      <div className="now-beam" ref={glowRef} aria-hidden="true" />
      <div className="now-line" ref={nowRef} aria-hidden="true" />
    </div>
  );
}
