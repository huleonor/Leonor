import { useEffect, useMemo, useRef } from 'react';
import type { Engine } from '../lib/engine';
import { useI18n } from '../lib/i18n';
import { keyLayout } from '../lib/keys';
import { noteName } from '../lib/names';
import { AUTO, HIT, MISS, type FingerMode, type NoteNaming } from '../lib/types';

interface Props { engine: Engine; lo: number; hi: number; naming: NoteNaming; fingers: FingerMode; inset: number; onTap: () => void; }

// Printed on the notebook page like the reels: the right hand in riso pink, the left in teal; the
// gate is the green of a right note. Read from the design tokens (a canvas cannot read CSS variables).
function palette() {
  const css = getComputedStyle(document.documentElement);
  const v = (k: string) => css.getPropertyValue(k).trim();
  return {
    display: v('--paper'), lane: v('--paper-2'), bar: v('--rule-2'), barText: v('--muted'), white: v('--white'), ink: v('--ink'),
    right: v('--pink'), rightLit: v('--pink-soft'), left: v('--teal'), leftLit: v('--teal-soft'), leftInk: v('--ink'), red: v('--mark'), gate: v('--ok'),
  };
}
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const VISIBLE_SECONDS = 3.2;

export function FallingNotes({ engine, lo, hi, naming, fingers, inset, onTap }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layout = useMemo(() => keyLayout(lo, hi), [lo, hi]);
  const { t } = useI18n();

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const notes = engine.song.notes;
    const maxDur = Math.max(...notes.map(n => n.duration));
    const C = palette();
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

      // The display: black glass, a faint lane on every black key so the eye can track columns.
      ctx.fillStyle = C.display;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = C.lane;
      for (let m = lo; m <= hi; m++) {
        const g = layout[m];
        if (g?.black) ctx.fillRect(inset + g.x * kw, 0, g.w * kw, H);
      }

      // Bar lines with their numbers.
      ctx.font = `700 12px ${SANS}`;
      ctx.textAlign = 'left';
      engine.measureTimes.forEach((mt, i) => {
        const y = Y(mt);
        if (y < -20 || y > H + 20) return;
        ctx.fillStyle = C.bar;
        ctx.fillRect(inset, Math.round(y), kw, 1);
        ctx.fillStyle = C.barText;
        ctx.fillText(String(i + 1), inset + 8, y - 5);
      });

      // Octave guides at every C.
      ctx.fillStyle = C.bar;
      for (let m = lo; m <= hi; m++) if (m % 12 === 0 && layout[m]) ctx.fillRect(inset + layout[m].x * kw, 0, 1, H);

      // Notes: binary search the first one that can be on screen.
      let a = 0, b = notes.length;
      while (a < b) { const mid = (a + b) >> 1; if (notes[mid].time < now - maxDur - 0.2) a = mid + 1; else b = mid; }
      const waitingIds = new Set<number>();
      // (Once the hint panel under the display takes over, this plate steps aside: one message.)
      if (engine.waiting && !engine.hintVisible()) {
        const g = engine.groups[engine.gi];
        g?.ids.forEach(id => waitingIds.add(id));
      }
      const listen = engine.opts.listen;
      const wrongFresh = performance.now() - engine.lastWrong.at < 450;
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
        const base = R ? C.right : C.left;
        const lit = R ? C.rightLit : C.leftLit;
        const mine = engine.user[n.id] === 1 || listen;
        const sounding = now >= n.time && now < n.time + n.duration;

        if (!mine) {
          // The other hand, played by the app: present but quiet.
          ctx.globalAlpha = 0.28;
          ctx.fillStyle = base;
          ctx.beginPath(); ctx.rect(x, top, w, h); ctx.fill();
          ctx.globalAlpha = 1;
          continue;
        }
        if (st === MISS) {
          ctx.strokeStyle = C.red;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 3]);
          ctx.beginPath(); ctx.rect(x + 0.75, top + 0.75, w - 1.5, h - 1.5); ctx.stroke();
          ctx.setLineDash([]);
        } else {
          const done = st === HIT || (listen && st === AUTO);
          ctx.globalAlpha = done && !sounding ? 0.35 : 1;
          ctx.fillStyle = done && sounding ? lit : base;
          ctx.beginPath(); ctx.rect(x, top, w, h); ctx.fill();
          if ((done && sounding) || waitingIds.has(n.id)) {
            ctx.fillStyle = C.white;
            ctx.fillRect(x + 3, bot - 3, w - 6, 2);
          }
          if (waitingIds.has(n.id) && wrongFresh) {
            ctx.strokeStyle = C.red;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.rect(x - 1, top - 1, w + 2, h + 2); ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
        const showFinger = !!n.finger && mine && st !== MISS && (fingers === 'all' || (fingers === 'some' && n.fingerCue));
        if (showFinger && h > 40 && w > 12) {
          // Finger number: a white disc near the bottom of the bar, above the note name.
          const r = Math.min(10, w / 2 - 1.5);
          const cy = bot - 30 - r;
          ctx.fillStyle = C.white;
          ctx.fillRect(x + w / 2 - r, cy - r, r * 2, r * 2);
          ctx.fillStyle = C.ink;
          ctx.font = `700 ${Math.round(r * 1.25)}px ${SANS}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(n.finger), x + w / 2, cy + 0.5);
          ctx.textBaseline = 'alphabetic';
        }
        if (h > 22 && w > 12) {
          // Sized to the lane so it reads from the music stand. A short bar shows the finger instead.
          const label = showFinger && h <= 40 ? String(n.finger) : noteName(n.midi, naming);
          let size = Math.max(11, Math.min(16, w * 0.6));
          ctx.font = `700 ${size}px ${SANS}`;
          while (size > 9 && ctx.measureText(label).width > w - 3) { size -= 1; ctx.font = `700 ${size}px ${SANS}`; }
          ctx.fillStyle = st === MISS ? C.red : R ? C.ink : C.leftInk;
          ctx.textAlign = 'center';
          ctx.fillText(label, x + w / 2, bot - 7);
        }
      }

      // The gate: a green line where the notes meet the keys.
      ctx.fillStyle = C.gate;
      ctx.fillRect(inset, H - 3, kw, 3);

      // A wrong note: a red block in that key's lane, at the gate.
      if (wrongFresh && layout[engine.lastWrong.midi]) {
        const g = layout[engine.lastWrong.midi];
        ctx.fillStyle = C.red;
        ctx.beginPath(); ctx.rect(inset + g.x * kw + 1, H - 16, g.w * kw - 2, 14); ctx.fill();
      }

      // Waiting: an LCD plate over the gate names the notes it is waiting for.
      // (Once the hint panel under the display takes over, this plate steps aside: one message.)
      if (engine.waiting && !engine.hintVisible()) {
        const g = engine.groups[engine.gi];
        if (g) {
          const names = [...new Set(g.midis.map(m => noteName(m, naming)))].join(' + ');
          const text = t('waitingFor', { notes: names });
          ctx.font = `700 15px ${SANS}`;
          const tw = ctx.measureText(text).width;
          const bx = W / 2 - tw / 2 - 16, by = H - 54;
          ctx.fillStyle = C.ink;
          ctx.beginPath(); ctx.rect(bx, by, tw + 32, 32); ctx.fill();
          ctx.strokeStyle = wrongFresh ? C.red : C.gate;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.fillStyle = wrongFresh ? C.red : C.white;
          ctx.textAlign = 'center';
          ctx.fillText(text, W / 2, by + 21);
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [engine, lo, hi, layout, naming, fingers, inset, t]);

  return (
    <canvas
      ref={canvasRef}
      className="stage-canvas"
      role="button"
      aria-label={t('pause')}
      onClick={onTap}
    />
  );
}
