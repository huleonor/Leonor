import { useEffect, useMemo, useRef, useState } from 'react';
import { AddSong } from './components/AddSong';
import { Home } from './components/Home';
import { IconChart, IconGear, IconHome, IconMusic } from './components/Icons';
import { InputCheck } from './components/InputCheck';
import { Practice } from './components/Practice';
import { ProgressView } from './components/ProgressView';
import { SettingsSheet } from './components/SettingsSheet';
import { SongPage } from './components/SongPage';
import { Songs } from './components/Songs';
import { holdNote, loadPiano, releaseNote, unlockAudio } from './lib/audio';
import { refreshCatalog, refreshSong, useCatalog, type SongInfo } from './lib/catalog';
import type { CourseStep } from './lib/course';
import { I18nContext, makeT } from './lib/i18n';
import { connect, disconnectBle, disconnectMic, linkState, onLinkState, onNote, watchForMidi, type LinkState, type Source } from './lib/input';
import { loadSettings, removeSong, renameSong, saveSettings } from './lib/library';
import type { Settings, SongEntry } from './lib/types';

type Tab = 'home' | 'songs' | 'progress';
const TABS: [Tab, string, (p: { size?: number }) => React.ReactElement][] = [
  ['home', 'Home', IconHome],
  ['songs', 'Songs', IconMusic],
  ['progress', 'Progress', IconChart],
];

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [tab, setTab] = useState<Tab>('home');
  const [openId, setOpenId] = useState<string | null>(null);
  const [play, setPlay] = useState<{ id: string; step?: CourseStep; n: number } | null>(null);
  const [sheet, setSheet] = useState<'settings' | 'check' | null>(null);
  const [adding, setAdding] = useState<{ file: File; slot?: SongEntry } | null>(null);
  const [links, setLinks] = useState<Record<Source, LinkState>>(linkState);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const prevMidi = useRef(links.midi.status);
  const fileRef = useRef<HTMLInputElement>(null);
  const slotRef = useRef<SongEntry | undefined>(undefined);
  const { ready, entries, infos } = useCatalog();

  useEffect(() => onLinkState(setLinks), []);
  useEffect(() => { watchForMidi(); }, []);
  useEffect(() => { saveSettings(settings); }, [settings]);

  // Keys played on a MIDI or Bluetooth keyboard sound through the app's piano, on every screen.
  useEffect(() => {
    if (!settings.localSound) return;
    return onNote(e => {
      if (e.source === 'mic') return;
      if (e.type === 'on') { unlockAudio(); holdNote(e.midi, e.velocity); }
      else releaseNote(e.midi);
    });
  }, [settings.localSound]);

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
    update({ input: 'midi', setupDone: true });
    setNotice({ text: links.midi.label ? i18n.t('midiConnected', { name: links.midi.label }) : i18n.t('midiConnectedPlain') });
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

  // Reconnect the chosen input when practice opens (Bluetooth needs its own tap: it shows a picker).
  const ensureInput = () => {
    const k = settings.input;
    if ((k === 'mic' || k === 'midi') && links[k].status === 'off') connect(k);
  };

  const pickFile = (slot?: SongEntry) => { slotRef.current = slot; fileRef.current?.click(); };
  const openSong = (info: SongInfo) => {
    if (info.entry.missing) { pickFile(info.entry); return; }
    if (info.error || !info.song) { setNotice({ text: i18n.t(info.entry.builtIn ? 'err.loadFailed' : 'err.missing'), error: true }); return; }
    setOpenId(info.entry.id);
  };
  const startStep = (info: SongInfo, step?: CourseStep) => {
    unlockAudio();
    ensureInput();
    setOpenId(info.entry.id);
    setPlay({ id: info.entry.id, step, n: 0 });
  };
  const exitPractice = () => {
    if (play) refreshSong(play.id);
    setPlay(null);
  };

  const playing = play && infos[play.id];
  const open = openId ? infos[openId] : undefined;

  return (
    <I18nContext.Provider value={i18n}>
      {playing && playing.song ? (
        <Practice
          key={`${play.step?.id ?? 'free'}-${play.n}`}
          song={playing.song} course={playing.course} step={play.step}
          settings={settings} update={update} links={links}
          onExit={exitPractice}
          onStep={step => { refreshSong(play.id); setPlay(p => p && { ...p, step, n: p.n + 1 }); }}
          onSettings={() => setSheet('settings')}
        />
      ) : (
        <div className="app">
          <nav className="rail" aria-label="Main">
            <img className="rail-logo" src="/icons/icon.svg" alt="Hugo's Piano" width={36} height={36} />
            {TABS.map(([id, label, Icon]) => (
              <button key={id} className={`rail-btn ${tab === id && !open ? 'on' : ''}`} aria-current={tab === id && !open ? 'page' : undefined}
                onClick={() => { setTab(id); setOpenId(null); }}>
                <Icon size={22} /><span>{label}</span>
              </button>
            ))}
            <button className="rail-btn settings" onClick={() => setSheet('settings')}><IconGear size={22} /><span>Settings</span></button>
          </nav>
          <main className="content">
            {open && open.song ? (
              <SongPage
                key={open.entry.id}
                info={open}
                onBack={() => setOpenId(null)}
                onStep={step => startStep(open, step)}
                onFree={() => startStep(open)}
                onRename={open.entry.builtIn ? undefined : async (title, composer) => { await renameSong(open.entry, title, composer); await refreshCatalog(); }}
                onDelete={open.entry.builtIn ? undefined : async () => { await removeSong(open.entry); setOpenId(null); await refreshCatalog(); }}
              />
            ) : tab === 'home' ? (
              <Home
                settings={settings} ready={ready} entries={entries} infos={infos} links={links}
                onSetup={kind => { update({ input: kind, setupDone: true }); connectInput(kind); }}
                onSkipSetup={() => update({ setupDone: true })}
                onOpen={openSong}
                onPlay={startStep}
                onBrowse={() => setTab('songs')}
              />
            ) : tab === 'songs' ? (
              <Songs infos={infos} entries={entries} ready={ready} onOpen={openSong} onAdd={() => pickFile()} />
            ) : (
              <ProgressView settings={settings} update={update} entries={entries} infos={infos} />
            )}
          </main>
        </div>
      )}

      <input
        ref={fileRef} type="file" accept=".mid,.midi,audio/midi,audio/x-midi" hidden
        onChange={e => { const f = e.target.files?.[0]; if (f) setAdding({ file: f, slot: slotRef.current }); e.target.value = ''; }}
      />
      {adding && (
        <AddSong
          file={adding.file} slot={adding.slot}
          onClose={() => setAdding(null)}
          onDone={async entry => { setAdding(null); await refreshCatalog(); setTab('songs'); setOpenId(entry.id); setNotice({ text: `“${entry.title}” is ready to learn.` }); }}
        />
      )}
      {sheet === 'settings' && (
        <SettingsSheet settings={settings} update={update} links={links} connectInput={connectInput} onCheck={() => setSheet('check')} onClose={() => setSheet(null)} />
      )}
      {sheet === 'check' && <InputCheck links={links} naming={settings.naming} onClose={() => setSheet('settings')} />}
      {notice && <div className={`toast ${notice.error ? 'error' : ''}`} role="status">{notice.text}</div>}
    </I18nContext.Provider>
  );
}
