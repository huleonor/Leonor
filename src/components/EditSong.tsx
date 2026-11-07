import { useState } from 'react';
import { L } from '../lib/lang';
import type { SongEntry } from '../lib/types';
import { IconClose, IconTrash } from './Icons';

interface Props {
  entry: SongEntry;
  onSave: (title: string, composer: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

/** Rename or delete one of his own songs; a piece the app ships can only be taken out of the library. */
export function EditSong({ entry, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(entry.title);
  const [composer, setComposer] = useState(entry.composer ?? '');
  const [confirm, setConfirm] = useState(false);
  const shipped = !!entry.builtIn && !entry.slot;
  return (
    <div className="scrim" onClick={onClose}>
      <div className="side-sheet" role="dialog" aria-modal="true" aria-labelledby="edit-title" onClick={e => e.stopPropagation()}>
        <header className="sheet-head">
          <h2 id="edit-title">{shipped ? entry.title : L('Edit song', 'Editar música')}</h2>
          <button className="icon-btn ghost" onClick={onClose} aria-label={L('Close', 'Fechar')}><IconClose /></button>
        </header>
        {!shipped && <form className="set-group" onSubmit={e => { e.preventDefault(); onSave(title, composer); }}>
          <label className="field">{L('Title', 'Título')}<input value={title} onChange={e => setTitle(e.target.value)} required /></label>
          <label className="field">{L('Composer', 'Compositor')}<input value={composer} onChange={e => setComposer(e.target.value)} placeholder={L('Optional', 'Opcional')} /></label>
          <button className="btn go" type="submit">{L('Save', 'Guardar')}</button>
        </form>}
        <section className="set-group">
          {confirm ? (
            <>
              <p className="warn">{shipped
                ? L(`Remove “${entry.title}” from your library? Your progress is kept, and it comes back from Add songs.`, `Remover “${entry.title}” da tua biblioteca? O teu progresso fica guardado, e volta a partir de Juntar músicas.`)
                : L(`Delete “${entry.title}” and its progress from this phone?`, `Apagar “${entry.title}” e o seu progresso deste telemóvel?`)}</p>
              <div className="actions start">
                <button className="btn danger" onClick={onDelete}><IconTrash size={16} />{shipped ? L('Remove', 'Remover') : L('Delete', 'Apagar')}</button>
                <button className="btn quiet" onClick={() => setConfirm(false)}>{L('Keep it', 'Manter')}</button>
              </div>
            </>
          ) : (
            <button className="link muted" onClick={() => setConfirm(true)}><IconTrash size={15} />{shipped ? L('Remove from library', 'Remover da biblioteca') : L('Remove this song', 'Remover esta música')}</button>
          )}
        </section>
      </div>
    </div>
  );
}
