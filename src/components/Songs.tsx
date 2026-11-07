import { AnimatePresence, motion } from 'motion/react';
import { L } from '../lib/lang';
import { useEffect, useRef, useState } from 'react';
import type { SongInfo } from '../lib/catalog';
import { hiddenSongs, onLibrary, unhideSong } from '../lib/library';
import { FIRST_SONG } from './Journey';
import { keyName } from '../lib/analysis';
import { meterOf, pctOf } from '../lib/mastery';
import type { Song, SongEntry } from '../lib/types';
import { IconClose, IconImport, IconMore, IconPlus } from './Icons';
import { SOFT } from './Motion';
import { Ruling, SongCover } from './SongCover';
import { SongPreview } from './SongPreview';

const COLLECTIONS: [NonNullable<SongEntry['collection']>, () => string][] = [['classical', () => L('Classical', 'Clássica')], ['film', () => L('Film scores', 'Bandas sonoras')], ['modern', () => L('Modern piano', 'Piano moderno')]];

export const byLine = (e: SongEntry) => [e.composer, e.film && e.film !== e.title ? e.film : undefined].filter(Boolean).join(' · ');

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
  const who = e.composer ?? (e.builtIn ? '' : L('Imported', 'Importada'));
  // Two short lines that never wrap: who wrote it, then its length while it is not started.
  const second = song && meterOf(song).value <= 0 ? L(`${length(song.duration)}, not started`, `${length(song.duration)}, por começar`) : '';
  return <>{who && <i>{who}</i>}{second && <i>{second}</i>}</>;
}

/** How a card was touched last: a finger previews first, a mouse previews on hover. */
type Via = 'mouse' | 'touch';

/**
 * A song as an index card: its main part as notes falling onto keys (SongPreview), its title, who
 * wrote it and how far he has come. With a mouse the preview plays while the pointer rests on the
 * card and a click opens it; with a finger the first tap plays the preview and the second opens it.
 */
