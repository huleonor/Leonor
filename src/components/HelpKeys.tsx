import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { Engine } from '../lib/engine';
import { pickRange } from '../lib/keys';
import type { FingerMode, NoteNaming } from '../lib/types';
import { Keyboard } from './Keyboard';
import { SOFT } from './Motion';

const WRONG_MS = 2500;
const LINGER_MS = 1600;

/**
 * The keyboard as help, not furniture: it rises only when he is stuck (a long pause or a few wrong
 * notes) or just played a wrong key, shows a small stretch of keys around the notes he needs with
 * them lit, and slides away again once he is playing right.
 */
export function HelpKeys({ engine, naming, fingers, always = false, lo, hi, wide = false, reading = false }: { engine: Engine; naming: NoteNaming; fingers: FingerMode; always?: boolean; /** A fixed range: every key the piece needs. */ lo?: number; hi?: number; /** Full width along the bottom of a lesson. */ wide?: boolean; /** Mastery: he learns to read, so the keys come only when the staff's help (the note's name) was not enough: three wrong keys on one note, or a long stall. */ reading?: boolean }) {
  const [show, setShow] = useState(always);
  const [range, setRange] = useState<[number, number]>(() => pickRange(60, 72, 14));
  const lastNeed = useRef(0);

  useEffect(() => {
    let raf = 0, shown = always, key = '';
    const frame = () => {
      const now = performance.now();
      const wrong = engine.lastWrong.at > 0 && now - engine.lastWrong.at < WRONG_MS;
      const need = always || (reading
        ? engine.waiting && (engine.wrongInWait >= 3 || (engine.wrongInWait >= 1 && now - engine.waitSince > 12000))
        : engine.hintVisible() || wrong);
      if (need) lastNeed.current = now;
      const next = need || now - lastNeed.current < LINGER_MS;
      if (next !== shown) { shown = next; setShow(next); }
      if (need && lo === undefined) {
        // Centre the stretch of keys on what he has to play now (and the key he hit by mistake).
        const want = engine.waitingFor().map(w => w.midi);
        const around = want.length ? want : engine.expected();
        // The wrong key joins the stretch only when it is near the right one.
        const near = wrong && around.some(m => Math.abs(m - engine.lastWrong.midi) <= 12);
        const ms = [...around, ...(near ? [engine.lastWrong.midi] : [])].filter(m => m > 0);
        if (ms.length) {
          const r = pickRange(Math.min(...ms), Math.max(...ms), 14);
          const k = r.join('-');
          if (k !== key) { key = k; setRange(r); }
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [engine, always, lo]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div className={`help-keys ${wide ? 'wide' : ''}`} initial={{ y: '110%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '110%', opacity: 0 }} transition={SOFT} aria-hidden="true">
          <Keyboard engine={engine} lo={lo ?? range[0]} hi={hi ?? range[1]} naming={naming} fingers={fingers} showNext />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
