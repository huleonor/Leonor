import { useEffect, useMemo, useState } from 'react';

const COLORS = ['#a5ed6e', '#1cb0f6', '#ffc800', '#ff9600', '#ce82ff', '#ff4b4b'];

/** A burst of confetti over a card, for a lesson well played. Same pieces every render. */
export function Confetti({ n = 36 }: { n?: number }) {
  const pieces = useMemo(() => Array.from({ length: n }, (_, i) => {
    const r = (k: number) => ((Math.sin(i * 97.3 + k * 13.1) + 1) / 2);
    return {
      left: `${r(1) * 100}%`, background: COLORS[i % COLORS.length],
      '--x': `${(r(2) - 0.5) * 160}px`, '--r': `${(r(3) - 0.5) * 900}deg`, '--d': `${r(4) * 0.35}s`,
    } as React.CSSProperties;
  }), [n]);
  return <div className="confetti" aria-hidden="true">{pieces.map((st, i) => <i key={i} style={st} />)}</div>;
}

/** A number that counts up from 0, Duolingo's XP tally. */
export function CountUp({ to, ms = 700 }: { to: number; ms?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setV(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return <>{v}</>;
}
