import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import type { SongInfo } from '../lib/catalog';
import { meterOf, pctOf } from '../lib/mastery';
import { clipsOf, onSeen, reelsOf, seenReels, type Reel } from '../lib/reels';
import { askStrategy } from '../lib/strategy';
import type { SongEntry } from '../lib/types';
import { IconImport, IconKeysFill, IconPlay, IconStar } from './Icons';
import { SOFT, SPRING } from './Motion';
import { type Section } from './SongScreen';

const CURRENT = 'hugos-piano:current-song';
export const FIRST_SONG = 'interstellar-experience';

/** The song being learnt now: one song at a time, Interstellar Experience first. */
export function currentSongId(): string {
  try { return localStorage.getItem(CURRENT) ?? FIRST_SONG; } catch { return FIRST_SONG; }
}
export function setCurrentSong(id: string) {
  try { localStorage.setItem(CURRENT, id); } catch { /* storage blocked: stays for this visit */ }
}

/**
 * The practice for a phase: the steps of every course part inside it (hand by hand, together, with
 * the beat), the normal lessons, so he plays right away what the video just explained.
 */
export function practiceFor(info: SongInfo, reel: Reel): Section | undefined {
  const course = info.course;
  if (!course) return undefined;
  const parts = course.parts.filter(p => p.to >= reel.from && p.from <= reel.to);
  // A part that repeats an earlier one has no steps of its own: practise the one it repeats.
  const ids = [...new Set(parts.map(p => p.sameAs ?? p.n))];
  const steps = course.steps.filter(s => s.part !== undefined && ids.includes(s.part));
  if (!steps.length) return undefined;
  const done = steps.filter(s => (info.prog[s.id]?.stars ?? 0) > 0).length;
  return { id: reel.id, title: `Phase ${reel.n}: ${reel.words.title}`, bars: `Bars ${reel.from}-${reel.to}`, from: reel.from, steps, done, learnt: done === steps.length };
}

function useBump(sub: (fn: () => void) => () => void) {
  const [, set] = useState(0);
  useEffect(() => sub(() => set(x => x + 1)), [sub]);
}

interface Props {
  /** The song being learnt now. */
  songId: string;
  onChoose: (id: string) => void;
  infos: Record<string, SongInfo>;
  entries: SongEntry[];
  ready: boolean;
  onWatch: (songId: string, index: number) => void;
  onPractice: (songId: string, reel: Reel) => void;
  onWholeSong: (info: SongInfo) => void;
  onBringMidi: (slot: SongEntry) => void;
  onSongs: () => void;
}

/**
 * Song: the song being learnt, phase by phase. Every phase is one video that explains its patterns
 * and tricks, and its practice; the next thing to do is lit.
 */
