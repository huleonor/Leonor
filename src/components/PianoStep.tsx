/**
 * The piano, asked once (P0 of the 2026-11 audit): the first time he goes into the videos without
 * a piano connected, one short step before them: connect the piano (cable, Bluetooth) or use the
 * microphone, test it, or skip. The videos wait for him and hear his notes only with one of them,
 * and until now nothing asked. A failure says what happened and what to do (the choice's own line);
 * the microphone says what it is for before the browser asks. Never asked again: Settings has it.
 */
import { useEffect } from 'react';
import { L } from '../lib/lang';
import type { LinkState, Source } from '../lib/input';
import type { Settings } from '../lib/types';
import { PianoChoices } from './SettingsSheet';

const ASKED = 'leonor:piano-asked';
export function pianoAsked(): boolean { try { return localStorage.getItem(ASKED) === '1'; } catch { return true; } }
function markAsked() { try { localStorage.setItem(ASKED, '1'); } catch { /* only for this visit */ } }

interface Props {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  links: Record<Source, LinkState>;
  connectInput: (kind: Source) => void;
  disconnectInput: (kind: Source) => void;
  onCheck: () => void;
  /** Goes on to the videos. */
  onDone: () => void;
}

export function PianoStep({ onDone, ...rest }: Props) {
  const on = Object.values(rest.links).some(l => l.status === 'on');
  const done = () => { markAsked(); onDone(); };
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') done(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });
  return (
    <div className="scrim piano-step-scrim">
      <div className="side-sheet piano-step" role="dialog" aria-modal="true" aria-labelledby="piano-step-title">
        <header className="sheet-head"><h2 id="piano-step-title">{L('Your piano', 'O teu piano')}</h2></header>
        <p className="sub">{L('Connect it and the videos wait for you and hear every note you play.', 'Liga-o e os vídeos esperam por ti e ouvem cada nota que tocas.')}</p>
        <PianoChoices {...rest} />
        <p className="fine">{L('The microphone only listens for your notes. Nothing is recorded or sent.', 'O microfone só ouve as tuas notas. Nada é gravado nem enviado.')}</p>
        <div className="piano-step-go">
          {on
            ? <button className="btn go big" onClick={done}>{L('Start the videos', 'Começar os vídeos')}</button>
            : <button className="btn quiet" onClick={done}>{L('Skip for now', 'Agora não')}</button>}
        </div>
      </div>
    </div>
  );
}
