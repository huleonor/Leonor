import type { FingerMode } from '../lib/types';
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
  /** Finger numbers over the notes: every note, only where the hand moves, or none (set by the coach). */
  fingers?: FingerMode;
  /** One-hand step: only that hand's notes are printed. */
  only?: 'R' | 'L';
}

/**
 * One section as a single engraved line that slides left as he plays, Simply Piano style: the staff
 * runs on across the whole screen, the clef and key signature stay put at the left edge, notes he
 * has played fade away behind them, and the notes to play next arrive at a thin "now" line.
 */
export function LessonStaff({ engine, from, to, feedback, fingers = 'all', only }: Props) {
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
    // Like Simply Piano: about four bars across the whole screen (a shorter step fills it), as big
    // as the stage's height allows. Engraved once, measured, and engraved again at the size that fits.
    const perBar = Math.max(170, density(song) * 34 + 60);
    const tallest = Math.min(3.4, (size.h - 110) / 125);
    const score = buildScore(song, bars, fingers, { from, to, only, staffSep: 20 });
    const draw = (sc: number) => engrave(line, paper, engine, score, { staffwidth: bars * perBar, scale: sc, stretch: true, feedback: () => feedbackRef.current });
    let scale = Math.max(0.8, Math.min(tallest, (size.w * 0.9) / (perBar * Math.min(4, bars))));
    let eg = draw(scale);
    const drawn = paper.getBoundingClientRect().width;
    const want = size.w * 0.94 * Math.max(1, bars / 4);
    const fit = Math.max(0.8, Math.min(tallest, scale * want / Math.max(1, drawn)));
    if (Math.abs(fit - scale) / scale > 0.06) { scale = fit; eg = draw(scale); }
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

    // The staff never ends: its lines run on across the stage, behind the engraving.
    const lineTop = parseFloat(line.style.top) || 0;
    const paperBox = paper.getBoundingClientRect();
    const extras: HTMLElement[] = [];
    const thick = Math.max(1, scale * 0.5);
    paper.querySelectorAll<SVGGElement>('g.abcjs-staff').forEach(g => {
      const b = g.getBoundingClientRect();
      const ext = document.createElement('div');
      ext.className = 'staff-ext';
      ext.style.top = `${lineTop + b.top - paperBox.top}px`;
      ext.style.height = `${b.height + thick}px`;
      ext.style.backgroundSize = `100% ${b.height / 4}px`;
      ext.style.setProperty('--thick', `${thick}px`);
      hostRef.current!.appendChild(ext);
      extras.push(ext);
    });
    // The clef (and key signature) stays at the left edge while the music slides under it, and the
    // notes he has played fade out behind it.
    let clefW = 0;
    paper.querySelectorAll('.abcjs-clef, .abcjs-key-signature, .abcjs-brace').forEach(el => { clefW = Math.max(clefW, el.getBoundingClientRect().right - paperBox.left); });
    const svg = paper.querySelector('svg');
    if (svg && clefW > 0) {
      const panel = document.createElement('div');
      panel.className = 'clef-panel';
      panel.style.top = `${lineTop}px`;
      panel.style.width = `${clefW + 10 * scale}px`;
      panel.style.height = `${paperBox.height}px`;
      const copy = svg.cloneNode(true) as SVGElement;
      copy.querySelectorAll('.abcjs-note, .abcjs-rest, .abcjs-bar, .abcjs-time-signature, .abcjs-annotation, .abcjs-slur, .abcjs-tie').forEach(n => n.remove());
      panel.appendChild(copy);
      const fadeEl = document.createElement('div');
      fadeEl.className = 'past-fade';
      fadeEl.style.left = `${clefW + 10 * scale}px`;
      hostRef.current!.appendChild(panel);
      hostRef.current!.appendChild(fadeEl);
      extras.push(panel, fadeEl);
    }

    // A step that fits on the screen stays still, centred between the clef and the right edge, and
    // the now line travels over it (Simply Piano does the same); a longer one slides under the now line.
    const panelW = clefW > 0 ? clefW + 10 * scale : 0;
    const startX = (eg.stops[0]?.x ?? 0) - 36 * scale;
    const endX = eg.lines[0]?.right ?? paper.getBoundingClientRect().width;
    const room = size.w - panelW - 24;
    const fits = endX - startX <= room;
    const shift = fits ? panelW + (room - (endX - startX)) / 2 - startX : 0;
    if (fits) {
      // The bar line that opened the line (before the first note) would stand alone in the gap.
      const left = line.getBoundingClientRect().left;
      const firstNote = eg.stops[0]?.x ?? 0;
      // Everything drawn before the first note (the opening bar line, the line joining the staves)
      // would stand alone in the gap; the clef panel shows what matters there.
      paper.querySelectorAll<SVGElement>('svg path, svg text').forEach(el => { if (!el.closest('g.abcjs-staff') && el.getBoundingClientRect().right - left < firstNote - 2) el.style.opacity = '0'; });
      line.style.transform = `translateX(${shift}px)`;
      // The clef panel already shows the clef and key at the left edge.
      paper.querySelectorAll<SVGElement>('.abcjs-clef, .abcjs-key-signature, .abcjs-time-signature, .abcjs-brace').forEach(el => { el.style.opacity = '0'; });
    }

    let raf = 0, offset = -1, hint = false, lastStop = -1;
    // The now line sits where the first note already is, so nothing jumps at the start.
    const firstX = eg.stops[0]?.x ?? size.w * 0.3;
    const anchor = Math.max(clefW + 70 * scale, Math.min(size.w * 0.42, firstX));
    // Played notes stay clear until they reach the clef, then fade out under it.
    extras.forEach(x => { if (x.className === 'past-fade') x.style.width = `${Math.min(46 * scale, Math.max(0, anchor - clefW - 10 * scale - 30))}px`; });
    glow.style.transform = `translateX(${anchor - 40}px)`;
    // The "now" line, like Simply Piano's: across the staff, where the notes to play arrive.
    const box = eg.lines[0];
    const top = parseFloat(line.style.top) || 0;
    const nowTop = box ? top + box.top - 14 : 0;
    if (box) { now.style.transform = `translate(${anchor - 16}px, ${nowTop}px)`; now.style.height = `${box.bottom - box.top + 28}px`; }
    const frame = () => {
      eg.paintTies(engine.time);
      if (engine.hintVisible() !== hint) { hint = !hint; repaintNext(); }
      const c = cursorAt(eg.stops, engine.time);
      // Free play has no cursor, like Simply Piano: he reads on from the last note he played.
      // With the beat the now line shows where the music is.
      const showNow = !engine.opts.follow;
      if (now.style.opacity !== (showNow ? '' : '0')) now.style.opacity = showNow ? '' : '0';
      if (c && fits) {
        // Still music: the now line and its glow move to the notes.
        const x = c.x + shift;
        offset = offset < 0 ? x : offset + (x - offset) * 0.25;
        now.style.transform = `translate(${offset - 16}px, ${nowTop}px)`;
        glow.style.transform = `translateX(${offset - 40}px)`;
      } else if (c) {
        const target = Math.max(0, c.x - anchor);
        offset = offset < 0 ? target : offset + (target - offset) * 0.18;
        line.style.transform = `translateX(${-offset}px)`;
      }
      if (c) {
        const at = eg.stops[c.i];
        if (c.i !== lastStop && engine.playing && at && engine.time >= at.time - 1e-3) { lastStop = c.i; eg.pulse(at); }
        // Stuck: the beam of light where the music is brightens and breathes.
        glow.classList.toggle('on', hint && !!at);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); off(); offDots(); dots.remove(); extras.forEach(x => x.remove()); };
  }, [engine, from, to, only, fingers, size.w, size.h]);

  return (
    <div className="lesson-staff" ref={hostRef}>
      <div className="lesson-line" ref={lineRef}><div ref={paperRef} /></div>
      <div className="now-beam" ref={glowRef} aria-hidden="true" />
      <div className="now-line" ref={nowRef} aria-hidden="true" />
    </div>
  );
}
