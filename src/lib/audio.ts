import { SplendidGrandPiano } from 'smplr';

let ctx: AudioContext | null = null;
let piano: SplendidGrandPiano | null = null;
let loading: Promise<SplendidGrandPiano> | null = null;
const held = new Map<number, () => void>();

/**
 * iOS audio session: 'playback' ignores the silent switch like a music app;
 * 'play-and-record' is required while the microphone is listening.
 */
export function setAudioSession(type: 'playback' | 'play-and-record') {
  const nav = navigator as Navigator & { audioSession?: { type: string } };
  if (nav.audioSession) { try { nav.audioSession.type = type; } catch { /* ignore */ } }
}

export function audioContext(): AudioContext {
  if (!ctx) {
    setAudioSession('playback');
    ctx = new AudioContext({ latencyHint: 'interactive' });
  }
  return ctx;
}

/** Must be called from a user gesture at least once (iOS unlock). */
export async function unlockAudio() {
  const c = audioContext();
  if (c.state !== 'running') await c.resume().catch(() => {});
}

export function loadPiano(onProgress?: (loaded: number, total: number) => void): Promise<SplendidGrandPiano> {
  if (piano) return Promise.resolve(piano);
  if (!loading) {
    const p = new SplendidGrandPiano(audioContext(), {
      volume: 100,
      decayTime: 0.6,
      onLoadProgress: pr => onProgress?.(pr.loaded, pr.total),
    });
    loading = p.load.then(() => (piano = p));
  }
  return loading;
}

export const pianoReady = () => !!piano;

export function playNote(midi: number, velocity = 80, duration?: number) {
  if (!piano) return;
  piano.start({ note: midi, velocity: Math.max(1, Math.min(127, velocity)), duration });
}

export function holdNote(midi: number, velocity = 80) {
  if (!piano) return;
  held.get(midi)?.();
  held.set(midi, piano.start({ note: midi, velocity }));
}

export function releaseNote(midi: number) {
  held.get(midi)?.();
  held.delete(midi);
}

export function stopAll() {
  piano?.stop();
  held.clear();
}
