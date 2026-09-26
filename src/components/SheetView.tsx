import abcjs from 'abcjs';
import { useEffect, useRef, useState } from 'react';
import { buildScore, density, type AbcToken } from '../lib/abc';
import type { Engine } from '../lib/engine';
import { useI18n } from '../lib/i18n';
import { AUTO, HIT, MISS, type FingerMode } from '../lib/types';

interface Props { engine: Engine; fingers: FingerMode; onTap: () => void; }

interface Stop { time: number; x: number; line: number; }
interface Box { top: number; bottom: number; }

const INK = '#1a1a1a';
const COLORS = { R: '#f25c08', L: '#2f5bff', auto: '#a3a29b', miss: '#e0301e' };

function rectIn(el: Element, host: HTMLElement) {
  const r = el.getBoundingClientRect(), h = host.getBoundingClientRect();
  return { left: r.left - h.left + host.scrollLeft, top: r.top - h.top + host.scrollTop, width: r.width, height: r.height };
}

export function SheetView({ engine, fingers, onTap }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [ready, setReady] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    const el = scrollRef.current!;
    const ro = new ResizeObserver(() => setWidth(Math.round(el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (width < 120) return;
    const host = scrollRef.current!, paper = paperRef.current!, cursor = cursorRef.current!;
    const song = engine.song;
    const perBar = Math.max(110, density(song) * 24 + 36);
    const mpl = Math.max(1, Math.min(6, Math.floor((width - 40) / perBar)));
    const score = buildScore(song, mpl, fingers);
    const scale = width < 560 ? 0.82 : width < 760 ? 0.92 : 1;

    const [tune] = abcjs.renderAbc(paper, score.abc, {
      add_classes: true,
      staffwidth: (width - 24) / scale,
      scale,
      paddingleft: 6,
      paddingright: 6,
      paddingtop: 10,
      paddingbottom: 24,
      foregroundColor: INK,
      clickListener: (el) => {
        if (engine.playing) return;
        const start = (el as { startChar?: number }).startChar;
        const tok = score.tokens.find(tk => tk.start === start || tk.start === (start ?? -9) + 1);
        if (tok) engine.seek(tok.time - 0.4);
      },
    });

    // Map each written note back to the SVG it produced.
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
    const noteTokens = score.tokens.filter(tk => !tk.rest);
    // abcjs counts the space before a note that follows a bar line or a voice tag as part of it.
    const elsOf = (tk: AbcToken) => svgByStart.get(tk.start) ?? svgByStart.get(tk.start - 1) ?? [];
    const tokensByNote = new Map<number, AbcToken[]>();
    for (const tk of noteTokens) for (const id of tk.ids) {
      const list = tokensByNote.get(id) ?? [];
      list.push(tk);
      tokensByNote.set(id, list);
    }

    const paint = (tk: AbcToken) => {
      const st = tk.ids.map(id => engine.status[id]);
      let color = INK;
      // A tied continuation is only "played" once the cursor reaches it.
      if (tk.cont && tk.time > engine.time + 0.01) color = INK;
      else if (st.some(s => s === MISS)) color = COLORS.miss;
      else if (st.every(s => s === HIT || s === AUTO)) {
        const mine = tk.ids.some(id => engine.user[id]) || engine.opts.listen;
        color = mine ? COLORS[tk.hand] : COLORS.auto;
      }
      for (const el of elsOf(tk)) {
        el.style.fill = color;
        el.querySelectorAll?.('path').forEach(p => ((p as SVGElement).style.fill = color));
      }
    };
    const contTokens = noteTokens.filter(tk => tk.cont);
    let ci = 0;
    const paintAll = () => {
      noteTokens.forEach(paint);
      ci = contTokens.findIndex(tk => tk.time > engine.time + 0.01);
      if (ci < 0) ci = contTokens.length;
    };
    paintAll();
    const off = engine.on(e => {
      if (e.type !== 'status') return;
      if (e.ids === 'all') { paintAll(); return; }
      const seen = new Set<AbcToken>();
      for (const id of e.ids) for (const tk of tokensByNote.get(id) ?? []) if (!seen.has(tk)) { seen.add(tk); paint(tk); }
    });

    // Cursor stops: one per onset, at the notehead.
    const lineBoxes: Box[] = [];
    const extend = (line: number, top: number, bottom: number) => {
      const b = lineBoxes[line];
      lineBoxes[line] = b ? { top: Math.min(b.top, top), bottom: Math.max(b.bottom, bottom) } : { top, bottom };
    };
    for (let l = 0; l < score.lineCount; l++) {
      paper.querySelectorAll(`.abcjs-staff-wrapper.abcjs-l${l}, .abcjs-staff.abcjs-l${l}`).forEach(el => {
        const r = rectIn(el, host);
        extend(l, r.top, r.top + r.height);
      });
    }
    const stops: Stop[] = [];
    for (const tk of noteTokens) {
      if (tk.cont) continue;
      const els = elsOf(tk);
      if (!els.length) continue;
      const head = els.map(e => (e.matches?.('.abcjs-notehead') ? e : e.querySelector?.('.abcjs-notehead'))).find(Boolean) ?? els[0];
      const r = rectIn(head as Element, host);
      extend(tk.line, r.top, r.top + r.height);
      const x = r.left + r.width / 2;
      const prev = stops[stops.length - 1];
      if (prev && Math.abs(prev.time - tk.time) < 0.02) { prev.x = Math.min(prev.x, x); continue; }
      stops.push({ time: tk.time, x, line: tk.line });
    }
    setReady(true);

    let raf = 0, lastLine = -1;
    const frame = () => {
      const now = engine.time;
      while (ci < contTokens.length && contTokens[ci].time <= now + 0.01) paint(contTokens[ci++]);
      let a = 0, b = stops.length - 1;
      if (b < 0) return;
      while (a < b) { const m = (a + b + 1) >> 1; if (stops[m].time <= now) a = m; else b = m - 1; }
      const s = stops[a];
      const n = stops[a + 1];
      let x = s.x;
      if (now < s.time) x = s.x - 14;
      else if (n && n.line === s.line && n.time > s.time) x = s.x + (n.x - s.x) * Math.min(1, (now - s.time) / (n.time - s.time));
      const box = lineBoxes[s.line] ?? { top: 0, bottom: 120 };
      cursor.style.transform = `translate(${x - 1}px, ${box.top - 10}px)`;
      cursor.style.height = `${box.bottom - box.top + 20}px`;
      cursor.classList.toggle('waiting', engine.waiting);
      if (s.line !== lastLine) {
        lastLine = s.line;
        host.scrollTo({ top: Math.max(0, box.top - 18), behavior: 'smooth' });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); off(); };
  }, [engine, width]);

  return (
    <div className="score" ref={scrollRef} onClick={e => { if (engine.playing || !(e.target as Element).closest('.abcjs-note')) onTap(); }}>
      <div className="score-paper">
        <div ref={paperRef} />
        <div ref={cursorRef} className="score-cursor" />
      </div>
      {!ready && <p className="score-loading">{t('sheetLoading')}</p>}
    </div>
  );
}
