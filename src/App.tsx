import { useEffect, useMemo, useRef, useState } from 'react';
import { AddSong } from './components/AddSong';
import { onStats } from './lib/stats';
import { scheduleReminders, startWebReminders } from './lib/reminders';
import { currentSongId, Journey, practiceFor, setCurrentSong } from './components/Journey';
import { ReelFeed } from './components/Reels';
import { clipsOf, seenReels, type Reel } from './lib/reels';
import { InputCheck } from './components/InputCheck';
import { Lesson } from './components/Lesson';
import { SettingsSheet } from './components/SettingsSheet';
import { EditSong } from './components/EditSong';
import { SongScreen, sectionsOf, type Section } from './components/SongScreen';
import { Songs } from './components/Songs';
import { Logo } from './components/Brand';
import { holdNote, loadPiano, releaseNote, unlockAudio } from './lib/audio';
import { refreshCatalog, refreshSong, useCatalog, type SongInfo } from './lib/catalog';
import { I18nContext, makeT } from './lib/i18n';
import { MasterySession } from './lib/mastery';
import { connect, disconnectBle, disconnectMic, linkState, onLinkState, onNote, watchForMidi, type LinkState, type Source } from './lib/input';
import { addToLibrary, loadSettings, removeSong, renameSong, saveSettings } from './lib/library';
import type { Settings, SongEntry } from './lib/types';

