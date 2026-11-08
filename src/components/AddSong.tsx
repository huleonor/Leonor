import { useEffect, useMemo, useState } from 'react';
import { L } from '../lib/lang';
import { songGrade } from '../lib/analysis';
import { buildCourse } from '../lib/course';
import { useI18n } from '../lib/i18n';
import { readMidi, saveImported } from '../lib/library';
import { formatTime } from '../lib/names';
import type { Song, SongEntry } from '../lib/types';
import { IconClose, IconImport } from './Icons';
import { SheetThumb } from './SheetThumb';
import { ScoreCheck } from './ScoreCheck';
import { keepPendingScore } from '../lib/pdfCheck';

interface Props {
  file: File;
  /** A bundled song waiting for its file. */
  slot?: SongEntry;
  onDone: (entry: SongEntry) => void;
  onClose: () => void;
  /** Choose a file again (after a PDF, the MIDI). */
  onPickAgain?: () => void;
}

/** A MIDI file becomes a song: name it, see how it will be taught, save it. */
export function AddSong(props: Props) {
  return /\.pdf$/i.test(props.file.name) || props.file.type === 'application/pdf' ? <PdfFirst {...props} /> : <AddMidi {...props} />;
}

/**
 * A PDF chosen where a MIDI was expected: the app cannot read the notes of a printed score (that is
 * optical music recognition, which apps made for it do far better), so it says how to turn it into
 * a MIDI file, and keeps the PDF to check that MIDI against it when it comes.
 */
function PdfFirst({ file, slot, onClose, onPickAgain }: Props) {
  useEffect(() => { file.arrayBuffer().then(keepPendingScore).catch(() => {}); }, [file]);
  return (
    <div className="upload-page" role="dialog" aria-modal="true" aria-labelledby="pdf-title">
      <header className="upload-head">
        <h2 id="pdf-title">{L('A score in PDF', 'Uma partitura em PDF')}</h2>
        <button className="icon-btn ghost" onClick={onClose} aria-label={L('Close', 'Fechar')}><IconClose /></button>
      </header>
      <div className="upload-body">
        <div className="upload-form">
          <section className="set-group">
            <p>{L('The videos and lessons are made from a MIDI file. A PDF is a printed page: turn it into MIDI with an app made for reading scores, then add that file here.', 'Os vídeos e as lições são feitos a partir de um ficheiro MIDI. Um PDF é uma página impressa: transforma-o em MIDI com uma app feita para ler partituras e junta aqui esse ficheiro.')}</p>
            <ol className="pdf-steps">
              <li>{L('Open the PDF in PlayScore 2 (iPhone) or MuseScore Studio (Import PDF).', 'Abre o PDF no PlayScore 2 (iPhone) ou no MuseScore Studio (Importar PDF).')}</li>
              <li>{L('Export it as MIDI.', 'Exporta-o em MIDI.')}</li>
              <li>{L('Add the MIDI here. This PDF is kept for now: the app checks the MIDI against it.', 'Junta aqui o MIDI. Este PDF fica guardado por agora: a app verifica o MIDI com ele.')}</li>
            </ol>
            <p className="fine file-name">{file.name}{slot ? `, ${slot.title}` : ''}</p>
          </section>
          <div className="upload-actions">
            {onPickAgain && <button className="btn go big" type="button" onClick={onPickAgain}><IconImport size={16} />{L('Choose the MIDI file', 'Escolher o ficheiro MIDI')}</button>}
            <button className="btn outline big" type="button" onClick={onClose}>{L('Close', 'Fechar')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddMidi({ file, slot, onDone, onClose }: Props) {
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
          {read && <ScoreCheck song={read.song} />}
        </div>
      </div>
    </div>
  );
}
