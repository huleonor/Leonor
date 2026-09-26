import { useEffect, useMemo, useState } from 'react';
import type { Engine } from '../lib/engine';
import { keyLayout } from '../lib/keys';
import { noteName } from '../lib/names';
import type { NoteNaming } from '../lib/types';

export function WaitHint({ engine, naming }: { engine: Engine; naming: NoteNaming }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick(x => x + 1), 250);
    const off = engine.on(e => { if (e.type === 'state' || e.type === 'wrong') tick(x => x + 1); });
    return () => { window.clearInterval(id); off(); };
  }, [engine]);

  const show = engine.hintVisible();
  const want = show ? engine.waitingFor() : [];
  const wrong = show && engine.wrongInWait > 0 ? engine.lastWrong.midi : -1;
  const key = want.map(w => w.midi).join(',') + '/' + wrong;

  const view = useMemo(() => {
    if (!want.length) return null;
    const all = [...want.map(w => w.midi), ...(wrong >= 0 ? [wrong] : [])];
    const lo = Math.min(...all) - (Math.min(...all) % 12);
    const hi = Math.max(...all) - (Math.max(...all) % 12) + 11;
    return { lo, hi, layout: keyLayout(lo, hi) };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!view) return null;
  const hands = new Set(want.map(w => w.hand));
  const handText = hands.size === 2 ? 'Both hands' : hands.has('L') ? 'Left hand' : 'Right hand';
  const keys = [];
  for (let m = view.lo; m <= view.hi; m++) {
    const g = view.layout[m];
    if (!g) continue;
    const target = want.find(w => w.midi === m);
    const cls = target ? `t t${target.hand}` : m === wrong ? 'x' : '';
    keys.push(
      <div key={m} className={`hk ${g.black ? 'b' : 'w'} ${cls}`} style={{ left: `${g.x * 100}%`, width: `${g.w * 100}%` }}>
        {(target || m === wrong) && <span>{noteName(m, naming, true)}</span>}
      </div>,
    );
  }
  return (
    <div className="wait-hint" role="status" aria-live="polite">
      <div className="wh-text">
        <p className="wh-title">Play <b>{want.map(w => noteName(w.midi, naming, true)).join(' + ')}</b></p>
        <p className="wh-sub">{wrong >= 0 && !want.some(w => w.midi === wrong) ? <em>You played {noteName(wrong, naming, true)}</em> : handText}</p>
      </div>
      <div className="wh-keys">{keys}</div>
    </div>
  );
}
