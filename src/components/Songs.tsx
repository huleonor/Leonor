import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import type { SongInfo } from '../lib/catalog';
import { addToLibrary, myLibrary, onLibrary, removeFromLibrary } from '../lib/library';
import { keyName } from '../lib/analysis';
import { meterOf, pctOf } from '../lib/mastery';
import type { Song, SongEntry } from '../lib/types';
import { IconCheck, IconClose, IconImport, IconMore, IconPlus } from './Icons';
import { SOFT, SPRING } from './Motion';
import { OpeningStaff, SongCover } from './SongCover';

const COLLECTIONS: [NonNullable<SongEntry['collection']>, string][] = [['classical', 'Classical'], ['film', 'Film scores'], ['modern', 'Modern piano']];

export const byLine = (e: SongEntry) => [e.composer, e.film && e.film !== e.title ? e.film : undefined].filter(Boolean).join(' · ');

function useLibrary() {
  const [ids, setIds] = useState(myLibrary);
  useEffect(() => onLibrary(() => setIds(myLibrary())), []);
  return ids;
}

/** A small square cover, the same design for every song (SongCover.tsx). */
function Cover({ entry, song }: { entry: SongEntry; song?: Song }) {
  return <span className="cover"><SongCover entry={entry} song={song} /></span>;
}

/** Minutes and seconds, for how long a piece plays. */
const length = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

/** How far Mastery has come on a song, as a number (0 when not started). */
function pctFor(song?: Song) { return song ? pctOf(meterOf(song).value) : 0; }

/** The line under a song's title: who wrote it, and its length while it is not started. */
function lineFor(e: SongEntry, song?: Song) {
  const who = e.composer ?? (e.builtIn ? '' : 'Imported');
  if (song && meterOf(song).value <= 0) return [who, `${length(song.duration)}, not started`].filter(Boolean).join('. ');
  return who;
}

/** A song in my library, as a row: title and composer, and its percent set big on the right. */
function LibRow({ info, onOpen, onEdit }: { info: SongInfo; onOpen: () => void; onEdit?: () => void }) {
  const e = info.entry;
  const pct = pctFor(info.song);
  return (
    <motion.li className="lib-row" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={SOFT}>
      <button className="lib-open" onClick={onOpen} aria-label={`Learn ${e.title}, ${pct}% learnt`}>
        <span><b>{e.title}</b><small>{lineFor(e, info.song)}</small></span>
        <span className={`num ${pct ? '' : 'fresh'}`} aria-hidden="true">{pct}%</span>
      </button>
      {onEdit && <button className="icon-btn ghost" onClick={onEdit} aria-label={`Edit ${e.title}`}><IconMore size={20} /></button>}
    </motion.li>
  );
}

interface Props {
  infos: Record<string, SongInfo>;
  entries: SongEntry[];
  ready: boolean;
  /** The song being learnt now (its id or the slot it fills). */
  current?: string;
  onOpen: (info: SongInfo) => void;
  onAdd: (slot?: SongEntry) => void;
  onEdit: (entry: SongEntry) => void;
}

/** My songs: only the ones he brought into his library; the marketplace adds more. */
export function Songs({ infos, entries, ready, current, onOpen, onAdd, onEdit }: Props) {
  const lib = useLibrary();
  const [market, setMarket] = useState(false);
  const mine = entries.filter(e => !e.missing && (!e.builtIn || lib.includes(e.id) || (e.slot && lib.includes(e.slot)))).map(e => infos[e.id]).filter(Boolean);

  const now = mine.find(info => current === (info.entry.slot ?? info.entry.id));
  const rest = mine.filter(info => info !== now);

  return (
    <div className="page songs">
      <header className="page-head">
        <h1>Library</h1>
        <button className="btn" onClick={() => setMarket(true)}><IconPlus size={16} />Add songs</button>
      </header>
      {!ready && <div aria-busy="true">{Array.from({ length: 4 }, (_, i) => <span key={i} className="lib-skeleton" style={{ display: 'block' }} />)}</div>}
      {ready && !mine.length && (
        <section className="empty-library">
          <h2>Your library is empty</h2>
          <p className="sub">Pick songs from the marketplace, or upload a MIDI file of your own.</p>
          <div className="actions">
            <button className="btn go big" onClick={() => setMarket(true)}>Browse songs</button>
            <button className="btn" onClick={() => onAdd()}><IconImport size={16} />Upload MIDI</button>
          </div>
        </section>
      )}
      {ready && now && (
        <button className="lib-now" onClick={() => onOpen(now)} aria-label={`Learning now: ${now.entry.title}, ${pctFor(now.song)}% learnt`}>
          <OpeningStaff song={now.song} />
          <span className="lib-now-foot">
            <span><b>{now.entry.title}</b><small>Learning now. {now.entry.composer}</small></span>
            <span className="num" aria-hidden="true">{pctFor(now.song)}<i>%</i></span>
          </span>
        </button>
      )}
      {ready && mine.length > 0 && (
        <ul className="lib-list">
          <AnimatePresence>
            {rest.map(info => <LibRow key={info.entry.id} info={info} onOpen={() => onOpen(info)} onEdit={info.entry.builtIn ? undefined : () => onEdit(info.entry)} />)}
          </AnimatePresence>
          <li><button className="lib-add" onClick={() => setMarket(true)}><IconPlus size={18} />Add songs from the marketplace</button></li>
        </ul>
      )}
      <AnimatePresence>
        {market && <Marketplace entries={entries} infos={infos} lib={lib} onClose={() => setMarket(false)} onUpload={onAdd} />}
      </AnimatePresence>
    </div>
  );
}

