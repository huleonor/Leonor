import { useEffect, useMemo, useState } from 'react';
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
    <div className="drawer-scrim" onClick={onClose}>
      <div className="drawer check" role="dialog" aria-label="Check input" onClick={e => e.stopPropagation()}>
        <div className="drawer-head">
          <h2>Check input</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><IconClose /></button>
        </div>
        <div className="check-live" aria-live="polite">
          <span className="check-kicker">{last ? `Heard from ${SOURCE_NAME[last.source]}` : 'Play any key'}</span>
          <strong>{heard.length ? heard.map(m => noteName(m, naming, true)).join(' + ') : '—'}</strong>
          <small>{count ? `${count} notes so far` : 'Nothing heard yet'}</small>
        </div>
        <div className="check-keys" aria-hidden="true">{keys}</div>
        <dl className="check-list">
          {(['midi', 'ble', 'mic'] as Source[]).map(k => (
            <div key={k}>
              <dt>{SOURCE_NAME[k]}</dt>
              <dd className={links[k].status}>
                {links[k].status === 'on' ? `On${links[k].label ? ' · ' + links[k].label : ''}` : links[k].status === 'error' ? 'Problem' : links[k].status === 'connecting' ? 'Connecting…' : 'Off'}
              </dd>
            </div>
          ))}
          <div>
            <dt>Mic level</dt>
            <dd><span className="meter"><i style={{ transform: `scaleX(${level})` }} /></span></dd>
          </div>
          <div>
            <dt>Running as</dt>
            <dd>{isNative ? 'iPhone app' : `Browser · MIDI ${support.webMidi ? 'yes' : 'no'} · Bluetooth ${support.bluetooth ? 'yes' : 'no'}`}</dd>
          </div>
          {native && (
            <div>
              <dt>MIDI devices</dt>
              <dd>{native.devices.length ? native.devices.join(', ') : 'None found'} · {native.events} events</dd>
            </div>
          )}
        </dl>
        <p className="note">
          {isNative
            ? 'Cable: plug the piano in with the Lightning to USB Camera Adapter; it appears above within 2 seconds. Bluetooth: tap Bluetooth MIDI in the library, pick the piano, then Done.'
            : 'On iPhone, use the Hugo’s Piano app for cable and Bluetooth. Browsers there only have the microphone.'}
        </p>
      </div>
    </div>
  );
}
