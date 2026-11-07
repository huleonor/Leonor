/**
 * Reading on the staff in the videos (the user's choice 2026-11: "the staff or the falling notes",
 * with the keys and the hands below, and the staff "focused on the part we are doing, like the
 * practice"): in place of the falling notes, the video's bars engraved big like the lessons' page
 * (Simply Piano's), about a bar or two across, sliding under a pink now line on the video's own
 * clock. The notes sounding now, and the keys the voice names or the video waits for, print in
 * their hand's ink, so the note read is the key lit below. One hand's staff in a hand-alone video.
 * The engraving is the lessons' own (abc.ts, engrave.ts); only the video on screen engraves.
 */
import { useEffect, useRef, useState } from 'react';
import { buildScore, density } from '../lib/abc';
import type { Engine } from '../lib/engine';
import { cursorAt, engrave } from '../lib/engrave';
import type { ReelTimeline } from '../lib/reels';
import type { Hand, Song } from '../lib/types';
import type { KeysGeom } from './Reels';

interface Props {
  song: Song;
  from: number;
  to: number;
  /** A hand-alone video prints only that hand's staff. */
  only?: Hand;
  tl: ReelTimeline;
  /** The video's clock, in seconds. */
  now: () => number;
  playing: boolean;
  /** The keys the voice has named so far (midi to order) and until when it names them: their notes print in ink too. */
  named?: React.RefObject<Map<number, number>>;
  namedUntil?: number;
  /** Where the keys are: the staff fills the room above them. */
  geom?: React.RefObject<KeysGeom | null>;
}

