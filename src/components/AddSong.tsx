import { useEffect, useMemo, useState } from 'react';
import { songGrade } from '../lib/analysis';
import { buildCourse } from '../lib/course';
import { useI18n } from '../lib/i18n';
import { readMidi, saveImported } from '../lib/library';
import { formatTime } from '../lib/names';
import type { Song, SongEntry } from '../lib/types';
import { IconClose } from './Icons';
import { Difficulty, SheetThumb } from './SheetThumb';

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
        <h2 id="add-title">{slot ? `Add the MIDI for ${slot.title}` : 'Upload a song'}</h2>
        <button className="icon-btn ghost" onClick={onClose} aria-label="Close"><IconClose /></button>
      </header>
      <div className="upload-body">
        <div className="upload-preview">
          <div className="song-page">
            {read ? <SheetThumb song={read.song} title={title || read.song.entry.title} composer={composer || undefined} bars={12} /> : <p className="fine pad-in">{error ? '' : 'Reading the file…'}</p>}
          </div>
          <p className="fine file-name">{file.name}</p>
        </div>
        <div className="upload-form">
          {error && (
            <div className="set-group">
              <p className="warn">{error}</p>
              <p className="fine">Try another .mid file. Files with two tracks, one per hand, work best.</p>
              <button className="btn" onClick={onClose}>Close</button>
            </div>
          )}
          {read && facts && (
            <form onSubmit={e => { e.preventDefault(); save(); }}>
              <label className="field">Title<input value={title} onChange={e => setTitle(e.target.value)} required /></label>
              <label className="field">Composer<input value={composer} onChange={e => setComposer(e.target.value)} placeholder="Optional" /></label>
              <div className="field">
                Difficulty
                <div className="field-static"><Difficulty level={facts.level} /><small>Worked out from the notes</small></div>
              </div>
              <p className="fine">{formatTime(read.song.duration)} · {facts.hands === 2 ? 'two hands' : 'one hand'} · {facts.parts} sections to learn, each right hand, left hand, together and in tempo.</p>
              <div className="upload-actions">
                <button className="btn go big" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add to my songs'}</button>
                <button className="btn outline big" type="button" onClick={onClose}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
