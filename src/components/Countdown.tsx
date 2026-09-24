import { useEffect, useRef, useState } from 'react';
import type { Engine } from '../lib/engine';

/** Academy-leader style countdown shown while the engine counts in. */
export function Countdown({ engine, caption }: { engine: Engine; caption: string }) {
  const [n, setN] = useState(0);
  const sweepRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0, last = -1;
    const frame = () => {
      const c = engine.playing ? engine.countdown : 0;
      const v = c > 0 ? Math.ceil(c) : 0;
      if (v !== last) { last = v; setN(v); }
      if (sweepRef.current && c > 0) {
        const frac = 1 - (c - Math.floor(c) || 1);
        sweepRef.current.style.setProperty('--sweep', `${frac * 360}deg`);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  if (!n) return null;
  return (
    <div className="leader" aria-live="assertive">
      <div className="leader-sweep" ref={sweepRef} />
      <div className="leader-cross" />
      <div className="leader-ring" />
      <div className="leader-ring inner" />
      <span className="leader-num">{n}</span>
      <span className="leader-cap">{caption}</span>
    </div>
  );
}
