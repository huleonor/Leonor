import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { barsToTime } from '../lib/analysis';
import { loadPiano, unlockAudio } from '../lib/audio';
import { nextStep, recordStep, starsFor, type Course, type CourseStep } from '../lib/course';
import { Engine } from '../lib/engine';
import { onNote, setMicRange, type LinkState, type Source } from '../lib/input';
import { pickRange } from '../lib/keys';
import { recordRun } from '../lib/library';
import { formatSpeed, noteName } from '../lib/names';
import { addPractice, streak } from '../lib/stats';
import type { FingerMode, Hand, HandsChoice, Settings, Song } from '../lib/types';
import { Countdown } from './Countdown';
import { FallingNotes } from './FallingNotes';
import { IconBack, IconFalling, IconFlame, IconHeadphones, IconPause, IconPlay, IconRestart, IconSheet, IconStar } from './Icons';
import { Keyboard } from './Keyboard';
import { Staff, type Judgement } from './Staff';

const SPEEDS = [0.6, 0.8, 1, 1.2];
const SOURCE_SHORT: Record<Source, string> = { mic: 'Mic', ble: 'Bluetooth', midi: 'USB' };

export const stepName = (s: CourseStep) => (s.part !== undefined ? `Part ${s.part} · ${s.title}` : s.title);

/** What a step asks of him, in one sentence. */
function instruction(step: CourseStep | undefined, hands: HandsChoice, wait: boolean): string {
  const who = hands === 'R' ? 'the right hand' : hands === 'L' ? 'the left hand' : 'both hands';
  if (!step) return wait ? `Play ${who}. The music waits for each note.` : `Play ${who} in tempo.`;
  switch (step.kind) {
    case 'hand': return `Play ${who} on its own. The music waits for each note, and the app plays the other hand.`;
    case 'together': return 'Both hands together, a little faster. The music still waits for you.';
    case 'tempo': return 'In tempo now: the music keeps going, so keep playing through mistakes.';
    case 'join': return `Play parts ${step.parts?.[0]} and ${step.parts?.[1]} in one go. The music waits for you.`;
    default: return step.wait ? 'The whole song, start to finish. The music waits for you.' : 'Your final performance: the whole song, in tempo.';
  }
}

const HEADLINE = ['Almost there', 'Passed', 'Great job!', 'Perfect!'];

interface Props {
  song: Song;
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  links: Record<Source, LinkState>;
  step?: CourseStep;
  course?: Course;
  onExit: () => void;
  onStep: (step: CourseStep) => void;
  onSettings: () => void;
}

type Local = { speed: number; wait: boolean; hands: HandsChoice };