function SongCard({ info, big, previewing, onPreview, onOpen, onEdit }: {
  info: SongInfo; big?: boolean; previewing: boolean;
  onPreview: (on: boolean) => void; onOpen: () => void; onEdit?: () => void;
}) {
  const e = info.entry, song = info.song!;
  const pct = pctFor(song);
  const via = useRef<Via>('mouse');
  const hover = useRef(0);
  return (
    <motion.li className={`song-card ${big ? 'big' : ''} ${previewing ? 'playing' : ''}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={SOFT}>
      <button className="song-card-open"
        onPointerDown={ev => { via.current = ev.pointerType === 'mouse' ? 'mouse' : 'touch'; }}
        onPointerEnter={ev => { if (ev.pointerType !== 'mouse') return; window.clearTimeout(hover.current); hover.current = window.setTimeout(() => onPreview(true), 220); }}
        onPointerLeave={ev => { if (ev.pointerType !== 'mouse') return; window.clearTimeout(hover.current); onPreview(false); }}
        onClick={() => { if (via.current === 'touch' && !previewing) { onPreview(true); return; } window.clearTimeout(hover.current); onPreview(false); onOpen(); }}
        aria-label={L(`${big ? 'Learning now: ' : ''}${e.title}, ${pct}% learnt. Open it`, `${big ? 'A aprender: ' : ''}${e.title}, ${pct}% aprendida. Abrir`)}>
        <span className="song-card-stage"><SongPreview song={song} playing={previewing} onEnd={() => onPreview(false)} /></span>
        <span className="song-card-foot">
          <span>
            <b>{e.title}</b>
            <small>{previewing && via.current === 'touch' ? L('Tap again to learn it', 'Toca outra vez para aprender') : big ? [L('Learning now', 'A aprender'), e.composer].filter(Boolean).join('. ') : lineFor(e, song)}</small>
          </span>
          <span className={`num ${pct ? '' : 'fresh'}`} aria-hidden="true">{pct}<i>%</i></span>
        </span>
      </button>
      {onEdit && <button className="icon-btn ghost song-card-edit" onClick={onEdit} aria-label={L(`More for ${e.title}: edit or remove`, `Mais para ${e.title}: editar ou remover`)}><IconMore size={20} /></button>}
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

/**
 * My songs: every song the app has ready (the pieces it ships, a slot filled with his MIDI file, the
 * files he uploaded) is in the library by itself; "Add songs" brings in the pieces that need his file.
 */
export function Songs({ infos, entries, ready, current, onOpen, onAdd, onEdit }: Props) {
  const [market, setMarket] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [, bump] = useState(0);
  useEffect(() => onLibrary(() => bump(x => x + 1)), []);
  const hidden = hiddenSongs();
  const mine = entries.filter(e => !e.missing && !hidden.includes(e.id)).map(e => infos[e.id]).filter((i): i is SongInfo => !!i?.song);

  // Interstellar Experience is always in his library: until his MIDI file is in, a card asks for it
  // (the song is under copyright, so nothing of it ships with the app).
  const filled = mine.some(info => (info.entry.slot ?? info.entry.id) === FIRST_SONG || /interstellar/i.test(info.entry.title));
  const waiting = filled ? undefined : entries.find(e => e.id === FIRST_SONG || e.slot === FIRST_SONG);
  const now = mine.find(info => current === (info.entry.slot ?? info.entry.id));
  const rest = mine.filter(info => info !== now);
  const card = (info: SongInfo, big = false) => (
    <SongCard key={info.entry.id} info={info} big={big} previewing={preview === info.entry.id}
      onPreview={on => setPreview(p => (on ? info.entry.id : p === info.entry.id ? null : p))}
      onOpen={() => onOpen(info)} onEdit={() => onEdit(info.entry)} />
  );

  return (
    <div className="page songs">
      <header className="page-head">
        <h1>{L('Library', 'Biblioteca')}</h1>
        <button className="btn" onClick={() => setMarket(true)}><IconPlus size={16} />{L('Add songs', 'Juntar músicas')}</button>
      </header>
      {!ready && <div aria-busy="true"><Ruling text={L('Opening your library...', 'A abrir a tua biblioteca...')} /></div>}
      {ready && waiting && (
        <button className="lib-now waiting" onClick={() => onAdd(waiting)} aria-label={`${waiting.title}: add your MIDI file`}>
          <span className="lib-now-foot">
            <span><b>{waiting.title}</b><small>{[waiting.composer, L('Add your MIDI file of it and its videos are ready', 'Junta o teu ficheiro MIDI e os vídeos ficam prontos')].filter(Boolean).join('. ')}</small></span>
            <span className="btn go"><IconImport size={16} />{L('Add the MIDI file', 'Juntar o ficheiro MIDI')}</span>
          </span>
        </button>
      )}
      {ready && !mine.length && !waiting && (
        <section className="empty-library">
          <Ruling rest text={L('Not a note here yet.', 'Ainda nenhuma nota aqui.')} />
          <h2>{L('Your library is empty', 'A tua biblioteca está vazia')}</h2>
          <p className="sub">{L('Upload a MIDI file of a piece you want to learn.', 'Carrega um ficheiro MIDI de uma peça que queiras aprender.')}</p>
          <div className="actions">
            <button className="btn go big" onClick={() => onAdd()}><IconImport size={16} />{L('Upload MIDI', 'Carregar MIDI')}</button>
          </div>
        </section>
      )}
      {ready && mine.length > 0 && (
        <ul className="lib-list">
          <AnimatePresence>
            {now && card(now, true)}
            {rest.map(info => card(info))}
          </AnimatePresence>
          <li className="lib-more"><button className="lib-add" onClick={() => setMarket(true)}><IconPlus size={18} />{L('Add songs', 'Juntar músicas')}</button></li>
        </ul>
      )}
      <AnimatePresence>
        {market && <Marketplace entries={entries} infos={infos} onClose={() => setMarket(false)} onUpload={onAdd} />}
      </AnimatePresence>
    </div>
  );
}

/** What he gets: how long it plays and its key, or that it needs his own MIDI file. */
function facts(e: SongEntry, song?: Song) {
  if (!song) return e.missing ? L('Bring your own MIDI file', 'Traz o teu ficheiro MIDI') : '';
  return [length(song.duration), `${keyName(song).name}`, song.hands.length === 2 ? L('two hands', 'duas mãos') : L('one hand', 'uma mão')].join(', ');
}

/** Adding songs: the pieces that need his own MIDI file (the others are in the library already). */
function Marketplace({ entries, infos, onClose, onUpload }: { entries: SongEntry[]; infos: Record<string, SongInfo>; onClose: () => void; onUpload: (slot?: SongEntry) => void }) {
  const hidden = hiddenSongs();
  // The pieces that need his file, and the ones he took out of his library, to add back.
  const slots = entries.filter(e => e.missing || hidden.includes(e.id));
  return (
    <motion.div className="market" role="dialog" aria-modal="true" aria-labelledby="market-title" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={SOFT}>
      <header className="market-head">
        <button className="icon-btn ghost" onClick={onClose} aria-label={L('Close', 'Fechar')}><IconClose size={24} /></button>
        <h1 id="market-title">{L('Add songs', 'Juntar músicas')}</h1>
        <button className="btn small" onClick={() => onUpload()}><IconImport size={16} />{L('Upload MIDI', 'Carregar MIDI')}</button>
      </header>
      <div className="market-body">
        <p className="sub">{L('Every piece the app has is in your library. These ones need your own MIDI file of them.', 'Todas as peças da app já estão na tua biblioteca. Estas precisam do teu próprio ficheiro MIDI.')}</p>
        {COLLECTIONS.map(([c, title]) => {
          const list = slots.filter(e => (e.collection ?? 'film') === c);
          if (!list.length) return null;
          return (
            <section key={c} className="market-shelf" aria-labelledby={`market-${c}`}>
              <h2 id={`market-${c}`}>{title()}</h2>
              <ul className="market-list">
                {list.map(e => (
                  <li key={e.id}>
                    <Cover entry={e} song={infos[e.id]?.song} />
                    <span className="song-text market-text">
                      <b>{e.title}</b>
                      <span>{[e.composer, e.film && e.film !== e.title ? e.film : undefined, e.year].filter(Boolean).join(', ')}</span>
                      {e.about && <span className="market-about">{L(e.about, e.aboutPt ?? e.about)}</span>}
                      <span className="market-facts">{facts(e, infos[e.id]?.song)}</span>
                    </span>
                    {e.missing
                      ? <button className="btn small" onClick={() => onUpload(e)}>{L('Add MIDI', 'Juntar MIDI')}</button>
                      : <button className="btn small" onClick={() => unhideSong(e.id)}><IconPlus size={14} />{L('Add back', 'Repor')}</button>}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </motion.div>
  );
}
