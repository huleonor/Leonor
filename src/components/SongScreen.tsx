import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { L } from '../lib/lang';
import { loadPiano, unlockAudio } from '../lib/audio';
import type { SongInfo } from '../lib/catalog';
import { barsToTime } from '../lib/analysis';
import { partLearnt, type CourseStep } from '../lib/course';
import { Engine } from '../lib/engine';
import { onNote, setMicRange, type LinkState, type Source } from '../lib/input';
import { recordRun } from '../lib/library';
import { pctOf, useMastery } from '../lib/mastery';
import { listenForSkills } from '../lib/skills';
import { addPractice } from '../lib/stats';
import { formatSpeed } from '../lib/names';
import { usePracticeClock } from '../lib/practiceClock';
import type { HandsChoice, Settings } from '../lib/types';
import { AnimatePresence, motion } from 'motion/react';
import { HelpKeys } from './HelpKeys';
import {
  IconCap, IconCheck, IconClose, IconGear, IconKeys, IconLoop, IconMagic, IconPlay, IconRestart, IconSpeaker, IconStop, IconTarget,
} from './Icons';
import { Bump, Cheer, ProgressBar, SOFT, SPRING } from './Motion';
import { metronomeOn, setMetronome, useMetronome } from '../lib/metronome';
import { ScoreView } from './ScoreView';
import { byLine } from './Songs';
import { Segmented } from './ui';

const SPEEDS = [0.6, 0.8, 1];
type Mode = 'play' | 'listen';
type Scroll = 'magic' | 'auto';

/** A section of the song as the Teach me strip shows it. */
export interface Section { id: string; title: string; bars: string; from: number; steps: CourseStep[]; learnt: boolean; done: number; }

export function sectionsOf(info: SongInfo): Section[] {
  const course = info.course!;
  const out: Section[] = [];
  for (const p of course.parts) {
    if (p.sameAs) continue;
    const steps = course.steps.filter(s => s.part === p.n);
    out.push({
      id: `p${p.n}`, title: L(`Part ${p.n}`, `Parte ${p.n}`), bars: L(`Bars ${p.from}-${p.to}`, `Compassos ${p.from}-${p.to}`), from: p.from, steps,
      learnt: partLearnt(course, info.prog, p.n), done: steps.filter(s => (info.prog[s.id]?.stars ?? 0) > 0).length,
    });
  }
  const whole = course.steps.filter(s => s.kind === 'song');
  out.push({
    id: 'song', title: L('Whole song', 'A música toda'), bars: L('Start to finish', 'Do início ao fim'), from: 0, steps: whole,
    learnt: (info.prog.song?.stars ?? 0) > 0, done: whole.filter(s => (info.prog[s.id]?.stars ?? 0) > 0).length,
  });
  return out;
}

interface Props {
  info: SongInfo;
  settings: Settings;
  links: Record<Source, LinkState>;
  onExit: () => void;
  onTeach: (section: Section) => void;
  /** Starts the next lesson Mastery planned. */
  onMastery: () => void;
  onSettings: () => void;
}

/**
 * A song, Duolingo style: a close button and a progress bar, the score, and one row of actions.
 * The music waits for him (or runs in tempo); the keyboard only rises when he needs help; the
 * other choices live in a small options sheet; "Learn step by step" opens the song's sections.
 */
