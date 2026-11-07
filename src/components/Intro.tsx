/**
 * The way in (the user's choice 2026-11: "an entrance like a professional app's, with an
 * animation"): as the app opens, a page of the notebook. A staff is ruled across it line by line, a
 * short tune drops onto it note by note in the two inks, the name is written in and underlined, and
 * the page lifts away to the song. About two and a half seconds, once per visit, a tap skips it, and
 * it is left out when he asks for less motion. It answers one change of state, the app opening.
 */
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { L } from '../lib/lang';

const KEY = 'leonor:intro-seen';
/** Whether the way in plays on this visit. */
export function introDue() {
  try {
    if (sessionStorage.getItem(KEY)) return false;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  } catch { return false; }
  return true;
}

// A short tune on the staff, in steps from the middle line (up is positive): a rise and a fall.
const TUNE = [-2, 0, 2, 4, 3, 1, 2, -1];
const EXPO = [0.16, 1, 0.3, 1] as const;

export function Intro({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    try { sessionStorage.setItem(KEY, '1'); } catch { /* storage unavailable */ }
    const t = window.setTimeout(() => setLeaving(true), 2300);
    return () => window.clearTimeout(t);
  }, []);
  const W = 320, gap = 10, mid = 60;
  return (
    <motion.div className="intro" role="presentation" onClick={() => setLeaving(true)}
      initial={{ y: 0 }} animate={leaving ? { y: '-100%' } : { y: 0 }} transition={{ duration: 0.55, ease: EXPO }}
      onAnimationComplete={() => { if (leaving) onDone(); }}>
      <div className="intro-page">
        <svg className="intro-staff" viewBox={`0 0 ${W} 120`} aria-hidden="true">
          {[-2, -1, 0, 1, 2].map((k, i) => (
            <motion.line key={k} x1={10} x2={W - 10} y1={mid + k * gap} y2={mid + k * gap}
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: i * 0.06, ease: EXPO }} />
          ))}
          {TUNE.map((st, i) => {
            const x = 50 + i * 32, y = mid - st * gap / 2, up = y >= mid;
            return (
              <motion.g key={i} initial={{ opacity: 0, y: -36 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.45 + i * 0.07, ease: EXPO }}>
                <ellipse className="plate" cx={x + 2} cy={y + 2} rx={6.4} ry={4.6} transform={`rotate(-22 ${x + 2} ${y + 2})`} />
                <ellipse className={i % 3 === 2 ? 'head teal' : 'head'} cx={x} cy={y} rx={6.4} ry={4.6} transform={`rotate(-22 ${x} ${y})`} />
                <line className="stem" x1={up ? x + 5.6 : x - 5.6} x2={up ? x + 5.6 : x - 5.6} y1={y} y2={up ? y - 28 : y + 28} />
              </motion.g>
            );
          })}
        </svg>
        <motion.h1 className="intro-name" initial={{ clipPath: 'inset(0 100% 0 0)' }} animate={{ clipPath: 'inset(0 0% 0 0)' }}
          transition={{ duration: 0.6, delay: 1, ease: EXPO }}>
          Leonor
          <motion.i className="intro-mark" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.35, delay: 1.45, ease: EXPO }} />
        </motion.h1>
        <motion.p className="intro-line" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 1.55, ease: EXPO }}>
          {L('Learn one song at a time.', 'Aprende uma música de cada vez.')}
        </motion.p>
      </div>
    </motion.div>
  );
}
