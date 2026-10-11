import { useEffect, useMemo, useReducer, useState } from 'react';
import { loadPiano, unlockAudio } from '../lib/audio';
import type { SongInfo } from '../lib/catalog';
import { partLearnt, type CourseStep } from '../lib/course';
import { Engine } from '../lib/engine';
import { onNote, setMicRange, type LinkState, type Source } from '../lib/input';
import { pickRange } from '../lib/keys';
import { recordRun } from '../lib/library';
import { formatSpeed } from '../lib/names';
import { usePracticeClock } from '../lib/practiceClock';
import type { Settings } from '../lib/types';
import {
  IconAutoScroll, IconCap, IconCheck, IconChevronDown, IconChevronUp, IconExit, IconFeedback, IconMagic, IconNotes,
  IconKeys, IconPlay, IconRestart, IconSpeaker, IconStop,
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
  const [collapsed, setCollapsed] = useState(false);
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
  const [lo, hi] = useMemo(() => pickRange(song.range[0], song.range[1]), [song]);

  useEffect(() => { setMicRange(song.range[0], song.range[1]); }, [song]);
  useEffect(() => { loadPiano().catch(() => {}); }, []);
  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __engine: Engine }).__engine = engine; }, [engine]);

  useEffect(() => {
    const off = engine.on(e => {
      if (e.type === 'state') bump();
      if (e.type === 'end') {
        if (engine.opts.listen) { engine.restart(); setMode('play'); bump(); return; }
        const s = engine.stats();
        recordRun(song.entry.id, s.accuracy, engine.opts.follow ? 1 : engine.opts.speed);
        setResult(s);
      }
    });
    const offNote = onNote(e => engine.input(e));
    return () => { off(); offNote(); engine.destroy(); };
  }, [engine, song]);

  // Mode changes reconfigure the engine where the cursor is. Magic scroll waits at once for his
  // first note; tempo and listening start on a press.
  useEffect(() => {
    const listen = mode === 'listen';
    const follow = !listen && scroll === 'magic';
    engine.pause();
    engine.setOptions({ listen, follow, wait: false, speed: listen ? 1 : follow ? 1 : speed, lenient: settings.input === 'mic' });
    if (follow && !engine.finished) engine.play(0);
    if (listen) { unlockAudio(); engine.play(1); }
    bump();
  }, [engine, mode, scroll, speed, settings.input]);

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

  const tool = (on: boolean, label: string, icon: React.ReactNode, onClick: () => void, pressed?: boolean) => (
    <button className={`tool ${on ? 'on' : ''}`} onClick={onClick} aria-pressed={pressed}>{icon}<span>{label}</span></button>
  );

  return (
    <div className={`song-screen ${collapsed ? 'collapsed' : ''}`}>
      {collapsed ? (
        <button className="toolbar-handle" onClick={() => setCollapsed(false)} aria-label="Show the tool bar"><IconChevronDown size={20} /></button>
      ) : (
        <header className="toolbar" role="toolbar" aria-label="Song modes">
          <button className="tool collapse" onClick={() => setCollapsed(true)} aria-label="Hide the tool bar"><IconChevronUp size={22} /></button>
          {tool(mode === 'listen', mode === 'listen' ? 'Stop' : 'Listen', mode === 'listen' ? <IconStop size={24} /> : <IconSpeaker size={24} />, () => { setTeach(false); setMode(m => (m === 'listen' ? 'play' : 'listen')); }, mode === 'listen')}
          {tool(teach, 'Teach me', <IconCap size={24} />, () => setTeach(t => !t), teach)}
          {tool(mode === 'play' && !teach, 'Play', <IconNotes size={24} />, () => { setTeach(false); setMode('play'); })}
          <span className="tool-sep" aria-hidden="true" />
          {tool(feedback, 'Feedback', <IconFeedback size={24} />, () => setFeedback(f => !f), feedback)}
          {tool(scroll === 'magic', 'Magic scroll', <IconMagic size={24} />, () => setScroll('magic'), scroll === 'magic')}
          {tool(scroll === 'auto', 'Auto scroll', <IconAutoScroll size={24} />, () => setScroll('auto'), scroll === 'auto')}
          {!inputOn && tool(false, 'Connect', <span className="tool-alert"><IconKeys size={24} /></span>, onSettings)}
          {tool(false, 'Exit', <IconExit size={24} />, onExit)}
        </header>
      )}

      <div className="mini-keys" aria-hidden="true">
        <Keyboard engine={engine} lo={lo} hi={hi} naming={settings.naming} fingers="off" />
      </div>

      {teach && (
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
        <ScoreView engine={engine} fingers={settings.fingers} feedback={feedback} follow title={song.entry.title} composer={byLine(song.entry) || undefined} sections={labels} onSeek={seek} />

        {!result && tempoMode && (
          <div className="sheet-status" role="group" aria-label="Tempo">
            <button className="btn go" onClick={startTempo}>{engine.playing ? <><IconStop size={16} />Stop</> : <><IconPlay size={16} />{engine.started ? 'Go on' : 'Start'}</>}</button>
            <div className="seg small" role="radiogroup" aria-label="Speed">
              {SPEEDS.map(v => <button key={v} role="radio" aria-checked={speed === v} className={speed === v ? 'on' : ''} onClick={() => setSpeed(v)}>{formatSpeed(v)}</button>)}
            </div>
          </div>
        )}
        {!result && mode === 'play' && !tempoMode && !atStart && (
          <button className="sheet-restart" onClick={restart} aria-label="From the start"><IconRestart size={20} /></button>
        )}

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
      </main>
    </div>
  );
}
