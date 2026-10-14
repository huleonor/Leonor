import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import type { SongInfo } from '../lib/catalog';
import { addToLibrary, myLibrary, onLibrary, removeFromLibrary } from '../lib/library';
import type { SongEntry } from '../lib/types';
import { Spot } from './Brand';
import { IconCheck, IconClose, IconImport, IconMore, IconMusic, IconPlus, IconStar } from './Icons';
import { SOFT, SPRING } from './Motion';
import { SongCover } from './SongCover';

const COLLECTIONS: [NonNullable<SongEntry['collection']>, string][] = [['film', 'Film scores'], ['modern', 'Modern piano'], ['classical', 'Classical']];

export const byLine = (e: SongEntry) => [e.composer, e.film && e.film !== e.title ? e.film : undefined].filter(Boolean).join(' · ');

function useLibrary() {
  const [ids, setIds] = useState(myLibrary);
  useEffect(() => onLibrary(() => setIds(myLibrary())), []);
  return ids;
}

/** A small square cover, the same design for every song (SongCover.tsx). */
function Cover({ entry }: { entry: SongEntry }) {
  return <span className="cover"><SongCover entry={entry} /></span>;
}

/** A song in my library: cover, title, who wrote it, and stars once started. */
export function SongCard({ info, onOpen, onEdit }: { info: SongInfo; onOpen: () => void; onEdit?: () => void }) {
  const e = info.entry;
  return (
    <motion.div className="song-card" layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={SOFT}>
      <motion.button className="song-open" onClick={onOpen} aria-label={`Open ${e.title}`} whileTap={{ scale: 0.96 }}>
        <Cover entry={e} />
        <span className="song-text">
          <b>{e.title}</b>
          <span>{e.composer ?? (e.builtIn ? '' : 'Imported')}</span>
          {info.stars > 0 && <span className="song-stars" aria-label={`${info.stars} of ${info.total} stars`}><IconStar size={12} />{info.stars}/{info.total}</span>}
        </span>
      </motion.button>
      {onEdit && <button className="card-more" onClick={onEdit} aria-label={`Edit ${e.title}`}><IconMore size={20} /></button>}
    </motion.div>
  );
}

interface Props {
  infos: Record<string, SongInfo>;
  entries: SongEntry[];
  ready: boolean;
  onOpen: (info: SongInfo) => void;
  onAdd: (slot?: SongEntry) => void;
  onEdit: (entry: SongEntry) => void;
}

/** My songs: only the ones he brought into his library; the marketplace adds more. */
export function Songs({ infos, entries, ready, onOpen, onAdd, onEdit }: Props) {
  const lib = useLibrary();
  const [market, setMarket] = useState(false);
  const mine = entries.filter(e => !e.missing && (!e.builtIn || lib.includes(e.id) || (e.slot && lib.includes(e.slot)))).map(e => infos[e.id]).filter(Boolean);

  return (
    <div className="page songs">
      <header className="page-head">
        <h1>My songs</h1>
        <button className="btn go" onClick={() => setMarket(true)}><IconPlus size={16} />Add songs</button>
      </header>
      {!ready && <div className="song-grid" aria-busy="true">{Array.from({ length: 6 }, (_, i) => <span key={i} className="song-card skeleton" />)}</div>}
      {ready && !mine.length && (
        <section className="empty-library">
          <Spot size={96}><IconMusic size={44} /></Spot>
          <h2>Your library is empty</h2>
          <p className="sub">Pick songs from the marketplace, or upload a MIDI file of your own.</p>
          <div className="actions">
            <button className="btn go big" onClick={() => setMarket(true)}>Browse songs</button>
            <button className="btn" onClick={() => onAdd()}><IconImport size={16} />Upload MIDI</button>
          </div>
        </section>
      )}
      {ready && mine.length > 0 && (
        <motion.div className="song-grid" layout>
          <AnimatePresence>
            {mine.map(info => <SongCard key={info.entry.id} info={info} onOpen={() => onOpen(info)} onEdit={info.entry.builtIn ? undefined : () => onEdit(info.entry)} />)}
          </AnimatePresence>
          <motion.button layout className="song-card add-tile" onClick={() => setMarket(true)} whileTap={{ scale: 0.96 }}>
            <span className="cover add"><IconPlus size={28} /></span>
            <span className="song-text"><b>Add songs</b><span>From the marketplace</span></span>
          </motion.button>
        </motion.div>
      )}
      <AnimatePresence>
        {market && <Marketplace entries={entries} lib={lib} onClose={() => setMarket(false)} onUpload={onAdd} />}
      </AnimatePresence>
    </div>
  );
}

/** The marketplace: every song the app offers, to bring into the library with one tap. */
function Marketplace({ entries, lib, onClose, onUpload }: { entries: SongEntry[]; lib: string[]; onClose: () => void; onUpload: (slot?: SongEntry) => void }) {
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
                      <Cover entry={e} />
                      <span className="song-text"><b>{e.title}</b><span>{byLine(e)}</span></span>
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
