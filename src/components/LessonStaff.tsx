import { noteName } from '../lib/names';
import { HIT, type FingerMode, type NoteNaming } from '../lib/types';
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
  /** How note names read when he is stuck (C D E, or Do Re Mi). */
  naming?: NoteNaming;
}

/**
 * One section as a single engraved line that slides left as he plays, Simply Piano style: the staff
 * runs on across the whole screen, the clef and key signature stay put at the left edge, notes he
 * has played fade away behind them, and the notes to play next arrive at a thin "now" line.
 */
export function LessonStaff({ engine, from, to, feedback, fingers = 'all', only, naming = 'letters' }: Props) {
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
    // Like Simply Piano, a short step's bars spread over the whole width, from just after the
    // clef to the right edge: abcjs spreads them only over its own staff width, so widen that
    // until the notes fill the room.
    let staffwidth = bars * perBar;
    if (bars <= 4) {
      for (let k = 0; k < 3; k++) {
        const first = eg.stops[0]?.x ?? 0;
        const right = eg.lines[0]?.right ?? 0;
        // Room right of the clef panel, less the gap before the first note and a margin at the right.
        let clefRight = 0;
        const pb = paper.getBoundingClientRect();
        paper.querySelectorAll('.abcjs-clef, .abcjs-key-signature, .abcjs-brace').forEach(el => { clefRight = Math.max(clefRight, el.getBoundingClientRect().right - pb.left); });
        const want = (size.w - clefRight - 10 * scale - 24 - 36 * scale) * 0.96;
        const have = right - first;
        if (have <= 0 || Math.abs(want - have) / want < 0.04) break;
        staffwidth = Math.max(bars * 60, staffwidth * want / have);
        eg = engrave(line, paper, engine, score, { staffwidth, scale, stretch: true, feedback: () => feedbackRef.current });
      }
    }
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

    // Like Simply Piano, a note he gets right bursts: a ring and a few sparks at the notehead.
    const sparkle = (ids: number[]) => {
      for (const id of ids) {
        if (engine.status[id] !== HIT || !engine.user[id]) continue;
        const stop = eg.stopOf(id);
        const n = engine.song.notes[id];
        const p = stop && eg.pitchY(stop.line, n.midi, n.hand);
        if (!stop || !p) continue;
        const b = document.createElement('span');
        b.className = 'spark';
        const size = p.gap * 2.2;
        b.style.width = b.style.height = `${size}px`;
        // (The `translate` property, so the pop's `scale` grows it in place.)
        b.style.translate = `${stop.x - size / 2}px ${p.y - size / 2}px`;
        for (let k = 0; k < 6; k++) { const i = document.createElement('i'); i.style.setProperty('--a', `${k * 60 + 15}deg`); b.appendChild(i); }
        dots.appendChild(b);
        setTimeout(() => b.remove(), 700);
      }
    };
    const offSpark = engine.on(e => { if (e.type === 'status' && e.ids !== 'all') sparkle(e.ids); });

    // With the beat, a right note that came clearly before or after its time says so above the
    // staff: "Early" or "Late", in small letters, so he hears and sees the beat without a mistake.
    const offJudge = engine.on(e => {
      if (e.type !== 'judge' || Math.abs(e.offset) < 0.12) return;
      const stop = eg.stopOf(e.id);
      const box = stop && eg.lines[stop.line];
      if (!stop || !box) return;
      const t = document.createElement('span');
      t.className = `timing ${e.offset < 0 ? 'early' : 'late'}`;
      t.textContent = e.offset < 0 ? 'Early' : 'Late';
      t.style.translate = `${stop.x}px ${box.top - 8 * scale}px`;
      dots.appendChild(t);
      setTimeout(() => t.remove(), 900);
    });

    // Stuck on a note in free play: its name appears next to it on the staff (never the keyboard
    // first), after two wrong keys or a long look, so he learns to read it there.
    let named = -1;
    const names: HTMLElement[] = [];
    const clearNames = () => { names.forEach(x => x.remove()); names.length = 0; named = -1; };
    const nameNext = () => {
      const stuck = engine.opts.follow && engine.waiting && (engine.wrongInWait >= 2 || (engine.started && performance.now() - engine.waitSince > 7000));
      if (!stuck) { if (named >= 0) clearNames(); return; }
      if (named === engine.gi) return;
      clearNames();
      named = engine.gi;
      for (const id of engine.groups[engine.gi]?.ids ?? []) {
        if (!engine.user[id]) continue;
        const stop = eg.stopOf(id);
        const n = engine.song.notes[id];
        const p = stop && eg.pitchY(stop.line, n.midi, n.hand);
        if (!stop || !p) continue;
        const t = document.createElement('span');
        t.className = 'note-name';
        t.textContent = noteName(n.midi, naming);
        t.style.fontSize = `${Math.max(14, p.gap * 1.5)}px`;
        t.style.translate = `${stop.x + p.gap * 1.4}px ${p.y}px`;
        t.style.transform = 'translateY(-50%)';
        dots.appendChild(t);
        names.push(t);
      }
    };

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
    // Simply Piano starts the music right after the clef.
    const shift = fits ? panelW + Math.min(16 * scale, (room - (endX - startX)) / 2) - startX : 0;
    if (fits) {
      // The bar line that opened the line (before the first note) would stand alone in the gap.
      const left = line.getBoundingClientRect().left;
      const firstNote = eg.stops[0]?.x ?? 0;
      // Everything drawn before the first note (the opening bar line, the line joining the staves)
      // would stand alone in the gap; the clef panel shows what matters there.
      paper.querySelectorAll<SVGElement>('svg path, svg text').forEach(el => { if (!el.closest('g.abcjs-staff') && el.getBoundingClientRect().right - left < firstNote - 2) el.style.opacity = '0'; });
      line.style.transform = `translateX(${shift}px)`;
    }
    // The clef panel already shows the clef and key at the left edge: the engraving's own copies
    // would show up again as the music slides in with the count-in.
    paper.querySelectorAll<SVGElement>('.abcjs-clef, .abcjs-key-signature, .abcjs-time-signature, .abcjs-brace').forEach(el => { el.style.opacity = '0'; });

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
      nameNext();
      if (engine.hintVisible() !== hint) { hint = !hint; repaintNext(); }
      const c = cursorAt(eg.stops, engine.time);
      // Free play has no cursor, like Simply Piano: he reads on from the last note he played.
      // With the beat the now line shows where the music is.
      const showNow = !engine.opts.follow;
      if (now.style.opacity !== (showNow ? '' : '0')) now.style.opacity = showNow ? '' : '0';
      // With the beat, the count-in is the line coming in, in tempo, to land on beat 1 as the music
      // starts (Simply Piano has no numbers): from the clef in still music, from the right as it slides.
      const lead = engine.countdown > 0 && !engine.opts.follow && engine.countTotal > 0 && engine.playing
        ? 1 - engine.countdown / (engine.countTotal * engine.countBeat) : -1;
      if (c && fits && lead >= 0) {
        const x = c.x + shift, edge = panelW + 4;
        offset = edge + (x - edge) * lead;
        now.style.transform = `translate(${offset - 16}px, ${nowTop}px)`;
        glow.style.transform = `translateX(${offset - 40}px)`;
      } else if (c && lead >= 0) {
        offset = c.x - anchor - size.w * 0.35 * (1 - lead);
        line.style.transform = `translateX(${-offset}px)`;
      } else if (c && fits) {
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
    // A new step comes in: the notes slide in from the right, like turning to the next line.
    paper.animate?.([{ opacity: 0, transform: 'translateX(40px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
    return () => { cancelAnimationFrame(raf); off(); offDots(); offSpark(); offJudge(); clearNames(); dots.remove(); extras.forEach(x => x.remove()); };
  }, [engine, from, to, only, fingers, size.w, size.h]);

  return (
    <div className="lesson-staff" ref={hostRef}>
      <div className="lesson-line" ref={lineRef}><div ref={paperRef} /></div>
      <div className="now-beam" ref={glowRef} aria-hidden="true" />
      <div className="now-line" ref={nowRef} aria-hidden="true" />
    </div>
  );
}
