import { useEffect, useMemo, useRef, useState } from 'react';
import { AddSong } from './components/AddSong';
import { Celebrate } from './components/Celebrate';
import { Paywall } from './components/Paywall';
import { countPractice, FREE_SONGS, isPremium, practicesLeft, type PaywallReason } from './lib/billing';
import { applyFreezes, onStats, sessionComplete, setGoalMinutes } from './lib/stats';
import { scheduleReminders, startWebReminders } from './lib/reminders';
import { Home } from './components/Home';
import { Learn, markSession } from './components/Learn';
import { IconCap, IconChart, IconGear, IconHome, IconMusic } from './components/Icons';
import { InputCheck } from './components/InputCheck';
import { Lesson } from './components/Lesson';
import { ProgressView } from './components/ProgressView';
import { SettingsSheet } from './components/SettingsSheet';
import { EditSong } from './components/EditSong';
import { SongScreen, sectionsOf } from './components/SongScreen';
import { Songs } from './components/Songs';
import { holdNote, loadPiano, releaseNote, unlockAudio } from './lib/audio';
import { refreshCatalog, refreshSong, useCatalog, type SongInfo } from './lib/catalog';
import type { CourseStep } from './lib/course';
import { I18nContext, makeT } from './lib/i18n';
import { lessonAfter, lessonPlayable, markPlacementTaken, pathChanged, placedUnits, placeUnit, UNITS, type Playable } from './lib/path';
import { connect, disconnectBle, disconnectMic, linkState, onLinkState, onNote, watchForMidi, type LinkState, type Source } from './lib/input';
import { loadSettings, removeSong, renameSong, saveSettings } from './lib/library';
import type { Settings, SongEntry } from './lib/types';

