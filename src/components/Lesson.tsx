import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { L } from '../lib/lang';
import { barsToTime } from '../lib/analysis';
import { loadPiano, unlockAudio } from '../lib/audio';
import { coachRun, settingsFor } from '../lib/adapt';
import { recordStep, starsFor, type CourseStep } from '../lib/course';
import { listenForSkills } from '../lib/skills';
import { fastLearner, recordPace } from '../lib/path';
import type { SongInfo } from '../lib/catalog';
import { Engine } from '../lib/engine';
import { pctOf, type MasterySession, type MasteryVerdict } from '../lib/mastery';
import { onNote, setMicRange, type LinkState, type Source } from '../lib/input';
import { pickRange } from '../lib/keys';
import { formatSpeed, noteName } from '../lib/names';
import { usePracticeClock } from '../lib/practiceClock';
import { addPractice } from '../lib/stats';
import type { FingerMode, Settings } from '../lib/types';
import { AnimatePresence, motion } from 'motion/react';
import { CountUp } from './Confetti';
import { Bump, Cheer, SOFT, SPRING } from './Motion';
import { HelpKeys } from './HelpKeys';
import { metronomeOn, setMetronome, useMetronome } from '../lib/metronome';
import { Countdown } from './Countdown';
import { FallingNotes } from './FallingNotes';
import { IconArrowDown, IconArrowLeft, IconArrowRight, IconArrowUp, IconCheck, IconHeadphones, IconMoon, IconPause, IconPlay, IconRestart, IconStar, IconTarget } from './Icons';
import { Keyboard } from './Keyboard';
import { LessonStaff } from './LessonStaff';
import type { Section } from './SongScreen';
import { Segmented } from './ui';

const HEADLINE = () => [L('Almost there', 'Quase'), L('Passed', 'Passou'), L('Great job!', 'Muito bem!'), L('Perfect!', 'Perfeito!')];
const SPEEDS = [0.6, 0.8, 1, 1.2];

function stepLabel(s: CourseStep) {
  return s.title;
}

function intro(s: CourseStep): string {
  if (!s.wait) return L('With the beat: a slip takes you back a bar', 'Com o ritmo: um erro leva-te um compasso atrás');
  if (s.id.endsWith('x')) return L('The tricky bit once more, slowly', 'A parte difícil mais uma vez, devagar');
  return s.hands === 'R' ? L('Right hand: the music waits for you', 'Mão direita: a música espera por ti') : s.hands === 'L' ? L('Left hand: the music waits for you', 'Mão esquerda: a música espera por ti') : L('Both hands: the music waits for you', 'Duas mãos: a música espera por ti');
}

interface Props {
  info: SongInfo;
  section: Section;
  startAt?: string;
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  links: Record<Source, LinkState>;
  onExit: () => void;
  onNextSection?: () => void;
  /** In the videos' feed (one course): a passed step calls this at once, no result screen. */
  onFinish?: () => void;
  /** Words for the last step's "next" button and the way out (a song's lesson, or the daily session). */
  nextLabel?: string;
  exitLabel?: string;
  /** Stars the last step needs before "next" shows (a test needs 2). Below it, `onStop` ends the run. */
  minStars?: number;
  onStop?: () => void;
  stopLabel?: string;
  onSettings: () => void;
  onRecorded: () => void;
  /**
   * Path lessons adapt: a perfect free-play run passes the free-play steps it proves and goes on
   * to the beat, and a fast learner starts with both hands (back to one at a time if that is hard).
   */
  adaptive?: boolean;
  /**
   * Mastery, Simply Piano style: each step repeats until it has its good runs (the dots) and the
   * next one starts by itself; the section's result shows for three seconds, then the next section.
   */
  session?: MasterySession;
}

