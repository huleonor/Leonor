import { lazy, Suspense, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { loadPiano, unlockAudio } from '../lib/audio';
import { Engine } from '../lib/engine';
import { filmName, useI18n } from '../lib/i18n';
import { onNote, type LinkState, type Source } from '../lib/input';
import { pickRange } from '../lib/keys';
import { recordRun } from '../lib/library';
import { formatSpeed, formatTime, noteName } from '../lib/names';
import type { HandsChoice, NoteNaming, Settings, Song } from '../lib/types';
import { Countdown } from './Countdown';
import { FallingNotes } from './FallingNotes';
import { IconBack, IconBack5, IconFalling, IconPlay, IconRestart, IconSheet } from './Icons';
import { Keyboard } from './Keyboard';

// The score engraver is heavy; load it only when the sheet view is opened.
const SheetView = lazy(() => import('./SheetView').then(m => ({ default: m.SheetView })));

const SPEEDS = [0.6, 0.8, 1, 1.2];
const INSET = 26;
const SOURCE_CODE: Record<Source, string> = { mic: 'MIC', ble: 'BT', midi: 'MIDI' };

/** Edge code in the bar: which input is live and the last note it heard. */
function InputTag({ kind, link, naming }: { kind: Settings['input']; link?: LinkState; naming: NoteNaming }) {
  const { t } = useI18n();
  const [heard, setHeard] = useState<number | null>(null);
  useEffect(() => onNote(e => { if (e.type === 'on') setHeard(e.midi); }), []);
  const on = kind !== 'none' && link?.status === 'on';
  return (
    <div className={`input-tag ${on ? 'on' : 'off'}`} role="status" aria-live="polite">
      <i />
      {on ? <>{SOURCE_CODE[kind as Source]}<b>{heard !== null ? noteName(heard, naming, true) : '—'}</b></> : t('noInputShort')}
    </div>
  );
}

interface Props {
  song: Song;
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  links: Record<Source, LinkState>;
  onExit: () => void;
}

export function Player({ song, settings, update, links, onExit }: Props) {
  const { t, lang } = useI18n();
  const [listen, setListen] = useState(false);
  const [pianoPct, setPianoPct] = useState<number | null>(0);
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const progressRef = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<ReturnType<Engine['stats']> | null>(null);

  const oneHand = song.hands.length === 1;
  const hands: HandsChoice = oneHand ? song.hands[0] : settings.hands;

  const engine = useMemo(() => new Engine(song, {
    speed: settings.speed, wait: settings.wait, hands, listen: false,
    accompaniment: settings.accompaniment, localSound: settings.localSound, lenient: settings.input === 'mic',
  }), [song]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __engine: Engine }).__engine = engine;
  }, [engine]);

  useEffect(() => {
    engine.setOptions({
      speed: settings.speed, wait: settings.wait, hands, listen,
      accompaniment: settings.accompaniment, localSound: settings.localSound, lenient: settings.input === 'mic',
    });
  }, [engine, settings.speed, settings.wait, hands, listen, settings.accompaniment, settings.localSound, settings.input]);

  useEffect(() => {
    const off = engine.on(e => {
      if (e.type === 'state') bump();
      if (e.type === 'end') {
        const s = engine.stats();
        if (!engine.opts.listen) {
          setResult(s);
          recordRun(song.entry.id, s.accuracy, engine.opts.speed);
        }
        bump();
      }
    });
    const offNote = onNote(e => engine.input(e));
    return () => { off(); offNote(); engine.destroy(); };
  }, [engine, song]);

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
    let raf = 0;
    const frame = () => {
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${engine.progress()})`;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  const [lo, hi] = useMemo(() => pickRange(song.range[0], song.range[1]), [song]);
  const togglePlay = () => { unlockAudio(); setResult(null); engine.toggle(); };
  const inputOn = settings.input !== 'none' && links[settings.input as Source]?.status === 'on';
  const film = filmName(song.entry, lang);
  const sub = [film, song.entry.year, formatTime(song.duration)].filter(Boolean).join(' · ');

  const seekFromBar = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    engine.seek(engine.startTime + f * (song.duration - engine.startTime));
  };

  const showResult = engine.finished && !!result;
  const showSetup = !engine.playing && !showResult;

  return (
    <div className={`player view-${settings.view}`}>
      <header className="bar">
        <button className="icon-btn" onClick={onExit} aria-label={t('back')}><IconBack /></button>
        <div className="bar-title">
          <h1>{song.entry.title}</h1>
          <p>{sub}</p>
        </div>
        <div className="seg" role="group" aria-label={t('viewNotes') + ' / ' + t('viewSheet')}>
          <button className={settings.view === 'notes' ? 'on' : ''} onClick={() => update({ view: 'notes' })} aria-pressed={settings.view === 'notes'} aria-label={t('viewNotes')} title={t('viewNotes')}>
            <IconFalling size={16} /><span>{t('viewNotes')}</span>
          </button>
          <button className={settings.view === 'sheet' ? 'on' : ''} onClick={() => update({ view: 'sheet' })} aria-pressed={settings.view === 'sheet'} aria-label={t('viewSheet')} title={t('viewSheet')}>
            <IconSheet size={16} /><span>{t('viewSheet')}</span>
          </button>
        </div>
        <div className="seg speeds" role="group" aria-label={t('speed')}>
          {SPEEDS.map(s => (
            <button key={s} className={settings.speed === s ? 'on' : ''} onClick={() => update({ speed: s })} aria-pressed={settings.speed === s}>
              {formatSpeed(s)}
            </button>
          ))}
        </div>
        <button className={`chip ${settings.wait ? 'on' : ''}`} onClick={() => update({ wait: !settings.wait })} aria-pressed={settings.wait} disabled={listen}>
          <i />{t('wait')}
        </button>
        {!listen && <InputTag kind={settings.input} link={settings.input !== 'none' ? links[settings.input as Source] : undefined} naming={settings.naming} />}
      </header>

      <div className="progress" onPointerDown={seekFromBar} role="slider" aria-label="progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(engine.progress() * 100)}>
        <div ref={progressRef} className="progress-fill" />
      </div>

      <main className="stage">
        {settings.view === 'notes'
          ? <FallingNotes engine={engine} lo={lo} hi={hi} naming={settings.naming} inset={INSET} onTap={togglePlay} />
          : <Suspense fallback={<p className="sheet-loading">{t('sheetLoading')}</p>}><SheetView key={song.entry.id} engine={engine} onTap={togglePlay} /></Suspense>}
        <Countdown engine={engine} caption={`${song.entry.title}  ·  ${formatSpeed(settings.speed)}${settings.wait && !listen ? '  ·  ' + t('wait') : ''}`} />

        {showSetup && (
          <div className="overlay">
            <div className="card">
              <h2>{song.entry.title}</h2>
              <p className="card-sub">{sub}</p>
              <div className="card-rows">
                <div className="row">
                  <span className="lab">{t('mode')}</span>
                  <div className="seg">
                    <button className={!listen ? 'on' : ''} onClick={() => setListen(false)}>{t('play')}</button>
                    <button className={listen ? 'on' : ''} onClick={() => setListen(true)}>{t('listen')}</button>
                  </div>
                </div>
                {!oneHand && !listen && (
                  <div className="row">
                    <span className="lab">{t('handsLabel')}</span>
                    <div className="seg">
                      {(['R', 'L', 'both'] as HandsChoice[]).map(h => (
                        <button key={h} className={settings.hands === h ? 'on' : ''} onClick={() => update({ hands: h })}>
                          {t(h === 'R' ? 'right' : h === 'L' ? 'left' : 'both')}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="card-actions">
                <button className="primary" onClick={togglePlay} disabled={pianoPct !== null && listen}>
                  <IconPlay size={16} />{engine.started ? t('continue') : t('start')}
                </button>
                {engine.started && (
                  <>
                    <button className="ghost" onClick={() => { engine.restart(); bump(); }}><IconRestart size={16} />{t('restart')}</button>
                    <button className="ghost" onClick={() => engine.seek(engine.time - 5)}><IconBack5 size={16} />{t('back5')}</button>
                  </>
                )}
              </div>
              {!listen && !inputOn && <p className="note warn">{t('noInput')}</p>}
              {pianoPct !== null && <p className="note">{pianoPct > 0 ? t('loadingPiano', { pct: pianoPct }) : t('loadingPianoPlain')}</p>}
              <p className="note rotate-hint">{t('rotate')}</p>
            </div>
          </div>
        )}

        {showResult && result && (
          <div className="overlay">
            <div className="card end">
              <h2>{t('theEnd')}</h2>
              <p className="card-sub">{song.entry.title} · {formatSpeed(engine.opts.speed)}</p>
              <dl className="stats">
                <div><dt>{t('accuracy')}</dt><dd>{Math.round(result.accuracy * 100)}%</dd></div>
                <div><dt>{t('notesHit')}</dt><dd>{result.hit}/{result.total}</dd></div>
                <div><dt>{t('wrongNotes')}</dt><dd>{result.wrong}</dd></div>
              </dl>
              <div className="card-actions">
                <button className="primary" onClick={() => { setResult(null); engine.restart(); engine.play(); }}><IconRestart size={16} />{t('again')}</button>
                {settings.speed < 1.2 && (
                  <button className="ghost" onClick={() => {
                    const next = SPEEDS[SPEEDS.indexOf(settings.speed) + 1] ?? 1.2;
                    update({ speed: next });
                    setResult(null); engine.setOptions({ speed: next }); engine.restart(); engine.play();
                  }}>{t('faster')}</button>
                )}
                <button className="ghost" onClick={onExit}>{t('library')}</button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="keys" style={{ paddingInline: INSET }}>
        <Keyboard engine={engine} lo={lo} hi={hi} naming={settings.naming} />
      </footer>
    </div>
  );
}
