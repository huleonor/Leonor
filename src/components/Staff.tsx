import { useEffect, useMemo, useRef } from 'react';
import type { Engine } from '../lib/engine';
import { keyName } from '../lib/analysis';
import { glyph, type GlyphName } from '../lib/glyphs';
import { noteName } from '../lib/names';
import { AUTO, HIT, MISS, type FingerMode, type Hand, type NoteNaming, type SongNote } from '../lib/types';

/** One judgement word floating up from the now-line (tempo mode). */
export interface Judgement { text: string; tone: 'good' | 'ok' | 'off'; at: number; }

interface Props {
  engine: Engine;
  /** Which staves to draw: the hand being practised, or both as a grand staff. */
  staves: Hand[];
  naming: NoteNaming;
  fingers: FingerMode;
  judgements: React.RefObject<Judgement[]>;
  onTap: () => void;
}

const C = {
  paper: '#fbfaff', line: '#c9c4e6', ink: '#1b1640', ink2: '#5b5590', clefPanel: '#f3f1fd',
  go: '#1fb85f', goSoft: 'rgba(63,208,122,.16)', miss: '#e5384f', right: '#1782d6', left: '#c97800',
  auto: '#b9b4d8',
};
const FONT = '"Nunito Variable", Nunito, ui-rounded, system-ui, sans-serif';

// Letter of each pitch class, spelled with sharps or with flats, and its accidental.
const SHARP: [number, number][] = [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [3, 0], [3, 1], [4, 0], [4, 1], [5, 0], [5, 1], [6, 0]];
const FLAT: [number, number][] = [[0, 0], [1, -1], [1, 0], [2, -1], [2, 0], [3, 0], [4, -1], [4, 0], [5, -1], [5, 0], [6, -1], [6, 0]];
// Key signature order, as letters (C=0 … B=6), and where each sits on the treble staff (diatonic index).
const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6];
const FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3];
const SHARP_POS = [38, 35, 39, 36, 33, 37, 34];
const FLAT_POS = [34, 37, 33, 36, 32, 35, 31];
/** Diatonic index of each staff's bottom line: E4 (treble), G2 (bass). */
const BOTTOM: Record<Hand, number> = { R: 30, L: 18 };

interface Placed { note: SongNote; d: number; acc: number | null; staff: number; label: string; }

const LETTER_NAMES = { letters: ['C', 'D', 'E', 'F', 'G', 'A', 'B'], solfege: ['Dó', 'Ré', 'Mi', 'Fá', 'Sol', 'Lá', 'Si'] };