/** Teach me: one section, step by step (right hand, left hand, together, in tempo), Simply Piano style. */
export function Lesson(props: Props) {
  const { section, startAt, adaptive, info } = props;
  const steps = section.steps;
  const stars = (id: string) => info.prog[id]?.stars ?? 0;
  // A fast learner new to this lesson starts with both hands together.
  const [fast] = useState(() => {
    if (!adaptive || startAt || steps.some(s => stars(s.id) > 0) || !fastLearner()) return -1;
    const b = steps.findIndex(s => s.wait && !s.listen && s.hands === 'both');
    return b > 0 ? b : -1;
  });
  const [index, setIndex] = useState(() => (fast >= 0 ? fast : Math.max(0, steps.findIndex(s => s.id === startAt))));
  const [run, setRun] = useState(0);
  const tried = useRef(new Set<string>());
  const step = steps[index];
  const dir = useRef(1);
  const go = (i: number) => { const j = Math.max(0, Math.min(steps.length - 1, i)); dir.current = j >= index ? 1 : -1; setIndex(j); setRun(r => r + 1); };
  // The steps are scrolled like the videos (the user's choice 2026-11): a swipe up (or the wheel,
  // or Page Down) brings the next step up from below, a swipe down the one before. Only between a
  // lesson's own steps: a single step (the staff step in the video feed) leaves the swipe to the feed.
  const prev = index > 0 ? () => go(index - 1) : undefined;
  const next = index < steps.length - 1 ? () => go(index + 1) : undefined;
  const nav = useRef({ prev, next });
  nav.current = { prev, next };
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);
  const wheel = useRef({ sum: 0, last: 0 });
  const free = (t: EventTarget | null) => !(t instanceof Element && t.closest('.sheet, .lesson-options, input, select, [data-noswipe]'));
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'PageDown') { nav.current.next?.(); e.preventDefault(); }
      if (e.key === 'PageUp') { nav.current.prev?.(); e.preventDefault(); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const swipe = {
    onTouchStart: (e: React.TouchEvent) => { const p = e.touches[0]; touch.current = e.touches.length === 1 && free(e.target) ? { x: p.clientX, y: p.clientY, t: Date.now() } : null; },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = touch.current; touch.current = null;
      if (!s) return;
      const p = e.changedTouches[0], dx = p.clientX - s.x, dy = p.clientY - s.y;
      if (Date.now() - s.t > 800 || Math.abs(dy) < 60 || Math.abs(dy) < 1.5 * Math.abs(dx)) return;
      (dy < 0 ? nav.current.next : nav.current.prev)?.();
    },
    onWheel: (e: React.WheelEvent) => {
      if (!free(e.target) || (!nav.current.next && !nav.current.prev)) return;
      const w = wheel.current, now = Date.now();
      if (now - w.last < 700) return;
      w.sum = (Math.sign(w.sum) === Math.sign(e.deltaY) ? w.sum : 0) + e.deltaY;
      if (Math.abs(w.sum) < 80) return;
      const f = w.sum > 0 ? nav.current.next : nav.current.prev;
      w.sum = 0;
      if (f) { w.last = now; f(); }
    },
  };
  // What a perfect free-play run proves: the other free-play steps on the same hands (both hands
  // prove each hand alone). Those pass with it, and the lesson goes on to the next thing it has not.
  const proves = (k: number) => steps.filter((st, j) => j !== k && st.wait && (steps[k].hands === 'both' || st.hands === steps[k].hands));
  const leap = (k: number) => {
    const ids = new Set(proves(k).map(st => st.id));
    const j = steps.findIndex((st, i) => i > k && !ids.has(st.id));
    return ids.size && j > k ? { j, ids } : null;
  };
  const target = adaptive && step.wait ? leap(index) : null;
  const firstTry = !tried.current.has(step.id);
  return (
    <div className={`lesson-scroll ${steps.length > 1 ? 'steps' : ''}`} {...swipe}>
    <AnimatePresence initial={false} custom={dir.current} mode="popLayout">
    <motion.div key={step.id} className="lesson-slide" custom={dir.current}
      variants={{ in: (d: number) => ({ y: `${d * 100}%` }), at: { y: 0 }, out: (d: number) => ({ y: `${-d * 100}%` }) }}
      initial="in" animate="at" exit="out" transition={{ type: 'tween', ease: [0.16, 1, 0.3, 1], duration: 0.45 }}>
    <LessonRun
      key={`${step.id}-${run}`}
      {...props}
      step={step}
      index={index}
      onPrev={prev}
      onNext={next}
      onAgain={() => setRun(r => r + 1)}
      onPace={adaptive && step.wait ? perfect => { if (firstTry) recordPace(perfect); tried.current.add(step.id); } : undefined}
      onPerfect={target ? async acc => {
        for (const st of steps) if (target.ids.has(st.id) && stars(st.id) === 0) await recordStep(info.song!.entry.id, st.id, acc);
        props.onRecorded();
        go(target.j);
      } : undefined}
      onStruggle={fast >= 0 && index === fast ? () => go(0) : undefined}
      onGo={go}
    />
    </motion.div>
    </AnimatePresence>
    </div>
  );
}

