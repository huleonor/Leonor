import { motion } from 'motion/react';
import { L } from '../lib/lang';
import { useEffect, useMemo, useState } from 'react';
import type { SongInfo } from '../lib/catalog';
import { meterOf, pctOf } from '../lib/mastery';
import { clipsOf, onSeen, reelsOf, seenReels, type Reel } from '../lib/reels';
import { askStrategy } from '../lib/strategy';
import { hiddenSongs } from '../lib/library';
import { HomeStaff, Ruling } from './SongCover';
import type { Song, SongEntry } from '../lib/types';
import { IconCheck, IconImport, IconKeysFill, IconPlay, IconSpeaker, IconStop } from './Icons';
import { SPRING } from './Motion';
import { listenBars, listening, onListening, stopListening } from '../lib/listen';
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
  return { id: reel.id, title: reel.words.title === reel.section ? reel.section : `${reel.section}: ${reel.words.title}`, bars: L(`Bars ${reel.from}-${reel.to}`, `Compassos ${reel.from}-${reel.to}`), from: reel.from, steps, done, learnt: done === steps.length };
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
  /** The video he was on, to pick up again (ContinueCard), in place of the Watch button. */
  resume?: React.ReactNode;
  /** Hear a section played through with the hands (a video); without it, the piano alone. */
  onHear?: (r: Reel) => void;
  /** The whole song played through with the hands and the falling notes, at a speed he picks. */
  onHearSong?: () => void;
}

/**
 * Song: the song being learnt, phase by phase. Every phase is one video that explains its patterns
 * and tricks, and its practice; the next thing to do is lit.
 */
