import { useEffect, useMemo, useRef } from 'react';
import type { Engine } from '../lib/engine';
import { useI18n } from '../lib/i18n';
import { keyLayout } from '../lib/keys';
import { noteName } from '../lib/names';
import { AUTO, HIT, MISS, type NoteNaming } from '../lib/types';

interface Props { engine: Engine; lo: number; hi: number; naming: NoteNaming; inset: number; onTap: () => void; }

const C = {
  black: '#0f0d0b', strip: '#14110e', frame: '#2a2520', perf: '#3b342c', white: '#f2eee6',
  amber: '#d9822b', amberLit: '#f3ab62', cyan: '#6fb7c4', cyanLit: '#a4dbe4', rust: '#c4533a',
};
const VISIBLE_SECONDS = 3.2;

export function FallingNotes({ engine, lo, hi, naming, inset, onTap }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layout = useMemo(() => keyLayout(lo, hi), [lo, hi]);
  const { t } = useI18n();

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const notes = engine.song.notes;
    const maxDur = Math.max(...notes.map(n => n.duration));
    let raf = 0;

    const frame = () => {
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const W = canvas.clientWidth, H = canvas.clientHeight;
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const now = engine.time;
      const kw = W - inset * 2;
      const pps = H / VISIBLE_SECONDS;
      const Y = (time: number) => H - (time - now) * pps;

      // Film base and strip.
      ctx.fillStyle = C.black;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = C.strip;
      ctx.fillRect(inset, 0, kw, H);

      // Frame lines and edge codes at each bar.
      ctx.font = '700 10px Archivo, sans-serif';
      ctx.textAlign = 'left';
      engine.measureTimes.forEach((mt, i) => {
        const y = Y(mt);
        if (y < -20 || y > H + 20) return;
        ctx.fillStyle = C.frame;
        ctx.fillRect(inset, Math.round(y), kw, 1);
        ctx.save();
        ctx.translate(W - inset / 2 + 4, y - 6);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = 'rgba(217,130,43,.85)';
        ctx.fillText(String(i + 1).padStart(2, '0'), 0, 0);
        ctx.restore();
      });

      // Perforations travel with the music.
      const step = 22;
      const off = ((now * pps) % step + step) % step;
      ctx.fillStyle = C.perf;
      for (let y = -step + off; y < H + step; y += step) {
        ctx.beginPath(); ctx.roundRect(inset / 2 - 4.5, y, 9, 13, 2.5); ctx.fill();
      }

      // Octave guides at every C.
      ctx.fillStyle = 'rgba(242,238,230,.045)';
      for (let m = lo; m <= hi; m++) if (m % 12 === 0 && layout[m]) ctx.fillRect(inset + layout[m].x * kw, 0, 1, H);

      // Notes: binary search the first one that can be on screen.
      let a = 0, b = notes.length;
      while (a < b) { const mid = (a + b) >> 1; if (notes[mid].time < now - maxDur - 0.2) a = mid + 1; else b = mid; }
      const waitingIds = new Set<number>();
      if (engine.waiting) {
        const g = engine.groups[engine.gi];
        g?.ids.forEach(id => waitingIds.add(id));
      }
      const listen = engine.opts.listen;
      for (let i = a; i < notes.length; i++) {
        const n = notes[i];
        const yb = Y(n.time);
        if (yb < -4) break;
        const yt = Y(n.time + n.duration);
        if (yt > H) continue;
        const g = layout[n.midi];
        if (!g) continue;
        const pad = g.black ? 0.5 : 2;
        const x = inset + g.x * kw + pad, w = g.w * kw - pad * 2;
        const top = Math.max(yt, -10), bot = Math.min(yb, H);
        const h = bot - top;
        if (h < 1) continue;
        const st = engine.status[n.id];
        const R = n.hand === 'R';
        const base = R ? C.amber : C.cyan;
        const lit = R ? C.amberLit : C.cyanLit;
        const mine = engine.user[n.id] === 1 || listen;
        const sounding = now >= n.time && now < n.time + n.duration;

        if (!mine) {
          // The other hand, played by the app: present but quiet.
          ctx.globalAlpha = 0.28;
          ctx.fillStyle = base;
          ctx.beginPath(); ctx.roundRect(x, top, w, h, 4); ctx.fill();
          ctx.globalAlpha = 1;
          continue;
        }
        if (st === MISS) {
          ctx.strokeStyle = C.rust;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 3]);
          ctx.beginPath(); ctx.roundRect(x + 0.75, top + 0.75, w - 1.5, h - 1.5, 4); ctx.stroke();
          ctx.setLineDash([]);
        } else {
          const done = st === HIT || (listen && st === AUTO);
          ctx.globalAlpha = done && !sounding ? 0.35 : 1;
          ctx.fillStyle = done && sounding ? lit : base;
          ctx.beginPath(); ctx.roundRect(x, top, w, h, 4); ctx.fill();
          if ((done && sounding) || waitingIds.has(n.id)) {
            ctx.fillStyle = C.white;
            ctx.fillRect(x + 3, bot - 3, w - 6, 2);
          }
          ctx.globalAlpha = 1;
        }
        if (h > 20 && w > 14) {
          ctx.fillStyle = st === MISS ? C.rust : C.black;
          ctx.font = `700 ${w > 30 ? 11 : 9}px Archivo, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(noteName(n.midi, naming), x + w / 2, bot - 8);
        }
      }

      // The gate: where notes meet the keys.
      ctx.fillStyle = C.white;
      ctx.fillRect(inset, H - 2, kw, 2);
      ctx.strokeStyle = C.white;
      ctx.lineWidth = 1.5;
      for (const [gx, d] of [[inset + 1, 1], [inset + kw - 1, -1]] as const) {
        ctx.beginPath(); ctx.moveTo(gx + d * 12, H - 16); ctx.lineTo(gx, H - 16); ctx.lineTo(gx, H - 4); ctx.stroke();
      }

      if (engine.waiting) {
        const g = engine.groups[engine.gi];
        if (g) {
          const names = [...new Set(g.midis.map(m => noteName(m, naming)))].join(' + ');
          const alpha = 0.65 + 0.35 * Math.sin(performance.now() / 160);
          ctx.fillStyle = `rgba(217,130,43,${alpha})`;
          ctx.font = '800 13px Archivo, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(t('waitingFor', { notes: names }).toUpperCase(), W / 2, H - 26);
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [engine, lo, hi, layout, naming, inset, t]);

  return (
    <canvas
      ref={canvasRef}
      className="lanes"
      role="button"
      aria-label={t('pause')}
      onClick={onTap}
    />
  );
}
