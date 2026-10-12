import { useEffect, useMemo, useRef, useState } from 'react';
import { AddSong } from './components/AddSong';
import { Celebrate } from './components/Celebrate';
import { Paywall } from './components/Paywall';
import { type PaywallReason } from './lib/billing';
import { applyFreezes, onStats, setGoalMinutes } from './lib/stats';
import { scheduleReminders, startWebReminders } from './lib/reminders';
import { PathHome, colorOf } from './components/PathHome';
import { EnergySheet, Shop } from './components/Economy';
import { TheoryLesson } from './components/TheoryLesson';
import { Gem } from './components/GameIcons';
import { IconGear, IconHome, IconMusic } from './components/Icons';
import { InputCheck } from './components/InputCheck';
import { Lesson } from './components/Lesson';
import { SettingsSheet } from './components/SettingsSheet';
import { EditSong } from './components/EditSong';
import { SongScreen, sectionsOf } from './components/SongScreen';
import { Songs } from './components/Songs';
import { holdNote, loadPiano, releaseNote, unlockAudio } from './lib/audio';
import { refreshCatalog, refreshSong, useCatalog, type SongInfo } from './lib/catalog';
import { I18nContext, makeT } from './lib/i18n';
import { finishTheory, markPlacementTaken, nodePlayable, pathChanged, placedUnits, placeUnit, UNITS, type Playable } from './lib/path';
import type { PathNode, Unit } from './lib/curriculum';
import type { CourseProgress } from './lib/course';
import { energy } from './lib/energy';
import { connect, disconnectBle, disconnectMic, linkState, onLinkState, onNote, watchForMidi, type LinkState, type Source } from './lib/input';
import { loadSettings, removeSong, renameSong, saveSettings } from './lib/library';
import type { Settings, SongEntry } from './lib/types';

type Tab = 'home' | 'songs' | 'shop';
const TABS: [Tab, string, (p: { size?: number }) => React.ReactElement][] = [
  ['home', 'Learn', IconHome],
  ['songs', 'Songs', IconMusic],
  ['shop', 'Shop', p => <Gem size={p.size} />],
];

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [tab, setTab] = useState<Tab>('home');
  const [openId, setOpenId] = useState<string | null>(null);
  const [lesson, setLesson] = useState<{ id: string; section: string; step?: string; n: number } | null>(null);
  // A course lesson, a skill practice, or today's session (several pieces played one after the other).
  const [run, setRun] = useState<{ items: Playable[]; i: number; n: number; session: boolean; test?: boolean; path?: boolean } | null>(null);
  const [theory, setTheory] = useState<{ node: PathNode; unit: Unit } | null>(null);
  const [energySheet, setEnergySheet] = useState<'info' | 'empty' | null>(null);
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
  const pickFile = (slot?: SongEntry) => { slotRef.current = slot; fileRef.current?.click(); };
  const openSong = (info: SongInfo) => {
    if (info.entry.missing) { pickFile(info.entry); return; }
    if (info.error || !info.song) { setNotice({ text: i18n.t(info.entry.builtIn ? 'err.loadFailed' : 'err.missing'), error: true }); return; }
    setOpenId(info.entry.id);
  };
  // Opening a song shows its sheet music; Teach me opens a section's lesson on top of it.
  const openSheet = (info: SongInfo) => { unlockAudio(); ensureInput(); openSong(info); };

  // A node on the path: theory opens its cards, the trophy is the unit test, the rest are lessons
  // (each step costs energy, so he needs some to start).
  const playNode = (node: PathNode, unit: Unit, prog?: CourseProgress) => {
    if (node.kind === 'theory') { setTheory({ node, unit }); return; }
    const p = nodePlayable(node, prog);
    if (!p) return;
    if (node.kind === 'trophy') { takeTest([p]); return; }
    if (energy() < 1) { setEnergySheet('empty'); return; }
    unlockAudio(); ensureInput();
    setRun({ items: [p], i: 0, n: 0, session: false, path: true });
  };
  // A test: the placement test (every unit in turn) or one unit's test-out. Each pass skips that unit.
  const takeTest = (items: Playable[]) => { unlockAudio(); ensureInput(); setRun({ items, i: 0, n: 0, session: false, test: true }); };
  const endTest = (passedThrough: number) => {
    markPlacementTaken();
    setRun(null);
    const at = UNITS.findIndex(u => !placedUnits().includes(u.id));
    setTab('home');
    pathChanged();
    setNotice({ text: passedThrough > 0 ? (at < 0 ? 'You passed every unit test.' : `You start at Unit ${at + 1}: ${UNITS[at].title}.`) : 'You start at the beginning: Unit 1.' });
  };
  const runItem = run?.items[run.i];

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
            placeUnit(runItem.id.replace(/-test$/, ''));
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
          energyMode={run.path ? 'spend' : 'earn'}
          onPremium={() => setPaywall('energy')}
          exitLabel={run.session ? 'Back to today’s session' : run.path ? 'Back to the path' : 'Back to practice'}
          nextLabel={run.session ? (run.i < run.items.length - 1 ? `Next: ${run.items[run.i + 1].title}` : 'Finish today’s session') : 'Continue'}
          onExit={() => { setRun(null); pathChanged(); }}
          onNextSection={() => {
            pathChanged();
            if (run.session && run.i < run.items.length - 1) setRun({ ...run, i: run.i + 1, n: run.n + 1 });
            else setRun(null);
          }}
          onRecorded={() => pathChanged()}
          onSettings={() => setSheet('settings')}
        />
      ) : theory ? (
        <TheoryLesson
          key={theory.node.id}
          node={theory.node} color={colorOf(theory.unit)} naming={settings.naming}
          onExit={() => setTheory(null)}
          onDone={() => { finishTheory(theory.node); setTheory(null); }}
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
            <img className="rail-logo" src="/icons/logo.png" alt="Hugo’s Piano" width={40} height={40} />
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
              <PathHome
                settings={settings} links={links}
                onPiano={() => setSheet('settings')}
                onNode={playNode}
                onTest={items => takeTest(items)}
                onEnergy={() => setEnergySheet('info')}
                onShop={() => setTab('shop')}
                onPremium={() => setPaywall('upgrade')}
              />
            ) : tab === 'shop' ? (
              <Shop onPremium={() => setPaywall('upgrade')} />
            ) : tab === 'songs' ? (
              <Songs infos={infos} entries={entries} ready={ready} onOpen={openSheet} onAdd={slot => pickFile(slot)} onEdit={setEditing} />
            ) : null}
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
      {energySheet && (
        <EnergySheet
          empty={energySheet === 'empty'}
          onClose={() => setEnergySheet(null)}
          onPremium={() => { setEnergySheet(null); setPaywall('energy'); }}
        />
      )}
      <Celebrate />
      {paywall && <Paywall reason={paywall} onClose={() => setPaywall(null)} onDone={text => { setPaywall(null); pathChanged(); setNotice({ text }); }} />}
      {notice && <div className={`toast ${notice.error ? 'error' : ''}`} role="status">{notice.text}</div>}
    </I18nContext.Provider>
  );
}
