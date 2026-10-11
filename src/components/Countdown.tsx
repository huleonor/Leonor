import { useEffect, useState } from 'react';
import type { Engine } from '../lib/engine';

/** The count-in: a big number over the stage, one per beat of the lead-in. */
export function Countdown({ engine }: { engine: Engine }) {
  const [n, setN] = useState(0);

  useEffect(() => {
    let raf = 0, last = -1;
    const frame = () => {
      const c = engine.playing ? engine.countdown : 0;
      const v = c > 0 ? Math.ceil(c) : 0;
      if (v !== last) { last = v; setN(v); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  if (!n) return null;
  return (
    <div className="countin" aria-live="assertive">
      <span key={n} className="countin-num">{n}</span>
    </div>
  );
}