export function SongScreen({ info, settings, links, onExit, onTeach, onMastery, onSettings }: Props) {
  const song = info.song!;
  const [mode, setMode] = useState<Mode>('play');
  const [scroll, setScroll] = useState<Scroll>('magic');
  const [feedback, setFeedback] = useState(true);
  const [speed, setSpeed] = useState(0.8);
  const [teach, setTeach] = useState(false);
  const [masterySheet, setMasterySheet] = useState(false);
  const mastery = useMastery(song)!;
  const pct = pctOf(mastery.meter.value);
  const pickerWasPlaying = useRef(false);
  const [options, setOptions] = useState(false);
  const [alwaysKeys, setAlwaysKeys] = useState(() => { try { return localStorage.getItem('hugos-piano:keys') === 'always'; } catch { return false; } });
  const toggleKeys = () => setAlwaysKeys(a => { try { localStorage.setItem('hugos-piano:keys', a ? 'help' : 'always'); } catch { /* ignore */ } return !a; });
  const [hands, setHands] = useState<HandsChoice>('both');
  const [loop, setLoop] = useState<{ n: number; from: number; to: number } | null>(null);
  const [result, setResult] = useState<ReturnType<Engine['stats']> | null>(null);
  // A run of right notes, for the praise that pops at milestones.
  const [combo, setCombo] = useState(0);
  const [metro, setMetro] = useState(metronomeOn);
  const [, bump] = useReducer((x: number) => x + 1, 0);
  usePracticeClock();

  const engine = useMemo(() => new Engine(song, {
    speed: 1, wait: false, follow: true, hands: 'both', listen: false, accompaniment: false, lenient: settings.input === 'mic',
  }), [song]); // eslint-disable-line react-hooks/exhaustive-deps
  const sections = useMemo(() => sectionsOf(info), [info]);
  useMetronome(engine, scroll === 'auto' && mode === 'play' && metro);
  // The parts, labelled on the score where each one begins (a repeat is labelled with the part it repeats).
  const labels = useMemo(() => info.course!.parts.map(p => ({ bar: p.from, label: p.sameAs ? L(`Part ${p.sameAs}`, `Parte ${p.sameAs}`) : L(`Part ${p.n}`, `Parte ${p.n}`) })), [info.course]);
  // The section he should open next: the first one not learnt yet.
  const nextSection = sections.find(s => !s.learnt);

  useEffect(() => { setMicRange(song.range[0], song.range[1]); }, [song]);
  useEffect(() => { loadPiano().catch(() => {}); }, []);
  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __engine: Engine }).__engine = engine; }, [engine]);

  useEffect(() => {
    // Playing the song also teaches the app about his skills.
    let skills = listenForSkills(engine);
    const off = engine.on(e => {
      if (e.type === 'state') bump();
      if (e.type === 'press' && !(e.ok && e.id === undefined)) setCombo(c => (e.ok ? c + 1 : 0));
      if (e.type === 'end') {
        skills.stop();
        skills = listenForSkills(engine);
        if (engine.opts.listen) { engine.restart(); setMode('play'); bump(); return; }
        const s = engine.stats();
        recordRun(song.entry.id, s.accuracy, engine.opts.follow ? 1 : engine.opts.speed);
        if (s.accuracy >= 0.5) addPractice(0, 1, 0);
        setResult(s);
      }
    });
    const offNote = onNote(e => engine.input(e));
    return () => { off(); offNote(); skills.stop(); engine.destroy(); };
  }, [engine, song]);

  // Mode changes reconfigure the engine where the cursor is. Magic scroll waits at once for his
  // first note; tempo and listening start on a press.
  useEffect(() => {
    const listen = mode === 'listen';
    const follow = !listen && scroll === 'magic';
    engine.pause();
    engine.setOptions({ listen, follow, wait: false, hands: song.hands.length === 1 ? song.hands[0] : hands, speed: listen ? 1 : follow ? 1 : speed, lenient: settings.input === 'mic' });
    if (follow && !engine.finished) { if (!engine.stats().hit) engine.toFirstNote(); engine.play(0); }
    if (listen) { unlockAudio(); engine.play(1); }
    bump();
  }, [engine, mode, scroll, speed, hands, settings.input]);

  // Loop: the part under the cursor plays round and round until Loop is pressed again.
  useEffect(() => {
    engine.setSegment(loop ? barsToTime(engine.measureTimes, loop.from, loop.to) : null, !!loop);
    if (engine.opts.follow || engine.opts.listen) engine.play(engine.opts.listen ? 1 : 0);
    bump();
  }, [engine, loop]);
  const toggleLoop = () => {
    if (loop) { setLoop(null); return; }
    let bar = 0;
    while (bar + 1 < engine.measureTimes.length && engine.measureTimes[bar + 1] <= engine.time + 1e-3) bar++;
    const part = info.course!.parts.find(p => bar + 1 >= p.from && bar + 1 <= p.to) ?? info.course!.parts[0];
    if (part) setLoop({ n: part.sameAs ?? part.n, from: part.from, to: part.to });
  };

  const openStepPicker = () => { pickerWasPlaying.current = engine.playing; engine.pause(); setTeach(true); };
  const closeStepPicker = () => {
    setTeach(false);
    if (pickerWasPlaying.current && !engine.finished) engine.play(engine.opts.follow ? 0 : engine.started ? 1 : 3);
    pickerWasPlaying.current = false;
  };
  const restart = () => { setResult(null); engine.restart(); if (engine.opts.follow) { engine.toFirstNote(); engine.play(0); } setCombo(0); bump(); };
  const seek = (t: number) => {
    setResult(null);
    engine.seek(t - 0.05);
    if (engine.opts.follow) engine.play(0);
    bump();
  };
  const startTempo = () => { unlockAudio(); setResult(null); if (engine.playing) engine.pause(); else engine.play(engine.started ? 1 : 3); bump(); };
  const inputOn = settings.input !== 'none' && links[settings.input as Source]?.status === 'on';
  const tempoMode = mode === 'play' && scroll === 'auto';
  const atStart = engine.gi === 0;

  const stats = engine.stats();
  const twoHands = song.hands.length === 2;

  return (
    <div className="song-screen">
      <header className="song-top">
        <button className="icon-btn ghost" onClick={onExit} aria-label={L('Back to my songs', 'Voltar às minhas músicas')}><IconClose size={24} /></button>
        <ProgressBar value={stats.total ? stats.hit / stats.total : 0} label={`${stats.hit} of ${stats.total} notes`} />
        {!inputOn && <button className="piano-chip" onClick={onSettings} aria-label={L('Connect your piano', 'Ligar o teu piano')}><IconKeys size={20} /><i /></button>}
        <button className="icon-btn ghost" onClick={() => setOptions(true)} aria-label={L('Options', 'Opções')}><IconGear size={22} /></button>
      </header>
      <main className="sheet">
        <div className="sheet-card">
          <ScoreView engine={engine} fingers={settings.fingers} feedback={feedback} follow title={song.entry.title} composer={byLine(song.entry) || undefined} sections={labels} onSeek={seek} />
          <Cheer combo={combo} />
          <AnimatePresence>
            {mode === 'play' && !tempoMode && !result && stats.hit === 0 && (
              <motion.p className="ready-pill" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0, scale: 0.9 }} transition={SPRING}>
                <IconKeys size={18} />Play the first note to start
              </motion.p>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {result && (
              <motion.div className="sheet-result card" role="dialog" aria-labelledby="sheet-result-title" initial={{ scale: 0.85, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }} transition={SPRING}>
                <h2 id="sheet-result-title">{result.accuracy >= 0.95 ? L('Beautifully played', 'Muito bem tocado') : result.accuracy >= 0.7 ? L('You played it through', 'Tocaste até ao fim') : L('Keep at it', 'Continua a praticar')}</h2>
                <p className="result-line">{result.hit} of {result.total} notes, {Math.round(result.accuracy * 100)}% right</p>
                <div className="actions">
                  <button className="btn go" onClick={restart}><IconRestart size={16} />{L('Play again', 'Tocar outra vez')}</button>
                  <button className="btn" onClick={() => { setResult(null); openStepPicker(); }}><IconCap size={16} />{L('Learn step by step', 'Aprender passo a passo')}</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {!teach && <HelpKeys engine={engine} naming={settings.naming} fingers={settings.fingers} always={alwaysKeys} />}

      <footer className="song-foot">
        <motion.button className={`btn ${mode === 'listen' ? 'on' : ''}`} whileTap={{ scale: 0.96 }} onClick={() => { setTeach(false); setMode(m => (m === 'listen' ? 'play' : 'listen')); }} aria-pressed={mode === 'listen'}>
          {mode === 'listen' ? <><IconStop size={18} />{L('Stop', 'Parar')}</> : <><IconSpeaker size={18} />{L('Listen', 'Ouvir')}</>}
        </motion.button>
        {tempoMode && !result && (
          <motion.button className="btn go" whileTap={{ scale: 0.96 }} onClick={startTempo}>{engine.playing ? <><IconStop size={16} />{L('Stop', 'Parar')}</> : <><IconPlay size={16} />{engine.started ? L('Go on', 'Continuar') : L('Start', 'Começar')}</>}</motion.button>
        )}
      <motion.button className="btn go big" whileTap={{ scale: 0.96 }} onClick={openStepPicker}><IconCap size={18} />{L('Learn step by step', 'Aprender passo a passo')}</motion.button>
        <motion.button className="btn big mastery-btn" whileTap={{ scale: 0.96 }} onClick={() => { setTeach(false); setMasterySheet(true); }} aria-label={`${L('Mastery', 'Domínio')}, ${pct}%`}>
          <motion.span className="mastery-fill" initial={false} animate={{ width: `${pct}%` }} transition={SOFT} />
          <IconTarget size={18} />{L('Mastery', 'Domínio')}<b>{pct}%</b>
        </motion.button>
      </footer>

      <AnimatePresence>
        {options && (
          <motion.div className="veil sheet-veil" onClick={() => setOptions(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.section className="card options-sheet" role="dialog" aria-modal="true" aria-labelledby="options-title" onClick={e => e.stopPropagation()} initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} transition={SOFT}>
              <h2 id="options-title">{L('Options', 'Opções')}</h2>
              {twoHands && <Segmented<HandsChoice> label="Hands" value={hands} onChange={setHands} options={[['L', 'Left'], ['both', 'Both'], ['R', 'Right']]} />}
              <Segmented<Scroll> label={L('The music', 'A música')} value={scroll} onChange={setScroll} options={[['magic', L('Waits for you', 'Espera por ti')], ['auto', L('In tempo', 'A tempo')]]} />
              {tempoMode && <Segmented label="Speed" value={speed} onChange={setSpeed} options={SPEEDS.map(v => [v, formatSpeed(v)] as [number, string])} />}
              <div className="option-rows">
                <button className={`option-row ${feedback ? 'on' : ''}`} onClick={() => setFeedback(f => !f)} aria-pressed={feedback}><IconCheck size={18} /><span>{L('Colour right and wrong notes', 'Colorir as notas certas e erradas')}</span><i className="switch-dot" /></button>
                <button className={`option-row ${alwaysKeys ? 'on' : ''}`} onClick={toggleKeys} aria-pressed={alwaysKeys}><IconKeys size={18} /><span>{L('Keep the keyboard on screen', 'Manter o teclado no ecrã')}</span><i className="switch-dot" /></button>
                {tempoMode && <button className={`option-row ${metro ? 'on' : ''}`} onClick={() => { setMetro(!metro); setMetronome(!metro); }} aria-pressed={metro}><IconSpeaker size={18} /><span>{L('Metronome', 'Metrónomo')}</span><i className="switch-dot" /></button>}
                <button className={`option-row ${loop ? 'on' : ''}`} onClick={toggleLoop} aria-pressed={!!loop}><IconLoop size={18} /><span>{loop ? L(`Looping part ${loop.n}`, `A repetir a parte ${loop.n}`) : L('Loop the part I’m on', 'Repetir a parte onde estou')}</span><i className="switch-dot" /></button>
              </div>
              <div className="actions">
                {!atStart && <button className="btn" onClick={() => { restart(); setOptions(false); }}><IconRestart size={16} />{L('From the start', 'Do início')}</button>}
                <button className="btn go" onClick={() => setOptions(false)}>{L('Done', 'Feito')}</button>
              </div>
            </motion.section>
          </motion.div>
        )}
        {masterySheet && (
          <motion.div className="veil sheet-veil" onClick={() => setMasterySheet(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.section className="card mastery-sheet" role="dialog" aria-modal="true" aria-labelledby="mastery-title" onClick={e => e.stopPropagation()} initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} transition={SOFT}>
              <div className="mastery-head">
                <h2 id="mastery-title">{L('Mastery', 'Domínio')}</h2>
                <b className="mastery-pct"><Bump value={pct} />%</b>
              </div>
              <span className="mastery-track big" role="progressbar" aria-label={L('Mastery', 'Domínio')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                <motion.i initial={{ width: 0 }} animate={{ width: `${Math.max(2, pct)}%` }} transition={SOFT} />
              </span>
              <ol className="mastery-parts" aria-label={L('The parts of the song', 'As partes da música')}>
                {mastery.meter.parts.map(p => (
                  <li key={p.n} className={p.value >= 0.999 ? 'done' : ''} style={{ flexGrow: p.weight }} aria-label={L(`Part ${p.n}, bars ${p.from}-${p.to}: ${pctOf(p.value)}%`, `Parte ${p.n}, compassos ${p.from}-${p.to}: ${pctOf(p.value)}%`)}>
                    <motion.i initial={{ width: 0 }} animate={{ width: `${p.value * 100}%` }} transition={SOFT} />
                  </li>
                ))}
              </ol>
              <div className="mastery-next">
                <small>{L('Next', 'A seguir')}</small>
                <b>{mastery.next.title}</b>
                {mastery.next.why && <p>{mastery.next.why}</p>}
                <small className="mastery-count">{mastery.next.lessons.length === 1 ? L('One step', 'Um passo') : L(`${mastery.next.lessons.length} steps`, `${mastery.next.lessons.length} passos`)}{L(', one after the other', ', um a seguir ao outro')}</small>
              </div>
              <button className="btn go big" onClick={() => { setMasterySheet(false); onMastery(); }}><IconPlay size={18} />{L('Start', 'Começar')}</button>
              <p className="fine">100% is the whole song with the beat at full speed, 95% right, on two different days.</p>
            </motion.section>
          </motion.div>
        )}
        {teach && (
          <motion.div className="veil sections-veil" onClick={closeStepPicker} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.section className="card sections-sheet" role="dialog" aria-modal="true" aria-labelledby="sections-title" onClick={e => e.stopPropagation()} initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} transition={SOFT}>
              <header className="sections-head">
                <button className="icon-btn ghost" onClick={closeStepPicker} aria-label={L('Back to the song', 'Voltar à música')}><IconClose size={22} /></button>
                <h2 id="sections-title">{L('Learn step by step', 'Aprender passo a passo')}</h2>
                <span aria-hidden="true" />
              </header>
              <ol className="section-list">
                {sections.map((sc, n) => (
                  <motion.li key={sc.id} initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ ...SOFT, delay: n * 0.04 }}>
                    <button className={`section-row ${sc.learnt ? 'learnt' : ''} ${sc === nextSection ? 'next' : ''}`} onClick={() => onTeach(sc)}>
                      <span className="section-icon">{sc.learnt ? <IconCheck size={18} /> : sc.id === 'song' ? <IconMagic size={18} /> : sc.id.slice(1)}</span>
                      <span className="section-text"><b>{sc.title}</b><small>{sc.bars}, {sc.done} of {sc.steps.length} steps</small></span>
                      {sc === nextSection && <span className="section-go">{L('Start', 'Começar')}</span>}
                    </button>
                  </motion.li>
                ))}
              </ol>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
