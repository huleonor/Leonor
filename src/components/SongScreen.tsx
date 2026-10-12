import { useEffect, useMemo, useReducer, useState } from 'react';
import { loadPiano, unlockAudio } from '../lib/audio';
import type { SongInfo } from '../lib/catalog';
import { barsToTime } from '../lib/analysis';
import { partLearnt, type CourseStep } from '../lib/course';
import { Engine } from '../lib/engine';
import { onNote, setMicRange, type LinkState, type Source } from '../lib/input';
import { pickRange } from '../lib/keys';
import { recordRun } from '../lib/library';
import { listenForSkills } from '../lib/skills';
import { addPractice } from '../lib/stats';
import { formatSpeed, formatTime } from '../lib/names';
import { usePracticeClock } from '../lib/practiceClock';
import type { HandsChoice, Settings } from '../lib/types';
import {
  IconAutoScroll, IconBack, IconCap, IconCheck, IconChevronDown, IconChevronUp, IconHand, IconKeys, IconLoop, IconMagic, IconNotes, IconPlay, IconRestart, IconSpeaker, IconStop,
} from './Icons';
import { Keyboard } from './Keyboard';
import { ScoreView } from './ScoreView';
import { byLine } from './Songs';

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
      id: `p${p.n}`, title: `Part ${p.n}`, bars: `Bars ${p.from}–${p.to}`, from: p.from, steps,
      learnt: partLearnt(course, info.prog, p.n), done: steps.filter(s => (info.prog[s.id]?.stars ?? 0) > 0).length,
    });
  }
  const whole = course.steps.filter(s => s.kind === 'song');
  out.push({
    id: 'song', title: 'Whole song', bars: 'Start to finish', from: 0, steps: whole,
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
  onSettings: () => void;
}

/**
 * The song as sheet music, the way Simply Piano shows it: a tool bar of modes over the printed score.
 * Play follows him note by note (Magic scroll) or runs in tempo (Auto scroll); Listen plays it to him;
 * Teach me opens the song's sections as lessons.
 */
export function SongScreen({ info, settings, links, onExit, onTeach, onSettings }: Props) {
  const song = info.song!;
  const [mode, setMode] = useState<Mode>('play');
  const [scroll, setScroll] = useState<Scroll>('magic');
  const [feedback, setFeedback] = useState(true);
  const [speed, setSpeed] = useState(0.8);
  const [teach, setTeach] = useState(false);
  const [keysHidden, setKeysHidden] = useState(false);
  // The tool bar folds away for more score; the choice is remembered.
  const [barOpen, setBarOpen] = useState(() => { try { return localStorage.getItem('hugos-piano:bar') !== 'closed'; } catch { return true; } });
  const toggleBar = () => setBarOpen(o => { try { localStorage.setItem('hugos-piano:bar', o ? 'closed' : 'open'); } catch { /* ignore */ } return !o; });
  const [hands, setHands] = useState<HandsChoice>('both');
  const [loop, setLoop] = useState<{ n: number; from: number; to: number } | null>(null);
  const [result, setResult] = useState<ReturnType<Engine['stats']> | null>(null);
  const [, bump] = useReducer((x: number) => x + 1, 0);
  usePracticeClock();

  const engine = useMemo(() => new Engine(song, {
    speed: 1, wait: false, follow: true, hands: 'both', listen: false, accompaniment: false, lenient: settings.input === 'mic',
  }), [song]); // eslint-disable-line react-hooks/exhaustive-deps
  const sections = useMemo(() => sectionsOf(info), [info]);
  // The parts, labelled on the score where each one begins (a repeat is labelled with the part it repeats).
  const labels = useMemo(() => info.course!.parts.map(p => ({ bar: p.from, label: p.sameAs ? `Part ${p.sameAs}` : `Part ${p.n}` })), [info.course]);
  // The section he should open next: the first one not learnt yet.
  const nextSection = sections.find(s => !s.learnt);
  const [lo, hi] = useMemo(() => pickRange(song.range[0], song.range[1], 36), [song]);

  useEffect(() => { setMicRange(song.range[0], song.range[1]); }, [song]);
  useEffect(() => { loadPiano().catch(() => {}); }, []);
  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __engine: Engine }).__engine = engine; }, [engine]);

  useEffect(() => {
    // Playing the song also teaches the app about his skills.
    let skills = listenForSkills(engine);
    const off = engine.on(e => {
      if (e.type === 'state') bump();
      if (e.type === 'end') {
        skills.stop();
        skills = listenForSkills(engine);
        if (engine.opts.listen) { engine.restart(); setMode('play'); bump(); return; }
        const s = engine.stats();
        recordRun(song.entry.id, s.accuracy, engine.opts.follow ? 1 : engine.opts.speed);
        // Playing a song through earns XP by how well it went, and counts for the streak.
        if (s.accuracy >= 0.5) addPractice(0, 1, Math.round(s.accuracy * 20));
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
    if (follow && !engine.finished) engine.play(0);
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

  const restart = () => { setResult(null); engine.restart(); if (engine.opts.follow) engine.play(0); bump(); };
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
  const position = Math.max(0, engine.time - song.firstNoteTime);
  const twoHands = song.hands.length === 2;

  return (
    <div className={`song-screen ${barOpen ? '' : 'bar-closed'}`}>
      {!barOpen && (
        <button className="bar-handle" onClick={toggleBar} aria-label="Show the tool bar" aria-expanded={false}><IconChevronDown size={18} /></button>
      )}
      {barOpen && <header className="sheet-bar">
        <button className="icon-btn ghost" onClick={onExit} aria-label="Back to the songs"><IconBack /></button>
        <div className="sheet-modes" role="toolbar" aria-label="Song modes">
          {twoHands && (
            <div className="hands" role="radiogroup" aria-label="Hands">
              {(['L', 'both', 'R'] as HandsChoice[]).map(h => (
                <button key={h} role="radio" aria-checked={hands === h} className={hands === h ? 'on' : ''} onClick={() => setHands(h)}
                  aria-label={h === 'both' ? 'Both hands' : h === 'L' ? 'Left hand' : 'Right hand'}>
                  {h === 'L' ? <IconHand size={18} className="mirror" /> : h === 'R' ? <IconHand size={18} /> : <><IconHand size={16} className="mirror" /><IconHand size={16} /></>}
                </button>
              ))}
            </div>
          )}
          <button className={`mode ${mode === 'listen' ? 'on' : ''}`} onClick={() => { setTeach(false); setMode(m => (m === 'listen' ? 'play' : 'listen')); }} aria-pressed={mode === 'listen'}>
            {mode === 'listen' ? <IconStop size={18} /> : <IconSpeaker size={18} />}{mode === 'listen' ? 'Stop' : 'Listen'}
          </button>
          <button className={`mode ${mode === 'play' && !teach ? 'on' : ''}`} onClick={() => { setTeach(false); setMode('play'); }} aria-pressed={mode === 'play' && !teach}>
            <IconNotes size={18} />Play
          </button>
          <button className={`mode ${teach ? 'on' : ''}`} onClick={() => setTeach(t => !t)} aria-pressed={teach}>
            <IconCap size={18} />Teach me
          </button>
          <span className="bar-sep" aria-hidden="true" />
          <div className="seg small scroll-mode" role="radiogroup" aria-label="How the music moves">
            <button role="radio" aria-checked={scroll === 'magic'} className={scroll === 'magic' ? 'on' : ''} onClick={() => setScroll('magic')}><IconMagic size={16} /><span>Waits for you</span></button>
            <button role="radio" aria-checked={scroll === 'auto'} className={scroll === 'auto' ? 'on' : ''} onClick={() => setScroll('auto')}><IconAutoScroll size={16} /><span>In tempo</span></button>
          </div>
          <button className={`chip ${feedback ? 'on' : ''}`} onClick={() => setFeedback(f => !f)} aria-pressed={feedback}><i className="dot" /><span>Feedback</span></button>
        </div>
        <p className="sheet-meta" aria-live="off">
          Notes: <b>{stats.hit}</b> / {stats.total}<span>{formatTime(position)}</span>
        </p>
        {!inputOn && <button className="connect" onClick={onSettings}><i />Connect<span>&nbsp;piano</span></button>}
        <button className="icon-btn ghost" onClick={toggleBar} aria-label="Hide the tool bar" aria-expanded><IconChevronUp size={18} /></button>
      </header>}

      {teach && barOpen && (
        <nav className="sections" aria-label="Sections to learn">
          {sections.map(s => (
            <button key={s.id} className={`section ${s.learnt ? 'learnt' : ''} ${s === nextSection ? 'next' : ''}`} onClick={() => onTeach(s)}>
              <span className="section-icon">{s.learnt ? <IconCheck size={18} /> : <IconCap size={20} />}</span>
              <span className="section-text">
                <b>{s.title}</b>
                <small>{s.bars} · {s.done}/{s.steps.length} steps</small>
              </span>
            </button>
          ))}
        </nav>
      )}

      <main className="sheet">
        <div className="sheet-card">
          <ScoreView engine={engine} fingers={settings.fingers} feedback={feedback} follow title={song.entry.title} composer={byLine(song.entry) || undefined} sections={labels} onSeek={seek} />

          <div className="sheet-float left">
            {!result && tempoMode && (
              <>
                <button className="btn go" onClick={startTempo}>{engine.playing ? <><IconStop size={16} />Stop</> : <><IconPlay size={16} />{engine.started ? 'Go on' : 'Start'}</>}</button>
                <div className="seg small" role="radiogroup" aria-label="Speed">
                  {SPEEDS.map(v => <button key={v} role="radio" aria-checked={speed === v} className={speed === v ? 'on' : ''} onClick={() => setSpeed(v)}>{formatSpeed(v)}</button>)}
                </div>
              </>
            )}
          </div>
          <div className="sheet-float right">
            {mode === 'play' && !atStart && <button className="float-btn" onClick={restart} aria-label="From the start"><IconRestart size={18} /><span>Restart</span></button>}
            <button className={`float-btn ${loop ? 'on' : ''}`} onClick={toggleLoop} aria-pressed={!!loop} aria-label={loop ? `Looping part ${loop.n}, tap to stop` : 'Loop this part'}><IconLoop size={18} /><span>{loop ? `Looping Part ${loop.n}` : 'Loop'}</span></button>
            <button className="float-btn" onClick={() => setKeysHidden(h => !h)} aria-pressed={keysHidden} aria-label={keysHidden ? 'Show the keyboard' : 'Hide the keyboard'}><IconKeys size={18} /><span>{keysHidden ? 'Show keys' : 'Hide keys'}</span></button>
          </div>

          {result && (
            <div className="sheet-result card" role="dialog" aria-labelledby="sheet-result-title">
              <h2 id="sheet-result-title">{result.accuracy >= 0.95 ? 'Beautifully played' : result.accuracy >= 0.7 ? 'You played it through' : 'Keep at it'}</h2>
              <p className="result-line">{result.hit} of {result.total} notes · {result.wrong} wrong · {Math.round(result.accuracy * 100)}%</p>
              <div className="actions">
                <button className="btn go" onClick={restart}><IconRestart size={16} />Play again</button>
                <button className="btn" onClick={() => { setResult(null); setTeach(true); }}><IconCap size={16} />Teach me</button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* While he picks a section the keyboard steps aside, so the score stays readable. */}
      {!keysHidden && !teach && (
        <footer className="sheet-keys">
          <Keyboard engine={engine} lo={lo} hi={hi} naming={settings.naming} fingers={settings.fingers} />
        </footer>
      )}
    </div>
  );
}
