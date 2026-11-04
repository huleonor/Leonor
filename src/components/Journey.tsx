import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import type { SongInfo } from '../lib/catalog';
import { meterOf, pctOf } from '../lib/mastery';
import { onSeen, reelsOf, seenReels, type Reel } from '../lib/reels';
import { askStrategy } from '../lib/strategy';
import type { SongEntry } from '../lib/types';
import { IconCheck, IconImport, IconKeysFill, IconPlay, IconReel, IconStar } from './Icons';
import { SOFT, SPRING } from './Motion';
import { type Section } from './SongScreen';
import { SongCover } from './SongCover';

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
          <section className="journey-hero waiting">
            <span className="journey-cover"><SongCover entry={slot} /></span>
            <div className="journey-title">
              <small>Your first song</small>
              <h1>{slot.title}</h1>
              <p>{slot.composer}</p>
              <p className="sub">The videos and the lessons are made from the song's own notes. Add a MIDI file of it and they are ready in a second.</p>
              <button className="btn go big" onClick={() => onBringMidi(slot)}><IconImport size={18} />Add the MIDI file</button>
              {info?.error && <p className="error-line">That file could not be read. Try another MIDI file.</p>}
            </div>
          </section>
        )}
        {others.length > 0 && (
          <section className="journey-others" aria-labelledby="others-title">
            <h2 id="others-title">Or start with one of these</h2>
            <ul>
              {others.map(e => (
                <li key={e.id}><button className="other-song" onClick={() => onChoose(e.id)}><span className="cover"><SongCover entry={e} song={infos[e.id]?.song} /></span><b>{e.title}</b><small>{e.composer}</small></button></li>
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
    return { r, i, watched: seen.includes(r.id), section, stars, practised: !!section?.learnt };
  });
  // The next thing to do: the first phase not watched, or watched but not practised.
  const next = rows.find(x => !x.watched || (x.section && !x.practised));
  const pct = pctOf(meterOf(song).value);

  return (
    <div className="page journey">
      <section className="journey-hero">
        <span className="journey-cover"><SongCover entry={entry} song={song} /></span>
        <div className="journey-title">
          <small>Now learning</small>
          <h1>{entry.title}</h1>
          <p>{entry.composer}</p>
          <div className="journey-meter" aria-label={`${pct}% of the song`}><i><motion.b initial={{ width: 0 }} animate={{ width: `${Math.max(2, pct)}%` }} transition={SOFT} /></i></div>
          <p className="journey-meta"><span>{next ? `Phase ${next.r.n} of ${reels.length}` : 'Every phase done'}</span><span>{pct}%</span></p>
          <div className="journey-actions">
            {next ? (
              <button className="btn go big" onClick={() => (!next.watched ? onWatch(song.entry.id, next.i) : onPractice(song.entry.id, next.r))}>
                <IconPlay size={18} />{!next.watched ? `Watch phase ${next.r.n}` : `Practise phase ${next.r.n}`}
              </button>
            ) : (
              <button className="btn go big" onClick={() => onWholeSong(info)}><IconKeysFill size={18} />Play the whole song</button>
            )}
            <button className="btn" onClick={onSongs}>Change song</button>
          </div>
        </div>
      </section>

      <ol className="phase-list">
        {rows.map(({ r, i, watched, section, stars, practised }) => {
          const isNext = next?.r === r;
          return (
            <motion.li key={r.id} className={`phase-card ${isNext ? 'next' : ''} ${watched && practised ? 'done' : ''}`} initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ...SOFT, delay: i * 0.04 }}>
              <motion.button className="phase-video" whileTap={{ scale: 0.96 }} transition={SPRING} onClick={() => onWatch(song.entry.id, i)} aria-label={`Watch phase ${r.n}: ${r.words.title}`}>
                <IconReel size={30} />
                {watched && <i className="tick"><IconCheck size={14} /></i>}
              </motion.button>
              <div className="phase-text">
                <small>Phase {r.n}, bars {r.from}-{r.to}</small>
                <b>{r.words.title}</b>
                <span>{r.words.hook}</span>
              </div>
              {section && (
                <button className={`phase-practise ${practised ? 'done' : ''}`} onClick={() => onPractice(song.entry.id, r)} aria-label={`Practise phase ${r.n}, ${stars} of 3 stars`}>
                  <IconKeysFill size={20} />
                  <span className="tile-stars" aria-hidden="true">{[1, 2, 3].map(k => <IconStar key={k} size={11} className={k <= stars ? 'on' : ''} />)}</span>
                </button>
              )}
              {isNext && <motion.span className="step-bubble" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 1.6 }}>{watched ? 'PLAY' : 'WATCH'}</motion.span>}
            </motion.li>
          );
        })}
        <li className={`journey-part finale ${!next ? 'ready' : ''}`}>
          <header><h2>The whole song</h2><small>Start to finish, with the beat</small></header>
          <button className={`btn ${!next ? 'go' : ''} big`} onClick={() => onWholeSong(info)}><IconKeysFill size={18} />Play the whole song</button>
        </li>
      </ol>
    </div>
  );
}