export function Practice({ song, settings, update, links, step, course, onExit, onStep, onSettings }: Props) {
  const oneHand = song.hands.length === 1;
  // A step brings its own hands, speed and Wait; free play starts from the saved settings.
  const [local, setLocal] = useState<Local>(() => step
    ? { speed: step.speed, wait: step.wait, hands: step.hands }
    : { speed: settings.speed, wait: settings.wait, hands: oneHand ? song.hands[0] : settings.hands });
  const set = (patch: Partial<Local>) => {
    setLocal(l => ({ ...l, ...patch }));
    if (!step) update(patch);
  };
  const hands: HandsChoice = oneHand ? song.hands[0] : local.hands;
  const [listen, setListen] = useState(false);
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const [result, setResult] = useState<{ accuracy: number; hit: number; total: number; wrong: number; stars: number; next?: CourseStep; streakUp?: number } | null>(null);
  const [pianoPct, setPianoPct] = useState<number | null>(0);
  const progressRef = useRef<HTMLDivElement>(null);
  const judgements = useRef<Judgement[]>([]);
  const [hint, setHint] = useState<{ want: string; wrong?: string; hand: string } | null>(null);

  const engine = useMemo(() => new Engine(song, {
    speed: local.speed, wait: local.wait, hands, listen: false,
    accompaniment: settings.accompaniment, lenient: settings.input === 'mic',
  }), [song]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setMicRange(song.range[0], song.range[1]); }, [song]);
  useEffect(() => { if (step) engine.setSegment(barsToTime(engine.measureTimes, step.from, step.to)); }, [engine, step]);
  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __engine: Engine }).__engine = engine; }, [engine]);

  useEffect(() => {
    engine.setOptions({ speed: local.speed, wait: local.wait, hands, listen, accompaniment: settings.accompaniment, lenient: settings.input === 'mic' });
  }, [engine, local.speed, local.wait, hands, listen, settings.accompaniment, settings.input]);

  // Practice time: counted while the music actually runs, written every 15 s and on the way out.
  useEffect(() => {
    let pending = 0, last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      if (engine.playing && engine.countdown === 0 && !engine.opts.listen) pending += (now - last) / 1000;
      last = now;
      if (pending >= 15) { addPractice(pending); pending = 0; }
    }, 1000);
    return () => { window.clearInterval(id); addPractice(pending); };
  }, [engine]);

  useEffect(() => {
    const off = engine.on(e => {
      if (e.type === 'state') bump();
      if (e.type === 'judge') {
        const o = e.offset, a = Math.abs(o);
        const j: Judgement = a < 0.08 ? { text: 'Perfect', tone: 'good', at: performance.now() }
          : a < 0.16 ? { text: 'Good', tone: 'ok', at: performance.now() }
          : { text: o < 0 ? 'Early' : 'Late', tone: 'off', at: performance.now() };
        judgements.current = [j]; // one word at a time, the newest
      }
      if (e.type === 'end') {
        if (engine.opts.listen) {
          // Listening first ends back on the step card, ready to play.
          setListen(false);
          engine.setOptions({ listen: false });
          engine.restart();
          engine.started = false;
          bump();
          return;
        }
        const s = engine.stats();
        const stars = starsFor(s.accuracy);
        const before = streak();
        if (step && course) {
          recordStep(song.entry.id, step.id, s.accuracy).then(prog => {
            addPractice(0, stars > 0 ? 1 : 0);
            const after = streak();
            setResult({ ...s, stars, next: nextStep(course, prog), streakUp: !before.today && after.today ? after.days : undefined });
          });
        } else {
          recordRun(song.entry.id, s.accuracy, engine.opts.speed);
          setResult({ ...s, stars });
        }
        bump();
      }
    });
    const offNote = onNote(e => engine.input(e));
    return () => { off(); offNote(); engine.destroy(); };
  }, [engine, song, step, course]);

  useEffect(() => {
    let alive = true;
    loadPiano((l, total) => alive && setPianoPct(total ? Math.round((l / total) * 100) : 0))
      .then(() => alive && setPianoPct(null))
      .catch(() => alive && setPianoPct(null));
    return () => { alive = false; };
  }, []);

  // Keep the screen awake while the music runs.
  useEffect(() => {
    if (!engine.playing) return;
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock?.request('screen').then(l => (lock = l)).catch(() => {});
    return () => { lock?.release().catch(() => {}); };
  }, [engine, engine.playing]);

  // Progress bar and the wait hint, polled from the engine.
  useEffect(() => {
    let raf = 0, lastKey = '';
    const frame = () => {
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${engine.progress()})`;
      let next: typeof hint = null;
      if (engine.hintVisible()) {
        const want = engine.waitingFor();
        const hs = new Set(want.map(w => w.hand));
        const wrong = engine.wrongInWait > 0 && !want.some(w => w.midi === engine.lastWrong.midi) ? noteName(engine.lastWrong.midi, settings.naming, true) : undefined;
        next = {
          want: want.map(w => noteName(w.midi, settings.naming, true)).join(' + '),
          wrong,
          hand: hs.size === 2 ? 'both hands' : hs.has('L') ? 'left hand' : 'right hand',
        };
      }
      const key = next ? `${next.want}/${next.wrong}` : '';
      if (key !== lastKey) { lastKey = key; setHint(next); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [engine, settings.naming]);

  // The keyboard spans the notes of this step (both hands when listening), at least two octaves.
  const [lo, hi] = useMemo(() => {
    const seg = step ? barsToTime(engine.measureTimes, step.from, step.to) : null;
    const ms = song.notes
      .filter(n => (!seg || (n.time >= seg.from - 1e-3 && n.time < seg.to)) && (hands === 'both' || n.hand === hands))
      .map(n => n.midi);
    return ms.length ? pickRange(Math.min(...ms), Math.max(...ms)) : pickRange(song.range[0], song.range[1]);
  }, [song, step, hands, engine]);
  const staves: Hand[] = useMemo(() => (listen || hands === 'both' ? (oneHand ? [song.hands[0]] : ['R', 'L']) : [hands as Hand]), [hands, listen, oneHand, song]);
  const inputKind = settings.input;
  const link = inputKind !== 'none' ? links[inputKind as Source] : undefined;
  const inputOn = link?.status === 'on';

  const start = () => { unlockAudio(); setResult(null); engine.play(3); };
  const toggle = () => { unlockAudio(); if (engine.finished) return; engine.toggle(); };
  const again = () => { setResult(null); engine.restart(); engine.play(3); };
  const listenFirst = () => { unlockAudio(); setListen(true); engine.setOptions({ listen: true }); engine.restart(); engine.play(1); };
  const cycleSpeed = () => set({ speed: SPEEDS[(SPEEDS.indexOf(local.speed) + 1) % SPEEDS.length] ?? 1 });

  const title = step ? stepName(step) : 'Play freely';
  const sub = step ? `${song.entry.title} · bars ${step.from}–${step.to}` : song.entry.title;
  const showIntro = !engine.started && !result;
  const showPause = engine.started && !engine.playing && !engine.finished && !result;

  return (
    <div className={`practice view-${settings.view}`}>
      <header className="p-bar">
        <button className="icon-btn" onClick={engine.playing ? toggle : onExit} aria-label={engine.playing ? 'Pause' : 'Back to the song'}>
          {engine.playing ? <IconPause /> : <IconBack />}
        </button>
        <div className="p-title">
          <h1>{title}</h1>
          <p>{listen ? `Listening · ${song.entry.title}` : sub}</p>
        </div>
        <div className="p-progress" aria-hidden="true"><div ref={progressRef} /></div>
        <div className="p-tools">
          <button className={`chip ${local.wait ? 'on' : ''}`} onClick={() => set({ wait: !local.wait })} aria-pressed={local.wait} disabled={listen}>
            <i className="dot" />Wait
          </button>
          <button className="chip" onClick={cycleSpeed} aria-label={`Speed ${formatSpeed(local.speed)}, tap to change`}>{formatSpeed(local.speed)}</button>
          <button className="icon-btn ghost" onClick={() => update({ view: settings.view === 'sheet' ? 'notes' : 'sheet' })} aria-label={settings.view === 'sheet' ? 'Show falling notes' : 'Show the staff'}>
            {settings.view === 'sheet' ? <IconFalling /> : <IconSheet />}
          </button>
          <button className={`input-pill ${inputOn ? 'on' : ''}`} onClick={onSettings} aria-label="Piano input">
            <i />{inputOn ? SOURCE_SHORT[inputKind as Source] : 'No piano'}
          </button>
        </div>
      </header>

      <main className="stage">
        {settings.view === 'sheet'
          ? <Staff engine={engine} staves={staves} naming={settings.naming} fingers={settings.fingers} judgements={judgements} onTap={toggle} />
          : <FallingNotes engine={engine} lo={lo} hi={hi} naming={settings.naming} fingers={settings.fingers} inset={0} onTap={toggle} />}
        {hint && engine.playing && (
          <div className={`hint ${hint.wrong ? 'is-wrong' : ''}`} role="status" aria-live="polite">
            {hint.wrong && <span className="hint-wrong">You played {hint.wrong}</span>}
            <span>Play <b>{hint.want}</b> · {hint.hand}</span>
          </div>
        )}
        <Countdown engine={engine} />

        {showIntro && (
          <div className="veil">
            <section className="card intro" aria-labelledby="intro-title">
              <p className="intro-song">{song.entry.title}</p>
              <h2 id="intro-title">{title}</h2>
              <p className="intro-text">{instruction(step, hands, local.wait)}</p>
              {step && (
                <ul className="star-rule" aria-label="Stars">
                  <li><Stars n={1} of={1} />70%</li>
                  <li><Stars n={2} of={2} />85%</li>
                  <li><Stars n={3} of={3} />95%</li>
                </ul>
              )}
              {!step && !oneHand && (
                <Segmented label="Hands" value={local.hands} onChange={v => set({ hands: v })}
                  options={[['R', 'Right'], ['L', 'Left'], ['both', 'Both']]} />
              )}
              <div className="actions">
                <button className="btn go big" onClick={start}><IconPlay size={18} />Start</button>
                <button className="btn" onClick={listenFirst} disabled={pianoPct !== null}><IconHeadphones size={18} />Listen first</button>
              </div>
              {!inputOn && (
                <p className="warn">No piano connected yet. <button className="link" onClick={onSettings}>Connect your piano</button></p>
              )}
              {pianoPct !== null && <p className="fine">Loading the piano sound{pianoPct > 0 ? ` · ${pianoPct}%` : '…'}</p>}
            </section>
          </div>
        )}

        {showPause && (
          <div className="veil">
            <section className="card pause" aria-labelledby="pause-title">
              <h2 id="pause-title">Paused</h2>
              <div className="actions">
                <button className="btn go big" onClick={toggle}><IconPlay size={18} />Resume</button>
                <button className="btn" onClick={again}><IconRestart size={18} />Restart</button>
              </div>
              <div className="pause-rows">
                <Segmented label="Speed" value={local.speed} onChange={v => set({ speed: v })} options={SPEEDS.map(v => [v, formatSpeed(v)] as [number, string])} />
                {!step && !oneHand && (
                  <Segmented label="Hands" value={local.hands} onChange={v => set({ hands: v })} options={[['R', 'Right'], ['L', 'Left'], ['both', 'Both']]} />
                )}
                <Segmented<FingerMode> label="Fingers" value={settings.fingers} onChange={v => update({ fingers: v })} options={[['off', 'Off'], ['some', 'Some'], ['all', 'All']]} />
              </div>
              <button className="btn quiet" onClick={onExit}>{step ? 'Back to the song' : 'Exit'}</button>
            </section>
          </div>
        )}

        {result && (
          <div className="veil">
            <section className="card result" aria-labelledby="result-title">
              <div className="result-stars" aria-label={`${result.stars} of 3 stars`}>
                {[0, 1, 2].map(i => (
                  <span key={i} className={`big-star ${i < result.stars ? 'won' : ''}`} style={{ animationDelay: `${120 + i * 160}ms` }}><IconStar size={44} /></span>
                ))}
              </div>
              <h2 id="result-title">{HEADLINE[result.stars]}</h2>
              <dl className="result-stats">
                <div><dt>Accuracy</dt><dd>{Math.round(result.accuracy * 100)}%</dd></div>
                <div><dt>Notes</dt><dd>{result.hit}/{result.total}</dd></div>
                <div><dt>Wrong</dt><dd>{result.wrong}</dd></div>
              </dl>
              {result.streakUp !== undefined && (
                <p className="streak-up"><IconFlame size={18} />{result.streakUp === 1 ? 'Streak started' : `${result.streakUp}-day streak`}</p>
              )}
              {result.stars === 0 && (
                <p className="fine">You need 70% for a star. {local.speed > 0.6 ? 'Try it slower: tap the speed.' : local.wait ? 'Take it one note at a time.' : 'Switch Wait on to take it note by note.'}</p>
              )}
              <div className="actions">
                {step && result.stars > 0 && result.next && result.next.id !== step.id
                  ? <button className="btn go big" onClick={() => onStep(result.next!)}><IconPlay size={18} />Next: {stepName(result.next)}</button>
                  : null}
                <button className={`btn ${step && result.stars > 0 && result.next && result.next.id !== step.id ? '' : 'go big'}`} onClick={again}><IconRestart size={18} />Try again</button>
                <button className="btn quiet" onClick={onExit}>{step ? 'Song' : 'Exit'}</button>
              </div>
            </section>
          </div>
        )}
      </main>

      <footer className="p-keys">
        <Keyboard engine={engine} lo={lo} hi={hi} naming={settings.naming} fingers={settings.fingers} />
      </footer>
    </div>
  );
}

export function Stars({ n, of = 3 }: { n: number; of?: number }) {
  return (
    <span className="stars" aria-label={`${n} of ${of} stars`}>
      {Array.from({ length: of }, (_, i) => <IconStar key={i} size={14} className={i < n ? 'won' : ''} />)}
    </span>
  );
}

export function Segmented<V extends string | number>({ label, value, options, onChange }: { label: string; value: V; options: [V, string][]; onChange: (v: V) => void }) {
  return (
    <div className="seg-row">
      <span className="seg-label">{label}</span>
      <div className="seg" role="radiogroup" aria-label={label}>
        {options.map(([v, text]) => (
          <button key={String(v)} role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{text}</button>
        ))}
      </div>
    </div>
  );
}