export function ReelStaff({ song, from, to, only, tl, now, playing, named, namedUntil = 0, geom }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const nowRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const playingRef = useRef(playing);
  playingRef.current = playing;

  // The room above the keys, read from the keyboard's geometry as it is laid out.
  useEffect(() => {
    let raf = 0, last = -1;
    const fit = () => {
      const g = geom?.current, el = hostRef.current;
      if (g && el && Math.abs(g.kbTop - last) > 2) { last = g.kbTop; el.style.height = `${Math.max(80, g.kbTop - 10)}px`; }
      raf = requestAnimationFrame(fit);
    };
    raf = requestAnimationFrame(fit);
    const el = hostRef.current!;
    const ro = new ResizeObserver(() => setSize({ w: Math.round(el.clientWidth), h: Math.round(el.clientHeight) }));
    ro.observe(el);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [geom]);

  useEffect(() => {
    if (size.w < 120 || size.h < 60) return;
    const line = lineRef.current!, paper = paperRef.current!, nowEl = nowRef.current!;
    paper.innerHTML = '';
    const quiet = { song, status: {}, user: {}, opts: { listen: true, follow: false }, groups: [], gi: 0, time: -1 } as unknown as Engine;
    const bars = to - from + 1;
    const score = buildScore(song, bars, 'off', { from, to, only, staffSep: 20 });
    const css = getComputedStyle(hostRef.current!);
    const ink = { R: css.getPropertyValue('--pink').trim() || '#FF006E', L: css.getPropertyValue('--teal').trim() || '#00A99D' };
    const idOf = new Map(song.notes.map(n => [`${n.ticks}:${n.midi}`, n]));
    let sounding = new Map<number, Hand>();
    const tint = (ids: number[]) => { const h = ids.map(id => sounding.get(id)).find(Boolean); return h ? ink[h] : undefined; };
    // Big, like the lessons: the staff about half the room's height (a grand staff is about 125
    // units tall, one staff about 45), never so big that a bar overflows the screen.
    const units = only ? 50 : 125;
    const perBar = Math.max(170, density(song) * 34 + 60);
    const tall = Math.max(0.7, Math.min(3.2, (size.h * 0.55) / units, (size.h - 70) / (units + 40)));
    const draw = (sc: number) => { paper.innerHTML = ''; return engrave(line, paper, quiet, score, { staffwidth: bars * perBar, scale: sc, feedback: () => false, tint }); };
    let eg, scale0 = tall;
    try {
      let scale = tall;
      eg = draw(scale);
      const oneBar = paper.getBoundingClientRect().width / Math.max(1, bars);
      if (oneBar > size.w * 0.8) { scale = Math.max(0.6, scale * (size.w * 0.8) / oneBar); eg = draw(scale); }
      scale0 = scale;
    } catch { return; }
    eg.paintAll();
    const svgH = paper.getBoundingClientRect().height;
    line.style.top = `${Math.max(0, (size.h - svgH) / 2 + 10)}px`;
    const box = eg.lines[0];
    const top = parseFloat(line.style.top) || 0;
    if (box) { nowEl.style.top = `${top + box.top - 14}px`; nowEl.style.height = `${box.bottom - box.top + 28}px`; }
    // As on the lessons' page: the staff's lines run across the whole width, and the clef and key
    // signature stay at the left edge while the music slides under them.
    const host = hostRef.current!;
    const extras: HTMLElement[] = [];
    const paperBox = paper.getBoundingClientRect();
    const thick = Math.max(1, scale0 * 0.5);
    paper.querySelectorAll<SVGGElement>('g.abcjs-staff').forEach(g => {
      const b = g.getBoundingClientRect();
      const ext = document.createElement('div');
      ext.className = 'staff-ext';
      ext.style.top = `${top + b.top - paperBox.top}px`;
      ext.style.height = `${b.height + thick}px`;
      ext.style.backgroundSize = `100% ${b.height / 4}px`;
      ext.style.setProperty('--thick', `${thick}px`);
      host.appendChild(ext);
      extras.push(ext);
    });
    let clefW = 0;
    paper.querySelectorAll('.abcjs-clef, .abcjs-key-signature, .abcjs-brace').forEach(el => { clefW = Math.max(clefW, el.getBoundingClientRect().right - paperBox.left); });
    const svg = paper.querySelector('svg');
    if (svg && clefW > 0) {
      const panel = document.createElement('div');
      panel.className = 'clef-panel';
      panel.style.top = `${top}px`;
      panel.style.width = `${clefW + 10 * scale0}px`;
      panel.style.height = `${paperBox.height}px`;
      const copy = svg.cloneNode(true) as SVGElement;
      copy.querySelectorAll('.abcjs-note, .abcjs-rest, .abcjs-bar, .abcjs-time-signature, .abcjs-annotation, .abcjs-slur, .abcjs-tie, .abcjs-beam-elem').forEach(n => n.remove());
      panel.appendChild(copy);
      host.appendChild(panel);
      extras.push(panel);
    }
    const anchor = Math.round(Math.max(clefW + 60, Math.min(size.w * 0.34, 220)));
    nowEl.style.left = `${anchor}px`;

    const notes = [...tl.notes].sort((a, b) => a.t - b.t);
    const songTime = (t: number) => {
      if (!notes.length) return 0;
      let a = 0, b = notes.length - 1;
      while (a < b) { const m = (a + b + 1) >> 1; if (notes[m].t <= t + 1e-3) a = m; else b = m - 1; }
      const n = notes[a], next = notes.slice(a + 1).find(x => x.t > n.t + 1e-3);
      const s0 = song.ticksToSeconds(n.ticks);
      if (t < n.t) return s0 - 0.01;
      if (next) { const s1 = song.ticksToSeconds(next.ticks); if (s1 > s0) return s0 + (s1 - s0) * Math.min(1, (t - n.t) / Math.max(1e-3, next.t - n.t)); }
      return s0;
    };
    let raf = 0, offset = -1, lastStop = -1;
    const frame = () => {
      const t = now();
      const next = new Map<number, Hand>();
      for (const n of notes) { if (n.t > t) break; if (t < n.t + Math.max(0.12, n.dur)) { const sn = idOf.get(`${n.ticks}:${n.midi}`); if (sn) next.set(sn.id, n.hand); } }
      // While the voice names the keys (or the video waits for him), those notes light on the staff too.
      if (t < namedUntil && named?.current?.size) {
        for (const m of named.current.keys()) {
          let n: (typeof notes)[number] | undefined;
          for (const x of notes) if (x.midi === m && (!n || Math.abs(x.t - t) < Math.abs(n.t - t))) n = x;
          const sn = n && idOf.get(`${n.ticks}:${n.midi}`);
          if (n && sn) next.set(sn.id, n.hand);
        }
      }
      const changed = [...sounding.keys(), ...next.keys()].filter(id => sounding.get(id) !== next.get(id));
      sounding = next;
      if (changed.length) eg.paintIds(changed);
      const c = cursorAt(eg.stops, songTime(t));
      if (c) {
        const target = c.x - anchor;
        offset = offset < 0 || target < offset - size.w * 0.5 ? target : offset + (target - offset) * 0.2;
        line.style.transform = `translateX(${-offset}px)`;
        const at = eg.stops[c.i];
        if (c.i !== lastStop && playingRef.current && at) { lastStop = c.i; eg.pulse(at); }
        if (!playingRef.current) lastStop = -1;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); extras.forEach(x => x.remove()); };
  }, [song, from, to, only, tl, size.w, size.h]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="reel-staff" ref={hostRef} aria-hidden="true">
      <div className="reel-staff-line" ref={lineRef}><div ref={paperRef} /></div>
      <div className="reel-staff-now" ref={nowRef} />
    </div>
  );
}
