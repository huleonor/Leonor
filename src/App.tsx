import { useEffect, useMemo, useRef, useState } from 'react';
import { Library } from './components/Library';
import { Player } from './components/Player';
import { unlockAudio } from './lib/audio';
import { I18nContext, makeT } from './lib/i18n';
import { connect, disconnectBle, disconnectMic, onLinkState, linkState, watchForMidi, type LinkState, type Source } from './lib/input';
import { loadSettings, saveSettings } from './lib/library';
import type { Settings, Song } from './lib/types';

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [song, setSong] = useState<Song | null>(null);
  const [links, setLinks] = useState<Record<Source, LinkState>>(linkState);
  const [notice, setNotice] = useState<string | null>(null);
  const prevMidi = useRef(links.midi.status);

  useEffect(() => onLinkState(setLinks), []);
  useEffect(() => { watchForMidi(); }, []);
  useEffect(() => { saveSettings(settings); document.documentElement.lang = settings.lang === 'pt' ? 'pt-PT' : 'en'; }, [settings]);

  const update = (patch: Partial<Settings>) => setSettings(s => ({ ...s, ...patch }));
  const i18n = useMemo(() => ({ lang: settings.lang, t: makeT(settings.lang) }), [settings.lang]);

  // A keyboard on a cable just appeared: use it, unless a Bluetooth keyboard is already playing.
  useEffect(() => {
    const was = prevMidi.current;
    prevMidi.current = links.midi.status;
    if (links.midi.status !== 'on' || was === 'on') return;
    if (settings.input === 'ble' && links.ble.status === 'on') return;
    if (settings.input === 'mic') disconnectMic();
    update({ input: 'midi' });
    setNotice(links.midi.label ? i18n.t('midiConnected', { name: links.midi.label }) : i18n.t('midiConnectedPlain'));
  }, [links.midi.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 3800);
    return () => clearTimeout(id);
  }, [notice]);

  const connectInput = (kind: Source) => {
    unlockAudio();
    if (kind !== 'mic') disconnectMic();
    if (kind !== 'ble' && links.ble.status === 'on') disconnectBle();
    if (links[kind].status !== 'on') connect(kind);
  };

  // Reconnect the chosen input when a song opens (Bluetooth needs its own tap: the browser shows a picker).
  const ensureInput = () => {
    const k = settings.input;
    if ((k === 'mic' || k === 'midi') && links[k].status === 'off') connect(k);
  };

  return (
    <I18nContext.Provider value={i18n}>
      {song
        ? <Player song={song} settings={settings} update={update} links={links} onExit={() => setSong(null)} />
        : <Library settings={settings} update={update} links={links} connectInput={connectInput} onOpen={s => setSong(s)} onPick={() => { unlockAudio(); ensureInput(); }} />}
      {notice && <div className="toast" role="status">{notice}</div>}
    </I18nContext.Provider>
  );
}
