/**
 * Check a MIDI against his PDF score (pdfCheck.ts): pick the PDF, the app reads its chord symbols on
 * the device and says how many bars fit them and which to look at. Used when he adds a MIDI file and
 * from a song's sheet in the Library.
 */
import { useEffect, useRef, useState } from 'react';
import { L } from '../lib/lang';
import { checkAgainst, readScoreChords, takePendingScore, type ScoreCheck as Result } from '../lib/pdfCheck';
import type { Song } from '../lib/types';
import { IconImport } from './Icons';

export function ScoreCheck({ song }: { song: Song }) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<{ kind: 'idle' } | { kind: 'reading' } | { kind: 'done'; r: Result } | { kind: 'error' }>({ kind: 'idle' });
  const run = async (data: ArrayBuffer) => {
    setState({ kind: 'reading' });
    try {
      const { chords, pages } = await readScoreChords(data);
      setState({ kind: 'done', r: checkAgainst(song, chords, pages) });
    } catch { setState({ kind: 'error' }); }
  };
  // A PDF he picked before the MIDI (kept for this moment) is checked at once.
  useEffect(() => { const pending = takePendingScore(); if (pending) run(pending); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className="set-group score-check" aria-live="polite">
      <h3>{L('Check it against your score', 'Verificar com a tua partitura')}</h3>
      {state.kind === 'idle' && <p className="fine">{L('Choose the PDF of the score. The app reads its chord symbols, on this phone, and tells you which bars of the MIDI do not fit them: the places a conversion most often gets wrong.', 'Escolhe o PDF da partitura. A app lê as cifras dos acordes, neste telemóvel, e diz-te que compassos do MIDI não encaixam nelas: os sítios onde uma conversão mais costuma errar.')}</p>}
      {state.kind === 'reading' && <p className="fine">{L('Reading the chord symbols...', 'A ler as cifras...')}</p>}
      {state.kind === 'error' && <p className="warn">{L('That PDF could not be read. Try the file as you downloaded it.', 'Não foi possível ler esse PDF. Experimenta o ficheiro tal como o descarregaste.')}</p>}
      {state.kind === 'done' && (state.r.read === 0 ? (
        <p className="warn">{L('No chord symbols found in this PDF. A scanned page is a picture, with no text to read; a PDF from a music store usually has them.', 'Não encontrei cifras neste PDF. Uma página digitalizada é uma imagem, sem texto para ler; um PDF de uma loja de partituras costuma tê-las.')}</p>
      ) : (
        <>
          <p className="score-check-result"><b className="num">{state.r.fit}</b> {L(`of ${state.r.checked} bars fit the chords of your score`, `de ${state.r.checked} compassos encaixam nos acordes da tua partitura`)}</p>
          {state.r.flagged.length ? (
            <>
              <p className="fine">{L('Look at these bars: their notes do not fit the chords written over them.', 'Vê estes compassos: as notas não encaixam nos acordes escritos por cima.')}</p>
              <ul className="score-check-bars">
                {state.r.flagged.slice(0, 12).map(f => <li key={f.bar}><b>{L(`Bar ${f.bar}`, `Compasso ${f.bar}`)}</b> <span>{f.chords.join(', ')}</span></li>)}
              </ul>
            </>
          ) : <p className="fine">{L('Every bar fits. The MIDI follows your score.', 'Todos os compassos encaixam. O MIDI segue a tua partitura.')}</p>}
          <p className="fine">{L(`${state.r.read} chord symbols read from ${state.r.pages} pages.`, `${state.r.read} cifras lidas de ${state.r.pages} páginas.`)}</p>
        </>
      ))}
      <input ref={input} type="file" accept=".pdf,application/pdf" hidden onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) run(await f.arrayBuffer()); }} />
      <button className="btn" type="button" onClick={() => input.current?.click()} disabled={state.kind === 'reading'}>
        <IconImport size={16} />{state.kind === 'done' ? L('Check another PDF', 'Verificar outro PDF') : L('Choose the PDF', 'Escolher o PDF')}
      </button>
    </section>
  );
}