export function Journey({ songId: id, onChoose, infos, entries, ready, onWatch, onPractice, onWholeSong, onBringMidi, onSongs, resume, onHear, onHearSong }: Props) {
  useBump(onSeen);
  const entry = entries.find(e => e.id === id || e.slot === id);
  const info = entry ? infos[entry.id] : undefined;
  const song = info?.song;
  useEffect(() => { if (song) askStrategy(song); }, [song]);

  const reels = useMemo(() => (song ? reelsOf(song) : []), [song, infos]); // eslint-disable-line react-hooks/exhaustive-deps
  const seen = song ? seenReels(song.entry.id) : [];
  const others = entries.filter(e => !e.missing && !hiddenSongs().includes(e.id) && e.id !== entry?.id && infos[e.id]?.song).slice(0, 6);

  // Shown as soon as its own song is read (the catalog reads it first), not after the whole library.
  if (!ready && !info) return <div className="page journey" aria-busy="true"><Ruling text={L('Reading the song...', 'A ler a música...')} /></div>;

  if (!entry || entry.missing || !song || !info) {
    const slot = entry ?? entries.find(e => e.id === FIRST_SONG);
    return (
      <div className="page journey">
        {slot && (
          <section className="journey-hero waiting on-field">
            <p className="sub">{L('Your first song', 'A tua primeira música')}</p>
            <h1>{slot.title}</h1>
            <p className="journey-by">{slot.composer}</p>
            <p className="sub">{L("The videos and the lessons are made from the song's own notes. Add a MIDI file of it and they are ready in a second.", 'Os vídeos e as lições são feitos das notas da própria música. Junta um ficheiro MIDI dela e ficam prontos num segundo.')}</p>
            <div className="journey-actions"><button className="btn go big" onClick={() => onBringMidi(slot)}><IconImport size={18} />{L('Add the MIDI file', 'Juntar o ficheiro MIDI')}</button></div>
            {info?.error && <p className="error-line">{L('That file could not be read. Try another MIDI file.', 'Não foi possível ler esse ficheiro. Experimenta outro ficheiro MIDI.')}</p>}
          </section>
        )}
        {others.length > 0 && (
          <section className="journey-others" aria-labelledby="others-title">
            <h2 id="others-title">{L('Or start with one of these', 'Ou começa com uma destas')}</h2>
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
    const clips = clipsOf(song).filter(c => c.phase.id === r.id && c.kind !== 'read');
    return { r, i, watched: seen.includes(r.id), section, stars, practised: !!section?.learnt, of: clips.length, seenN: clips.filter(c => seen.includes(c.id)).length };
  });
  // The next thing to do: the first phase not watched, or watched but not practised.
  // The next thing to do: the first section not watched through (its practice is in the feed).
  const next = rows.find(x => !x.watched);
  const pct = pctOf(meterOf(song).value);
  const bars = reels.length ? reels[reels.length - 1].to : 0;
  const totalBars = Math.max(1, bars);
  // One short line of where he is in a section: a professional list says it in a few words.
  const status = (x: (typeof rows)[number]) => {
    if (x.watched) return L('Learnt', 'Aprendida');
    if (next === x) return L(`Next, ${x.of} videos`, `A seguir, ${x.of} vídeos`);
    if (x.watched) return L('Watched', 'Vista');
    if (x.seenN) return L(`${x.seenN} of ${x.of} videos`, `${x.seenN} de ${x.of} vídeos`);
    return L(`${x.of} videos`, `${x.of} vídeos`);
  };
  return (
    <div className="page journey">
      <header className="song-head">
        <div className="song-top">
          <span className="song-kicker">{greeting()} {L('Learning now:', 'A aprender:')}</span>
          <button className="btn quiet" onClick={onSongs}>{L('Change song', 'Mudar de música')}</button>
        </div>
        <h1>{entry.title}</h1>
        <p className="song-meta">{[entry.composer, reels.length ? L(`${reels.length} sections, ${bars} bars`, `${reels.length} secções, ${bars} compassos`) : ''].filter(Boolean).join(', ')}</p>
        <HomeStaff key={song.entry.id} song={song} done={rows.filter(x => x.watched).reduce((s, x) => s + (x.r.to - x.r.from + 1), 0) / totalBars} />
      </header>

      {/* His progress through the song: one segment per section, as long as its bars, filled by what
          he has watched (ink) and learnt (teal), the next one edged in pink. Every number is his. */}
      <section className="song-progress" aria-label={L(`${pct}% of the song learnt`, `${pct}% da música aprendida`)}>
        <div className="song-progress-top">
          <motion.span className="num" key={pct} initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={SPRING}>{pct}%</motion.span>
          <span>{next ? L(`Next: ${next.r.section}`, `A seguir: ${next.r.section}`) : L('Every section learnt', 'Todas as secções aprendidas')}</span>
        </div>
        <ol className="song-bar" aria-hidden="true">
          {rows.map(x => {
            const learnt = x.watched;
            const fill = learnt ? 1 : x.of ? x.seenN / x.of : 0;
            return <li key={x.r.id} className={`${learnt ? 'learnt' : ''} ${next === x ? 'next' : ''}`} style={{ flexGrow: (x.r.to - x.r.from + 1) / totalBars }}><i style={{ width: `${Math.round(fill * 100)}%` }} /></li>;
          })}
        </ol>
      </section>

      {resume}
      {!resume && (
        next ? (
          <button className="btn go big" onClick={() => (!next.watched ? onWatch(song.entry.id, next.i) : onPractice(song.entry.id, next.r))}>
            {!next.watched ? <IconPlay size={18} /> : <IconKeysFill size={18} />}{!next.watched ? L(`Watch ${next.r.section}`, `Ver ${next.r.section}`) : L(`Practise ${next.r.section}`, `Praticar ${next.r.section}`)}
          </button>
        ) : (
          <button className="btn go big" onClick={() => onWholeSong(info)}><IconKeysFill size={18} />{L('Play the whole song', 'Tocar a música toda')}</button>
        )
      )}

      <h2 className="song-sections-title">{L('Sections', 'Secções')}</h2>
      <SectionList
        song={song} onHear={onHear} onHearSong={onHearSong}
        nodes={[
          ...rows.map(x => ({
            key: x.r.id, n: String(x.r.n), title: x.r.section, about: x.r.words.title === x.r.section ? '' : x.r.words.title, line: status(x),
            state: next === x ? 'next' as const : x.watched ? 'done' as const : 'ahead' as const,
            onWatch: () => onWatch(song.entry.id, x.i), onPractice: x.section ? () => onPractice(song.entry.id, x.r) : undefined, reel: x.r,
          })),
          { key: 'whole', n: String(bars), title: L('Full song', 'Música toda'), about: '', line: L(`All ${bars} bars, with the beat`, `Os ${bars} compassos, com o ritmo`), state: 'finale' as const, onPractice: () => onWholeSong(info) },
        ]}
      />
    </div>
  );
}

/** A word for the time of day, as the page greets him. */
function greeting() {
  const h = new Date().getHours();
  return h < 5 ? L('Late night.', 'Noite dentro.') : h < 12 ? L('Good morning.', 'Bom dia.') : h < 20 ? L('Good afternoon.', 'Boa tarde.') : L('Good evening.', 'Boa noite.');
}

interface PathNode {
  key: string; n: string; title: string; about: string; line: string;
  state: 'done' | 'next' | 'ahead' | 'finale';
  onWatch?: () => void; onPractice?: () => void;
  /** The section, to hear it. */
  reel?: Reel;
}

/**
 * The song's sections as one index card (the 2026-11 audit, then the user's "more professional"):
 * a row per section in the order of the song, dashed rules between them: its number (a tick once
 * learnt), its name in the song's form and what it is, where he is in it; tapping the row opens its
 * videos; at the right, Hear (the section played through with the hands) and Practise (its
 * lessons) as square icon buttons. The next row is pink; Full song closes the card in ink.
 */
function SectionList({ song, nodes, onHear, onHearSong }: { song: Song; nodes: PathNode[]; onHear?: (r: Reel) => void; onHearSong?: () => void }) {
  const [, bump] = useState(0);
  useEffect(() => onListening(() => bump(x => x + 1)), []);
  useEffect(() => () => stopListening(), []);
  const now = listening();
  return (
    <ol className="section-card" aria-label={L('Sections of the song', 'Secções da música')}>
      {nodes.map(x => {
        const r = x.reel, on = !!r && now === `${song.entry.id}:${r.from}-${r.to}`;
        const go = x.onWatch ?? x.onPractice;
        return (
          <li key={x.key} className={`sec-row ${x.state}`}>
            <button className="sec-main" onClick={() => { stopListening(); go?.(); }}
              aria-label={`${x.title}. ${x.about ? `${x.about}. ` : ''}${x.line}. ${x.onWatch ? L('Watch the videos', 'Ver os vídeos') : L('Play the whole song', 'Tocar a música toda')}`}>
              <span className="sec-num" aria-hidden="true">{x.state === 'done' ? <IconCheck size={18} /> : x.state === 'finale' ? <IconKeysFill size={18} /> : x.n}</span>
              <span className="sec-words"><b>{x.title}</b>{x.about && <em>{x.about}</em>}<small>{x.line}</small></span>
            </button>
            {r && (
              <span className="sec-acts">
                <button className="sec-act" onClick={() => (onHear ? onHear(r) : on ? stopListening() : listenBars(song, r.from, r.to))} aria-pressed={onHear ? undefined : on}
                  aria-label={L(`Hear ${x.title}`, `Ouvir ${x.title}`)}>{on ? <IconStop size={18} /> : <IconSpeaker size={20} />}</button>
              </span>
            )}
            {x.state === 'finale' && onHearSong && (
              <span className="sec-acts">
                <button className="sec-act" onClick={() => { stopListening(); onHearSong(); }}
                  aria-label={L('Watch the full song played, with the hands and the falling notes', 'Ver a música toda tocada, com as mãos e as notas a cair')}><IconPlay size={20} /></button>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