/** Watch is the reel feed of the song being learnt; Song is its map; Library his songs. */
type Tab = 'watch' | 'song' | 'library';
// The tabs are words, set like a poster's index: no icons.
const TABS: [Tab, string][] = [
  ['watch', 'Watch'],
  ['song', 'Song'],
  ['library', 'Library'],
];

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [tab, setTab] = useState<Tab>('watch');
  // The song being learnt: one at a time, Interstellar Experience first.
  const [current, setCurrent] = useState(currentSongId);
  const choose = (id: string) => { setCurrent(id); setCurrentSong(id); };
  const [openId, setOpenId] = useState<string | null>(null);
  const [lesson, setLesson] = useState<{ id: string; section: string; step?: string; n: number; only?: Section; back?: number } | null>(null);
  // Where the Watch feed starts: the reel to show when the tab opens (null: the next one not watched).
  const [watch, setWatch] = useState<{ start: number; n: number } | null>(null);
  // A song's Mastery: one section at a time, the next planned when it ends.
  const [mastery, setMastery] = useState<{ id: string; n: number; session: MasterySession } | null>(null);
  const [editing, setEditing] = useState<SongEntry | null>(null);
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
  // Practice reminders: rewritten when the setting changes and after practice (today's is skipped once the goal is met).
  useEffect(() => startWebReminders(), []);
  useEffect(() => {
    const go = () => scheduleReminders(settings.reminder ?? null, settings.dailyGoal);
    go();
    let t = 0;
    const off = onStats(() => { window.clearTimeout(t); t = window.setTimeout(go, 20_000); });
    return () => { off(); window.clearTimeout(t); };
  }, [settings.reminder, settings.dailyGoal]);

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
  // Opening a song shows its sheet music; Teach me opens a section's lesson on top of it.
  const openSheet = (info: SongInfo) => { unlockAudio(); ensureInput(); openSong(info); };

  // A phase's practice, from its videos or the Song page. Back from it: the phase's last video;
  // when it is done: the next phase's first video.
  const practise = (id: string, reel: Reel) => {
    const info = infos[id];
    if (!info?.song) return;
    const only = practiceFor(info, reel);
    if (!only) return;
    unlockAudio(); ensureInput();
    const clips = clipsOf(info.song);
    const last = clips.map(c => c.phase.id).lastIndexOf(reel.id);
    setLesson({ id, section: only.id, n: Date.now(), only, back: Math.max(0, last) });
  };
  const watchFrom = (i: number) => { unlockAudio(); setWatch({ start: i, n: Date.now() }); setTab('watch'); };
  // The song he is learning, and where its feed starts: the first reel he has not watched.
  const currentEntry = entries.find(e => e.id === current || e.slot === current);
  const currentInfo = currentEntry ? infos[currentEntry.id] : undefined;
  const currentReels = useMemo(() => (currentInfo?.song ? clipsOf(currentInfo.song) : []), [currentInfo?.song, infos]); // eslint-disable-line react-hooks/exhaustive-deps
  // The feed opens on the first video he has not watched.
  const feedStart = () => {
    if (watch) return Math.min(watch.start, currentReels.length - 1);
    const seen = currentInfo?.song ? seenReels(currentInfo.song.entry.id) : [];
    const i = currentReels.findIndex(r => !seen.includes(r.id));
    return Math.max(0, i);
  };
  // A phase from the Song page: its first video he has not watched (or its first).
  const phaseStart = (id: string, phase: number) => {
    const song = infos[id]?.song;
    if (!song) return 0;
    const clips = clipsOf(song), seen = seenReels(id);
    const mine = clips.map((c, i) => ({ c, i })).filter(x => x.c.n === phase + 1);
    return (mine.find(x => !seen.includes(x.c.id)) ?? mine[0])?.i ?? 0;
  };
  const journey = (
    <Journey
      songId={current} onChoose={choose}
      infos={infos} entries={entries} ready={ready}
      onWatch={(id, i) => watchFrom(phaseStart(id, i))}
      onPractice={(id, reel) => practise(id, reel)}
      onWholeSong={info => openSheet(info)}
      onBringMidi={slot => pickFile(slot)}
      onSongs={() => setTab('library')}
    />
  );

  const open = openId ? infos[openId] : undefined;
  const lessonInfo = lesson && infos[lesson.id];
  const lessonSections = lessonInfo?.course ? sectionsOf(lessonInfo) : [];
  const lessonSection = lesson?.only ?? lessonSections.find(sc => sc.id === lesson?.section);
  const nextSection = lessonSection && !lesson?.only ? lessonSections[lessonSections.indexOf(lessonSection) + 1] : undefined;
  const masteryInfo = mastery ? infos[mastery.id] : undefined;
  const masterySection = useMemo(() => mastery?.session.section, [mastery?.session]);

  return (
    <I18nContext.Provider value={i18n}>
      {mastery && masteryInfo?.song && masterySection?.steps.length ? (
        <Lesson
          key={`mastery-${mastery.id}-${mastery.n}`}
          info={masteryInfo} section={masterySection} session={mastery.session}
          settings={settings} update={update} links={links}
          minStars={0}
          onExit={() => setMastery(null)}
          onNextSection={() => { const s = infos[mastery.id]?.song; if (s) setMastery(m => m && { ...m, n: m.n + 1, session: new MasterySession(s) }); }}
          onRecorded={() => refreshSong(mastery.id)}
          onSettings={() => setSheet('settings')}
        />
      ) : lesson && lessonInfo?.song && lessonSection ? (
        <Lesson
          key={`${lesson.id}-${lesson.section}-${lesson.n}`}
          info={lessonInfo} section={lessonSection} startAt={lesson.step}
          settings={settings} update={update} links={links}
          onExit={() => { if (lesson.back !== undefined) { setWatch({ start: lesson.back, n: Date.now() }); setTab('watch'); } setLesson(null); }}
          exitLabel={lesson.back !== undefined ? 'Back to the videos' : undefined}
          nextLabel={lesson.back !== undefined ? 'Next phase' : undefined}
          onNextSection={lesson.back !== undefined ? () => { setWatch({ start: lesson.back! + 1, n: Date.now() }); setTab('watch'); setLesson(null); }
            : nextSection ? () => setLesson(l => l && { ...l, section: nextSection.id, step: undefined, n: l.n + 1 }) : undefined}
          onRecorded={() => refreshSong(lesson.id)}
          onSettings={() => setSheet('settings')}
        />
      ) : open?.song ? (
        <SongScreen
          key={open.entry.id}
          info={open} settings={settings} links={links}
          onExit={() => setOpenId(null)}
          onTeach={section => { unlockAudio(); ensureInput(); setLesson({ id: open.entry.id, section: section.id, n: 0 }); }}
          onMastery={() => { unlockAudio(); ensureInput(); setMastery({ id: open.entry.id, n: 0, session: new MasterySession(open.song!) }); }}
          onSettings={() => setSheet('settings')}
        />
      ) : (
        <div className="app">
          <nav className="rail" aria-label="Main">
            <Logo size={40} className="rail-logo" />
            {TABS.map(([id, label]) => (
              <button key={id} className={`rail-btn tab-${id} ${tab === id ? 'on' : ''}`} aria-current={tab === id ? 'page' : undefined}
                onClick={() => { if (id === 'watch' && tab === 'watch') setWatch(null); setTab(id); setOpenId(null); }}>
                {label}
              </button>
            ))}
            <button className="rail-btn settings" onClick={() => setSheet('settings')}>Settings</button>
          </nav>
          <main className={`content ${tab === 'watch' && currentInfo?.song && currentReels.length ? 'tab-watch' : ''}`}>
            {tab === 'watch' ? (
              currentInfo?.song && currentReels.length ? (
                <ReelFeed
                  key={`${currentInfo.entry.id}-${watch?.n ?? 0}`} embedded
                  song={currentInfo.song} reels={currentReels} start={feedStart()}
                  onClose={() => setTab('song')}
                  onPractice={reel => practise(currentInfo.entry.id, reel.phase)}
                />
              ) : journey
            ) : tab === 'song' ? journey : (
              <Songs infos={infos} entries={entries} ready={ready} current={current}
                onOpen={info => { choose(info.entry.slot ?? info.entry.id); addToLibrary(info.entry.slot ?? info.entry.id); setTab('song'); }}
                onAdd={slot => pickFile(slot)} onEdit={setEditing} />
            )}
          </main>
        </div>
      )}

      <input
        ref={fileRef} type="file" accept=".mid,.midi,audio/midi,audio/x-midi" hidden
        onChange={e => { const f = e.target.files?.[0]; if (f) setAdding({ file: f, slot: slotRef.current }); e.target.value = ''; }}
      />
      {editing && (
        <EditSong
          entry={editing}
          onClose={() => setEditing(null)}
          onSave={async (title, composer) => { await renameSong(editing, title, composer); setEditing(null); await refreshCatalog(); }}
          onDelete={async () => { await removeSong(editing); setEditing(null); await refreshCatalog(); }}
        />
      )}
      {adding && (
        <AddSong
          file={adding.file} slot={adding.slot}
          onClose={() => setAdding(null)}
          onDone={async entry => { setAdding(null); await refreshCatalog(); choose(entry.slot ?? entry.id); setWatch(null); setTab('watch'); setNotice({ text: `“${entry.title}” is ready: its videos start now.` }); }}
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
