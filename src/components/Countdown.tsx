import { useEffect, useState } from 'react';
import type { Engine } from '../lib/engine';

/** The display counts in: a big numeral and a row of beat LEDs, like a metronome's. */
export function Countdown({ engine, caption }: { engine: Engine; caption: string }) {
  const [n, setN] = useState(0);
  const [total, setTotal] = useState(3);

  useEffect(() => {
    let raf = 0, last = -1;
    const frame = () => {
      const c = engine.playing ? engine.countdown : 0;
      const v = c > 0 ? Math.ceil(c) : 0;
      if (v !== last) {
        if (last <= 0 && v > 0) setTotal(v);
        last = v;
        setN(v);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  if (!n) return null;
  return (
    <div className="countin" aria-live="assertive">
      <span className="countin-num">{n}</span>
      <span className="countin-leds" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => <i key={i} className={i < total - n + 1 ? 'on' : ''} />)}
      </span>
      <span className="countin-cap">{caption}</span>
    </div>
  );
}
