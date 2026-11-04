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

/** Sounds a note now, or at `time` on the audio clock (for music scheduled a little ahead). */
export function playNote(midi: number, velocity = 80, duration?: number, time?: number) {
  if (!piano) return;
  piano.start({ note: midi, velocity: Math.max(1, Math.min(127, velocity)), duration, time });
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

/** A metronome tick: a short woodblock-like blip, higher on the first beat of the bar. */
export function playClick(accent = false) {
  try {
    const ctx = audioContext();
    const t = ctx.currentTime + 0.005;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(accent ? 1760 : 1175, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.22 : 0.14, t + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.06);
  } catch { /* audio unavailable */ }
}

// ---------- Sound effects for the videos (public/sfx, Pixabay licence) ----------
const sfxBuffers = new Map<string, Promise<AudioBuffer | null>>();

/** Loads a sound effect once; a missing file just plays nothing. */
export function loadSfx(name: string): Promise<AudioBuffer | null> {
  let p = sfxBuffers.get(name);
  if (!p) {
    p = fetch(`/sfx/${name}.mp3`).then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.statusText))))
      .then(b => audioContext().decodeAudioData(b)).catch(() => null);
    sfxBuffers.set(name, p);
  }
  return p;
}

const sfxPlaying = new Set<AudioBufferSourceNode>();

/** Plays a sound effect at `time` on the audio clock (now when omitted). */
export async function playSfx(name: string, gain = 0.5, time?: number) {
  const buf = await loadSfx(name);
  if (!buf) return;
  try {
    const c = audioContext();
    const src = c.createBufferSource();
    const g = c.createGain();
    g.gain.value = gain;
    src.buffer = buf;
    src.connect(g).connect(c.destination);
    src.onended = () => sfxPlaying.delete(src);
    sfxPlaying.add(src);
    src.start(Math.max(c.currentTime, time ?? c.currentTime));
  } catch { /* audio unavailable */ }
}

/** Stops every sound effect still to play (a video paused or left). */
export function stopSfx() { for (const s of sfxPlaying) { try { s.stop(); } catch { /* already done */ } } sfxPlaying.clear(); }
