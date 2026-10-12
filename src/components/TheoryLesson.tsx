import abcjs from 'abcjs';
import { useEffect, useRef, useState } from 'react';
import type { Card, PathNode, Staff } from '../lib/curriculum';
import { addGems } from '../lib/energy';
import { onNote } from '../lib/input';
import { addPractice } from '../lib/stats';
import type { NoteNaming } from '../lib/types';
import { motion } from 'motion/react';
import { Spot } from './Brand';
import { Confetti, CountUp } from './Confetti';
import { Gem } from './GameIcons';
import { IconBolt, IconClose, IconStar } from './Icons';
import { MiniKeys } from './MiniKeys';
import { AnswerFooter, ProgressBar, Shake, Slide, SPRING } from './Motion';

const XP = 10;
const GEMS = 3;

/** A few bars engraved with abcjs, big and clear. */
function StaffView({ staff }: { staff: Staff }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const head = `X:1\nM:${staff.meter ?? 'none'}\nL:1/4\n`;
    const abc = staff.left
      ? `${head}%%staves {1 2}\nK:${staff.key ?? 'C'}\nV:1 clef=treble\n${staff.notes} |]\nV:2 clef=bass\n${staff.left} |]\n`
      : `${head}K:${staff.key ?? 'C'} clef=${staff.clef ?? 'treble'}\n${staff.notes} |]\n`;
    try {
      abcjs.renderAbc(el, abc, { staffwidth: 340, scale: 1.25, paddingtop: 0, paddingbottom: 0, paddingleft: 0, paddingright: 0, foregroundColor: '#3c3c3c', responsive: 'resize' });
    } catch { el.innerHTML = ''; }
  }, [staff]);
  return <div className="theory-staff" ref={ref} aria-hidden="true" />;
}

const pc = (m: number) => ((m % 12) + 12) % 12;

interface Props {
  node: PathNode;
  color: readonly string[];
  naming: NoteNaming;
  onExit: () => void;
  onDone: () => void;
}

