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

/** Rename or delete one of his own songs. */
export function EditSong({ entry, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(entry.title);
  const [composer, setComposer] = useState(entry.composer ?? '');
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="scrim" onClick={onClose}>
      <div className="side-sheet" role="dialog" aria-modal="true" aria-labelledby="edit-title" onClick={e => e.stopPropagation()}>
        <header className="sheet-head">
          <h2 id="edit-title">{L('Edit song', 'Editar música')}</h2>
          <button className="icon-btn ghost" onClick={onClose} aria-label={L('Close', 'Fechar')}><IconClose /></button>
        </header>
        <form className="set-group" onSubmit={e => { e.preventDefault(); onSave(title, composer); }}>
          <label className="field">{L('Title', 'Título')}<input value={title} onChange={e => setTitle(e.target.value)} required /></label>
          <label className="field">{L('Composer', 'Compositor')}<input value={composer} onChange={e => setComposer(e.target.value)} placeholder={L('Optional', 'Opcional')} /></label>
          <button className="btn go" type="submit">{L('Save', 'Guardar')}</button>
        </form>
        <section className="set-group">
          {confirm ? (
            <>
              <p className="warn">Delete “{entry.title}” and its stars from this phone?</p>
              <div className="actions start">
                <button className="btn danger" onClick={onDelete}><IconTrash size={16} />{L('Delete', 'Apagar')}</button>
                <button className="btn quiet" onClick={() => setConfirm(false)}>{L('Keep it', 'Manter')}</button>
              </div>
            </>
          ) : (
            <button className="link muted" onClick={() => setConfirm(true)}><IconTrash size={15} />{L('Delete this song', 'Apagar esta música')}</button>
          )}
        </section>
      </div>
    </div>
  );
}
