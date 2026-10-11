import { useEffect, useMemo, useReducer, useState } from 'react';
import { barsToTime } from '../lib/analysis';
import { loadPiano, unlockAudio } from '../lib/audio';
import { recordStep, starsFor, type CourseStep } from '../lib/course';
import type { SongInfo } from '../lib/catalog';
import { Engine } from '../lib/engine';
import { onNote, setMicRange, type LinkState, type Source } from '../lib/input';
import { pickRange } from '../lib/keys';
import { formatSpeed, noteName } from '../lib/names';
import { usePracticeClock } from '../lib/practiceClock';
import { streak } from '../lib/stats';
import type { FingerMode, Settings } from '../lib/types';
import { Countdown } from './Countdown';
import { FallingNotes } from './FallingNotes';
import { IconArrowLeft, IconArrowRight, IconFlame, IconHeadphones, IconPause, IconPlay, IconRestart, IconStar } from './Icons';
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
  onSettings: () => void;
  onRecorded: () => void;
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

function LessonRun({ info, section, step, index, settings, update, links, onExit, onNextSection, onSettings, onRecorded, onPrev, onNext, onAgain }: RunProps) {
  const song = info.song!;
  const [speed, setSpeed] = useState(step.speed);
  const [listen, setListen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<{ accuracy: number; hit: number; total: number; wrong: number; stars: number; streakUp?: number } | null>(null);
  const [say, setSay] = useState<{ text: string; wrong?: string }>({ text: intro(step) });
  // A short step that went well moves on by itself, like Simply Piano; one that did not, starts again.
  const [flash, setFlash] = useState<{ text: string; good: boolean } | null>(null);
  const [, bump] = useReducer((x: number) => x + 1, 0);
  usePracticeClock();

  const engine = useMemo(() => new Engine(song, {
    speed: step.speed, wait: step.wait, hands: step.hands, listen: false,
    accompaniment: settings.accompaniment, lenient: settings.input === 'mic',
  }), [song, step.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // (Keyed by id: refreshed progress hands down new step objects for the same step.)

  useEffect(() => { engine.setSegment(barsToTime(engine.measureTimes, step.from, step.to)); bump(); }, [engine]); // eslint-disable-line react-hooks/exhaustive-deps
  // Wait steps start by themselves, like Simply Piano: the run-up plays, then the music waits for him.
  useEffect(() => {
    if (!step.wait) return;
    const id = window.setTimeout(() => { if (!engine.started) { unlockAudio(); engine.play(0); bump(); } }, 700);
    return () => window.clearTimeout(id);
  }, [engine]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setMicRange(song.range[0], song.range[1]); loadPiano().catch(() => {}); }, [song]);
  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __engine: Engine }).__engine = engine; }, [engine]);
  useEffect(() => { engine.setOptions({ speed, listen, accompaniment: settings.accompaniment, lenient: settings.input === 'mic' }); }, [engine, speed, listen, settings.accompaniment, settings.input]);

  useEffect(() => {
    const off = engine.on(e => {
      if (e.type === 'state' || e.type === 'status') bump();
      if (e.type === 'end') {
        if (engine.opts.listen) { setListen(false); engine.setOptions({ listen: false }); engine.restart(); engine.started = false; bump(); return; }
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
          const after = streak();
          onRecorded();
          if (quick) {
            setFlash({ text: stars === 3 ? 'Perfect!' : stars === 2 ? 'Great!' : 'Good!', good: true });
            window.setTimeout(onNext!, 1100);
            return;
          }
          setResult({ ...s, stars, streakUp: !before.today && after.today ? after.days : undefined });
        });
      }
    });
    const offNote = onNote(e => engine.input(e));
    return () => { off(); offNote(); engine.destroy(); };
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
  const next = result && result.stars > 0 ? (onNext ? { label: `Next: ${stepLabel(section.steps[index + 1])}`, go: onNext } : onNextSection ? { label: 'Next section', go: onNextSection } : null) : null;

  return (
    <div className={`lesson view-${settings.view}`}>
      <header className="lesson-bar">
        <button className="lesson-pause" onClick={engine.playing ? pause : () => setPaused(true)} aria-label="Pause"><IconPause size={26} /></button>
        {/* Nothing to read but the music: the instruction is for screen readers only. */}
        <div className="lesson-say" role="status" aria-live="polite">
          <p className="sr-only">{say.wrong ? `${say.wrong}. ${say.text}` : say.text}</p>
          {!inputOn && <button className="lesson-noinput" onClick={onSettings}><i />Connect your piano</button>}
        </div>
        <div className="lesson-nav">
          <button className="lesson-arrow" onClick={onPrev} disabled={!onPrev} aria-label="Previous step"><IconArrowLeft size={24} /></button>
          <div className="lesson-count" aria-label={`${section.title}, step ${index + 1} of ${section.steps.length}: ${stepLabel(step)}`}>
            <i style={{ width: `${((index + (flash?.good ? 1 : stats.total ? stats.hit / stats.total : 0)) / section.steps.length) * 100}%` }} />
            <span>{index + (flash?.good ? 1 : 0)}/{section.steps.length}</span>
          </div>
          <button className="lesson-arrow" onClick={onNext} disabled={!onNext} aria-label="Next step"><IconArrowRight size={24} /></button>
        </div>
      </header>

      <main className="lesson-stage">
        {settings.view === 'notes'
          ? <FallingNotes engine={engine} lo={lo} hi={hi} naming={settings.naming} fingers={settings.fingers} inset={0} onTap={pause} />
          : <LessonStaff engine={engine} from={step.from} to={step.to} feedback only={step.hands === 'R' || step.hands === 'L' ? step.hands : undefined} />}
        <Countdown engine={engine} />
        {flash && <p className={`lesson-flash ${flash.good ? 'good' : ''}`} role="status">{flash.text}</p>}
      </main>

      <footer className="lesson-keys">
        <Keyboard engine={engine} lo={lo} hi={hi} naming={settings.naming} fingers={settings.fingers} />
        {!engine.started && !paused && !result && !listen && !step.wait && (
          <div className="lesson-start">
            <button className="btn go big" onClick={start}><IconPlay size={18} />Start in tempo</button>
            <button className="btn" onClick={listenFirst}><IconHeadphones size={18} />Listen first</button>
          </div>
        )}
      </footer>

      {paused && !result && (
        <div className="veil">
          <section className="card pause" aria-labelledby="lesson-pause-title">
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
            <button className="btn quiet" onClick={onExit}>Back to the song</button>
          </section>
        </div>
      )}

      {result && (
        <div className="veil">
          <section className="card result" aria-labelledby="lesson-result-title">
            <div className="result-stars" aria-label={`${result.stars} of 3 stars`}>
              {[0, 1, 2].map(i => (
                <span key={i} className={`big-star ${i < result.stars ? 'won' : ''}`} style={{ animationDelay: `${120 + i * 160}ms` }}><IconStar size={44} /></span>
              ))}
            </div>
            <h2 id="lesson-result-title">{HEADLINE[result.stars]}</h2>
            <p className="result-line">{section.title} · {stepLabel(step)}: {result.hit} of {result.total} notes · {result.wrong} wrong · {Math.round(result.accuracy * 100)}%</p>
            {result.streakUp !== undefined && <p className="streak-up"><IconFlame size={18} />{result.streakUp === 1 ? 'Streak started' : `${result.streakUp}-day streak`}</p>}
            {result.stars === 0 && <p className="fine">You need 70% for a star. {step.wait ? 'Take it one note at a time.' : 'Try it slower: pause and pick a speed.'}</p>}
            <div className="actions">
              {next && <button className="btn go big" onClick={next.go}><IconPlay size={18} />{next.label}</button>}
              <button className={`btn ${next ? '' : 'go big'}`} onClick={onAgain}><IconRestart size={18} />Try again</button>
              <button className="btn quiet" onClick={onExit}>Back to the song</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
