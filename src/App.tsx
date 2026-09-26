import { useEffect, useMemo, useRef, useState } from 'react';
import { CourseView } from './components/CourseView';
import { Library } from './components/Library';
import { Player } from './components/Player';
import { holdNote, loadPiano, releaseNote, unlockAudio } from './lib/audio';
import { I18nContext, makeT } from './lib/i18n';
import { connect, disconnectBle, disconnectMic, onLinkState, onNote, linkState, watchForMidi, type LinkState, type Source } from './lib/input';
import { loadSettings, saveSettings } from './lib/library';
import type { Course, CourseStep } from './lib/course';
import type { Settings, Song } from './lib/types';

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [song, setSong] = useState<Song | null>(null);
  // Picking a song opens its course; playing is either a course step or the whole song.
  const [play, setPlay] = useState<{ step?: CourseStep; course?: Course; n: number } | null>(null);
  const [links, setLinks] = useState<Record<Source, LinkState>>(linkState);
  const [notice, setNotice] = useState<string | null>(null);
  const prevMidi = useRef(links.midi.status);

  useEffect(() => onLinkState(setLinks), []);
  useEffect(() => { watchForMidi(); }, []);
  useEffect(() => { saveSettings(settings); document.documentElement.lang = settings.lang === 'pt' ? 'pt-PT' : 'en'; }, [settings]);

  // Keys played on a MIDI or Bluetooth keyboard sound through the app's piano, on every screen.
  useEffect(() => {
    if (!settings.localSound) return;
    return onNote(e => {
      if (e.source === 'mic') return;
      if (e.type === 'on') { unlockAudio(); holdNote(e.midi, e.velocity); }
      else releaseNote(e.midi);
    });
  }, [settings.localSound]);

  // Have the piano sound ready as soon as a keyboard is connected.
  useEffect(() => {
    if (links.midi.status === 'on' || links.ble.status === 'on') loadPiano().catch(() => {});
  }, [links.midi.status, links.ble.status]);

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
      {song && play
        ? <Player
            key={`${play.step?.id ?? 'free'}-${play.n}`}
            song={song} settings={settings} update={update} links={links}
            step={play.step} course={play.course}
            onStep={step => setPlay(p => ({ step, course: p?.course, n: (p?.n ?? 0) + 1 }))}
            onExit={() => setPlay(null)}
          />
        : song
          ? <CourseView
              song={song}
              onBack={() => setSong(null)}
              onStep={(step, course) => { unlockAudio(); ensureInput(); setPlay({ step, course, n: 0 }); }}
              onFree={() => { unlockAudio(); ensureInput(); setPlay({ n: 0 }); }}
            />
          : <Library settings={settings} update={update} links={links} connectInput={connectInput} onOpen={s => { setSong(s); setPlay(null); }} onContinue={(s, step, course) => { setSong(s); setPlay({ step, course, n: 0 }); }} onPick={() => { unlockAudio(); ensureInput(); }} />}
      {notice && <div className="toast lcd" role="status">{notice}</div>}
    </I18nContext.Provider>
  );
}
