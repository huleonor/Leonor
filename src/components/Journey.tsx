import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import type { SongInfo } from '../lib/catalog';
import { meterOf, pctOf } from '../lib/mastery';
import { onSeen, reelsOf, seenReels, type Reel } from '../lib/reels';
import { askStrategy } from '../lib/strategy';
import type { SongEntry } from '../lib/types';
import { IconCheck, IconImport, IconKeysFill, IconPlay, IconReel, IconStar } from './Icons';
import { SOFT, SPRING } from './Motion';
import { sectionsOf, type Section } from './SongScreen';
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

/** The practice that follows a reel: that part's steps for the same hand (both hands: together and with the beat). */
export function practiceFor(info: SongInfo, reel: Reel): Section | undefined {
  const sc = sectionsOf(info).find(s => s.id === reel.practice.section);
  if (!sc) return undefined;
  const hands = reel.kind === 'intro' ? null : reel.kind === 'both' || info.song!.hands.length === 1 ? 'both' : reel.kind;
  const steps = hands ? sc.steps.filter(s => (hands === 'both' ? s.hands === 'both' || info.song!.hands.length === 1 : s.hands === hands)) : sc.steps;
  if (!steps.length) return sc;
  const label = reel.kind === 'L' ? 'left hand' : reel.kind === 'R' ? 'right hand' : 'both hands';
  return { ...sc, id: `${sc.id}-${reel.kind}`, title: `${sc.title}, ${label}`, steps, done: steps.filter(s => (info.prog[s.id]?.stars ?? 0) > 0).length, learnt: steps.every(s => (info.prog[s.id]?.stars ?? 0) > 0) };
}

function useBump(sub: (fn: () => void) => () => void) {
  const [, set] = useState(0);
  useEffect(() => sub(() => set(x => x + 1)), [sub]);
}

interface Props {
  infos: Record<string, SongInfo>;
  entries: SongEntry[];
  ready: boolean;
  onWatch: (songId: string, index: number) => void;
  onPractice: (songId: string, reel: Reel) => void;
  onWholeSong: (info: SongInfo) => void;
  onBringMidi: (slot: SongEntry) => void;
  onSongs: () => void;
}

type Item = { kind: 'reel'; reel: Reel; i: number; done: boolean } | { kind: 'practice'; reel: Reel; section: Section; done: boolean; stars: number };

/**
 * Learn: one song at a time. Each part is a few short videos, one pattern each (the left hand, the
 * right hand, both), and after each video the practice that drills exactly that. The next thing to
 * do is lit; what is done carries a tick or its stars.
 */
