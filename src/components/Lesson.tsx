import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { barsToTime } from '../lib/analysis';
import { loadPiano, unlockAudio } from '../lib/audio';
import { coachRun, settingsFor } from '../lib/adapt';
import { recordStep, starsFor, type CourseStep } from '../lib/course';
import { listenForSkills } from '../lib/skills';
import type { SongInfo } from '../lib/catalog';
import { Engine } from '../lib/engine';
import { onNote, setMicRange, type LinkState, type Source } from '../lib/input';
import { pickRange } from '../lib/keys';
import { formatSpeed, noteName } from '../lib/names';
import { usePracticeClock } from '../lib/practiceClock';
import { addPractice, streak, xpForStars } from '../lib/stats';
import type { FingerMode, Settings } from '../lib/types';
import { addGems, energy, gainEnergy, gemsForStars, spendEnergy, STREAK_FOR_ENERGY, useEconomy } from '../lib/energy';
import { AnimatePresence, motion } from 'motion/react';
import { Confetti, CountUp } from './Confetti';
import { Bump, Cheer, SOFT, SPRING } from './Motion';
import { EnergySheet } from './Economy';
import { Energy, Gem } from './GameIcons';
import { Countdown } from './Countdown';
import { FallingNotes } from './FallingNotes';
import { IconArrowLeft, IconArrowRight, IconBolt, IconCheck, IconFlame, IconHeadphones, IconKeys, IconPause, IconPlay, IconRestart, IconStar } from './Icons';
import { Keyboard } from './Keyboard';
import { LessonStaff } from './LessonStaff';
import type { Section } from './SongScreen';
import { Segmented } from './ui';

const HEADLINE = ['Almost there', 'Passed', 'Great job!', 'Perfect!'];
const SPEEDS = [0.6, 0.8, 1, 1.2];

function stepLabel(s: CourseStep) {
  if (s.kind === 'song') return s.wait ? 'Whole song' : 'Final performance';
  return s.title;
}

function intro(s: CourseStep): string {
  if (!s.wait) return 'In tempo: keep going through mistakes';
  if (s.id.endsWith('x')) return 'The tricky bit once more, slowly';
  return s.hands === 'R' ? 'Right hand: the music waits for you' : s.hands === 'L' ? 'Left hand: the music waits for you' : 'Both hands: the music waits for you';
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
  /** Words for the last step's "next" button and the way out (a song's lesson, or the daily session). */
  nextLabel?: string;
  exitLabel?: string;
  /** Stars the last step needs before "next" shows (a test needs 2). Below it, `onStop` ends the run. */
  minStars?: number;
  onStop?: () => void;
  stopLabel?: string;
  onSettings: () => void;
  onRecorded: () => void;
  /** Path lessons spend energy (1 a step); practice earns it (+2 a piece). */
  energyMode?: 'spend' | 'earn';
  onPremium?: () => void;
}

/** Teach me: one section, step by step (right hand, left hand, together, in tempo), Simply Piano style. */
export function Lesson(props: Props) {
  const { section, startAt } = props;
  const [index, setIndex] = useState(() => Math.max(0, section.steps.findIndex(s => s.id === startAt)));
  const [run, setRun] = useState(0);
  const step = section.steps[index];
  const go = (i: number) => { setIndex(Math.max(0, Math.min(section.steps.length - 1, i))); setRun(r => r + 1); };
  return (
    <LessonRun
      key={`${step.id}-${run}`}
      {...props}
      step={step}
      index={index}
      onPrev={index > 0 ? () => go(index - 1) : undefined}
      onNext={index < section.steps.length - 1 ? () => go(index + 1) : undefined}
      onAgain={() => setRun(r => r + 1)}
    />
  );
}

interface RunProps extends Props {
  step: CourseStep;
  index: number;
  onPrev?: () => void;
  onNext?: () => void;
  onAgain: () => void;
}

