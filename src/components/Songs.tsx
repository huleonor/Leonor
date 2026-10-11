import type { SongInfo } from '../lib/catalog';
import type { SongEntry } from '../lib/types';
import { IconMore, IconPlus, IconStar } from './Icons';
import { Difficulty, SheetThumb } from './SheetThumb';

type Shelf = 'film' | 'modern' | 'classical' | 'mine';
const SHELVES: [Shelf, string][] = [['mine', 'My songs'], ['film', 'Film scores'], ['modern', 'Modern piano'], ['classical', 'Classical']];
const shelfOf = (e: SongEntry): Shelf => (e.builtIn || e.slot ? e.collection ?? 'mine' : 'mine');

export const byLine = (e: SongEntry) => [e.composer, e.film && e.film !== e.title ? e.film : undefined].filter(Boolean).join(' · ');

/** A song as a sheet-music card: its first page, then who wrote it, what it is and how hard. */
export function SongCard({ info, onOpen, onEdit }: { info: SongInfo; onOpen: () => void; onEdit?: () => void }) {
  const e = info.entry;
  return (
    <div className="song-card">
      <button className="song-open" onClick={onOpen} aria-label={`Open ${e.title}`}>
        <span className="song-page"><SheetThumb song={info.song} title={e.title} composer={e.composer} /></span>
        <span className="song-text">
          <b>{e.composer ?? (e.builtIn ? '' : 'Imported')}</b>
          <span>{e.title}</span>
        </span>
        <span className="song-foot">
          <Difficulty level={info.level} />
          {info.stars > 0 && <span className="song-stars" aria-label={`${info.stars} of ${info.total} stars`}><IconStar size={12} />{info.stars}</span>}
        </span>
      </button>
      {onEdit && <button className="card-more" onClick={onEdit} aria-label={`Edit ${e.title}`}><IconMore size={20} /></button>}
    </div>
  );
}

interface Props {
  infos: Record<string, SongInfo>;
  entries: SongEntry[];
  ready: boolean;
  onOpen: (info: SongInfo) => void;
  onAdd: () => void;
  onEdit: (entry: SongEntry) => void;
}

export function Songs({ infos, entries, ready, onOpen, onAdd, onEdit }: Props) {
  const all = entries.map(e => infos[e.id]).filter(Boolean);
  const playable = all.filter(i => !i.entry.missing);
  const waiting = all.filter(i => i.entry.missing);

  return (
    <div className="page songs">
      <header className="page-head">
        <h1>Choose a song</h1>
        <button className="btn go" onClick={onAdd}><IconPlus size={16} />Upload MIDI</button>
      </header>
      {!ready && <p className="fine pad">Loading your songs…</p>}
      {ready && SHELVES.map(([shelf, title]) => {
        const list = playable.filter(i => shelfOf(i.entry) === shelf);
        if (shelf === 'mine' && !list.length) {
          return (
            <section key={shelf} className="shelf-block" aria-labelledby="shelf-mine">
              <h2 id="shelf-mine">{title}</h2>
              <button className="upload-slot" onClick={onAdd}>
                <IconPlus size={22} />
                <b>Upload a MIDI file</b>
                <small>It becomes sheet music you can play and learn, section by section.</small>
              </button>
            </section>
          );
        }
        if (!list.length) return null;
        return (
          <section key={shelf} className="shelf-block" aria-labelledby={`shelf-${shelf}`}>
            <h2 id={`shelf-${shelf}`}>{title}</h2>
            <div className="song-grid">
              {list.map(info => <SongCard key={info.entry.id} info={info} onOpen={() => onOpen(info)} onEdit={info.entry.builtIn ? undefined : () => onEdit(info.entry)} />)}
            </div>
          </section>
        );
      })}
      {ready && waiting.length > 0 && (
        <section className="shelf-block" aria-labelledby="shelf-waiting">
          <h2 id="shelf-waiting">Waiting for a MIDI file</h2>
          <ul className="waiting-list">
            {waiting.map(info => (
              <li key={info.entry.id}>
                <span><b>{info.entry.title}</b><small>{byLine(info.entry)}</small></span>
                <button className="btn quiet" onClick={() => onOpen(info)}><IconPlus size={16} />Add file</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
