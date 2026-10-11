import { useState } from 'react';
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
          <h2 id="edit-title">Edit song</h2>
          <button className="icon-btn ghost" onClick={onClose} aria-label="Close"><IconClose /></button>
        </header>
        <form className="set-group" onSubmit={e => { e.preventDefault(); onSave(title, composer); }}>
          <label className="field">Title<input value={title} onChange={e => setTitle(e.target.value)} required /></label>
          <label className="field">Composer<input value={composer} onChange={e => setComposer(e.target.value)} placeholder="Optional" /></label>
          <button className="btn go" type="submit">Save</button>
        </form>
        <section className="set-group">
          {confirm ? (
            <>
              <p className="warn">Delete “{entry.title}” and its stars from this phone?</p>
              <div className="actions start">
                <button className="btn danger" onClick={onDelete}><IconTrash size={16} />Delete</button>
                <button className="btn quiet" onClick={() => setConfirm(false)}>Keep it</button>
              </div>
            </>
          ) : (
            <button className="link muted" onClick={() => setConfirm(true)}><IconTrash size={15} />Delete this song</button>
          )}
        </section>
      </div>
    </div>
  );
}