interface RunProps extends Props {
  step: CourseStep;
  index: number;
  onPrev?: () => void;
  onNext?: () => void;
  onAgain: () => void;
  /** A free-play run ended: perfect or not (for how fast he learns). */
  onPace?: (perfect: boolean) => void;
  /** A perfect free-play run: pass what it proves and move on. */
  onPerfect?: (accuracy: number) => void;
  /** Both hands first did not go well: back to one hand at a time. */
  onStruggle?: () => void;
  onGo: (i: number) => void;
}

function LessonRun({ info, section, step, index, settings, update, onExit, onNextSection, onFinish, nextLabel = L('Next section', 'Secção seguinte'), exitLabel = L('Back to the song', 'Voltar à música'), minStars = 1, onStop, stopLabel = L('Finish', 'Terminar'), onRecorded, onPrev, onNext, onAgain, session, onPace, onPerfect, onStruggle, onGo }: RunProps) {
  const song = step.song ?? info.song!;
  // The coach sets this step's speed, how soon help comes and how many finger numbers show.
  // A Mastery step comes with its own speed: the planner climbs the tempo ladder itself.
  const coach = useMemo(() => { const c = settingsFor(step.speed, step.wait); return step.exact ? { ...c, speed: step.speed } : c; }, [step.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const fingers: FingerMode = settings.fingers === 'off' ? 'off' : step.fingers ?? (settings.fingers === 'some' && coach.fingers === 'all' ? 'some' : coach.fingers);
  const [speed, setSpeed] = useState(coach.speed);
  const [listen, setListen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<{ accuracy: number; hit: number; total: number; wrong: number; strays: number; stars: number; verdict?: MasteryVerdict } | null>(null);
  // With the beat, a slip sends him back: say where from, briefly.
  const [slip, setSlip] = useState<{ from: number; n: number } | null>(null);
  // Mastery: how the last run went (a tick, or again), and a line when a smaller stretch comes first.
  const [rep, setRep] = useState<{ pass: boolean; line?: string; n: number } | null>(null);
  // Right notes in a row, for the praise that pops at milestones.
  const [combo, setCombo] = useState(0);
  const comboRef = useRef(0);
  const heard = useRef(false);
  const [say, setSay] = useState<{ text: string; wrong?: string }>({ text: intro(step) });
  // A short step that went well moves on by itself, like Simply Piano; one that did not, starts again.
  const [flash, setFlash] = useState<{ text: string; good: boolean } | null>(null);
  const [, bump] = useReducer((x: number) => x + 1, 0);
  usePracticeClock();
  const [metro, setMetro] = useState(metronomeOn);
  const [alwaysKeys, setAlwaysKeys] = useState(() => { try { return localStorage.getItem('hugos-piano:keys') === 'always'; } catch { return false; } });
  const toggleKeys = () => setAlwaysKeys(a => { try { localStorage.setItem('hugos-piano:keys', a ? 'help' : 'always'); } catch { /* ignore */ } return !a; });

  const engine = useMemo(() => new Engine(song, {
    // Free play: the cursor jumps to the next notes and waits there, no bars to sit through.
    speed: coach.speed, wait: false, follow: step.wait, hands: step.hands, listen: false, hintAfter: coach.hintAfter, fixSlips: !step.wait && !step.grace, grace: step.wait ? 0 : step.grace,
    accompaniment: settings.accompaniment, lenient: settings.input === 'mic',
  }), [song, step.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // (Keyed by id: refreshed progress hands down new step objects for the same step.)
  useMetronome(engine, !step.wait && metro);

  useEffect(() => { engine.setSegment(barsToTime(engine.measureTimes, step.from, step.to)); bump(); }, [engine]); // eslint-disable-line react-hooks/exhaustive-deps
  // Wait steps start by themselves, like Simply Piano: the run-up plays, then the music waits for him.
  // A listening step plays the piece to him first.
  // Mastery: with the beat, the count-in starts by itself.
  useEffect(() => {
    if (!session || step.wait) return;
    const id = window.setTimeout(() => { if (!engine.started) { unlockAudio(); engine.play(3); bump(); } }, 700);
    return () => window.clearTimeout(id);
  }, [engine]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!step.wait) return;
    const id = window.setTimeout(() => {
      if (engine.started) return;
      unlockAudio();
      if (step.listen && !heard.current) { heard.current = true; setListen(true); engine.setOptions({ listen: true }); engine.restart(); engine.play(1); }
      else { engine.toFirstNote(); engine.play(0); }
      bump();
    }, 500);
    return () => window.clearTimeout(id);
  }, [engine]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setMicRange(song.range[0], song.range[1]); loadPiano().catch(() => {}); }, [song]);
  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __engine: Engine }).__engine = engine; }, [engine]);
  useEffect(() => { engine.setOptions({ speed, listen, accompaniment: settings.accompaniment, lenient: settings.input === 'mic' }); }, [engine, speed, listen, settings.accompaniment, settings.input]);

  useEffect(() => {
    // Every chord he plays teaches the app about his skills; a whole run also tunes the coach.
    let skills = listenForSkills(engine);
    let tracker = session?.track(engine, index);
    let slipTimer = 0;
    const off = engine.on(e => {
      if (e.type === 'state' || e.type === 'status') bump();
      if (e.type === 'rewind') {
        comboRef.current = 0; setCombo(0);
        setSlip(sl => ({ from: e.from, n: (sl?.n ?? 0) + 1 }));
        window.clearTimeout(slipTimer);
        slipTimer = window.setTimeout(() => setSlip(null), 1800);
      }
      if (e.type === 'press') {
        if (e.ok && e.id === undefined) return;
        comboRef.current = e.ok ? comboRef.current + 1 : 0;
        setCombo(comboRef.current);
      }
      if (e.type === 'end') {
        if (engine.opts.listen) {
          setListen(false); engine.setOptions({ listen: false }); engine.restart(); engine.started = false; skills.stop(); skills = listenForSkills(engine); tracker?.stop(); tracker = session?.track(engine, index); bump();
          // Heard it: now his turn.
          if (step.wait) window.setTimeout(() => { if (!engine.started) { engine.toFirstNote(); engine.play(0); bump(); } }, 900);
          return;
        }
        const run = skills.stop();
        // The coach quietly tunes the next steps; the learner just keeps going.
        coachRun(run, !step.wait);
        const verdict = tracker?.finish();
        tracker = undefined;
        setSlip(null);
        const s = engine.stats();
        if (session && verdict) {
          // Mastery: no screens between runs. A tick or "again", then the same step, the next, or a smaller stretch.
          const out = session.after(index, verdict);
          if (out.kind === 'done') {
            const sum = session.summary();
            const stars = starsFor(sum.accuracy);
            addPractice(0, 1, 0);
            onRecorded();
            setResult({ ...s, accuracy: sum.accuracy, stars, verdict: sum });
            return;
          }
          setRep({ pass: out.pass, line: out.line, n: Date.now() });
          window.setTimeout(() => { setRep(null); if (out.kind === 'again') onAgain(); else if (out.kind === 'next') onNext?.(); else onGo(index); }, out.line ? 2200 : 900);
          return;
        }
        const stars = starsFor(s.accuracy);
        const quick = (step.wait || !!onFinish) && (!!onNext || !!onFinish);
        const perfect = step.wait && s.wrong === 0 && s.accuracy >= 0.999;
        onPace?.(perfect);
        if (quick && onStruggle && s.accuracy < 0.85) {
          setFlash({ text: L('One hand at a time first', 'Primeiro uma mão de cada vez'), good: false });
          window.setTimeout(onStruggle, 1300);
          return;
        }
        if (quick && stars === 0) {
          setFlash({ text: L('Let’s try that again', 'Vamos tentar outra vez'), good: false });
          window.setTimeout(onAgain, 1300);
          return;
        }
        recordStep(song.entry.id, step.id, s.accuracy).then(() => {
          // A finished step counts as practice (for the reminders); nothing to collect or spend.
          if (stars > 0) addPractice(0, 1, 0);
          onRecorded();
          if (quick && perfect && onPerfect) {
            setFlash({ text: L('Perfect! On to the beat', 'Perfeito! Agora com o ritmo'), good: true });
            window.setTimeout(() => onPerfect(s.accuracy), 1100);
            return;
          }
          if (quick) {
            setFlash({ text: stars === 3 ? L('Perfect!', 'Perfeito!') : stars === 2 ? L('Great!', 'Muito bem!') : L('Good!', 'Bem!'), good: true });
            window.setTimeout(onNext ?? onFinish!, 1100);
            return;
          }
          setResult({ ...s, stars });
        });
      }
    });
    const offNote = onNote(e => engine.input(e));
    return () => { off(); offNote(); skills.stop(); tracker?.stop(); window.clearTimeout(slipTimer); engine.destroy(); };
  }, [engine]); // eslint-disable-line react-hooks/exhaustive-deps

  // The instruction line says what to play now, and what he played instead.
  useEffect(() => {
    let raf = 0, last = '';
    const frame = () => {
      let next: { text: string; wrong?: string } = { text: intro(step) };
      const target = engine.groups[engine.gi];
      if (engine.opts.listen) next = { text: L('Listen to this part, then play it', 'Ouve esta parte e depois toca-a') };
      else if (target && step.wait && (engine.waiting || engine.stats().hit === 0 || engine.countdown > 0)) {
        const want = engine.waitingFor();
        if (!want.length) { raf = requestAnimationFrame(frame); return; }
        const f = want.length === 1 && want[0].finger ? ` with finger ${want[0].finger}` : '';
        const wrong = engine.wrongInWait > 0 && performance.now() - engine.lastWrong.at < 2500 && !want.some(w => w.midi === engine.lastWrong.midi)
          ? L(`You played ${noteName(engine.lastWrong.midi, settings.naming, true)}`, `Tocaste ${noteName(engine.lastWrong.midi, settings.naming, true)}`) : undefined;
        next = { text: `${L('Play', 'Toca')} ${want.map(w => noteName(w.midi, settings.naming, true)).join(' + ')}${f}`, wrong };
      } else if (engine.started && engine.playing) next = { text: step.wait ? L('Keep going', 'Continua') : L('Keep playing in tempo', 'Continua a tempo') };
      const key = next.text + '|' + (next.wrong ?? '');
      if (key !== last) { last = key; setSay(next); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [engine, step, settings.naming]);

  // Keep the screen awake while the lesson runs.
  useEffect(() => {
    if (!engine.playing) return;
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock?.request('screen').then(l => (lock = l)).catch(() => {});
    return () => { lock?.release().catch(() => {}); };
  }, [engine, engine.playing]);

  const [lo, hi] = useMemo(() => {
    const seg = barsToTime(engine.measureTimes, step.from, step.to);
    const ms = song.notes.filter(n => n.time >= seg.from - 1e-3 && n.time < seg.to && (step.hands === 'both' || n.hand === step.hands)).map(n => n.midi);
    return ms.length ? pickRange(Math.min(...ms), Math.max(...ms)) : pickRange(song.range[0], song.range[1]);
  }, [engine, song, step]);

  const stats = engine.stats();
  const start = () => { unlockAudio(); setPaused(false); engine.play(step.wait ? 0 : 3); bump(); };
  const pause = () => { engine.pause(); setPaused(true); bump(); };
  const resume = () => { unlockAudio(); setPaused(false); engine.play(1); bump(); };
  const listenFirst = () => { unlockAudio(); setPaused(false); setListen(true); engine.setOptions({ listen: true }); engine.restart(); engine.play(1); };
  const next = result && result.stars >= minStars ? (onNext ? { label: `${L('Next', 'A seguir')}: ${stepLabel(section.steps[index + 1])}`, go: onNext } : onNextSection ? { label: nextLabel, go: onNextSection } : null)
    : result && onStop && !onNext ? { label: stopLabel, go: onStop } : null;

  const progress = (index + (flash?.good ? 1 : stats.total ? stats.hit / stats.total : 0)) / section.steps.length;

  return (
    <div className={`lesson simply view-${settings.view}`}>
      <header className="lesson-bar">
        <motion.button className="lesson-pause" whileTap={{ scale: 0.9 }} onClick={engine.playing ? pause : () => setPaused(true)} aria-label={L('Pause', 'Pausa')}><IconPause size={24} /></motion.button>
        {/* Like Simply Piano the bar holds only pause and the step count: the music says what to
            play, and the instruction is for screen readers. The piano connection lives in Settings. */}
        <div className="lesson-say" role="status" aria-live="polite">
          <p className="sr-only">{stepLabel(step)}. {say.wrong ? `${say.wrong}. ${say.text}` : say.text}</p>
        </div>
        <div className="lesson-nav">
          {(onPrev || onNext) && <button className="lesson-arrow" onClick={onPrev} disabled={!onPrev} aria-label={L('Previous step', 'Passo anterior')}><IconArrowUp size={20} /></button>}
          <div className="lesson-count" aria-label={`${section.title}, ${L('step', 'passo')} ${index + 1} ${L('of', 'de')} ${section.steps.length}: ${stepLabel(step)}`}>
            <motion.i animate={{ width: `${Math.max(0.04, progress) * 100}%` }} transition={SOFT} />
            <span><Bump value={index + (flash?.good ? 1 : 0)} />/{section.steps.length}</span>
          </div>
          {(onPrev || onNext) && <button className="lesson-arrow" onClick={onNext} disabled={!onNext} aria-label={L('Next step', 'Passo seguinte')}><IconArrowDown size={20} /></button>}
          {session && (step.reps ?? 1) > 1 && (
            <span className="rep-dots" aria-label={L(`${Math.min(session.good[index], step.reps ?? 1)} of ${step.reps} good runs`, `${Math.min(session.good[index], step.reps ?? 1)} de ${step.reps} boas tentativas`)}>
              {Array.from({ length: step.reps ?? 1 }, (_, k) => {
                const on = k < session.good[index];
                return <motion.i key={`${k}-${on}`} className={on ? 'on' : ''} initial={on ? { scale: 0.4 } : false} animate={{ scale: 1 }} transition={SPRING}>{on ? <IconCheck size={11} /> : k + 1}</motion.i>;
              })}
            </span>
          )}
        </div>
      </header>

      <main className="lesson-stage">
        {settings.view === 'notes'
          ? <FallingNotes engine={engine} lo={lo} hi={hi} naming={settings.naming} fingers={settings.fingers} inset={0} onTap={pause} />
          : <LessonStaff engine={engine} from={step.from} to={step.to} feedback fingers={fingers} only={step.hands === 'R' || step.hands === 'L' ? step.hands : undefined} />}
        <Countdown engine={engine} />
        <Cheer combo={combo} />
        <AnimatePresence>
          {rep && (
            rep.line
              ? <motion.p className="lesson-listening zoom" role="status" key={`rep-${rep.n}`} initial={{ y: -10, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={SPRING}>{rep.line}</motion.p>
              : <motion.span className={`rep-mark ${rep.pass ? 'good' : 'again'}`} role="status" aria-label={rep.pass ? L('Good', 'Bem') : L('Again', 'Outra vez')} key={`rep-${rep.n}`} initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} transition={SPRING}>
                  {rep.pass ? <IconCheck size={30} /> : <IconRestart size={26} />}
                </motion.span>
          )}
          {slip && !listen && (
            <motion.p className="lesson-listening slip" role="status" key={`slip-${slip.n}`} initial={{ y: -10, opacity: 0, scale: 0.8 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -10, opacity: 0 }} transition={SPRING}>
              <IconRestart size={18} />From bar {slip.from} again
            </motion.p>
          )}
          {listen && (
            <motion.p className="lesson-listening" role="status" initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={SPRING}>
              <IconHeadphones size={18} />Listen first
            </motion.p>
          )}
          {flash && (
            <motion.div className="lesson-flash-wrap" role="status" key="flash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.p className={`lesson-flash ${flash.good ? 'good' : ''}`} initial={{ scale: 0.6, y: 20 }} animate={{ scale: 1, y: 0 }} transition={SPRING}>
                {flash.good ? <IconCheck size={22} /> : <IconRestart size={20} />}{flash.text}
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {settings.view === 'notes'
        ? <footer className="lesson-keys"><Keyboard engine={engine} lo={lo} hi={hi} naming={settings.naming} fingers={fingers} /></footer>
        : <HelpKeys engine={engine} naming={settings.naming} fingers={fingers} lo={lo} hi={hi} wide always={alwaysKeys} />}
      <footer className="lesson-actions">
        {!session && !engine.started && !paused && !result && !listen && !step.wait && (
          <div className="lesson-start">
            <motion.button className="btn go big" whileTap={{ scale: 0.95 }} onClick={start}><IconPlay size={18} />{L('Start with the beat', 'Começar com o ritmo')}</motion.button>
            <motion.button className="btn" whileTap={{ scale: 0.95 }} onClick={listenFirst}><IconHeadphones size={18} />{L('Listen first', 'Ouvir primeiro')}</motion.button>
          </div>
        )}
      </footer>

      <AnimatePresence>
        {paused && !result && (
          <motion.div className="veil sheet-veil" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.section className="card pause" aria-labelledby="lesson-pause-title" initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} transition={SOFT}>
              <h2 id="lesson-pause-title">{L('Paused', 'Em pausa')}</h2>
              <div className="actions">
                <button className="btn go big" onClick={engine.started ? resume : start}><IconPlay size={18} />{engine.started ? L('Resume', 'Continuar') : L('Start', 'Começar')}</button>
                <button className="btn" onClick={() => { setPaused(false); onAgain(); }}><IconRestart size={18} />{L('Restart', 'Recomeçar')}</button>
                <button className="btn" onClick={listenFirst}><IconHeadphones size={18} />{L('Listen', 'Ouvir')}</button>
              </div>
              <div className="pause-rows">
                {!step.wait && <Segmented label="Speed" value={speed} onChange={setSpeed} options={SPEEDS.map(v => [v, formatSpeed(v)] as [number, string])} />}
                <Segmented<FingerMode> label="Fingers" value={settings.fingers} onChange={v => update({ fingers: v })} options={[['off', 'Off'], ['some', 'Some'], ['all', 'All']]} />
                <Segmented label={L('View', 'Vista')} value={settings.view} onChange={v => update({ view: v })} options={[['sheet', L('Score', 'Partitura')], ['notes', L('Falling notes', 'Notas a cair')]]} />
                <Segmented<'on' | 'off'> label="Metronome" value={metro ? 'on' : 'off'} onChange={v => { setMetro(v === 'on'); setMetronome(v === 'on'); }} options={[['on', 'On'], ['off', 'Off']]} />
                <Segmented<'help' | 'always'> label={L('Keyboard', 'Teclado')} value={alwaysKeys ? 'always' : 'help'} onChange={v => { if ((v === 'always') !== alwaysKeys) toggleKeys(); }} options={[['help', L('When I need it', 'Quando preciso')], ['always', L('Always', 'Sempre')]]} />
              </div>
              <div className="pause-steps">
                {onPrev && <button className="btn small" onClick={onPrev}><IconArrowLeft size={16} />{L('Previous step', 'Passo anterior')}</button>}
                {onNext && <button className="btn small" onClick={onNext}>{L('Skip this step', 'Saltar este passo')}<IconArrowRight size={16} /></button>}
              </div>
              <button className="btn quiet" onClick={onExit}>{exitLabel}</button>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      {result && (
        <div className="lesson-done" role="dialog" aria-labelledby="lesson-result-title">
          <div className="result-stars" aria-label={L(`${result.stars} of 3 stars`, `${result.stars} de 3 estrelas`)}>
            {[0, 1, 2].map(i => (
              <motion.span key={i} className={`big-star ${i < result.stars ? 'won' : ''}`} initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...SPRING, delay: 0.12 + i * 0.16 }}><IconStar size={56} /></motion.span>
            ))}
          </div>
          {/* "Perfect" only when not a single note went wrong. */}
          <h1 id="lesson-result-title">{HEADLINE()[result.stars === 3 && result.wrong > 0 ? 2 : result.stars]}</h1>
          <p className="sub">{result.hit} of {result.total} notes right first time, {result.wrong} wrong{result.strays > 0 ? `, ${result.strays} accidental ${result.strays === 1 ? 'touch' : 'touches'} not counted` : ''}</p>
          {result.verdict && (
            <motion.div className="mastery-gain" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ...SPRING, delay: 0.4 }}>
              <span className="mastery-gain-head"><IconTarget size={18} />{L('Mastery', 'Domínio')}<b><CountUp from={pctOf(result.verdict.before)} to={pctOf(result.verdict.after)} ms={1100} />%</b></span>
              <span className="mastery-track" role="progressbar" aria-label={L('Mastery', 'Domínio')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pctOf(result.verdict.after)}>
                <motion.i initial={{ width: `${Math.max(2, result.verdict.before * 100)}%` }} animate={{ width: `${Math.max(2, result.verdict.after * 100)}%` }} transition={{ ...SOFT, delay: 0.7 }} />
              </span>
              <p>{result.verdict.line}</p>
            </motion.div>
          )}
          {result.verdict?.rest && <p className="rest-note"><IconMoon size={18} />{result.verdict.rest}</p>}
          <div className="theory-rewards">
            <motion.span className="reward acc" initial={{ y: 24, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ ...SPRING, delay: 0.5 }}>
              <small>{L('Accuracy', 'Precisão')}</small><b><CountUp to={Math.round(result.accuracy * 100)} />%</b>
            </motion.span>
          </div>
          {result.stars === 0 && !result.verdict && <p className="fine">{L('You need 70% for a star.', 'Precisas de 70% para uma estrela.')} {step.wait ? L('Take it one note at a time.', 'Vai uma nota de cada vez.') : L('Try it slower: pause and pick a speed.', 'Experimenta mais devagar: pausa e escolhe uma velocidade.')}</p>}
          {result.verdict ? (
            // Mastery: the next section starts by itself after three seconds; when he has levelled
            // off, stopping comes first and nothing starts on its own.
            result.verdict.rest ? (
              <div className="lesson-done-actions">
                <button className="btn go big" onClick={onExit}>{L('Done for today', 'Chega por hoje')}</button>
                {onNextSection && <button className="btn" onClick={onNextSection}>{L('Keep going', 'Continuar')}</button>}
              </div>
            ) : (
              <div className="lesson-done-actions">
                {onNextSection && <AutoNext go={onNextSection} />}
                <button className="btn quiet" onClick={onExit}>{exitLabel}</button>
              </div>
            )
          ) : (
            <div className="lesson-done-actions">
              {next && <button className="btn go big" onClick={next.go}>{next.label}</button>}
              <button className={`btn ${next ? '' : 'go big'}`} onClick={onAgain}><IconRestart size={18} />{L('Try again', 'Tentar outra vez')}</button>
              <button className="btn quiet" onClick={onExit}>{exitLabel}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** The next section starts by itself after three seconds; the bar shows it coming. */
function AutoNext({ go }: { go: () => void }) {
  useEffect(() => { const id = window.setTimeout(go, 3000); return () => window.clearTimeout(id); }, [go]);
  return (
    <button className="btn go big auto-next" onClick={go}>
      <motion.i initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 3, ease: 'linear' }} />
      <span>{L('Next section', 'Secção seguinte')}</span>
    </button>
  );
}
