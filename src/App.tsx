import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { L, notePrefs, setLang, setVideoPrefs } from './lib/lang';
import { AddSong } from './components/AddSong';
import { onStats } from './lib/stats';
import { scheduleReminders, startWebReminders } from './lib/reminders';
import { currentSongId, FIRST_SONG, Journey, practiceFor, setCurrentSong } from './components/Journey';
import { ReelFeed } from './components/Reels';
import { ContinueCard, lastReel, rememberReel } from './components/HomePage';
import { clipsOf, listenClip, listenSongClip, seenReels, type Clip, type Reel } from './lib/reels';
import { InputCheck } from './components/InputCheck';
import { Lesson } from './components/Lesson';
import type { CourseStep } from './lib/course';
import { SettingsSheet } from './components/SettingsSheet';
import { PianoStep, pianoAsked } from './components/PianoStep';
import { EditSong } from './components/EditSong';
import { Intro, introDue } from './components/Intro';
import { SongScreen, sectionsOf, type Section } from './components/SongScreen';
import { Songs } from './components/Songs';
import { IconHome, IconHomeFill, IconArrowLeft, IconReel, IconTabLibrary, IconTabLibraryFill, IconTabSettings, IconTabSong, IconTabSongFill, IconTabWatch } from './components/Icons';
import { holdNote, loadPiano, releaseNote, unlockAudio } from './lib/audio';
import { refreshCatalog, refreshSong, useCatalog, type SongInfo } from './lib/catalog';
import { I18nContext, makeT } from './lib/i18n';
import { MasterySession } from './lib/mastery';
import { connect, disconnectBle, disconnectMic, linkState, onLinkState, onNote, watchForMidi, type LinkState, type Source } from './lib/input';
import { addToLibrary, hideSong, loadSettings, removeSong, renameSong, saveSettings, unhideSong } from './lib/library';
import type { Settings, SongEntry } from './lib/types';

