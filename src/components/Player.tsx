import { lazy, Suspense, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { loadPiano, unlockAudio } from '../lib/audio';
import { Engine } from '../lib/engine';
import { filmName, useI18n } from '../lib/i18n';
import { onNote, setMicRange, type LinkState, type Source } from '../lib/input';
import { barsToTime } from '../lib/analysis';
import { nextStep, recordStep, starsFor, type Course, type CourseProgress, type CourseStep } from '../lib/course';
import { pickRange } from '../lib/keys';
import { recordRun } from '../lib/library';
import { formatSpeed, formatTime, noteName } from '../lib/names';
import type { HandsChoice, NoteNaming, Settings, Song } from '../lib/types';
import { Countdown } from './Countdown';
import { FallingNotes } from './FallingNotes';
import { stepLabel } from './CourseView';
import { IconBack, IconBack5, IconFalling, IconPlay, IconRestart, IconSheet } from './Icons';
import { Keyboard } from './Keyboard';
import { WaitHint } from './WaitHint';

// The score engraver is heavy; load it only when the sheet view is opened.
const SheetView = lazy(() => import('./SheetView').then(m => ({ default: m.SheetView })));

const SPEEDS = [0.6, 0.8, 1, 1.2];
const INSET = 0;
const SOURCE_CODE: Record<Source, string> = { mic: 'MIC', ble: 'BT', midi: 'USB' };

/** The input LCD: which input is live and the notes it just heard. */
function InputLcd({ kind, link, naming }: { kind: Settings['input']; link?: LinkState; naming: NoteNaming }) {
  const { t } = useI18n();
  const [heard, setHeard] = useState<number[]>([]);
  useEffect(() => onNote(e => { if (e.type === 'on') setHeard(e.chord && e.chord.length > 1 ? e.chord : [e.midi]); }), []);
  const on = kind !== 'none' && link?.status === 'on';
  return (
    <div className={`lcd input-lcd ${on ? '' : 'off'}`} role="status" aria-live="polite">
      <small><i className={`led ${on ? 'green' : ''}`} />{on ? `${SOURCE_CODE[kind as Source]} · heard` : 'input'}</small>
      <b>{on ? (heard.length ? heard.slice(0, 3).map(m => noteName(m, naming, true)).join(' ') : '—') : t('noInputShort')}</b>
    </div>
  );
}

interface Props {
  song: Song;
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  links: Record<Source, LinkState>;
  onExit: () => void;
  /** A course step: only its bars, with its own hands, speed and Wait. */
  step?: CourseStep;
  course?: Course;
  onStep?: (step: CourseStep) => void;
}

type Practice = Pick<Settings, 'speed' | 'wait' | 'hands'>;

export function Player({ song, settings: global, update: updateGlobal, links, onExit, step, course, onStep }: Props) {
  // A course step sets speed, hands and Wait for this run only; free play uses (and saves) the settings.
  const [local, setLocal] = useState<Practice | null>(step ? { speed: step.speed, wait: step.wait, hands: step.hands } : null);
  const settings: Settings = local ? { ...global, ...local } : global;
  const update = (patch: Partial<Settings>) => {
    const { speed, wait, hands, ...rest } = patch;
    const practice = Object.fromEntries(Object.entries({ speed, wait, hands }).filter(([, v]) => v !== undefined)) as Partial<Practice>;
    if (local) setLocal({ ...local, ...practice }); else Object.keys(practice).length && updateGlobal(practice);
    if (Object.keys(rest).length) updateGlobal(rest);
  };
  const [stepProg, setStepProg] = useState<{ stars: number; next?: CourseStep } | null>(null);
  const { t, lang } = useI18n();
  const [listen, setListen] = useState(false);
  const [pianoPct, setPianoPct] = useState<number | null>(0);
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const progressRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLParagraphElement>(null);
  const [result, setResult] = useState<ReturnType<Engine['stats']> | null>(null);

  const oneHand = song.hands.length === 1;
  const hands: HandsChoice = oneHand ? song.hands[0] : settings.hands;

  const engine = useMemo(() => new Engine(song, {
    speed: settings.speed, wait: settings.wait, hands, listen: false,
    accompaniment: settings.accompaniment, lenient: settings.input === 'mic',
  }), [song]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setMicRange(song.range[0], song.range[1]); }, [song]);

  // A step plays its own bars and stops at their end.
  useEffect(() => {
    if (step) engine.setSegment(barsToTime(engine.measureTimes, step.from, step.to));
  }, [engine, step]);

  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __engine: Engine }).__engine = engine;
  }, [engine]);

  useEffect(() => {
    engine.setOptions({
      speed: settings.speed, wait: settings.wait, hands, listen,
      accompaniment: settings.accompaniment, lenient: settings.input === 'mic',
    });
  }, [engine, settings.speed, settings.wait, hands, listen, settings.accompaniment, settings.input]);

  useEffect(() => {
    const off = engine.on(e => {
      if (e.type === 'state') bump();
      if (e.type === 'end') {
        const s = engine.stats();
        if (!engine.opts.listen) {
          setResult(s);
          if (step && course) {
            recordStep(song.entry.id, step.id, s.accuracy).then((prog: CourseProgress) => {
              setStepProg({ stars: starsFor(s.accuracy), next: nextStep(course, prog) });
            });
          } else {
            recordRun(song.entry.id, s.accuracy, engine.opts.speed);
          }
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

  // Keep the screen awake while a song is rolling.
  useEffect(() => {
    if (!engine.playing) return;
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock?.request('screen').then(l => (lock = l)).catch(() => {});
    return () => { lock?.release().catch(() => {}); };
  }, [engine, engine.playing]);

  useEffect(() => {
    let raf = 0, last = '';
    const bars = engine.measureTimes.filter(t => t <= song.duration).length;
    const frame = () => {
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${engine.progress()})`;
      // Bar and time readout, written only when it changes.
      let bar = 0;
      while (bar + 1 < engine.measureTimes.length && engine.measureTimes[bar + 1] <= engine.time) bar++;
      const text = `BAR ${Math.max(1, bar + 1)}/${bars}  ${formatTime(Math.max(0, engine.time))}`;
      if (text !== last && readoutRef.current) { readoutRef.current.textContent = text; last = text; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [engine, song]);

  const [lo, hi] = useMemo(() => pickRange(song.range[0], song.range[1]), [song]);
  const togglePlay = () => { unlockAudio(); setResult(null); engine.toggle(); };
  const inputOn = settings.input !== 'none' && links[settings.input as Source]?.status === 'on';
  const film = filmName(song.entry, lang);
  const sub = step
    ? `Bars ${step.from}–${step.to} · ${formatSpeed(settings.speed)}${settings.wait ? ' · Wait' : ''}`
    : [film, song.entry.year, formatTime(song.duration)].filter(Boolean).join(' · ');
  const title = step && course ? stepLabel(course, step) : song.entry.title;

  const seekFromBar = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const [a, b] = engine.segment ? [engine.segment.from - 1.6, engine.segment.to] : [engine.startTime, song.duration];
    engine.seek(a + f * (b - a));
  };

  const showResult = engine.finished && !!result;
  const showSetup = !engine.playing && !showResult;

  return (
    <div className={`player view-${settings.view}`}>
      <header className="bar">
        <button className="keycap" onClick={onExit} aria-label={t('back')}><IconBack /></button>
        <div className="bar-title">
          <h1>{step ? `${song.entry.title} · ${title}` : song.entry.title}</h1>
          <p className="lcd readout-lcd" ref={readoutRef} aria-label="Bar and time">{sub}</p>
        </div>
        <div className="slider" role="group" aria-label={t('viewNotes') + ' / ' + t('viewSheet')}>
          <button className={settings.view === 'notes' ? 'on' : ''} onClick={() => update({ view: 'notes' })} aria-pressed={settings.view === 'notes'} aria-label={t('viewNotes')}>
            <IconFalling size={15} /><span>{t('viewNotes')}</span>
          </button>
          <button className={settings.view === 'sheet' ? 'on' : ''} onClick={() => update({ view: 'sheet' })} aria-pressed={settings.view === 'sheet'} aria-label={t('viewSheet')}>
            <IconSheet size={15} /><span>{t('viewSheet')}</span>
          </button>
        </div>
        <div className="speeds" role="group" aria-label={t('speed')}>
          <div className="keys-row">
            {SPEEDS.map(v => (
              <button key={v} className={`keycap ${settings.speed === v ? 'lit' : ''}`} onClick={() => update({ speed: v })} aria-pressed={settings.speed === v} aria-label={`${t('speed')} ${formatSpeed(v)}`}>
                {v === 1 ? '1' : String(v).replace(/^0/, '')}
              </button>
            ))}
          </div>
          <span className="legend">{t('speed')}</span>
        </div>
        <div className="cap wait-key">
          <i className={`led ${settings.wait && !listen ? 'orange' : ''}`} />
          <button className={`keycap dark ${settings.wait ? 'down' : ''}`} onClick={() => update({ wait: !settings.wait })} aria-pressed={settings.wait} disabled={listen}>
            {t('wait').toUpperCase()}
          </button>
        </div>
        {!listen && <InputLcd kind={settings.input} link={settings.input !== 'none' ? links[settings.input as Source] : undefined} naming={settings.naming} />}
      </header>

      <main className="display">
        {settings.view === 'notes'
          ? <FallingNotes engine={engine} lo={lo} hi={hi} naming={settings.naming} fingers={settings.fingers} inset={INSET} onTap={togglePlay} />
          : <Suspense fallback={<p className="score-loading">{t('sheetLoading')}</p>}><SheetView key={`${song.entry.id}-${settings.fingers}`} engine={engine} fingers={settings.fingers} onTap={togglePlay} /></Suspense>}
        <div className="progress" onPointerDown={seekFromBar} role="slider" aria-label="Position in the song" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(engine.progress() * 100)}>
          <div ref={progressRef} className="progress-fill" />
        </div>
        <Countdown engine={engine} caption={`${song.entry.title}  ·  ${formatSpeed(settings.speed)}${settings.wait && !listen ? '  ·  ' + t('wait') : ''}`} />
      </main>
      {!listen && settings.wait && <WaitHint engine={engine} naming={settings.naming} />}

      {showSetup && (
        <div className="overlay">
          <div className="plate">
            <h2>{title}</h2>
            <p className="plate-sub">{step ? `${song.entry.title} · ${sub}` : sub}</p>
            <div className="plate-rows">
              <div className="row">
                <span className="legend">{t('mode')}</span>
                <div className="slider">
                  <button className={!listen ? 'on' : ''} onClick={() => setListen(false)}>{t('play')}</button>
                  <button className={listen ? 'on' : ''} onClick={() => setListen(true)}>{step ? 'Listen first' : t('listen')}</button>
                </div>
              </div>
              {!listen && (
                <div className="row">
                  <span className="legend">Fingers</span>
                  <div className="slider">
                    {(['off', 'some', 'all'] as const).map(f => (
                      <button key={f} className={settings.fingers === f ? 'on' : ''} onClick={() => update({ fingers: f })}>{f === 'off' ? 'Off' : f === 'some' ? 'Some' : 'All'}</button>
                    ))}
                  </div>
                </div>
              )}
              {!oneHand && !listen && !step && (
                <div className="row">
                  <span className="legend">{t('handsLabel')}</span>
                  <div className="slider">
                    {(['R', 'L', 'both'] as HandsChoice[]).map(h => (
                      <button key={h} className={settings.hands === h ? 'on' : ''} onClick={() => update({ hands: h })}>
                        {t(h === 'R' ? 'right' : h === 'L' ? 'left' : 'both')}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="plate-actions">
              <button className="pill go" onClick={togglePlay} disabled={pianoPct !== null && listen}>
                <IconPlay size={15} />{engine.started ? t('continue') : t('start')}
              </button>
              {engine.started && (
                <>
                  <button className="pill" onClick={() => { engine.restart(); bump(); }}><IconRestart size={16} />{t('restart')}</button>
                  {!step && <button className="pill" onClick={() => engine.seek(engine.time - 5)}><IconBack5 size={16} />{t('back5')}</button>}
                </>
              )}
              <button className="pill" onClick={onExit}>{step ? 'Course' : 'Back'}</button>
            </div>
            {step && !listen && <p className="note">{step.wait ? 'The music waits for you. ' : 'In tempo: the music keeps going. '}One star from 70% right, three from 95%.</p>}
            {!listen && !inputOn && <p className="note warn">{t('noInput')}</p>}
            {pianoPct !== null && <p className="note">{pianoPct > 0 ? t('loadingPiano', { pct: pianoPct }) : t('loadingPianoPlain')}</p>}
            <p className="note rotate-hint">{t('rotate')}</p>
          </div>
        </div>
      )}

      {showResult && result && (
        <div className="overlay">
          <div className="plate">
            {step ? (
              <>
                <div className="result-head">
                  <h2>{(stepProg?.stars ?? 0) > 0 ? 'Passed' : 'Not yet'}</h2>
                  <span className="stars big" aria-label={`${stepProg?.stars ?? 0} of 3 stars`}>
                    {[0, 1, 2].map(i => <i key={i} className={`led ${i < (stepProg?.stars ?? 0) ? 'orange' : ''}`} />)}
                  </span>
                </div>
                <p className="plate-sub">{title} · {song.entry.title}</p>
              </>
            ) : (
              <>
                <h2>{t('theEnd')}</h2>
                <p className="plate-sub">{song.entry.title} · {formatSpeed(engine.opts.speed)}</p>
              </>
            )}
            <dl className="lcd readout">
              <div><dt>{t('accuracy')}</dt><dd>{Math.round(result.accuracy * 100)}%</dd></div>
              <div><dt>{t('notesHit')}</dt><dd>{result.hit}/{result.total}</dd></div>
              <div><dt>{t('wrongNotes')}</dt><dd>{result.wrong}</dd></div>
            </dl>
            {step ? (
              <div className="plate-actions">
                {stepProg && stepProg.stars > 0 && stepProg.next && stepProg.next.id !== step.id && onStep
                  ? <button className="pill go" onClick={() => onStep(stepProg.next!)}><IconPlay size={15} />Next: {course ? stepLabel(course, stepProg.next) : stepProg.next.title}</button>
                  : null}
                <button className={`pill ${stepProg && stepProg.stars > 0 ? '' : 'go'}`} onClick={() => { setResult(null); setStepProg(null); engine.restart(); engine.play(); }}><IconRestart size={16} />{t('again')}</button>
                <button className="pill" onClick={onExit}>Course</button>
              </div>
            ) : (
              <div className="plate-actions">
                <button className="pill go" onClick={() => { setResult(null); engine.restart(); engine.play(); }}><IconRestart size={16} />{t('again')}</button>
                {settings.speed < 1.2 && (
                  <button className="pill" onClick={() => {
                    const next = SPEEDS[SPEEDS.indexOf(settings.speed) + 1] ?? 1.2;
                    update({ speed: next });
                    setResult(null); engine.setOptions({ speed: next }); engine.restart(); engine.play();
                  }}>{t('faster')}</button>
                )}
                <button className="pill" onClick={onExit}>Course</button>
              </div>
            )}
            {step && stepProg && stepProg.stars === 0 && <p className="note">You need 70% to pass. Try it again; switch on Wait or slow down if it helps.</p>}
          </div>
        </div>
      )}

      <footer className="keys" style={{ paddingInline: INSET }}>
        <Keyboard engine={engine} lo={lo} hi={hi} naming={settings.naming} fingers={settings.fingers} />
      </footer>
    </div>
  );
}
