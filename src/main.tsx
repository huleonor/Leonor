import { StrictMode } from 'react';
import { MotionConfig } from 'motion/react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
);

// Dev bench for the microphone detector: window.__runPitch() in the console.
if (import.meta.env.DEV) {
  (window as unknown as { __runPitch: unknown }).__runPitch = async (tuning?: object) =>
    (await import('./dev/pitchTest')).runPitchTest(tuning);
}

// The prediction model's report card: window.__predict() in the console.
if (import.meta.env.DEV) {
  (window as unknown as { __predict: unknown }).__predict = async () => {
    const { calibration } = await import('./lib/predict');
    const { memoryReport } = await import('./lib/mastery');
    const c = calibration();
    console.table(c.buckets);
    return { ...c, memory: memoryReport('gymnopedie-1') };
  };
}

// What each reel shows, bar by bar, to write its script from: await window.__reelFacts('song-id').
if (import.meta.env.DEV) {
  // The hands' quality check on the video on screen: await window.__handCheck(20).
  (window as unknown as { __handCheck: unknown }).__handCheck = async (s?: number) => (await import('./lib/handCheck')).handCheck(s);
  (window as unknown as { __handFrames: unknown }).__handFrames = async () => (await import('./lib/handCheck')).probe.last;
  // How playable the automatic fingering is: await window.__fingerCheck('song-id').
  (window as unknown as { __fingerCheck: unknown }).__fingerCheck = async (id: string) => {
    const { listSongs, loadSong } = await import('./lib/library');
    const { fingerReport } = await import('./lib/fingering');
    const entry = (await listSongs()).find(e => e.id === id || e.slot === id);
    if (!entry) return `No song ${id}`;
    return fingerReport((await loadSong(entry)).notes);
  };
  (window as unknown as { __reelFacts: unknown }).__reelFacts = async (id: string) => {
    const { listSongs, loadSong } = await import('./lib/library');
    const { reelFacts } = await import('./lib/reels');
    const { readSong } = await import('./lib/reading');
    const entry = (await listSongs()).find(e => e.id === id || e.slot === id);
    if (!entry) return `No song ${id}`;
    const song = await loadSong(entry);
    return { version: readSong(song).version, score: readSong(song).text, reels: reelFacts(song) };
  };
  // How hard each video's music is and how slow it goes: await window.__reelDifficulty('song-id').
  (window as unknown as { __reelDifficulty: unknown }).__reelDifficulty = async (id: string) => {
    const { listSongs, loadSong } = await import('./lib/library');
    const { clipsOf, timelineOf } = await import('./lib/reels');
    const entry = (await listSongs()).find(e => e.id === id || e.slot === id);
    if (!entry) return `No song ${id}`;
    const song = await loadSong(entry);
    return clipsOf(song).map(c => {
      const sg = c.segments[0];
      const tl = timelineOf(song, c);
      return { phase: c.n, k: c.k, kind: c.kind, bars: `${c.from}-${c.to}`, d: Math.round((c.difficulty ?? 0) * 100) / 100, speed: sg.speed, rounds: tl.countIns?.length ?? 0, secs: Math.round(tl.duration), head: c.head };
    });
  };
  // Every piece of voice the videos of the songs in his library need, for scripts/voice-bank.mjs:
  // copy(JSON.stringify(await window.__voiceKeys())) and save it as a file. A song of the app's own
  // (public domain) is recorded line by line; a song he brought (a slot) only as sentences without
  // note names and as pieces, so nothing of his file is recorded.
  (window as unknown as { __voiceKeys: unknown }).__voiceKeys = async () => {
    const { listSongs, loadSong } = await import('./lib/library');
    const { clipsOf, explainLines, timelineOf } = await import('./lib/reels');
    const { L, lang, notePrefs, NT, setLang } = await import('./lib/lang');
    const { SCRIPTS } = await import('./lib/reelScripts');
    const { SCRIPTS_PT } = await import('./lib/reelScriptsPt');
    const { allItems, naturalText, sentences, splitSentence } = await import('./lib/voicePieces');
    // Every language, and in Portuguese both ways of naming the notes: [key, text for the voice, language].
    const was = { lang: lang(), solfege: notePrefs.solfege };
    const out = new Map<string, [string, string, 'en' | 'pt']>();
    const songs = [];
    for (const entry of await listSongs()) { try { const song = await loadSong(entry); if (song) songs.push({ entry, song }); } catch { /* not loaded */ } }
    for (const [l, solfege] of [['en', false], ['pt', true], ['pt', false]] as const) {
      setLang(l); notePrefs.solfege = solfege;
      const add = (k: string) => { if (!out.has(k)) out.set(k, [k, naturalText(k, l), l]); };
      allItems(l).forEach(add);
      // The explanation's fixed lines, and the sentences its videos are made of.
      [...explainLines(), L('Left hand.', 'Mão esquerda.'), L('Right hand.', 'Mão direita.'), L('Now both hands, slowly.', 'Agora as duas mãos, devagar.')].forEach(add);
      for (const { entry, song } of songs) {
        // Hand-written lines are recorded whole; for a song he brought, others only as note-free sentences and pieces.
        // Only lines written by hand (never the rules' lines with his notes in them).
        const handWritten = (l === 'pt' ? Object.values(SCRIPTS_PT).flat().map(p => p.talk) : Object.values(SCRIPTS).flatMap(sc => sc.phases.map(p => p.talk)))
          .flatMap(t => (t ? Object.values(t).filter((x): x is string => !!x) : [])).map(NT);
        const talk = new Set(handWritten);
        for (const clip of clipsOf(song)) for (const { text } of timelineOf(song, clip).lines) {
          const pieces = sentences(text).map(splitSentence);
          if (!entry.slot || talk.has(text) || pieces.every(p => p.length === 1)) { add(text); continue; }
          sentences(text).forEach((x, i) => (pieces[i].length === 1 ? add(x) : pieces[i].forEach(add)));
        }
      }
    }
    setLang(was.lang); notePrefs.solfege = was.solfege;
    return [...out.values()];
  };
}