type Tab = 'home' | 'learn' | 'songs' | 'progress';
const TABS: [Tab, string, (p: { size?: number }) => React.ReactElement][] = [
  ['home', 'Home', IconHome],
  ['learn', 'Learn', IconCap],
  ['songs', 'Songs', IconMusic],
  ['progress', 'Progress', IconChart],
];

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [tab, setTab] = useState<Tab>('home');
  const [openId, setOpenId] = useState<string | null>(null);
  const [lesson, setLesson] = useState<{ id: string; section: string; step?: string; n: number } | null>(null);
  // A course lesson, a skill practice, or today's session (several pieces played one after the other).
  const [run, setRun] = useState<{ items: Playable[]; i: number; n: number; session: boolean; test?: boolean } | null>(null);
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
  useEffect(() => { saveSettings(settings); setGoalMinutes(settings.dailyGoal); }, [settings]);
  // A day missed since last time is covered by a streak freeze, if he has one.
  useEffect(() => { applyFreezes(); }, []);
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

  const [paywall, setPaywall] = useState<PaywallReason | null>(null);
  // Free plan: up to FREE_SONGS songs of your own (filling a built-in slot is always free).
  const pickFile = (slot?: SongEntry) => {
    if (!slot && !isPremium() && entries.filter(e => !e.builtIn).length >= FREE_SONGS) { setPaywall('songs'); return; }
    slotRef.current = slot; fileRef.current?.click();
  };
  // Free plan: a few skill practices a day.
  const practise = (p: Playable) => {
    if (practicesLeft() <= 0) { setPaywall('practice'); return; }
    countPractice();
    play([p], 0, false);
  };
  const openSong = (info: SongInfo) => {
    if (info.entry.missing) { pickFile(info.entry); return; }
    if (info.error || !info.song) { setNotice({ text: i18n.t(info.entry.builtIn ? 'err.loadFailed' : 'err.missing'), error: true }); return; }
    setOpenId(info.entry.id);
  };
  // Opening a song shows its sheet music; Teach me opens a section's lesson on top of it.
  const openSheet = (info: SongInfo) => { unlockAudio(); ensureInput(); openSong(info); };
  const startStep = (info: SongInfo, step: CourseStep) => {
    unlockAudio();
    ensureInput();
    const section = sectionsOf(info).find(sc => sc.steps.some(st => st.id === step.id));
    setOpenId(info.entry.id);
    if (section) setLesson({ id: info.entry.id, section: section.id, step: step.id, n: 0 });
  };

  const play = (items: Playable[], from: number, session: boolean) => { unlockAudio(); ensureInput(); setRun({ items, i: from, n: 0, session }); };
  // A test: the placement test (every unit in turn) or one unit's test-out. Each pass skips that unit.
  const takeTest = (items: Playable[]) => { unlockAudio(); ensureInput(); setRun({ items, i: 0, n: 0, session: false, test: true }); };
  const endTest = (passedThrough: number) => {
    markPlacementTaken();
    setRun(null);
    const at = UNITS.findIndex(u => !placedUnits().includes(u.id));
    setTab('learn');
    setNotice({ text: passedThrough > 0 ? (at < 0 ? 'You passed every unit test.' : `You start at Unit ${at + 1}: ${UNITS[at].title}.`) : 'You start at the beginning: Unit 1.' });
  };
  const runItem = run?.items[run.i];
  // A course lesson leads on to the next one on the path (a skill practice leads nowhere).
  const afterRun = run && !run.session && !run.test && runItem?.id && !runItem.id.startsWith('skill-') ? lessonAfter(runItem.id) : undefined;

  const open = openId ? infos[openId] : undefined;
  const lessonInfo = lesson && infos[lesson.id];
  const lessonSections = lessonInfo?.course ? sectionsOf(lessonInfo) : [];
  const lessonSection = lessonSections.find(sc => sc.id === lesson?.section);
  const nextSection = lessonSection && lessonSections[lessonSections.indexOf(lessonSection) + 1];

  return (
    <I18nContext.Provider value={i18n}>
      {run?.test && runItem ? (
        <Lesson
          key={`${runItem.id}-${run.i}-${run.n}`}
          info={runItem.info} section={runItem.section}
          settings={settings} update={update} links={links}
          minStars={2}
          exitLabel="Stop the test"
          nextLabel={run.i < run.items.length - 1 ? `Passed! Next: ${run.items[run.i + 1].title}` : 'Passed! Finish the test'}
          stopLabel="Finish the test here"
          onExit={() => endTest(run.i)}
          onStop={() => endTest(run.i)}
          onNextSection={() => {
            placeUnit(runItem.id.replace('test-', ''));
            if (run.i < run.items.length - 1) setRun({ ...run, i: run.i + 1, n: run.n + 1 });
            else endTest(run.i + 1);
          }}
          onRecorded={() => pathChanged()}
          onSettings={() => setSheet('settings')}
        />
      ) : run && runItem ? (
        <Lesson
          key={`${runItem.id}-${run.i}-${run.n}`}
          info={runItem.info} section={runItem.section}
          settings={settings} update={update} links={links}
          exitLabel={run.session ? 'Back to today’s session' : 'Back to the course'}
          nextLabel={run.session ? (run.i < run.items.length - 1 ? `Next: ${run.items[run.i + 1].title}` : 'Finish today’s session') : `Next lesson: ${afterRun?.title}`}
          onExit={() => { setRun(null); pathChanged(); }}
          onNextSection={run.session || afterRun ? () => {
            if (run.session) markSession(run.i + 1);
            if (run.session && run.i === run.items.length - 1) sessionComplete();
            pathChanged();
            if (run.session && run.i < run.items.length - 1) setRun({ ...run, i: run.i + 1, n: run.n + 1 });
            else if (!run.session && afterRun) setRun({ items: [lessonPlayable(afterRun)], i: 0, n: run.n + 1, session: false });
            else setRun(null);
          } : undefined}
          onRecorded={() => pathChanged()}
          onSettings={() => setSheet('settings')}
        />
      ) : lesson && lessonInfo?.song && lessonSection ? (
        <Lesson
          key={`${lesson.id}-${lesson.section}-${lesson.n}`}
          info={lessonInfo} section={lessonSection} startAt={lesson.step}
          settings={settings} update={update} links={links}
          onExit={() => setLesson(null)}
          onNextSection={nextSection ? () => setLesson(l => l && { ...l, section: nextSection.id, step: undefined, n: l.n + 1 }) : undefined}
          onRecorded={() => refreshSong(lesson.id)}
          onSettings={() => setSheet('settings')}
        />
      ) : open?.song ? (
        <SongScreen
          key={open.entry.id}
          info={open} settings={settings} links={links}
          onExit={() => setOpenId(null)}
          onTeach={section => { unlockAudio(); ensureInput(); setLesson({ id: open.entry.id, section: section.id, n: 0 }); }}
          onSettings={() => setSheet('settings')}
        />
      ) : (
        <div className="app">
          <nav className="rail" aria-label="Main">
            <img className="rail-logo" src="/icons/icon.svg" alt="Hugo's Piano" width={36} height={36} />
            {TABS.map(([id, label, Icon]) => (
              <button key={id} className={`rail-btn ${tab === id ? 'on' : ''}`} aria-current={tab === id ? 'page' : undefined}
                onClick={() => { setTab(id); setOpenId(null); }}>
                <Icon size={22} /><span>{label}</span>
              </button>
            ))}
            <button className="rail-btn settings" onClick={() => setSheet('settings')}><IconGear size={22} /><span>Settings</span></button>
          </nav>
          <main className="content">
            {tab === 'home' ? (
              <Home
                settings={settings} ready={ready} entries={entries} infos={infos} links={links}
                onSetup={kind => { update({ input: kind, setupDone: true }); connectInput(kind); }}
                onSkipSetup={() => update({ setupDone: true })}
                onOpen={openSheet}
                onPlay={startStep}
                onBrowse={() => setTab('songs')}
                onSession={(items, from) => play(items, from, true)}
              />
            ) : tab === 'learn' ? (
              <Learn settings={settings} onPlay={play} onTest={takeTest} onPaywall={setPaywall} />
            ) : tab === 'songs' ? (
              <Songs infos={infos} entries={entries} ready={ready} onOpen={openSheet} onAdd={() => pickFile()} onEdit={setEditing} />
            ) : (
              <ProgressView settings={settings} update={update} entries={entries} infos={infos} onPractice={practise} />
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
          onDone={async entry => { setAdding(null); await refreshCatalog(); setTab('songs'); setNotice({ text: `“${entry.title}” is ready: open it to play or learn it.` }); }}
        />
      )}
      {sheet === 'settings' && (
        <SettingsSheet settings={settings} update={update} links={links} connectInput={connectInput} onCheck={() => setSheet('check')} onClose={() => setSheet(null)} onPlan={() => { setSheet(null); setPaywall('upgrade'); }} />
      )}
      {sheet === 'check' && <InputCheck links={links} naming={settings.naming} onClose={() => setSheet('settings')} />}
      <Celebrate />
      {paywall && <Paywall reason={paywall} onClose={() => setPaywall(null)} onDone={text => { setPaywall(null); pathChanged(); setNotice({ text }); }} />}
      {notice && <div className={`toast ${notice.error ? 'error' : ''}`} role="status">{notice.text}</div>}
    </I18nContext.Provider>
  );
}
