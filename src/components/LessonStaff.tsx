import { useEffect, useRef, useState } from 'react';
import { buildScore, density } from '../lib/abc';
import type { Engine } from '../lib/engine';
import { cursorAt, engrave } from '../lib/engrave';
import { pressDots } from '../lib/pressDots';
import { IconHand } from './Icons';

interface Props {
  engine: Engine;
  from: number;
  to: number;
  feedback: boolean;
}

/**
 * One section as a single engraved line that slides left as he plays: the notes to play next sit
 * at a third of the width, in teal, with the finger to use in a bubble above them.
 */
export function LessonStaff({ engine, from, to, feedback }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
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
    const line = lineRef.current!, paper = paperRef.current!, bubble = bubbleRef.current!, glow = glowRef.current!;
    const song = engine.song;
    const bars = to - from + 1;
    // A grand staff is about 190 units tall at scale 1: fill most of the stage with it.
    const scale = Math.max(0.8, Math.min(1.7, (size.h - 60) / 190));
    const perBar = Math.max(180, density(song) * 40 + 60);
    const score = buildScore(song, bars, 'all', { from, to });
    const eg = engrave(line, paper, engine, score, {
      staffwidth: bars * perBar,
      scale,
      feedback: () => feedbackRef.current,
      // The notes to play turn teal only as a hint, so he reads the staff first.
      highlightNext: () => engine.hintVisible(),
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

    // Centre the line in the stage, but keep it close under the header on tall screens.
    const svgH = paper.getBoundingClientRect().height;
    line.style.top = `${Math.max(0, Math.min((size.h - svgH) / 2, 80)) + 14}px`;

    let raf = 0, offset = -1, hint = false, lastStop = -1;
    const anchor = size.w * 0.3;
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
        // Stuck: Simply Piano's beam of light over the notes to play.
        glow.classList.toggle('on', hint && !!at);
        if (hint && at) glow.style.transform = `translateX(${at.x - offset - 28}px)`;
        // The finger bubble over the notes he has to play next.
        const g = engine.groups[engine.gi];
        const stop = g && eg.stops.find(s => s.ids.some(id => g.ids.includes(id)));
        const fingers = g ? [...new Set(g.ids.map(id => engine.song.notes[id].finger).filter((f): f is number => !!f))] : [];
        const n = g && engine.song.notes[g.ids[0]];
        if (stop && n && fingers.length && !engine.opts.listen) {
          bubble.style.display = 'flex';
          bubble.style.transform = `translate(${stop.x - offset - 22}px, ${Math.max(0, (eg.lines[0]?.top ?? 40) + parseFloat(line.style.top) - 66)}px)`;
          const num = bubble.querySelector('b')!;
          const label = fingers.join(' ');
          if (num.textContent !== label) num.textContent = label;
          bubble.classList.toggle('left', n.hand === 'L');
        } else bubble.style.display = 'none';
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); off(); offDots(); dots.remove(); };
  }, [engine, from, to, size.w, size.h]);

  return (
    <div className="lesson-staff" ref={hostRef}>
      <div className="lesson-line" ref={lineRef}><div ref={paperRef} /></div>
      <div className="stuck-glow tall" ref={glowRef} aria-hidden="true" />
      <div className="finger-bubble" ref={bubbleRef} aria-hidden="true"><IconHand size={26} /><b /></div>
    </div>
  );
}