/** What he gets: how long it plays and its key, or that it needs his own MIDI file. */
function facts(e: SongEntry, song?: Song) {
  if (!song) return e.missing ? 'Bring your own MIDI file' : '';
  return [length(song.duration), `${keyName(song).name}`, song.hands.length === 2 ? 'two hands' : 'one hand'].join(', ');
}

/** The marketplace: every song the app offers, to bring into the library with one tap. */
function Marketplace({ entries, infos, lib, onClose, onUpload }: { entries: SongEntry[]; infos: Record<string, SongInfo>; lib: string[]; onClose: () => void; onUpload: (slot?: SongEntry) => void }) {
  const built = entries.filter(e => e.builtIn || e.slot);
  return (
    <motion.div className="market" role="dialog" aria-modal="true" aria-labelledby="market-title" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={SOFT}>
      <header className="market-head">
        <button className="icon-btn ghost" onClick={onClose} aria-label="Close the marketplace"><IconClose size={24} /></button>
        <h1 id="market-title">Marketplace</h1>
        <button className="btn small" onClick={() => onUpload()}><IconImport size={16} />Upload MIDI</button>
      </header>
      <div className="market-body">
        {COLLECTIONS.map(([c, title]) => {
          const list = built.filter(e => (e.collection ?? 'film') === c && !e.slot);
          if (!list.length) return null;
          return (
            <section key={c} className="market-shelf" aria-labelledby={`market-${c}`}>
              <h2 id={`market-${c}`}>{title}</h2>
              <ul className="market-list">
                {list.map(e => {
                  const filled = entries.find(x => x.slot === e.id);
                  const have = lib.includes(e.id);
                  const needsFile = e.missing && !filled;
                  return (
                    <li key={e.id} className={have ? 'have' : ''}>
                      <Cover entry={e} song={(filled && infos[filled.id]?.song) || infos[e.id]?.song} />
                      <span className="song-text market-text">
                        <b>{e.title}</b>
                        <span>{[e.composer, e.film && e.film !== e.title ? e.film : undefined, e.year].filter(Boolean).join(', ')}</span>
                        {e.about && <span className="market-about">{e.about}</span>}
                        <span className="market-facts">{facts(e, (filled && infos[filled.id]?.song) || infos[e.id]?.song)}</span>
                      </span>
                      {needsFile ? (
                        <button className="btn small" onClick={() => { addToLibrary(e.id); onUpload(e); }}>Add MIDI</button>
                      ) : (
                        <motion.button className={`btn small ${have ? 'added' : 'go'}`} onClick={() => (have ? removeFromLibrary(e.id) : addToLibrary(e.id))}
                          aria-pressed={have} aria-label={have ? `Remove ${e.title} from my songs` : `Add ${e.title} to my songs`} whileTap={{ scale: 0.92 }} layout transition={SPRING}>
                          <AnimatePresence mode="wait" initial={false}>
                            <motion.span key={have ? 'in' : 'add'} className="add-label" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={SPRING}>
                              {have ? <><IconCheck size={16} />Added</> : <><IconPlus size={16} />Add</>}
                            </motion.span>
                          </AnimatePresence>
                        </motion.button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </motion.div>
  );
}
