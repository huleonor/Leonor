import { useMemo } from 'react';
import { holdNote, releaseNote, unlockAudio } from '../lib/audio';
import { keyLayout } from '../lib/keys';
import { noteName } from '../lib/names';
import type { NoteNaming } from '../lib/types';

interface Props {
  lo: number;
  hi: number;
  /** Keys to point out. */
  mark?: number[];
  labels?: boolean;
  /** Keys down right now (his piano or his taps). */
  held?: Set<number>;
  /** Keys he got right, and the one he got wrong. */
  good?: Set<number>;
  bad?: number | null;
  naming: NoteNaming;
  onKey?: (midi: number, down: boolean) => void;
}

/** A small keyboard to look at and tap, for the theory lessons. */
export function MiniKeys({ lo, hi, mark = [], labels, held, good, bad, naming, onKey }: Props) {
  const layout = useMemo(() => keyLayout(lo, hi), [lo, hi]);
  const keys = [];
  for (let m = lo; m <= hi; m++) {
    const g = layout[m];
    if (!g) continue;
    const cls = ['mk', g.black ? 'b' : 'w', mark.includes(m) ? 'mark' : '', held?.has(m) ? 'down' : '', good?.has(m) ? 'good' : '', bad === m ? 'bad' : ''].join(' ');
    keys.push(
      <button
        key={m} className={cls} style={{ left: `${g.x * 100}%`, width: `${g.w * 100}%` }} tabIndex={onKey ? 0 : -1}
        aria-label={noteName(m, naming, true)} disabled={!onKey}
        onPointerDown={e => { if (!onKey) return; e.preventDefault(); unlockAudio(); holdNote(m, 80); onKey(m, true); }}
        onPointerUp={() => { if (!onKey) return; releaseNote(m); onKey(m, false); }}
        onPointerLeave={e => { if (!onKey || !(e.buttons & 1)) return; releaseNote(m); onKey(m, false); }}
      >
        {(labels && !g.black && mark.includes(m)) || (labels && !g.black && !mark.length) ? <span>{noteName(m, naming)}</span> : null}
      </button>,
    );
  }
  return <div className="minikeys">{keys}</div>;
}
