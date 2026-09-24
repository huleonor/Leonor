import { useEffect, useMemo, useState } from 'react';
import { Library } from './components/Library';
import { Player } from './components/Player';
import { unlockAudio } from './lib/audio';
import { I18nContext, makeT } from './lib/i18n';
import { connect, disconnectBle, disconnectMic, onLinkState, linkState, type LinkState, type Source } from './lib/input';
import { loadSettings, saveSettings } from './lib/library';
import type { Settings, Song } from './lib/types';

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [song, setSong] = useState<Song | null>(null);
  const [links, setLinks] = useState<Record<Source, LinkState>>(linkState);

  useEffect(() => onLinkState(setLinks), []);
  useEffect(() => { saveSettings(settings); document.documentElement.lang = settings.lang === 'pt' ? 'pt-PT' : 'en'; }, [settings]);

  const update = (patch: Partial<Settings>) => setSettings(s => ({ ...s, ...patch }));
  const i18n = useMemo(() => ({ lang: settings.lang, t: makeT(settings.lang) }), [settings.lang]);

  const connectInput = (kind: Source) => {
    unlockAudio();
    if (kind !== 'mic') disconnectMic();
    if (kind !== 'ble' && links.ble.status === 'on') disconnectBle();
    if (links[kind].status !== 'on') connect(kind);
  };

  return (
    <I18nContext.Provider value={i18n}>
      {song
        ? <Player song={song} settings={settings} update={update} links={links} onExit={() => setSong(null)} />
        : <Library settings={settings} update={update} links={links} connectInput={connectInput} onOpen={s => { unlockAudio(); setSong(s); }} />}
    </I18nContext.Provider>
  );
}