export function Journey({ infos, entries, ready, onWatch, onPractice, onWholeSong, onBringMidi, onSongs }: Props) {
  const [id, setId] = useState(currentSongId);
  useBump(onSeen);
  const entry = entries.find(e => e.id === id || e.slot === id);
  const info = entry ? infos[entry.id] : undefined;
  const song = info?.song;
  useEffect(() => { if (song) askStrategy(song); }, [song]);
  const choose = (x: string) => { setId(x); setCurrentSong(x); };

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
                <li key={e.id}><button className="other-song" onClick={() => choose(e.id)}><span className="cover"><SongCover entry={e} song={infos[e.id]?.song} /></span><b>{e.title}</b><small>{e.composer}</small></button></li>
              ))}
            </ul>
          </section>
        )}
      </div>
    );
  }

  // The path through the song: per part, each reel then its practice.
  const parts: { n: number; bars: string; chords: string; items: Item[] }[] = [];
  reels.forEach((r, i) => {
    if (r.kind === 'intro') return;
    let p = parts.find(x => x.n === r.part);
    if (!p) {
      p = { n: r.part, bars: `Bars ${sectionsOf(info).find(s => s.id === r.practice.section)?.bars.replace('Bars ', '') ?? ''}`, chords: [...new Set(r.chords.map(c => c.name))].slice(0, 5).join('  '), items: [] };
      parts.push(p);
    }
    p.items.push({ kind: 'reel', reel: r, i, done: seen.includes(r.id) });
    const section = practiceFor(info, r);
    if (section) {
      const stars = section.steps.length ? Math.min(...section.steps.map(s => info.prog[s.id]?.stars ?? 0)) : 0;
      p.items.push({ kind: 'practice', reel: r, section, done: section.learnt, stars });
    }
  });
  const flat = parts.flatMap(p => p.items);
  const next = flat.find(x => !x.done);
  const intro = reels.findIndex(r => r.kind === 'intro');
  const pct = pctOf(meterOf(song).value);
  const allDone = !next;

  return (
    <div className="page journey">
      <section className="journey-hero">
        <span className="journey-cover"><SongCover entry={entry} song={song} /></span>
        <div className="journey-title">
          <small>Now learning</small>
          <h1>{entry.title}</h1>
          <p>{entry.composer}</p>
          <div className="journey-meter" aria-label={`Mastery ${pct}%`}><i><motion.b initial={{ width: 0 }} animate={{ width: `${Math.max(2, pct)}%` }} transition={SOFT} /></i><span>{pct}%</span></div>
          <div className="journey-actions">
            {intro >= 0 && <button className="btn go" onClick={() => onWatch(song.entry.id, seen.length && next?.kind === 'reel' ? next.i : intro)}><IconPlay size={16} />{seen.length ? 'Watch the next video' : 'Watch the intro'}</button>}
            <button className="btn" onClick={onSongs}>Change song</button>
          </div>
        </div>
      </section>

      <ol className="journey-parts">
        {parts.map((p, pi) => (
          <motion.li key={p.n} className="journey-part" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ...SOFT, delay: pi * 0.05 }}>
            <header>
              <h2>Part {p.n}</h2>
              <small>{p.bars}</small>
              {p.chords && <span className="part-chords" aria-label={`Bass: ${p.chords}`}>{p.chords}</span>}
            </header>
            <ol className="part-steps">
              {p.items.map(item => {
                const isNext = item === next;
                const locked = !isNext && !item.done && flat.indexOf(item) > flat.indexOf(next!);
                const hand = item.reel.kind === 'L' ? 'Left hand' : item.reel.kind === 'R' ? 'Right hand' : 'Both hands';
                return (
                  <li key={`${item.kind}-${item.reel.id}`} className={`part-step ${item.kind} hand-${item.reel.kind} ${item.done ? 'done' : ''} ${isNext ? 'next' : ''} ${locked ? 'later' : ''}`}>
                    {isNext && <motion.span className="start-bubble" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 1.6 }}>{item.kind === 'reel' ? 'WATCH' : 'PLAY'}</motion.span>}
                    <motion.button whileTap={{ scale: 0.95 }} transition={SPRING}
                      onClick={() => (item.kind === 'reel' ? onWatch(song.entry.id, item.i) : onPractice(song.entry.id, item.reel))}
                      aria-label={item.kind === 'reel' ? `Watch: ${item.reel.words.hook}` : `Practise ${hand.toLowerCase()}, part ${p.n}`}>
                      {item.kind === 'reel' ? (
                        <span className="step-tile reel-tile">
                          <IconReel size={30} />
                          <b>{hand}</b>
                          <small>{item.reel.words.hook}</small>
                          {item.done && <i className="tick"><IconCheck size={14} /></i>}
                        </span>
                      ) : (
                        <span className="step-tile practice-tile">
                          <IconKeysFill size={28} />
                          <b>Practise</b>
                          <small>{item.section.steps.length === 1 ? 'One step' : `${item.section.steps.length} steps`}</small>
                          <span className="tile-stars" aria-label={`${item.stars} of 3 stars`}>{[1, 2, 3].map(k => <IconStar key={k} size={13} className={k <= item.stars ? 'on' : ''} />)}</span>
                        </span>
                      )}
                    </motion.button>
                  </li>
                );
              })}
            </ol>
          </motion.li>
        ))}
        <li className={`journey-part finale ${allDone ? 'ready' : ''}`}>
          <header><h2>The whole song</h2><small>Start to finish, with the beat</small></header>
          <button className={`btn ${allDone ? 'go' : ''} big`} onClick={() => onWholeSong(info)}><IconKeysFill size={18} />Play the whole song</button>
        </li>
      </ol>
    </div>
  );
}
