import { useEffect, useMemo, useState } from 'react';
import { songGrade } from '../lib/analysis';
import { buildCourse } from '../lib/course';
import { useI18n } from '../lib/i18n';
import { readMidi, saveImported } from '../lib/library';
import { formatTime } from '../lib/names';
import type { Song, SongEntry } from '../lib/types';
import { IconClose, IconPlay } from './Icons';

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
    <div className="scrim" onClick={onClose}>
      <div className="side-sheet" role="dialog" aria-modal="true" aria-labelledby="add-title" onClick={e => e.stopPropagation()}>
        <header className="sheet-head">
          <h2 id="add-title">{slot ? `Add ${slot.title}` : 'New song'}</h2>
          <button className="icon-btn ghost" onClick={onClose} aria-label="Close"><IconClose /></button>
        </header>
        <p className="fine file-name">{file.name}</p>
        {error && (
          <div className="set-group">
            <p className="warn">{error}</p>
            <p className="fine">Try another .mid file. Files with two tracks, one per hand, work best.</p>
            <button className="btn" onClick={onClose}>Close</button>
          </div>
        )}
        {!error && !read && <p className="fine">Reading the file…</p>}
        {read && facts && (
          <form className="set-group" onSubmit={e => { e.preventDefault(); save(); }}>
            <label className="field">Title<input value={title} onChange={e => setTitle(e.target.value)} required /></label>
            <label className="field">Composer<input value={composer} onChange={e => setComposer(e.target.value)} placeholder="Optional" /></label>
            <dl className="add-facts">
              <div><dt>Level</dt><dd>{facts.level}</dd></div>
              <div><dt>Length</dt><dd>{formatTime(read.song.duration)}</dd></div>
              <div><dt>Hands</dt><dd>{facts.hands === 2 ? 'Two' : 'One'}</dd></div>
              <div><dt>Parts</dt><dd>{facts.parts}</dd></div>
            </dl>
            <p className="fine">It becomes a course of {facts.steps} steps: each part right hand, left hand, together and in tempo, then the whole song.</p>
            <button className="btn go big" type="submit" disabled={saving}><IconPlay size={18} />{saving ? 'Saving…' : 'Save and learn it'}</button>
          </form>
        )}
      </div>
    </div>
  );
}
