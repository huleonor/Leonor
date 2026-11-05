import { useEffect, useMemo, useState } from 'react';
import { L } from '../lib/lang';
import { isNative, micMeter, nativeMidiStatus, onNote, support, type LinkState, type NativeMidiStatus, type Source } from '../lib/input';
import { keyLayout } from '../lib/keys';
import { noteName } from '../lib/names';
import type { NoteNaming } from '../lib/types';
import { IconClose } from './Icons';

const LO = 36, HI = 96;
const SOURCE_NAME: Record<Source, string> = { midi: 'USB / MIDI', ble: 'Bluetooth', mic: 'Microphone' };

interface Props {
  links: Record<Source, LinkState>;
  naming: NoteNaming;
  onClose: () => void;
}

/** Play anything: see what the app hears, from which input, and what state each input is in. */
export function InputCheck({ links, naming, onClose }: Props) {
  const [held, setHeld] = useState<Set<number>>(new Set());
  const [last, setLast] = useState<{ midi: number; source: Source; chord?: number[] } | null>(null);
  const [count, setCount] = useState(0);
  const [level, setLevel] = useState(0);
  const [native, setNative] = useState<NativeMidiStatus | null>(null);
  const layout = useMemo(() => keyLayout(LO, HI), []);

  useEffect(() => onNote(e => {
    setHeld(prev => {
      const next = new Set(prev);
      if (e.type === 'on') next.add(e.midi); else next.delete(e.midi);
      return next;
    });
    if (e.type === 'on') { setLast({ midi: e.midi, source: e.source, chord: e.chord }); setCount(c => c + 1); }
  }), []);

  useEffect(() => {
    const id = window.setInterval(() => setLevel(micMeter.level), 80);
    const poll = () => nativeMidiStatus().then(setNative);
    poll();
    const nid = window.setInterval(poll, 1500);
    return () => { window.clearInterval(id); window.clearInterval(nid); };
  }, []);

  const keys = [];
  for (let m = LO; m <= HI; m++) {
    const g = layout[m];
    if (!g) continue;
    keys.push(<div key={m} className={`ck ${g.black ? 'b' : 'w'} ${held.has(m) ? 'on' : ''}`} style={{ left: `${g.x * 100}%`, width: `${g.w * 100}%` }} />);
  }
  const heard = last?.chord && last.chord.length > 1 ? last.chord : last ? [last.midi] : [];

  return (
    <div className="scrim" onClick={onClose}>
      <div className="side-sheet wide" role="dialog" aria-modal="true" aria-labelledby="check-title" onClick={e => e.stopPropagation()}>
        <header className="sheet-head">
          <div>
            <h2 id="check-title">{L('Test your piano', 'Testar o piano')}</h2>
            <p className="fine">{L('Play any key. What the app hears shows up here.', 'Toca numa tecla qualquer. O que a app ouve aparece aqui.')}</p>
          </div>
          <button className="icon-btn ghost" onClick={onClose} aria-label={L('Close', 'Fechar')}><IconClose /></button>
        </header>
        <div className="check-live" aria-live="polite">
          <small>{last ? L(`Heard from ${SOURCE_NAME[last.source]}, ${count} notes`, `Ouvido de ${SOURCE_NAME[last.source]}, ${count} notas`) : L('Waiting for a note', 'À espera de uma nota')}</small>
          <strong>{heard.length ? heard.map(m => noteName(m, naming, true)).join(' + ') : '-'}</strong>
        </div>
        <div className="check-keys" aria-hidden="true">{keys}</div>
        <dl className="check-list">
          {(['midi', 'ble', 'mic'] as Source[]).map(k => (
            <div key={k}>
              <dt>{SOURCE_NAME[k]}</dt>
              <dd className={links[k].status}>
                <i className="status-dot" />
                {links[k].status === 'on' ? `${L('On', 'Ligado')}${links[k].label ? ', ' + links[k].label : ''}` : links[k].status === 'error' ? L('Problem', 'Problema') : links[k].status === 'connecting' ? L('Connecting…', 'A ligar…') : L('Off', 'Desligado')}
              </dd>
            </div>
          ))}
          <div>
            <dt>{L('Mic level', 'Nível do microfone')}</dt>
            <dd>
              <svg className="vu" viewBox="0 0 96 52" aria-label={`${L('Mic level', 'Nível do microfone')} ${Math.round(level * 100)}%`}>
                <path d="M8 48a40 40 0 0 1 80 0" fill="none" stroke="var(--line)" strokeWidth="6" strokeLinecap="round" />
                <path d="M72 20.7a40 40 0 0 1 16 27.3" fill="none" stroke="var(--miss)" strokeWidth="6" strokeLinecap="round" opacity=".8" />
                <line className="vu-needle" x1="48" y1="48" x2="48" y2="12" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" style={{ transform: `rotate(${-70 + level * 140}deg)` }} />
                <circle cx="48" cy="48" r="4" fill="var(--ink)" />
              </svg>
            </dd>
          </div>
          <div>
            <dt>{L('Running as', 'A correr como')}</dt>
            <dd>{isNative ? L('iPhone app', 'App para iPhone') : `Browser, MIDI ${support.webMidi ? L('yes', 'sim') : L('no', 'não')}, Bluetooth ${support.bluetooth ? L('yes', 'sim') : L('no', 'não')}`}</dd>
          </div>
          {native && (
            <div>
              <dt>{L('MIDI devices', 'Aparelhos MIDI')}</dt>
              <dd>
                {native.client !== 0 ? `CoreMIDI not ready (${native.client}), retrying` : `${native.devices.length ? native.devices.join(', ') : 'None found'} · ${native.events} events`}
              </dd>
            </div>
          )}
        </dl>
        <p className="fine">
          {isNative
            ? L('Cable: plug the piano in with the Lightning to USB Camera Adapter; it shows up above within 2 seconds. Bluetooth: choose Bluetooth under Your piano in Settings, pick the piano, then Done.', 'Cabo: liga o piano com o adaptador Lightning para USB; aparece acima em 2 segundos. Bluetooth: escolhe Bluetooth em O teu piano nas Definições, escolhe o piano e depois OK.')
            : L('On iPhone, use the Leonor app for cable and Bluetooth. iPhone browsers only have the microphone.', 'No iPhone, usa a app Leonor para o cabo e o Bluetooth. Os browsers do iPhone só têm o microfone.')}
        </p>
      </div>
    </div>
  );
}
