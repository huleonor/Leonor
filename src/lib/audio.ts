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

/** A metronome tick: a soft wooden "tok" (a short sine that drops in pitch), brighter on beat 1. */
export function playClick(accent = false) {
  try {
    const ctx = audioContext();
    const t = ctx.currentTime + 0.005;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const f = accent ? 1500 : 1050;
    osc.frequency.setValueAtTime(f, t);
    osc.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.04);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.2 : 0.12, t + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.08);
  } catch { /* audio unavailable */ }
}

/** A soft bell: a sine with a quieter octave above, a quick attack and a long ring. */
function bell(ctx: AudioContext, freq: number, at: number, level: number, ring = 0.9) {
  for (const [mult, amp] of [[1, 1], [2, 0.28], [3, 0.08]] as const) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * mult, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(level * amp, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + ring / mult);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + ring + 0.05);
  }
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/**
 * The little sounds that answer how a run went, kept quiet under his piano: a bright two-note
 * chime for a good run, a rising three-note bell when a step is done, a short arpeggio for a
 * finished section, and a soft low tone (never a buzzer) when it is "again".
 */
export function playCue(kind: 'good' | 'step' | 'section' | 'again') {
  try {
    const ctx = audioContext();
    const t = ctx.currentTime + 0.01;
    const notes = kind === 'good' ? [84, 88] : kind === 'step' ? [79, 84, 88] : kind === 'section' ? [72, 76, 79, 84, 88] : [60];
    const gap = kind === 'section' ? 0.09 : 0.07;
    notes.forEach((m, i) => bell(ctx, hz(m), t + i * gap, kind === 'again' ? 0.05 : 0.07, kind === 'again' ? 0.35 : 0.9));
  } catch { /* audio unavailable */ }
}
