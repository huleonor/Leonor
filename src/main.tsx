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
  (window as unknown as { __reelFacts: unknown }).__reelFacts = async (id: string) => {
    const { listSongs, loadSong } = await import('./lib/library');
    const { reelFacts } = await import('./lib/reels');
    const { readSong } = await import('./lib/reading');
    const entry = (await listSongs()).find(e => e.id === id || e.slot === id);
    if (!entry) return `No song ${id}`;
    const song = await loadSong(entry);
    return { version: readSong(song).version, score: readSong(song).text, reels: reelFacts(song) };
  };
  // Every piece of voice the videos of the songs in his library need, for scripts/voice-bank.mjs:
  // copy(JSON.stringify(await window.__voiceKeys())) and save it as a file. A song of the app's own
  // (public domain) is recorded line by line; a song he brought (a slot) only as sentences without
  // note names and as pieces, so nothing of his file is recorded.
  (window as unknown as { __voiceKeys: unknown }).__voiceKeys = async () => {
    const { listSongs, loadSong } = await import('./lib/library');
    const { clipsOf, timelineOf } = await import('./lib/reels');
    const { SCRIPTS } = await import('./lib/reelScripts');
    const { allItems, naturalText, sentences, splitSentence } = await import('./lib/voicePieces');
    const talk = new Set(Object.values(SCRIPTS).flatMap(sc => sc.phases.flatMap(p => (p.talk ? Object.values(p.talk) : []))));
    const keys = new Set<string>(allItems());
    for (const entry of await listSongs()) {
      let song;
      try { song = await loadSong(entry); } catch { continue; }
      if (!song) continue;
      for (const clip of clipsOf(song)) for (const { text } of timelineOf(song, clip).lines) {
        const pieces = sentences(text).map(splitSentence);
        if (!entry.slot || talk.has(text) || pieces.every(p => p.length === 1)) { keys.add(text); continue; }
        sentences(text).forEach((s, i) => (pieces[i].length === 1 ? keys.add(s) : pieces[i].forEach(k => keys.add(k))));
      }
    }
    return [...keys].map(k => [k, naturalText(k)]);
  };
}