function LessonRun({ info, section, step, index, settings, update, links, onExit, onNextSection, nextLabel = 'Next section', exitLabel = 'Back to the song', minStars = 1, onStop, stopLabel = 'Finish', onSettings, onRecorded, onPrev, onNext, onAgain, energyMode, onPremium }: RunProps) {
  const song = info.song!;
  // The coach sets this step's speed, how soon help comes and how many finger numbers show.
  const coach = useMemo(() => settingsFor(step.speed, step.wait), [step.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const fingers: FingerMode = settings.fingers === 'off' ? 'off' : settings.fingers === 'some' && coach.fingers === 'all' ? 'some' : coach.fingers;
  const [speed, setSpeed] = useState(coach.speed);
  const [listen, setListen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<{ accuracy: number; hit: number; total: number; wrong: number; stars: number; xp: number; gems: number; energy: number; streakUp?: number } | null>(null);
  // Energy: a path step needs 1 to start. Notes right in a row earn it back, 1 for every 10.
  const econ = useEconomy();
  const [noEnergy, setNoEnergy] = useState(() => energyMode === 'spend' && energy() < 1);
  const [combo, setCombo] = useState(0);
  const [bonus, setBonus] = useState(0);
  const [bonusOn, setBonusOn] = useState(false);
  const comboRef = useRef(0);
  const heard = useRef(false);
  const [say, setSay] = useState<{ text: string; wrong?: string }>({ text: intro(step) });
  // A short step that went well moves on by itself, like Simply Piano; one that did not, starts again.
  const [flash, setFlash] = useState<{ text: string; good: boolean; xp?: number; gems?: number } | null>(null);
  const [, bump] = useReducer((x: number) => x + 1, 0);
  usePracticeClock();

  const engine = useMemo(() => new Engine(song, {
    speed: coach.speed, wait: step.wait, hands: step.hands, listen: false, hintAfter: coach.hintAfter,
    accompaniment: settings.accompaniment, lenient: settings.input === 'mic',
  }), [song, step.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // (Keyed by id: refreshed progress hands down new step objects for the same step.)

  useEffect(() => { engine.setSegment(barsToTime(engine.measureTimes, step.from, step.to)); bump(); }, [engine]); // eslint-disable-line react-hooks/exhaustive-deps
  // Wait steps start by themselves, like Simply Piano: the run-up plays, then the music waits for him.
  // A listening step plays the piece to him first.
  useEffect(() => {
    if (!step.wait || noEnergy) return;
    const id = window.setTimeout(() => {
      if (engine.started) return;
      unlockAudio();
      if (step.listen && !heard.current) { heard.current = true; setListen(true); engine.setOptions({ listen: true }); engine.restart(); engine.play(1); }
      else { engine.toFirstNote(); engine.play(0); }
      bump();
    }, 500);
    return () => window.clearTimeout(id);
  }, [engine, noEnergy]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setMicRange(song.range[0], song.range[1]); loadPiano().catch(() => {}); }, [song]);
  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __engine: Engine }).__engine = engine; }, [engine]);
  useEffect(() => { engine.setOptions({ speed, listen, accompaniment: settings.accompaniment, lenient: settings.input === 'mic' }); }, [engine, speed, listen, settings.accompaniment, settings.input]);

  useEffect(() => {
    // Every chord he plays teaches the app about his skills; a whole run also tunes the coach.
    let skills = listenForSkills(engine);
    const off = engine.on(e => {
      if (e.type === 'state' || e.type === 'status') bump();
      if (e.type === 'press') {
        if (e.ok && e.id === undefined) return;
        comboRef.current = e.ok ? comboRef.current + 1 : 0;
        setCombo(comboRef.current);
        if (e.ok && comboRef.current % STREAK_FOR_ENERGY === 0) {
          if (energyMode) gainEnergy(1);
          setBonus(b => b + 1);
          window.setTimeout(() => setBonusOn(false), 1300);
          setBonusOn(true);
        }
      }
      if (e.type === 'end') {
        if (engine.opts.listen) {
          setListen(false); engine.setOptions({ listen: false }); engine.restart(); engine.started = false; skills.stop(); skills = listenForSkills(engine); bump();
          // Heard it: now his turn.
          if (step.wait) window.setTimeout(() => { if (!engine.started) { engine.toFirstNote(); engine.play(0); bump(); } }, 900);
          return;
        }
        const run = skills.stop();
        // The coach quietly tunes the next steps; the learner just keeps going.
        coachRun(run, !step.wait);
        const s = engine.stats();
        const stars = starsFor(s.accuracy);
        const before = streak();
        const quick = step.wait && !!onNext;
        if (quick && stars === 0) {
          setFlash({ text: 'Let’s try that again', good: false });
          window.setTimeout(onAgain, 1300);
          return;
        }
        recordStep(song.entry.id, step.id, s.accuracy).then(() => {
          // A finished step earns XP and counts for the streak; on the path it costs energy and earns
          // gems, in practice it earns energy.
          const xp = xpForStars(stars);
          if (stars > 0) addPractice(0, 1, xp);
          if (energyMode === 'spend') spendEnergy(1);
          const gems = energyMode !== 'earn' && stars > 0 ? gemsForStars(stars) : 0;
          if (gems) addGems(gems);
          const earned = energyMode === 'earn' && stars > 0 ? 2 : 0;
          if (earned) gainEnergy(earned);
          const after = streak();
          onRecorded();
          if (quick) {
            setFlash({ text: stars === 3 ? 'Perfect!' : stars === 2 ? 'Great!' : 'Good!', good: true, xp, gems });
            window.setTimeout(onNext!, 1100);
            return;
          }
          setResult({ ...s, stars, xp, gems, energy: earned, streakUp: !before.today && after.today ? after.days : undefined });
        });
      }
    });
    const offNote = onNote(e => engine.input(e));
    return () => { off(); offNote(); skills.stop(); engine.destroy(); };
  }, [engine]); // eslint-disable-line react-hooks/exhaustive-deps

  // The instruction line says what to play now, and what he played instead.
  useEffect(() => {
    let raf = 0, last = '';
    const frame = () => {
      let next: { text: string; wrong?: string } = { text: intro(step) };
      const target = engine.groups[engine.gi];
      if (engine.opts.listen) next = { text: 'Listen to this part, then play it' };
      else if (target && step.wait && (engine.waiting || engine.stats().hit === 0 || engine.countdown > 0)) {
        const want = engine.waitingFor();
        if (!want.length) { raf = requestAnimationFrame(frame); return; }
        const f = want.length === 1 && want[0].finger ? ` with finger ${want[0].finger}` : '';
        const wrong = engine.wrongInWait > 0 && performance.now() - engine.lastWrong.at < 2500 && !want.some(w => w.midi === engine.lastWrong.midi)
          ? `You played ${noteName(engine.lastWrong.midi, settings.naming, true)}` : undefined;
        next = { text: `Play ${want.map(w => noteName(w.midi, settings.naming, true)).join(' + ')}${f}`, wrong };
      } else if (engine.started && engine.playing) next = { text: step.wait ? 'Keep going' : 'Keep playing in tempo' };
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
  const inputOn = settings.input !== 'none' && links[settings.input as Source]?.status === 'on';
  const next = result && result.stars >= minStars ? (onNext ? { label: `Next: ${stepLabel(section.steps[index + 1])}`, go: onNext } : onNextSection ? { label: nextLabel, go: onNextSection } : null)
    : result && onStop && !onNext ? { label: stopLabel, go: onStop } : null;

  const progress = (index + (flash?.good ? 1 : stats.total ? stats.hit / stats.total : 0)) / section.steps.length;

  return (
    <div className={`lesson simply view-${settings.view}`}>
      <header className="lesson-bar">
        <motion.button className="lesson-pause" whileTap={{ scale: 0.9 }} onClick={engine.playing ? pause : () => setPaused(true)} aria-label="Pause"><IconPause size={24} /></motion.button>
        {/* The instruction is for screen readers; the music says what to play. */}
        <div className="lesson-say" role="status" aria-live="polite">
          <p className="sr-only">{say.wrong ? `${say.wrong}. ${say.text}` : say.text}</p>
          <span className="lesson-step">{stepLabel(step)}</span>
        </div>
        <div className="lesson-econ">
          <AnimatePresence>
            {combo >= 3 && (
              <motion.span className={`combo ${combo >= 10 ? 'hot' : ''}`} aria-label={`${combo} right in a row`} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={SPRING}>
                <IconFlame size={14} /><Bump value={combo} />
              </motion.span>
            )}
          </AnimatePresence>
          {energyMode && (
            <span className="lesson-energy" aria-label={econ.premium ? 'Unlimited energy' : `${econ.energy} energy`}>
              <Energy size={18} />{econ.premium ? '∞' : <Bump value={econ.energy} />}
              <AnimatePresence>{bonusOn && <motion.b className="energy-plus" key={bonus} initial={{ y: 8, opacity: 0, scale: 0.6 }} animate={{ y: -6, opacity: 1, scale: 1 }} exit={{ y: -18, opacity: 0 }} transition={SPRING}>+1</motion.b>}</AnimatePresence>
            </span>
          )}
          {!inputOn && <button className="piano-chip" onClick={onSettings} aria-label="Connect your piano"><IconKeys size={20} /><i /></button>}
        </div>
        <div className="lesson-nav">
          <button className="lesson-arrow" onClick={onPrev} disabled={!onPrev} aria-label="Previous step"><IconArrowLeft size={20} /></button>
          <div className="lesson-count" aria-label={`${section.title}, step ${index + 1} of ${section.steps.length}: ${stepLabel(step)}`}>
            <motion.i animate={{ width: `${Math.max(0.04, progress) * 100}%` }} transition={SOFT} />
            <span><Bump value={index + (flash?.good ? 1 : 0)} />/{section.steps.length}</span>
          </div>
          <button className="lesson-arrow" onClick={onNext} disabled={!onNext} aria-label="Next step"><IconArrowRight size={20} /></button>
        </div>
      </header>

      <main className="lesson-stage">
        {settings.view === 'notes'
          ? <FallingNotes engine={engine} lo={lo} hi={hi} naming={settings.naming} fingers={settings.fingers} inset={0} onTap={pause} />
          : <LessonStaff engine={engine} from={step.from} to={step.to} feedback fingers={fingers} only={step.hands === 'R' || step.hands === 'L' ? step.hands : undefined} />}
        <Countdown engine={engine} />
        <Cheer combo={combo} />
        <AnimatePresence>
          {listen && (
            <motion.p className="lesson-listening" role="status" initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={SPRING}>
              <IconHeadphones size={18} />Listen first
            </motion.p>
          )}
          {flash && (
            <motion.div className="lesson-flash-wrap" role="status" key="flash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.p className={`lesson-flash ${flash.good ? 'good' : ''}`} initial={{ scale: 0.6, y: 20 }} animate={{ scale: 1, y: 0 }} transition={SPRING}>
                {flash.good ? <IconCheck size={22} /> : <IconRestart size={20} />}{flash.text}
                {flash.xp ? <small className="xp-gain">+{flash.xp} XP{flash.gems ? `, +${flash.gems} gems` : ''}</small> : null}
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="lesson-keys">
        <Keyboard engine={engine} lo={lo} hi={hi} naming={settings.naming} fingers={fingers} />
        {!engine.started && !paused && !result && !listen && !step.wait && (
          <div className="lesson-start">
            <motion.button className="btn go big" whileTap={{ scale: 0.95 }} onClick={start}><IconPlay size={18} />Start in tempo</motion.button>
            <motion.button className="btn" whileTap={{ scale: 0.95 }} onClick={listenFirst}><IconHeadphones size={18} />Listen first</motion.button>
          </div>
        )}
      </footer>

      <AnimatePresence>
        {paused && !result && (
          <motion.div className="veil sheet-veil" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.section className="card pause" aria-labelledby="lesson-pause-title" initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} transition={SOFT}>
              <h2 id="lesson-pause-title">Paused</h2>
              <div className="actions">
                <button className="btn go big" onClick={engine.started ? resume : start}><IconPlay size={18} />{engine.started ? 'Resume' : 'Start'}</button>
                <button className="btn" onClick={() => { setPaused(false); onAgain(); }}><IconRestart size={18} />Restart</button>
                <button className="btn" onClick={listenFirst}><IconHeadphones size={18} />Listen</button>
              </div>
              <div className="pause-rows">
                {!step.wait && <Segmented label="Speed" value={speed} onChange={setSpeed} options={SPEEDS.map(v => [v, formatSpeed(v)] as [number, string])} />}
                <Segmented<FingerMode> label="Fingers" value={settings.fingers} onChange={v => update({ fingers: v })} options={[['off', 'Off'], ['some', 'Some'], ['all', 'All']]} />
                <Segmented label="View" value={settings.view} onChange={v => update({ view: v })} options={[['sheet', 'Score'], ['notes', 'Falling notes']]} />
              </div>
              <div className="pause-steps">
                {onPrev && <button className="btn small" onClick={onPrev}><IconArrowLeft size={16} />Previous step</button>}
                {onNext && <button className="btn small" onClick={onNext}>Skip this step<IconArrowRight size={16} /></button>}
              </div>
              <button className="btn quiet" onClick={onExit}>{exitLabel}</button>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      {noEnergy && (
        <EnergySheet empty onPremium={() => onPremium?.()} onClose={() => { if (energy() >= 1) setNoEnergy(false); else onExit(); }} />
      )}

      {result && (
        <div className="lesson-done" role="dialog" aria-labelledby="lesson-result-title">
          {result.stars >= 2 && <Confetti />}
          <div className="result-stars" aria-label={`${result.stars} of 3 stars`}>
            {[0, 1, 2].map(i => (
              <motion.span key={i} className={`big-star ${i < result.stars ? 'won' : ''}`} initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...SPRING, delay: 0.12 + i * 0.16 }}><IconStar size={56} /></motion.span>
            ))}
          </div>
          <h1 id="lesson-result-title">{HEADLINE[result.stars]}</h1>
          <p className="sub">{result.hit} of {result.total} notes right first time, {result.wrong} wrong</p>
          <div className="theory-rewards">
            {[
              ['xp', 'Total XP', <><IconBolt size={20} />+<CountUp to={result.xp} /></>],
              ['acc', 'Accuracy', <>{Math.round(result.accuracy * 100)}%</>],
              result.gems > 0 ? ['gems', 'Gems', <><Gem size={20} />+{result.gems}</>] : result.energy > 0 ? ['energy', 'Energy', <><Energy size={18} />+{result.energy}</>] : null,
            ].filter((x): x is [string, string, React.ReactElement] => !!x).map(([k, label, val], n) => (
              <motion.span key={k} className={`reward ${k}`} initial={{ y: 24, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ ...SPRING, delay: 0.5 + n * 0.12 }}>
                <small>{label}</small><b>{val}</b>
              </motion.span>
            ))}
          </div>
          {result.streakUp !== undefined && <p className="streak-up"><IconFlame size={18} />{result.streakUp === 1 ? 'Streak started' : `${result.streakUp}-day streak`}</p>}
          {result.stars === 0 && <p className="fine">You need 70% for a star. {step.wait ? 'Take it one note at a time.' : 'Try it slower: pause and pick a speed.'}</p>}
          <div className="lesson-done-actions">
            {next && <button className="btn go big" onClick={next.go}>{next.label}</button>}
            <button className={`btn ${next ? '' : 'go big'}`} onClick={onAgain}><IconRestart size={18} />Try again</button>
            <button className="btn quiet" onClick={onExit}>{exitLabel}</button>
          </div>
        </div>
      )}
    </div>
  );
}