/** A theory lesson, Duolingo style: one idea per card with the staff and the keys, then questions. */
export function TheoryLesson({ node, color, naming, onExit, onDone }: Props) {
  const cards = node.cards ?? [];
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [checked, setChecked] = useState<'right' | 'wrong' | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [wrongs, setWrongs] = useState(0);
  const [finished, setFinished] = useState(false);
  const card: Card | undefined = cards[i];

  // Play cards: the notes to find, in order; chords need every note down at once.
  const [at, setAt] = useState(0);
  const [held, setHeld] = useState<Set<number>>(new Set());
  const [good, setGood] = useState<Set<number>>(new Set());
  const [bad, setBad] = useState<number | null>(null);
  const heldRef = useRef(new Set<number>());

  useEffect(() => { setPicked(null); setChecked(null); setAt(0); setGood(new Set()); setBad(null); }, [i]);

  const key = (midi: number, down: boolean) => {
    if (down) heldRef.current.add(midi); else heldRef.current.delete(midi);
    setHeld(new Set(heldRef.current));
    if (!down || !card || card.t !== 'play' || checked) return;
    const want = card.play[at];
    const same = (a: number, b: number) => (card.exact ? a === b : pc(a) === pc(b));
    const chord = Array.isArray(want) ? want : [want];
    if (!chord.some(w => same(midi, w))) { setBad(midi); setWrongs(n => n + 1); window.setTimeout(() => setBad(null), 500); return; }
    setGood(g => new Set([...g, midi]));
    const all = chord.every(w => [...heldRef.current].some(h => same(h, w)));
    if (!all) return;
    if (at + 1 >= card.play.length) setChecked('right');
    else setAt(at + 1);
  };
  const keyRef = useRef(key);
  keyRef.current = key;
  useEffect(() => onNote(e => keyRef.current(e.midi, e.type === 'on')), []);

  const next = () => {
    if (i + 1 < cards.length) { setI(i + 1); return; }
    addPractice(0, 1, XP);
    addGems(GEMS);
    setFinished(true);
  };

  const check = () => {
    if (!card || card.t !== 'pick' || picked === null) return;
    const ok = picked === card.answer;
    setChecked(ok ? 'right' : 'wrong');
    if (!ok) { setMistakes(m => m + 1); setWrongs(n => n + 1); }
  };

  if (finished) {
    const perfect = mistakes === 0;
    return (
      <div className="theory-screen done" style={{ '--unit': color[0], '--unit-edge': color[1], '--unit-ink': color[2] } as React.CSSProperties}>
        <Confetti />
        <motion.div initial={{ scale: 0.4, rotate: -12, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={SPRING}>
          <Spot tone="star" size={128}><IconStar size={64} /></Spot>
        </motion.div>
        <h1>{perfect ? 'Perfect lesson!' : 'Lesson complete!'}</h1>
        <p className="sub">{perfect ? 'You made no mistakes in this lesson.' : 'Every question answered.'}</p>
        <div className="theory-rewards">
          {[
            ['xp', 'Total XP', <><IconBolt size={20} />+<CountUp to={XP} /></>],
            ['gems', 'Gems', <><Gem size={20} />+{GEMS}</>],
            ['acc', perfect ? 'Amazing' : 'Mistakes', <>{perfect ? '100%' : mistakes}</>],
          ].map(([k, label, val], n) => (
            <motion.span key={k as string} className={`reward ${k}`} initial={{ y: 24, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ ...SPRING, delay: 0.25 + n * 0.12 }}>
              <small>{label}</small><b>{val}</b>
            </motion.span>
          ))}
        </div>
        <button className="btn go big" onClick={onDone}>Continue</button>
      </div>
    );
  }
  if (!card) return null;

  const progress = (i + (checked === 'right' || card.t === 'say' ? 1 : 0)) / cards.length;
  const want = card.t === 'play' ? card.play[at] : undefined;
  const heading = card.t === 'pick' ? 'Choose the answer' : card.t === 'play' ? 'Play it' : 'New idea';
  return (
    <div className="theory-screen" style={{ '--unit': color[0], '--unit-edge': color[1], '--unit-ink': color[2] } as React.CSSProperties}>
      <header className="theory-bar">
        <button className="icon-btn ghost" onClick={onExit} aria-label="Quit lesson"><IconClose size={24} /></button>
        <ProgressBar value={progress} label={`Card ${i + 1} of ${cards.length}`} />
      </header>

      <Slide id={i} className="theory-body">
        <h1 className="theory-kind">{heading}</h1>
        <p className="theory-text">{card.text}</p>
        {card.staff && <StaffView staff={card.staff} />}
        {card.t === 'pick' && (
          <Shake on={checked === 'wrong' ? wrongs : 0} className="theory-options" >
            <div role="radiogroup" className="theory-options-in">
              {card.options.map((o, k) => (
                <motion.button key={o} role="radio" aria-checked={picked === k} disabled={!!checked}
                  whileTap={{ scale: 0.96, y: 2 }}
                  animate={checked === 'right' && k === card.answer ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                  transition={SPRING}
                  className={`option ${picked === k ? 'on' : ''} ${checked && k === card.answer ? 'right' : ''} ${checked === 'wrong' && picked === k ? 'wrong' : ''}`}
                  onClick={() => setPicked(k)}>
                  <span className="option-n">{k + 1}</span>{o}
                </motion.button>
              ))}
            </div>
          </Shake>
        )}
        {(card.keys || card.t === 'play') && (
          <Shake on={card.t === 'play' ? bad : 0} className="theory-keys">
            <MiniKeys
              lo={card.keys?.lo ?? 48} hi={card.keys?.hi ?? 72}
              mark={card.t === 'say' ? card.keys?.mark : card.t === 'pick' ? card.keys?.mark : []}
              labels={card.keys?.labels} held={held} good={good} bad={bad} naming={naming}
              onKey={card.t === 'play' ? key : undefined}
            />
            {card.t === 'play' && want !== undefined && card.play.length > 1 && (
              <p className="fine theory-count">{at + 1} of {card.play.length}</p>
            )}
          </Shake>
        )}
      </Slide>

      <AnswerFooter
        verdict={checked}
        title={checked === 'right' ? ['Nice!', 'Great job!', 'Correct!', 'Brilliant!'][i % 4] : 'Not quite'}
        detail={checked === 'wrong' && card.t === 'pick' ? <>Correct answer: {card.options[card.answer]}</> : undefined}
      >
        {checked ? (
          <button className={`btn big ${checked === 'right' ? 'go' : 'danger'}`} onClick={next}>Continue</button>
        ) : card.t === 'say' ? (
          <button className="btn go big" onClick={next}>Continue</button>
        ) : card.t === 'pick' ? (
          <button className="btn go big" disabled={picked === null} onClick={check}>Check</button>
        ) : (
          <>
            <button className="btn quiet" onClick={next}>Can’t play now</button>
            <p className="fine theory-hint">Play it on your piano, or tap the keys.</p>
          </>
        )}
      </AnswerFooter>
    </div>
  );
}
