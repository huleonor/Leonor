import { useEffect, useMemo, useState } from 'react';
import { L } from '../lib/lang';
import { songGrade } from '../lib/analysis';
import { buildCourse } from '../lib/course';
import { useI18n } from '../lib/i18n';
import { readMidi, saveImported } from '../lib/library';
import { formatTime } from '../lib/names';
import type { Song, SongEntry } from '../lib/types';
import { IconClose } from './Icons';
import { SheetThumb } from './SheetThumb';

interface Props {
  file: File;
  /** A bundled song waiting for its file. */
  slot?: SongEntry;
  onDone: (entry: SongEntry) => void;
  onClose: () => void;
}

/** A MIDI file becomes a song: name it, see how it will be taught, save it. */
export function AddSong({ file, slot, onDone, onClose }: Props) {
  const { t } = useI18n();
  const [read, setRead] = useState<{ song: Song; data: ArrayBuffer } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [composer, setComposer] = useState(slot?.composer ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    readMidi(file, slot)
      .then(r => { setRead(r); setTitle(r.song.entry.title); })
      .catch(err => setError(t(err instanceof Error ? err.message : 'err.badFile')));
  }, [file, slot, t]);

  const facts = useMemo(() => {
    if (!read) return null;
    const course = buildCourse(read.song);
    return { level: songGrade(read.song), parts: course.parts.length, steps: course.steps.length, hands: read.song.hands.length };
  }, [read]);

  const save = async () => {
    if (!read) return;
    setSaving(true);
    try { onDone(await saveImported(read.data, { title, composer }, slot)); }
    catch (err) { setError(t(err instanceof Error ? err.message : 'err.badFile')); setSaving(false); }
  };

  return (
    <div className="upload-page" role="dialog" aria-modal="true" aria-labelledby="add-title">
      <header className="upload-head">
        <h2 id="add-title">{slot ? L(`Add the MIDI for ${slot.title}`, `Juntar o MIDI de ${slot.title}`) : L('Upload a song', 'Carregar uma música')}</h2>
        <button className="icon-btn ghost" onClick={onClose} aria-label={L('Close', 'Fechar')}><IconClose /></button>
      </header>
      <div className="upload-body">
        <div className="upload-preview">
          <div className="song-page">
            {read ? <SheetThumb song={read.song} title={title || read.song.entry.title} composer={composer || undefined} bars={12} /> : <p className="fine pad-in">{error ? '' : L('Reading the file…', 'A ler o ficheiro…')}</p>}
          </div>
          <p className="fine file-name">{file.name}</p>
        </div>
        <div className="upload-form">
          {error && (
            <div className="set-group">
              <p className="warn">{error}</p>
              <p className="fine">{L('Try another .mid file. Files with two tracks, one per hand, work best.', 'Experimenta outro ficheiro .mid. Os ficheiros com duas pistas, uma por mão, funcionam melhor.')}</p>
              <button className="btn" onClick={onClose}>{L('Close', 'Fechar')}</button>
            </div>
          )}
          {read && facts && (
            <form onSubmit={e => { e.preventDefault(); save(); }}>
              <label className="field">{L('Title', 'Título')}<input value={title} onChange={e => setTitle(e.target.value)} required /></label>
              <label className="field">{L('Composer', 'Compositor')}<input value={composer} onChange={e => setComposer(e.target.value)} placeholder={L('Optional', 'Opcional')} /></label>
              <p className="fine">{formatTime(read.song.duration)} long, for {facts.hands === 2 ? 'two hands' : 'one hand'}. Its videos and lessons are made from these notes.</p>
              <div className="upload-actions">
                <button className="btn go big" type="submit" disabled={saving}>{saving ? L('Saving…', 'A guardar…') : L('Add to my songs', 'Juntar às minhas músicas')}</button>
                <button className="btn outline big" type="button" onClick={onClose}>{L('Cancel', 'Cancelar')}</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