/** Watch is the reel feed of the song being learnt; Song is its map; Library his songs. */
type Tab = 'home' | 'watch' | 'song' | 'library';
// The tab bar along the bottom, like an app's: a Phosphor mark over a short word, filled for the tab he is on.
// Three destinations (the 2026-11 audit, the user's yes): the song, his songs, and Settings (the gear
// at the end). The videos open from the song: its Continue card, its sections, its path.
const TABS: [Tab, () => string][] = [
  ['song', () => L('Song', 'Música')],
  ['library', () => L('Library', 'Biblioteca')],
];
const tabIcon = (id: Tab, on: boolean) =>
  id === 'home' ? (on ? <IconHomeFill /> : <IconHome />)
  : id === 'watch' ? (on ? <IconReel /> : <IconTabWatch />)
    : id === 'song' ? (on ? <IconTabSongFill /> : <IconTabSong />)
      : on ? <IconTabLibraryFill /> : <IconTabLibrary />;

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [tab, setTab] = useState<Tab>('song');
  // The song being learnt: one at a time, Interstellar Experience first.
  const [current, setCurrent] = useState(currentSongId);
  const [intro, setIntro] = useState(introDue);
  const choose = (id: string) => { setCurrent(id); setCurrentSong(id); };
  const [openId, setOpenId] = useState<string | null>(null);
  const [lesson, setLesson] = useState<{ id: string; section: string; step?: string; n: number; only?: Section; back?: number } | null>(null);
  // Where the Watch feed starts: the reel to show when the tab opens (null: the next one not watched).
  const [watch, setWatch] = useState<{ start: number; n: number } | null>(null);
  // A song's Mastery: one section at a time, the next planned when it ends.
  const [mastery, setMastery] = useState<{ id: string; n: number; session: MasterySession } | null>(null);
  const [editing, setEditing] = useState<SongEntry | null>(null);
  const [sheet, setSheet] = useState<'settings' | 'check' | null>(null);
  // On Watch the videos take the whole screen: the tabs hide behind a menu button and slide in.
  const [adding, setAdding] = useState<{ file: File; slot?: SongEntry } | null>(null);
  const [links, setLinks] = useState<Record<Source, LinkState>>(linkState);
  // The piano, asked once before the first videos (PianoStep.tsx): what to do after it.
  const [pianoNext, setPianoNext] = useState<(() => void) | null>(null);
  // A section played through with the hands (Hear on the Song tab): one video on its own.
  const [hearing, setHearing] = useState<Clip | null>(null);
  // The whole song watched from its own screen: that song (maybe not the one being learnt), and back to that screen.
  const [hearInfo, setHearInfo] = useState<SongInfo | null>(null);
  useEffect(() => { if (tab !== 'watch') { setHearing(null); setHearInfo(null); } }, [tab]);
  const back = () => { if (hearInfo) setOpenId(hearInfo.entry.id); setTab('song'); };
  /** Runs fn now, or after the piano step when it is due; true when it waits for the step. */
  const viaPiano = (fn: () => void) => {
    if (!pianoAsked() && !Object.values(linkState()).some(l => l.status === 'on')) { setPianoNext(() => fn); return true; }
    fn();
    return false;
  };
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const prevMidi = useRef(links.midi.status);
  const fileRef = useRef<HTMLInputElement>(null);
  const slotRef = useRef<SongEntry | undefined>(undefined);
  const { ready, entries, infos } = useCatalog();

  useEffect(() => onLinkState(setLinks), []);
  // The piano's sound loads as soon as the app opens: the first video he lands on (often not the
  // first of a phase) must not start before it (it played silent, the user's complaint 2026-11).
  useEffect(() => { loadPiano().catch(() => {}); }, []);
  // The teaching hands ready before the first video (the user found them slow to come): their code
  // and model are fetched once the page is idle, so the video only puts them on.
  useEffect(() => {
    const go = () => { import('./components/Hands3D').catch(() => {}); fetch(`${import.meta.env.BASE_URL}models/hand/hand.glb`).catch(() => {}); };
    const w = window as unknown as { requestIdleCallback?: (f: () => void) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(go); else window.setTimeout(go, 1500);
  }, []);
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
  // The language and the videos' settings are read by everything below; set them before it renders.
  setLang(settings.lang);
  notePrefs.solfege = settings.naming === 'solfege';
  setVideoPrefs({ pace: settings.videoPace ?? 1, wait: settings.videoWait ?? true });
  // The courses' step names are written in the language: written again when it changes.
  const langSeen = useRef(settings.lang);
  useEffect(() => { if (langSeen.current !== settings.lang) { langSeen.current = settings.lang; refreshCatalog(); } }, [settings.lang]);
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

  // Tapping the piano that is on turns it off.
  const disconnectInput = (kind: Source) => {
    if (kind === 'mic') disconnectMic();
    if (kind === 'ble') disconnectBle();
    update({ input: 'none' });
  };
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
  const watchFrom = (i: number) => { unlockAudio(); viaPiano(() => { setWatch({ start: i, n: Date.now() }); setTab('watch'); }); };
  // The song he is learning, and where its feed starts: the first reel he has not watched.
  const currentEntry = entries.find(e => e.id === current || e.slot === current);
  const currentInfo = currentEntry ? infos[currentEntry.id] : undefined;
  const currentReels = useMemo(() => (currentInfo?.song ? clipsOf(currentInfo.song) : []), [currentInfo?.song, infos]); // eslint-disable-line react-hooks/exhaustive-deps
  // The feed opens on the first video he has not watched.
  const feedStart = () => {
    if (watch) return Math.min(watch.start, currentReels.length - 1);
    // Where he was last, if that video still exists; else the first he has not watched.
    const last = currentInfo?.song ? lastReel(currentInfo.song.entry.id) : null;
    const k = last ? currentReels.findIndex(r => r.id === last) : -1;
    if (k >= 0) return k;
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
      onHear={r => { const song = currentInfo?.song; const c = song && listenClip(song, r); if (c) { unlockAudio(); setHearing(c); setTab('watch'); } }}
      onHearSong={() => { const song = currentInfo?.song; const c = song && listenSongClip(song); if (c) { unlockAudio(); setHearing(c); setTab('watch'); } }}
      resume={currentInfo?.song && currentReels.length && currentEntry && (currentEntry.id === current || currentEntry.slot === current) ? (
        <ContinueCard song={currentInfo.song} clip={currentReels[feedStart()]} onContinue={() => { unlockAudio(); viaPiano(() => { setWatch(null); setTab('watch'); }); }} />
      ) : undefined}
    />
  );

  const open = openId ? infos[openId] : undefined;
  const lessonInfo = lesson && infos[lesson.id];
  const lessonSections = lessonInfo?.course ? sectionsOf(lessonInfo) : [];
  const lessonSection = lesson?.only ?? lessonSections.find(sc => sc.id === lesson?.section);
  const nextSection = lessonSection && !lesson?.only ? lessonSections[lessonSections.indexOf(lessonSection) + 1] : undefined;
  const masteryInfo = mastery ? infos[mastery.id] : undefined;
  const masterySection = useMemo(() => mastery?.session.section, [mastery?.session]);

  const watching = tab === 'watch' && !!currentInfo?.song && currentReels.length > 0;
  const go = (id: Tab) => { if (id === 'watch' && tab === 'watch') setWatch(null); setTab(id); setOpenId(null); };
  const nav = (
    <nav className="rail" aria-label={L('Main', 'Principal')}>
      {TABS.map(([id, label]) => (
        <button key={id} className={`rail-btn tab-${id} ${tab === id ? 'on' : ''}`} aria-current={tab === id ? 'page' : undefined} onClick={() => go(id)}>
          {tabIcon(id, tab === id)}<span>{label()}</span>
        </button>
      ))}
      <button className="rail-btn settings" onClick={() => setSheet('settings')}><IconTabSettings /><span>{L('Settings', 'Definições')}</span></button>
    </nav>
  );

  return (
    <I18nContext.Provider value={i18n}>
      {/* A new language writes every screen again. */}
      <Fragment key={settings.lang}>
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
          exitLabel={lesson.back !== undefined ? L('Back to the videos', 'Voltar aos vídeos') : undefined}
          nextLabel={lesson.back !== undefined ? L('Next phase', 'Fase seguinte') : undefined}
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
          onWatch={() => { const c = listenSongClip(open.song!); if (c) { unlockAudio(); setHearInfo(open); setHearing(c); setOpenId(null); setTab('watch'); } }}
          onMastery={() => { unlockAudio(); ensureInput(); setMastery({ id: open.entry.id, n: 0, session: new MasterySession(open.song!) }); }}
          onSettings={() => setSheet('settings')}
        />
      ) : (
        <div className={`app ${watching ? 'watching' : ''}`}>
          {!watching && nav}
          {watching && (
            // Back to the song, always there (the 2026-11 audit): the videos open from it.
            <button className="nav-toggle back" onClick={back} aria-label={L('Back to the song', 'Voltar à música')}><IconArrowLeft size={24} /></button>
          )}
          <main className={`content ${watching ? 'tab-watch' : ''}`}>
            {tab === 'watch' ? (
              hearing && hearInfo?.song ? (
                <ReelFeed key={`${hearInfo.entry.id}-${hearing.id}`} embedded song={hearInfo.song} reels={[hearing]} start={0}
                  onClose={back} onPiano={() => setSheet('settings')} onPractice={() => {}} />
              ) : currentInfo?.song && currentReels.length ? (
                <ReelFeed
                  key={`${currentInfo.entry.id}-${hearing?.id ?? watch?.n ?? 0}`} embedded
                  song={currentInfo.song} reels={hearing ? [hearing] : currentReels} start={hearing ? 0 : feedStart()}
                  onClose={() => setTab('song')}
                  onPractice={reel => practise(currentInfo.entry.id, reel.phase)}
                  onPiano={() => setSheet('settings')}
                  onSpeed={v => { setVideoPrefs({ pace: v }); update({ videoPace: v }); }}
                  practice={(clip, done) => {
                    // The staff item of the course: the bars the video just taught, free play with
                    // both hands (or the only hand), on the lesson page; a pass moves the feed on.
                    const song = currentInfo.song!;
                    const step: CourseStep = { id: clip.stepId ?? `read-${clip.from}-${clip.to}`, kind: 'phrase', title: L(`On the staff, ${clip.where}`, `Na pauta, ${clip.where}`), short: 'R+L', from: clip.from, to: clip.to, hands: song.hands.length === 2 ? 'both' : song.hands[0], speed: 0.8, wait: true };
                    const section: Section = { id: step.id, title: `${clip.phase.section}: ${L('on the staff', 'na pauta')}`, bars: clip.where, from: clip.from, steps: [step], done: 0, learnt: false };
                    return (
                      <Lesson info={currentInfo} section={section} settings={settings} update={update} links={links}
                        onExit={() => setTab('song')} exitLabel={L('Back to the song', 'Voltar à música')}
                        onFinish={done} onRecorded={() => refreshSong(currentInfo.entry.id)} onSettings={() => setSheet('settings')} />
                    );
                  }}
                  onActive={(_, c) => { if (c.kind !== 'fix' && !hearing) rememberReel(currentInfo.entry.id, c.id); }}
                />
              ) : journey
            ) : tab === 'song' ? journey : (
              <Songs infos={infos} entries={entries} ready={ready} current={current}
                onOpen={info => { choose(info.entry.slot ?? info.entry.id); addToLibrary(info.entry.slot ?? info.entry.id); unhideSong(info.entry.id); setTab('song'); }}
                onAdd={slot => pickFile(slot)} onEdit={setEditing} />
            )}
          </main>
        </div>
      )}

      <input
        ref={fileRef} type="file" accept=".mid,.midi,audio/midi,audio/x-midi,.pdf,application/pdf" hidden
        onChange={e => { const f = e.target.files?.[0]; if (f) setAdding({ file: f, slot: slotRef.current }); e.target.value = ''; }}
      />
      {editing && (
        <EditSong
          entry={editing} song={infos[editing.id]?.song}
          onClose={() => setEditing(null)}
          onSave={async (title, composer) => { await renameSong(editing, title, composer); setEditing(null); await refreshCatalog(); }}
          onDelete={async () => {
            // A piece the app ships is hidden; a file he brought is deleted. The song being learnt
            // gives way to the first one.
            const id = editing.slot ?? editing.id;
            if (editing.builtIn && !editing.slot) hideSong(editing.id); else await removeSong(editing);
            setEditing(null);
            if (current === id || current === editing.id) choose(FIRST_SONG);
            await refreshCatalog();
          }}
        />
      )}
      {adding && (
        <AddSong
          file={adding.file} slot={adding.slot}
          onClose={() => setAdding(null)}
          onPickAgain={() => { const slot = adding.slot; setAdding(null); window.setTimeout(() => pickFile(slot), 0); }}
          onDone={async entry => { setAdding(null); await refreshCatalog(); choose(entry.slot ?? entry.id); const waits = viaPiano(() => { setWatch(null); setTab('watch'); }); setNotice({ text: waits ? L(`“${entry.title}” is ready.`, `“${entry.title}” está pronta.`) : L(`“${entry.title}” is ready: its videos start now.`, `“${entry.title}” está pronta: os vídeos começam agora.`) }); }}
        />
      )}
      {pianoNext && (
        <PianoStep settings={settings} update={update} links={links} connectInput={connectInput} disconnectInput={disconnectInput}
          onCheck={() => setSheet('check')} onDone={() => { const fn = pianoNext; setPianoNext(null); fn(); }} />
      )}
      {sheet === 'settings' && (
        <SettingsSheet settings={settings} update={update} links={links} connectInput={connectInput} disconnectInput={disconnectInput} onCheck={() => setSheet('check')} onClose={() => setSheet(null)} />
      )}
      {sheet === 'check' && <InputCheck links={links} naming={settings.naming} onClose={() => setSheet(pianoNext ? null : 'settings')} />}
      {notice && <div className={`toast ${notice.error ? 'error' : ''}`} role="status">{notice.text}</div>}
      {intro && <Intro onDone={() => setIntro(false)} />}
      </Fragment>
    </I18nContext.Provider>
  );
}
