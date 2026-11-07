import { SplendidGrandPiano } from 'smplr';

let ctx: AudioContext | null = null;
let piano: SplendidGrandPiano | null = null;
let loading: Promise<SplendidGrandPiano> | null = null;
const held = new Map<number, () => void>();

/**
 * iOS audio session: 'playback' ignores the silent switch like a music app;
 * 'play-and-record' is required while the microphone is listening.
 */
let session: 'playback' | 'play-and-record' = 'playback';
export function setAudioSession(type: 'playback' | 'play-and-record') {
  session = type;
  const nav = navigator as Navigator & { audioSession?: { type: string } };
  if (nav.audioSession) { try { nav.audioSession.type = type; } catch { /* ignore */ } }
}

export function audioContext(): AudioContext {
  if (!ctx) {
    setAudioSession('playback');
    ctx = new AudioContext({ latencyHint: 'interactive' });
    keepAwake(ctx);
  }
  return ctx;
}

/** Told just before the audio is rebuilt (a video pauses, so its clock does not jump). */
const resetListeners = new Set<() => void>();
export function onAudioReset(fn: () => void) { resetListeners.add(fn); return () => { resetListeners.delete(fn); }; }

/**
 * The sound must never stay off. iOS suspends or "interrupts" the audio when the screen locks, a
 * call or another app takes it, or the page goes to the background, and does not bring it back by
 * itself: the context is resumed whenever that happens and the page is visible, on the next touch
 * or key, and checked every two seconds. Coming back to the page (the user found it silent after
 * leaving the site and returning), the first touch also checks the sound is really alive: a context
 * still not running, or one that says it runs while its clock stands still (an iOS fault), is
 * closed and made again, with the piano loaded onto the new one, and the audio route is set again
 * (the speaker, or the microphone's while it listens).
 */
let returned = false;
function keepAwake(c: AudioContext) {
  const wake = () => { if (c !== ctx) return; if (c.state !== 'running' && (c.state as string) !== 'closed' && !document.hidden) c.resume().catch(() => {}); };
  c.addEventListener('statechange', () => { if (c.state !== 'running') window.setTimeout(wake, 250); });
  const onVisible = () => { if (document.hidden) { returned = true; return; } wake(); };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', wake);
  window.addEventListener('pageshow', e => { if ((e as PageTransitionEvent).persisted) returned = true; wake(); });
  const touch = () => { wake(); if (returned && c === ctx) { returned = false; checkAlive(); } };
  for (const e of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(e, touch, { capture: true, passive: true });
  window.setInterval(wake, 2000);
}

function checkAlive() {
  const c = ctx;
  if (!c) return;
  setAudioSession(session);
  c.resume().catch(() => {});
  const t0 = c.currentTime;
  window.setTimeout(() => {
    if (c !== ctx) return;
    if (c.state === 'running' && c.currentTime - t0 > 0.15) return;
    rebuildAudio();
  }, 450);
}

/** A fresh audio context (and piano on it) in place of one iOS left silent. */
export function rebuildAudio() {
  resetListeners.forEach(f => { try { f(); } catch { /* a listener's own fault */ } });
  const old = ctx;
  ctx = null; piano = null; loading = null; held.clear();
  old?.close().catch(() => {});
  audioContext().resume().catch(() => {});
  loadPiano().catch(() => {});
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
    p = fetch(`${import.meta.env.BASE_URL}sfx/${name}.mp3`).then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.statusText))))
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
