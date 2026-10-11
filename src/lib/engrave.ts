import abcjs from 'abcjs';
import type { AbcScore, AbcToken } from './abc';
import type { Engine } from './engine';
import { AUTO, HIT, MISS } from './types';

/** Colours on the white score. */
export const INK = { ink: '#1b1640', hit: '#178a48', miss: '#d92d45', other: '#b9b4d8', next: '#0e9fb0' };

/** A place the cursor can stop: one per onset, at the notehead. */
export interface Stop { time: number; x: number; line: number; ids: number[]; }
export interface LineBox { top: number; bottom: number; }

export interface Engraved {
  tokens: AbcToken[];
  stops: Stop[];
  lines: LineBox[];
  /** Repaint every written note from the engine's state. */
  paintAll: () => void;
  /** Repaint the notes behind these note ids. */
  paintIds: (ids: number[]) => void;
  /** Paint tied continuations the cursor has reached. */
  paintTies: (now: number) => void;
  /** The token under a click, for "start from here". */
  tokenAt: (startChar: number | undefined) => AbcToken | undefined;
}

function rectIn(el: Element, host: HTMLElement) {
  const r = el.getBoundingClientRect(), h = host.getBoundingClientRect();
  return { left: r.left - h.left + host.scrollLeft, top: r.top - h.top + host.scrollTop, width: r.width, height: r.height };
}

interface Options {
  staffwidth: number;
  scale: number;
  /** Let the SVG scale to its container's width (the effective scale is then width / staffwidth). */
  fit?: boolean;
  /** Colour played notes green and missed ones red. */
  feedback: () => boolean;
  /** Colour the notes he has to play next. */
  highlightNext?: boolean;
  onClickNote?: (startChar: number | undefined) => void;
}

/**
 * Engraves an ABC score into `paper` (inside the scrolling `host`) and ties every written note back
 * to the song's notes, so the engine's state can colour them and drive a cursor.
 */
export function engrave(host: HTMLElement, paper: HTMLElement, engine: Engine, score: AbcScore, o: Options): Engraved {
  const [tune] = abcjs.renderAbc(paper, score.abc, {
    add_classes: true,
    staffwidth: o.staffwidth,
    scale: o.fit ? 1 : o.scale,
    ...(o.fit ? { responsive: 'resize' as const } : {}),
    paddingleft: 4,
    paddingright: 8,
    paddingtop: 6,
    paddingbottom: 16,
    foregroundColor: INK.ink,
    clickListener: el => o.onClickNote?.((el as { startChar?: number }).startChar),
  });

  const svgByStart = new Map<number, SVGElement[]>();
  for (const line of tune.lines) {
    for (const staff of line.staff ?? []) {
      for (const voice of staff.voices ?? []) {
        for (const item of voice) {
          const it = item as { el_type: string; startChar: number; abselem?: { elemset: SVGElement[] } };
          if (it.el_type === 'note' && it.abselem) svgByStart.set(it.startChar, it.abselem.elemset);
        }
      }
    }
  }
  const tokens = score.tokens.filter(tk => !tk.rest);
  // abcjs counts the space before a note that follows a bar line or a voice tag as part of it.
  const elsOf = (tk: AbcToken) => svgByStart.get(tk.start) ?? svgByStart.get(tk.start - 1) ?? [];
  const byNote = new Map<number, AbcToken[]>();
  for (const tk of tokens) for (const id of tk.ids) {
    const list = byNote.get(id) ?? [];
    list.push(tk);
    byNote.set(id, list);
  }

  const paint = (tk: AbcToken) => {
    const st = tk.ids.map(id => engine.status[id]);
    const mine = tk.ids.some(id => engine.user[id]) || engine.opts.listen;
    let color = mine ? INK.ink : INK.other;
    const reached = !tk.cont || tk.time <= engine.time + 0.01;
    if (reached && o.feedback()) {
      if (st.some(s => s === MISS)) color = INK.miss;
      else if (st.every(s => s === HIT || s === AUTO) && mine) color = INK.hit;
    }
    if (o.highlightNext && mine && color === INK.ink && engine.groups[engine.gi]?.ids.some(id => tk.ids.includes(id))) color = INK.next;
    for (const el of elsOf(tk)) {
      el.style.fill = color;
      el.querySelectorAll?.('path').forEach(p => ((p as SVGElement).style.fill = color));
    }
  };
  const ties = tokens.filter(tk => tk.cont);
  let ti = 0;
  const paintAll = () => {
    tokens.forEach(paint);
    ti = ties.findIndex(tk => tk.time > engine.time + 0.01);
    if (ti < 0) ti = ties.length;
  };

  const lines: LineBox[] = [];
  const extend = (line: number, top: number, bottom: number) => {
    const b = lines[line];
    lines[line] = b ? { top: Math.min(b.top, top), bottom: Math.max(b.bottom, bottom) } : { top, bottom };
  };
  for (let l = 0; l < score.lineCount; l++) {
    paper.querySelectorAll(`.abcjs-staff.abcjs-l${l}`).forEach(el => {
      const r = rectIn(el, host);
      extend(l, r.top, r.top + r.height);
    });
  }
  const stops: Stop[] = [];
  for (const tk of tokens) {
    if (tk.cont) continue;
    const els = elsOf(tk);
    if (!els.length) continue;
    const head = els.map(e => (e.matches?.('.abcjs-notehead') ? e : e.querySelector?.('.abcjs-notehead'))).find(Boolean) ?? els[0];
    const r = rectIn(head as Element, host);
    extend(tk.line, r.top, r.top + r.height);
    const x = r.left + r.width / 2;
    const prev = stops[stops.length - 1];
    if (prev && Math.abs(prev.time - tk.time) < 0.02) { prev.x = Math.min(prev.x, x); prev.ids.push(...tk.ids); continue; }
    stops.push({ time: tk.time, x, line: tk.line, ids: [...tk.ids] });
  }

  return {
    tokens, stops, lines, paintAll,
    paintIds: ids => {
      const seen = new Set<AbcToken>();
      for (const id of ids) for (const tk of byNote.get(id) ?? []) if (!seen.has(tk)) { seen.add(tk); paint(tk); }
    },
    paintTies: now => { while (ti < ties.length && ties[ti].time <= now + 0.01) paint(ties[ti++]); },
    tokenAt: start => tokens.find(tk => tk.start === start || tk.start === (start ?? -9) + 1),
  };
}

/** The cursor's x at song time `now`: on a stop, or gliding toward the next one on the same line. */
export function cursorAt(stops: Stop[], now: number): { x: number; line: number; i: number } | null {
  if (!stops.length) return null;
  let a = 0, b = stops.length - 1;
  while (a < b) { const m = (a + b + 1) >> 1; if (stops[m].time <= now + 1e-3) a = m; else b = m - 1; }
  const s = stops[a], n = stops[a + 1];
  let x = s.x;
  if (now < s.time - 1e-3) x = s.x - 16;
  else if (n && n.line === s.line && n.time > s.time) x = s.x + (n.x - s.x) * Math.min(1, (now - s.time) / (n.time - s.time));
  return { x, line: s.line, i: a };
}
