import { useEffect, useMemo, useRef } from 'react';
import type { Engine } from '../lib/engine';
import { keyLayout } from '../lib/keys';
import { noteName } from '../lib/names';
import { AUTO, HIT, type FingerMode, type NoteNaming } from '../lib/types';

interface Props { engine: Engine; lo: number; hi: number; naming: NoteNaming; fingers: FingerMode; }

export function Keyboard({ engine, lo, hi, naming, fingers }: Props) {
  const layout = useMemo(() => keyLayout(lo, hi), [lo, hi]);
  const refs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    let raf = 0;
    const notes = engine.song.notes;
    const prev: Record<number, string> = {};
    const frame = () => {
      const now = performance.now();
      const t = engine.time;
      // The keys to press show only as a hint, and go away once he plays them.
      const expected = new Set(engine.hintVisible() ? engine.expected() : []);
      const groupNotes = (engine.groups[engine.gi]?.ids ?? []).map(id => notes[id]);
      const sounding: Record<number, string> = {};
      // Binary search the first note that could still be sounding.
      let a = 0, b = notes.length;
      while (a < b) { const m = (a + b) >> 1; if (notes[m].time < t - 8) a = m + 1; else b = m; }
      for (let i = a; i < notes.length && notes[i].time <= t; i++) {
        const n = notes[i];
        if (n.time + n.duration < t) continue;
        const st = engine.status[n.id];
        if (st === HIT) sounding[n.midi] = 'hit' + n.hand;
        else if (st === AUTO) sounding[n.midi] = engine.opts.listen ? 'hit' + n.hand : 'auto';
      }
      for (let m = lo; m <= hi; m++) {
        const el = refs.current[m];
        if (!el) continue;
        let cls = '';
        const expNote = expected.has(m) ? groupNotes.find(n => n.midi === m) ?? notes.find(n => n.midi === m && Math.abs(n.time - t) < 1.3) : undefined;
        const expHand = expected.has(m) ? expNote?.hand ?? 'R' : null;
        // The finger for the next key, printed on the key (every next key when fingers are on).
        const fg = expNote?.finger && fingers !== 'off' ? String(expNote.finger) : '';
        const fEl = el.querySelector('.kfinger');
        if (fEl && fEl.textContent !== fg) fEl.textContent = fg;
        const held = engine.held.has(m);
        const wrong = engine.lastWrong.midi === m && (now - engine.lastWrong.at < 380 || (held && engine.lastWrong.at > now - 4000));
        if (wrong) cls = 'wrong';
        else if (held) cls = sounding[m]?.startsWith('hit') ? sounding[m] : expHand ? 'hit' + expHand : 'down';
        else if (sounding[m]) cls = sounding[m];
        if (expHand && !cls.startsWith('hit') && !wrong) cls += ' next next' + expHand;
        // The key under Hugo's finger names itself, so he always sees what he played.
        if (held) cls += ' held';
        if (prev[m] !== cls) { el.className = `key ${layout[m].black ? 'b' : 'w'} ${cls}`; prev[m] = cls; }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [engine, lo, hi, layout, fingers]);

  const keys = [];
  for (let m = lo; m <= hi; m++) {
    const g = layout[m];
    if (!g) continue;
    keys.push(
      <div
        key={m}
        data-midi={m}
        ref={el => { refs.current[m] = el; }}
        className={`key ${g.black ? 'b' : 'w'}`}
        style={{ left: `${g.x * 100}%`, width: `${g.w * 100}%` }}
      >
        {!g.black && <span className="klabel">{m % 12 === 0 ? noteName(m, naming, true) : ''}</span>}
        <span className="kfinger" />
        <span className="kname">{noteName(m, naming)}</span>
        <span className="kbubble">{noteName(m, naming, true)}</span>
      </div>,
    );
  }
  return <div className="keyboard" aria-hidden="true">{keys}</div>;
}
