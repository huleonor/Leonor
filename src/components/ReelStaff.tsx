/**
 * The staff over the falling notes (the user's choice 2026-11, from a falling-notes video he liked:
 * "learn with the keys falling and the staff, and still the hands below"): the video's bars engraved
 * once as a grand staff (or the one hand's staff in a hand-alone video), sliding left under a pink
 * now line in step with the video's own clock, so the note he reads is the note that lands on the
 * key below. Each onset's noteheads swell as the now line reaches them. The engraving is the
 * lessons' own (abc.ts, engrave.ts); only the video on screen engraves.
 */
import { useEffect, useRef, useState } from 'react';
import { buildScore, density } from '../lib/abc';
import type { Engine } from '../lib/engine';
import { cursorAt, engrave } from '../lib/engrave';
import type { ReelTimeline } from '../lib/reels';
import type { Hand, Song } from '../lib/types';

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
  /** The keys the voice has named so far (midi to order) and until when it names them: their first notes print in ink too. */
  named?: React.RefObject<Map<number, number>>;
  namedUntil?: number;
}

export function ReelStaff({ song, from, to, only, tl, now, playing, named, namedUntil = 0 }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const nowRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const playingRef = useRef(playing);
  playingRef.current = playing;

  useEffect(() => {
    const el = hostRef.current!;
    const ro = new ResizeObserver(() => setSize({ w: Math.round(el.clientWidth), h: Math.round(el.clientHeight) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (size.w < 120 || size.h < 50) return;
    const line = lineRef.current!, paper = paperRef.current!, nowEl = nowRef.current!;
    paper.innerHTML = '';
    // The engraving reads an engine's state to colour notes: here every note is plain ink.
    const quiet = { song, status: {}, user: {}, opts: { listen: true, follow: false }, groups: [], gi: 0, time: -1 } as unknown as Engine;
    const bars = to - from + 1;
    const score = buildScore(song, bars, 'off', { from, to, only, staffSep: 14 });
    // A grand staff is about 125 units tall from the treble's top line to the bass's bottom line.
    const units = only ? 60 : 125;
    const scale = Math.max(0.5, Math.min(1.3, (size.h - 28) / (units + 40)));
    const perBar = Math.max(150, density(song) * 30 + 50);
    // The notes sounding now print in their hand's ink, so the note read on the staff is the falling
    // note landing on its key below, in the same colour.
    const css = getComputedStyle(hostRef.current!);
    const ink = { R: css.getPropertyValue('--pink').trim() || '#FF006E', L: css.getPropertyValue('--teal').trim() || '#00A99D' };
    const idOf = new Map(song.notes.map(n => [`${n.ticks}:${n.midi}`, n]));
    let sounding = new Map<number, Hand>();
    let eg;
    try { eg = engrave(line, paper, quiet, score, { staffwidth: bars * perBar, scale, feedback: () => false, tint: ids => { const h = ids.map(id => sounding.get(id)).find(Boolean); return h ? ink[h] : undefined; } }); } catch { return; }
    eg.paintAll();
    const svgH = paper.getBoundingClientRect().height;
    line.style.top = `${Math.max(0, (size.h - svgH) / 2)}px`;
    const box = eg.lines[0];
    const top = parseFloat(line.style.top) || 0;
    if (box) { nowEl.style.top = `${top + box.top - 8}px`; nowEl.style.height = `${box.bottom - box.top + 16}px`; }
    const anchor = Math.round(size.w * 0.32);
    nowEl.style.left = `${anchor}px`;

    // The video's notes in order of their time on the video's clock, each with its place in the song.
    const notes = [...tl.notes].sort((a, b) => a.t - b.t);
    const songTime = (t: number) => {
      if (!notes.length) return 0;
      let a = 0, b = notes.length - 1;
      while (a < b) { const m = (a + b + 1) >> 1; if (notes[m].t <= t + 1e-3) a = m; else b = m - 1; }
      const n = notes[a], next = notes.slice(a + 1).find(x => x.t > n.t + 1e-3);
      const s0 = song.ticksToSeconds(n.ticks);
      if (t < n.t) return s0 - 0.01;
      // Glide toward the next note while the video moves on to it, unless the music jumps back (a new round).
      if (next) { const s1 = song.ticksToSeconds(next.ticks); if (s1 > s0) return s0 + (s1 - s0) * Math.min(1, (t - n.t) / Math.max(1e-3, next.t - n.t)); }
      return s0;
    };
    let raf = 0, offset = -1, lastStop = -1;
    const frame = () => {
      const t = now();
      const next = new Map<number, Hand>();
      for (const n of notes) { if (n.t > t) break; if (t < n.t + Math.max(0.12, n.dur)) { const sn = idOf.get(`${n.ticks}:${n.midi}`); if (sn) next.set(sn.id, n.hand); } }
      // While the voice names the keys, the notes it names light on the staff as on the keyboard.
      if (t < namedUntil && named?.current?.size) {
        for (const m of named.current.keys()) {
          // The one nearest now: the first named, or the group he is asked to play while it waits.
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
        // A jump back (a new round, a loop) cuts straight there; the rest glides.
        offset = offset < 0 || target < offset - size.w * 0.5 ? target : offset + (target - offset) * 0.22;
        line.style.transform = `translateX(${-offset}px)`;
        const at = eg.stops[c.i];
        if (c.i !== lastStop && playingRef.current && at) { lastStop = c.i; eg.pulse(at); }
        if (!playingRef.current) lastStop = -1;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [song, from, to, only, tl, size.w, size.h]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="reel-staff" ref={hostRef} aria-hidden="true">
      <div className="reel-staff-line" ref={lineRef}><div ref={paperRef} /></div>
      <div className="reel-staff-now" ref={nowRef} />
    </div>
  );
}
