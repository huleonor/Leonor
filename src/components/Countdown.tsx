import { useEffect, useState } from 'react';
import type { Engine } from '../lib/engine';

/** The count-in: a big number over the stage, one per beat of the count-in. */
export function Countdown({ engine }: { engine: Engine }) {
  const [n, setN] = useState(0);

  useEffect(() => {
    let raf = 0, last = -1;
    const frame = () => {
      // Counts up to the music: with the beat a bar in tempo (1, 2, 3 in 3/4).
      const v = engine.countNumber();
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
