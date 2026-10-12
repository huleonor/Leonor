/**
 * State-driven motion, Duolingo style: every animation answers a change of state (a step done, an
 * answer checked, a number gained, help needed), never decoration. Springs from `motion`; the
 * whole app runs inside <MotionConfig reducedMotion="user">, so reduced-motion users get none.
 */
import { AnimatePresence, motion, useAnimate, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IconCheck, IconClose } from './Icons';

export const SPRING = { type: 'spring', stiffness: 520, damping: 32 } as const;
export const SOFT = { type: 'spring', stiffness: 260, damping: 26 } as const;

/** The lesson progress bar: springs forward and flashes its highlight each time it grows. */
export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const pct = Math.max(0.04, Math.min(1, value)) * 100;
  const prev = useRef(value);
  const [flash, setFlash] = useState(0);
  useEffect(() => { if (value > prev.current) setFlash(f => f + 1); prev.current = value; }, [value]);
  return (
    <span className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <motion.i animate={{ width: `${pct}%` }} transition={SOFT}>
        <motion.b key={flash} initial={{ opacity: flash ? 0.9 : 0 }} animate={{ opacity: 0 }} transition={{ duration: 0.6 }} />
      </motion.i>
    </span>
  );
}

/** A number that pops when it changes (gems, energy, XP, streak). */
export function Bump({ value, className }: { value: number | string; className?: string }) {
  return (
    <motion.span key={String(value)} className={className} initial={{ scale: 1.35, y: -2 }} animate={{ scale: 1, y: 0 }} transition={SPRING} style={{ display: 'inline-block' }}>
      {value}
    </motion.span>
  );
}

export type Verdict = 'right' | 'wrong' | null;

/**
 * The answer footer: quiet with its button while he works, then slides up green or red with the
 * verdict, the mark popping in, the way Duolingo checks an answer.
 */
export function AnswerFooter({ verdict, title, detail, children }: { verdict: Verdict; title?: string; detail?: ReactNode; children: ReactNode }) {
  return (
    <footer className={`answer-foot ${verdict ?? ''}`}>
      <AnimatePresence>
        {verdict && (
          <motion.div className={`answer-sheet ${verdict}`} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={SPRING}>
            <div className="answer-verdict">
              <motion.span className="verdict-mark" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...SPRING, delay: 0.08 }}>
                {verdict === 'right' ? <IconCheck size={30} /> : <IconClose size={30} />}
              </motion.span>
              <div><b>{title}</b>{detail && <p>{detail}</p>}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="answer-actions">{children}</div>
    </footer>
  );
}

/** Shakes its children once each time `on` changes to a truthy value: a wrong answer, a wrong key. */
export function Shake({ on, children, className }: { on: unknown; children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  const [scope, animate] = useAnimate();
  useEffect(() => { if (on && !reduce && scope.current) animate(scope.current, { x: [0, -10, 9, -6, 4, 0] }, { duration: 0.4 }); }, [on]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={scope} className={className}>{children}</div>;
}

/** Content that slides in from the right when a lesson moves to its next card. */
export function Slide({ id, children, className }: { id: string | number; children: ReactNode; className?: string }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={id} className={className} initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -40, opacity: 0 }} transition={SOFT}>
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
