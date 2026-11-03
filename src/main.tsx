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
}