export function Staff({ engine, staves, naming, fingers, judgements, onTap }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const song = engine.song;

  // Spell every note once: staff, diatonic position, the accidental it needs against the key and
  // the name inside its head. Flat keys spell black keys as flats, except a minor key's leading
  // note (C♯ in D minor), which is always sharp.
  const placed = useMemo(() => {
    const flats = song.fifths < 0;
    const { tonic, minor } = keyName(song);
    const keyAcc = new Array(7).fill(0);
    (flats ? FLAT_ORDER : SHARP_ORDER).slice(0, Math.abs(song.fifths)).forEach(l => (keyAcc[l] = flats ? -1 : 1));
    const names = LETTER_NAMES[naming];
    return song.notes.map((note): Placed => {
      const pc = note.midi % 12;
      const sharp = !flats || (minor && pc === (tonic + 11) % 12);
      const [letter, acc] = (sharp ? SHARP : FLAT)[pc];
      // B♯ / C♭ never happen with these tables, so the octave follows the MIDI number.
      const octave = Math.floor(note.midi / 12) - 1;
      const staff = staves.length === 1 ? 0 : note.hand === 'R' ? 0 : 1;
      const label = names[letter] + (acc === 1 ? '#' : acc === -1 ? 'b' : '');
      return { note, d: letter + 7 * octave, acc: acc === keyAcc[letter] ? null : acc, staff, label };
    });
  }, [song, staves, naming]);

  // Horizontal scale: the usual gap between the notes on these staves gets about three staff spaces.
  const typicalGap = useMemo(() => {
    const shown = song.notes.filter(n => staves.includes(n.hand));
    const times = [...new Set(shown.map(n => Math.round(n.time * 50) / 50))].sort((a, b) => a - b);
    const gaps = times.slice(1).map((t, i) => t - times[i]).filter(g => g > 0.04).sort((a, b) => a - b);
    return gaps.length ? gaps[Math.floor(gaps.length * 0.35)] : 0.5;
  }, [song, staves]);

  // How far the music reaches past each staff, in staff steps (ledger room), capped at four ledger lines.
  const reach = useMemo(() => {
    const above = staves.map(() => 0), below = staves.map(() => 0);
    for (const p of placed) {
      if (staves.length === 1 && p.note.hand !== staves[0]) continue;
      const base = BOTTOM[staves[p.staff]];
      above[p.staff] = Math.max(above[p.staff], Math.min(8, p.d - (base + 8)));
      below[p.staff] = Math.max(below[p.staff], Math.min(8, base - p.d));
    }
    return { above, below };
  }, [placed, staves]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const notes = song.notes;
    const maxDur = Math.max(...notes.map(n => n.duration));
    const beat = song.ppq;
    let raf = 0;

    const drawGlyph = (name: GlyphName, x: number, y: number, scale: number, color: string) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.fillStyle = color;
      ctx.fill(glyph(name));
      ctx.restore();
    };

    const frame = () => {
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const W = canvas.clientWidth, H = canvas.clientHeight;
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const grand = staves.length === 2;
      // Space between staff lines: as big as the stage allows, so it reads from the music stand,
      // with room for the ledger lines this music needs above and below.
      const up = reach.above[0] / 2, down = reach.below[reach.below.length - 1] / 2;
      const middle = grand ? Math.max(3, (reach.below[0] + reach.above[1]) / 2 + 1) : 0;
      const spaces = (grand ? 8 + middle : 4) + Math.max(1.6, up + 0.8) + Math.max(1, down + 0.8) + 1.4;
      const sp = Math.max(8, Math.min(grand ? 17 : 24, H / spaces));
      const top0 = Math.round((H - spaces * sp) / 2 + (Math.max(1.6, up + 0.8) + 1.4) * sp);
      const bottoms = grand ? [top0 + 4 * sp, top0 + (8 + middle) * sp] : [top0 + 4 * sp];
      const yOf = (p: Placed) => bottoms[p.staff] - (p.d - BOTTOM[staves[p.staff]]) * sp / 2;

      const keyCount = Math.abs(song.fifths);
      const clefW = sp * 3.6 + keyCount * sp * 1.05 + sp * 0.8;
      const nowX = Math.round(Math.max(clefW + sp * 2.5, W * 0.24));
      const pps = Math.max(sp * 3, Math.min(sp * 40, (sp * 3.4) / typicalGap));
      const now = engine.time;
      const X = (t: number) => nowX + (t - now) * pps;

      ctx.fillStyle = C.paper;
      ctx.fillRect(0, 0, W, H);

      // Staff lines.
      ctx.fillStyle = C.line;
      for (const b of bottoms) for (let i = 0; i < 5; i++) ctx.fillRect(0, Math.round(b - i * sp) - 0.5, W, 1.2);

      // Bar lines and bar numbers.
      const staffTop = bottoms[0] - 4 * sp, staffBot = bottoms[bottoms.length - 1];
      ctx.font = `700 ${Math.round(sp * 0.62)}px ${FONT}`;
      ctx.textAlign = 'left';
      engine.measureTimes.forEach((mt, i) => {
        const x = X(mt);
        if (x < clefW - 4 || x > W + 4) return;
        ctx.fillStyle = C.line;
        ctx.fillRect(Math.round(x), staffTop, 1.4, staffBot - staffTop);
        ctx.fillStyle = C.ink2;
        ctx.fillText(String(i + 1), x + 4, staffTop - sp * 0.6);
      });

      // The practised stretch: what lies outside it is the run-up, drawn quiet.
      const seg = engine.segment;

      // Now-line and its band, under the notes.
      ctx.fillStyle = C.goSoft;
      ctx.fillRect(nowX - sp * 0.9, staffTop - sp * 1.8, sp * 1.8, staffBot - staffTop + sp * 3.6);
      ctx.fillStyle = C.go;
      ctx.beginPath();
      ctx.roundRect(nowX - 1.5, staffTop - sp * 1.8, 3, staffBot - staffTop + sp * 3.6, 1.5);
      ctx.fill();

      // Notes on screen: binary search the first one that can be visible.
      const tFrom = now - (nowX - clefW) / pps - maxDur;
      let a = 0, b = notes.length;
      while (a < b) { const m = (a + b) >> 1; if (notes[m].time < tFrom) a = m + 1; else b = m; }
      const nextGroup = engine.groups[engine.gi];
      // Same window as engine.expected(), so a note turns blue on the staff and on its key together.
      const nextIds = new Set(nextGroup && nextGroup.time - now <= 1.2 ? nextGroup.ids : []);
      const headRx = sp * 0.66, headRy = sp * 0.5;
      const listen = engine.opts.listen;

      // Group chords per staff so they share a stem.
      type Chord = { x: number; staff: number; members: Placed[] };
      const chords: Chord[] = [];
      for (let i = a; i < notes.length; i++) {
        const n = notes[i];
        const x = X(n.time);
        if (x > W + sp * 2) break;
        const p = placed[n.id];
        // A single staff only shows the hand being practised.
        if (!grand && n.hand !== staves[0]) continue;
        const last = chords[chords.length - 1];
        if (last && last.staff === p.staff && Math.abs(last.x - x) < 1.5) last.members.push(p);
        else chords.push({ x, staff: p.staff, members: [p] });
      }

      for (const ch of chords) {
        if (ch.x < clefW - sp * 2) continue;
        const ds = ch.members.map(p => p.d);
        const mid = BOTTOM[staves[ch.staff]] + 4;
        const stemUp = ds.reduce((s, d) => s + d, 0) / ds.length < mid;
        const beats = ch.members[0].note.durationTicks / beat;
        const kind = beats >= 3.5 ? 'whole' : beats >= 1.75 ? 'half' : 'filled';
        const flags = kind === 'filled' ? (beats < 0.375 ? 2 : beats < 0.75 ? 1 : 0) : 0;
        const ys = ch.members.map(yOf);
        const status = ch.members.map(p => engine.status[p.note.id]);
        const outside = seg && !engine.inSegment(ch.members[0].note.time);

        const colourOf = (p: Placed, st: number) => {
          const mine = engine.user[p.note.id] === 1;
          if (st === HIT || (listen && st === AUTO && ch.x <= nowX + 1)) return C.go;
          if (st === MISS) return C.miss;
          if (!mine && !listen) return C.auto;
          if (nextIds.has(p.note.id)) return p.note.hand === 'R' ? C.right : C.left;
          return C.ink;
        };
        ctx.globalAlpha = outside ? 0.35 : 1;

        // Ledger lines.
        const bottom = bottoms[ch.staff];
        const base = BOTTOM[staves[ch.staff]];
        ctx.fillStyle = C.ink2;
        const minD = Math.min(...ds), maxD = Math.max(...ds);
        for (let d = base - 2; d >= minD; d -= 2) ctx.fillRect(ch.x - headRx * 1.7, bottom - (d - base) * sp / 2 - 0.6, headRx * 3.4, 1.4);
        for (let d = base + 10; d <= maxD; d += 2) ctx.fillRect(ch.x - headRx * 1.7, bottom - (d - base) * sp / 2 - 0.6, headRx * 3.4, 1.4);

        // Stem (and flags), in the colour of the first note.
        const lead = colourOf(ch.members[0], status[0]);
        if (kind !== 'whole') {
          const sx = stemUp ? ch.x + headRx - 0.8 : ch.x - headRx + 0.8;
          const yA = stemUp ? Math.max(...ys) : Math.min(...ys);
          const yB = stemUp ? Math.min(...ys) - sp * 3.3 : Math.max(...ys) + sp * 3.3;
          ctx.fillStyle = lead;
          ctx.fillRect(sx - 0.8, Math.min(yA, yB), 1.6, Math.abs(yB - yA));
          for (let f = 0; f < flags; f++) {
            drawGlyph(stemUp ? 'flagUp' : 'flagDown', sx - 0.6, yB + (stemUp ? 1 : -1) * f * sp * 0.75, sp / 10, lead);
          }
        }

        // Heads: a second (neighbouring step) moves to the other side of the stem.
        const order = ch.members.map((p, i) => ({ p, i })).sort((x, y) => x.p.d - y.p.d);
        order.forEach(({ p, i }, k) => {
          const prev = order[k - 1];
          const shift = prev && p.d - prev.p.d === 1 && !(prev as { shifted?: boolean }).shifted ? (stemUp ? 1 : -1) * headRx * 1.9 : 0;
          if (shift) (order[k] as { shifted?: boolean }).shifted = true;
          const x = ch.x + shift, y = ys[i];
          const col = colourOf(p, status[i]);
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(-0.32);
          ctx.beginPath();
          ctx.ellipse(0, 0, headRx, headRy, 0, 0, Math.PI * 2);
          if (kind === 'filled') { ctx.fillStyle = col; ctx.fill(); }
          else {
            ctx.fillStyle = C.paper; ctx.fill();
            ctx.lineWidth = Math.max(1.6, sp * 0.16);
            ctx.strokeStyle = col; ctx.stroke();
          }
          ctx.restore();
          // The note's name inside its head, while there is room for it.
          if (sp >= 11) {
            const scale = p.label.length >= 3 ? 0.46 : p.label.length === 2 ? 0.56 : 0.68;
            ctx.font = `800 ${Math.round(sp * scale)}px ${FONT}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = kind === 'filled' ? '#fff' : col;
            ctx.fillText(p.label, x, y + 0.5);
            ctx.textBaseline = 'alphabetic';
          }
          if (p.acc !== null) {
            const g: GlyphName = p.acc === 1 ? 'sharp' : p.acc === -1 ? 'flat' : 'natural';
            drawGlyph(g, x - headRx - sp * 1.05, y, sp / 10, col);
          }
          const showFinger = !!p.note.finger && fingers !== 'off' && (fingers === 'all' || p.note.fingerCue);
          if (showFinger) {
            ctx.font = `800 ${Math.round(sp * 0.72)}px ${FONT}`;
            ctx.textAlign = 'center';
            ctx.fillStyle = C.ink2;
            const fy = stemUp ? Math.max(...ys) + sp * 1.55 : Math.min(...ys) - sp * 1.05;
            if (i === 0) ctx.fillText(String(p.note.finger), ch.x, fy);
          }
        });
        ctx.globalAlpha = 1;
      }

      // A wrong note: a red head where he played it, at the now-line, with its name.
      const wrongAge = performance.now() - engine.lastWrong.at;
      if (wrongAge < 900 && engine.lastWrong.midi > 0) {
        const m = engine.lastWrong.midi;
        const flats = song.fifths < 0;
        const [letter] = (flats ? FLAT : SHARP)[m % 12];
        const d = letter + 7 * (Math.floor(m / 12) - 1);
        const staff = grand ? (m >= 60 ? 0 : 1) : 0;
        const y = bottoms[staff] - (d - BOTTOM[staves[staff]]) * sp / 2;
        if (y > -sp && y < H + sp) {
          ctx.globalAlpha = Math.max(0, 1 - wrongAge / 900);
          ctx.save(); ctx.translate(nowX, y); ctx.rotate(-0.32);
          ctx.beginPath(); ctx.ellipse(0, 0, headRx, headRy, 0, 0, Math.PI * 2);
          ctx.lineWidth = 2.4; ctx.strokeStyle = C.miss; ctx.stroke();
          ctx.restore();
          ctx.font = `800 ${Math.round(Math.max(12, sp * 0.7))}px ${FONT}`;
          ctx.fillStyle = C.miss;
          ctx.textAlign = 'left';
          ctx.fillText(noteName(m, naming, true).replace('♯', '#'), nowX + headRx + 6, y + sp * 0.25);
          ctx.globalAlpha = 1;
        }
      }

      // The clef panel: notes slide under it.
      ctx.fillStyle = C.clefPanel;
      ctx.fillRect(0, 0, clefW, H);
      const fade = ctx.createLinearGradient(clefW, 0, clefW + sp * 2, 0);
      fade.addColorStop(0, C.clefPanel);
      fade.addColorStop(1, 'rgba(243,241,253,0)');
      ctx.fillStyle = fade;
      ctx.fillRect(clefW, 0, sp * 2, H);
      ctx.fillStyle = C.line;
      for (const bt of bottoms) for (let i = 0; i < 5; i++) ctx.fillRect(0, Math.round(bt - i * sp) - 0.5, clefW + sp * 2, 1.2);
      bottoms.forEach((bt, si) => {
        const hand = staves[si];
        if (hand === 'R') drawGlyph('trebleClef', sp * 0.7, bt - sp, sp / 10, C.ink);
        else drawGlyph('bassClef', sp * 0.7, bt - 3 * sp, sp / 10, C.ink);
        const pos = song.fifths < 0 ? FLAT_POS : SHARP_POS;
        for (let k = 0; k < keyCount; k++) {
          const d = pos[k] - (hand === 'L' ? 14 : 0);
          const y = bt - (d - BOTTOM[hand]) * sp / 2;
          drawGlyph(song.fifths < 0 ? 'flat' : 'sharp', sp * 3.4 + k * sp * 1.05, y, sp / 10, C.ink);
        }
      });
      if (grand) {
        // The brace line that joins a grand staff.
        ctx.fillStyle = C.ink;
        ctx.fillRect(sp * 0.25, staffTop, 2, staffBot - staffTop);
      }

      // Timing words float up from the now-line.
      const js = judgements.current ?? [];
      const t = performance.now();
      ctx.textAlign = 'center';
      for (const j of js) {
        const age = (t - j.at) / 700;
        if (age > 1) continue;
        ctx.globalAlpha = 1 - age;
        ctx.font = `900 ${Math.round(Math.max(14, sp * 0.95))}px ${FONT}`;
        ctx.fillStyle = j.tone === 'good' ? C.go : j.tone === 'ok' ? C.ink2 : C.left;
        ctx.fillText(j.text, nowX, staffTop - sp * 2.3 - age * sp * 1.2);
      }
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [engine, song, staves, placed, reach, typicalGap, naming, fingers, judgements]);

  return <canvas ref={canvasRef} className="stage-canvas" role="button" aria-label="Pause" onClick={onTap} />;
}