export function Journey({ songId: id, onChoose, infos, entries, ready, onWatch, onPractice, onWholeSong, onBringMidi, onSongs }: Props) {
  useBump(onSeen);
  const entry = entries.find(e => e.id === id || e.slot === id);
  const info = entry ? infos[entry.id] : undefined;
  const song = info?.song;
  useEffect(() => { if (song) askStrategy(song); }, [song]);

  const reels = useMemo(() => (song ? reelsOf(song) : []), [song, infos]); // eslint-disable-line react-hooks/exhaustive-deps
  const seen = song ? seenReels(song.entry.id) : [];
  const others = entries.filter(e => !e.missing && e.id !== entry?.id && infos[e.id]?.song).slice(0, 6);

  if (!ready) return <div className="page journey" aria-busy="true"><span className="journey-hero skeleton" /></div>;

  if (!entry || entry.missing || !song || !info) {
    const slot = entry ?? entries.find(e => e.id === FIRST_SONG);
    return (
      <div className="page journey">
        {slot && (
          <section className="journey-hero waiting on-field">
            <p className="sub">Your first song</p>
            <h1>{slot.title}</h1>
            <p className="journey-by">{slot.composer}</p>
            <p className="sub">The videos and the lessons are made from the song's own notes. Add a MIDI file of it and they are ready in a second.</p>
            <div className="journey-actions"><button className="btn go big" onClick={() => onBringMidi(slot)}><IconImport size={18} />Add the MIDI file</button></div>
            {info?.error && <p className="error-line">That file could not be read. Try another MIDI file.</p>}
          </section>
        )}
        {others.length > 0 && (
          <section className="journey-others" aria-labelledby="others-title">
            <h2 id="others-title">Or start with one of these</h2>
            <ul>
              {others.map(e => (
                <li key={e.id}><button className="other-song" onClick={() => onChoose(e.id)}><b>{e.title}</b><small>{e.composer}</small></button></li>
              ))}
            </ul>
          </section>
        )}
      </div>
    );
  }

  const rows = reels.map((r, i) => {
    const section = practiceFor(info, r);
    const stars = section?.steps.length ? Math.min(...section.steps.map(s => info.prog[s.id]?.stars ?? 0)) : 0;
    const clips = clipsOf(song).filter(c => c.phase.id === r.id);
    return { r, i, watched: seen.includes(r.id), section, stars, practised: !!section?.learnt, of: clips.length, seenN: clips.filter(c => seen.includes(c.id)).length };
  });
  // The next thing to do: the first phase not watched, or watched but not practised.
  const next = rows.find(x => !x.watched || (x.section && !x.practised));
  const pct = pctOf(meterOf(song).value);
  const bars = reels.length ? reels[reels.length - 1].to : 0;
  const status = (x: (typeof rows)[number]) => {
    const where = `bars ${x.r.from}-${x.r.to}`;
    if (next === x) return !x.watched ? `Next: video ${Math.min(x.of, x.seenN + 1)} of ${x.of}, ${where}` : `Next: practise it, ${where}`;
    if (x.watched && (x.practised || !x.section)) return `Learnt, ${where}`;
    if (x.watched) return `Watched, ${where}`;
    if (x.seenN) return `${x.seenN} of ${x.of} videos watched, ${where}`;
    return `${x.of} videos, ${where}`;
  };

  return (
    <div className="page journey">
      <section className="journey-hero">
        <h1>{entry.title}</h1>
        <p className="journey-by">{[entry.composer, reels.length ? `${reels.length} phases, ${bars} bars` : ''].filter(Boolean).join('. ')}</p>
        <p className="num-line" aria-label={`${pct}% of the song learnt`}>
          <motion.span className="num" key={pct} initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={SPRING}>{pct}</motion.span>
          <span>percent learnt{next ? `, phase ${next.r.n} next` : ''}</span>
        </p>
        <div className="journey-actions">
          {next ? (
            <button className="btn go big" onClick={() => (!next.watched ? onWatch(song.entry.id, next.i) : onPractice(song.entry.id, next.r))}>
              {!next.watched ? <IconPlay size={18} /> : <IconKeysFill size={18} />}{!next.watched ? `Watch phase ${next.r.n}` : `Practise phase ${next.r.n}`}
            </button>
          ) : (
            <button className="btn go big" onClick={() => onWholeSong(info)}><IconKeysFill size={18} />Play the whole song</button>
          )}
          <button className="btn quiet" onClick={onSongs}>Change song</button>
        </div>
      </section>

      <ol className="phase-list">
        {rows.map(x => {
          const { r, i, watched, section, stars, practised } = x;
          return (
            <motion.li key={r.id} className={`phase-row ${next === x ? 'next' : ''} ${watched && (practised || !section) ? 'done' : ''}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ ...SOFT, delay: i * 0.03 }}>
              <button className="phase-open" onClick={() => onWatch(song.entry.id, i)} aria-label={`Watch phase ${r.n}: ${r.words.title}`}>
                <span className="num" aria-hidden="true">{r.n}</span>
                <span className="phase-text"><b>{r.words.title}</b><small>{status(x)}</small></span>
              </button>
              {section && (
                <button className="phase-practise" onClick={() => onPractice(song.entry.id, r)} aria-label={`Practise phase ${r.n}, ${stars} of 3 stars`}>
                  Practise
                  <span className="tile-stars" aria-hidden="true">{[1, 2, 3].map(k => <IconStar key={k} size={11} className={k <= stars ? 'on' : ''} />)}</span>
                </button>
              )}
            </motion.li>
          );
        })}
        <li className="phase-row finale">
          <button className="phase-open" onClick={() => onWholeSong(info)}>
            <span className="num" aria-hidden="true">{bars}</span>
            <span className="phase-text"><b>The whole song</b><small>All {bars} bars, start to finish, with the beat</small></span>
          </button>
          <button className="phase-practise" onClick={() => onWholeSong(info)} aria-label="Play the whole song"><IconKeysFill size={20} />Play</button>
        </li>
      </ol>
    </div>
  );
}
