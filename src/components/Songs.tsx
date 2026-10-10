import { useEffect, useState } from 'react';
import type { SongInfo } from '../lib/catalog';
import { GENERIC_COVER } from '../lib/library';
import type { SongEntry } from '../lib/types';
import { IconMusic, IconPlus, IconStar } from './Icons';

type Shelf = 'all' | 'film' | 'modern' | 'classical' | 'mine';
const SHELVES: [Shelf, string][] = [['all', 'All'], ['film', 'Film'], ['modern', 'Modern'], ['classical', 'Classical'], ['mine', 'My songs']];
const shelfOf = (e: SongEntry): Shelf => (e.builtIn || e.slot ? e.collection ?? 'mine' : 'mine');

export const byLine = (e: SongEntry) => [e.composer, e.film && e.film !== e.title ? e.film : undefined].filter(Boolean).join(' · ');

/** The song's photo; offline or broken, a quiet tile with a note takes its place. */
export function Cover({ entry, className = '' }: { entry: SongEntry; className?: string }) {
  const img = entry.image ?? GENERIC_COVER;
  return (
    <span className={`cover ${className}`}>
      <IconMusic size={22} />
      <img src={img.src} alt="" loading="lazy" decoding="async" onError={e => { e.currentTarget.style.display = 'none'; }} />
    </span>
  );
}

export function SongCard({ info, onOpen }: { info: SongInfo; onOpen: () => void }) {
  const e = info.entry;
  const pct = info.total ? info.stars / info.total : 0;
  return (
    <button className={`song-card ${e.missing ? 'missing' : ''}`} onClick={onOpen}>
      <span className="song-cover">
        <Cover entry={e} />
        {info.level && <span className={`level l${info.level}`}>Level {info.level}</span>}
        {e.missing && <span className="add-file"><IconPlus size={18} />Add MIDI file</span>}
      </span>
      <span className="song-text">
        <b>{e.title}</b>
        <small>{byLine(e) || (e.builtIn ? '' : 'Imported')}</small>
      </span>
      {!e.missing && (
        <span className="song-meter" aria-label={`${info.stars} of ${info.total} stars`}>
          <span className="meter"><i style={{ width: `${pct * 100}%` }} /></span>
          <span className="meter-n"><IconStar size={12} />{info.stars}</span>
        </span>
      )}
    </button>
  );
}

interface Props {
  infos: Record<string, SongInfo>;
  entries: SongEntry[];
  ready: boolean;
  onOpen: (info: SongInfo) => void;
  onAdd: () => void;
}

export function Songs({ infos, entries, ready, onOpen, onAdd }: Props) {
  const [shelf, setShelf] = useState<Shelf>(() => {
    try { return (localStorage.getItem('hugos-piano:shelf2') as Shelf) || 'all'; } catch { return 'all'; }
  });
  useEffect(() => { try { localStorage.setItem('hugos-piano:shelf2', shelf); } catch { /* ignore */ } }, [shelf]);
  const list = entries.filter(e => shelf === 'all' || shelfOf(e) === shelf).map(e => infos[e.id]).filter(Boolean);

  return (
    <div className="page songs">
      <header className="page-head">
        <h1>Songs</h1>
        <div className="seg filters" role="tablist" aria-label="Collection">
          {SHELVES.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={shelf === id} className={shelf === id ? 'on' : ''} onClick={() => setShelf(id)}>{label}</button>
          ))}
        </div>
        <button className="btn go" onClick={onAdd}><IconPlus size={16} />Add song</button>
      </header>
      {!ready && <p className="fine pad">Loading your songs…</p>}
      {ready && list.length === 0 && (
        <div className="empty">
          <h2>No songs of your own yet</h2>
          <p>Add a MIDI file (.mid) and it becomes a course, part by part, like every other song here. Two tracks, one per hand, work best.</p>
          <button className="btn go big" onClick={onAdd}><IconPlus size={18} />Add a song</button>
        </div>
      )}
      <div className="song-grid">
        {list.map(info => <SongCard key={info.entry.id} info={info} onOpen={() => onOpen(info)} />)}
      </div>
    </div>
  );
}
