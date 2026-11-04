/**
 * The voice of the phase videos. First choice: a natural voice, Kokoro-82M run on the device in a
 * worker (kokoroWorker.ts; the model is fetched once, about 90 MB, then kept by the browser), each
 * line made ahead of time while the video before it plays. Until it is ready, or where it cannot
 * run, the device's own speech engine (Web Speech API, its most natural English voice). No server,
 * no recording, no key. Either way the caption follows the word being said.
 */
import { get, set } from 'idb-keyval';
import { audioContext } from './audio';

const KEY = 'hugos-piano:reel-voice';
const listeners = new Set<() => void>();

export const voiceSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
/** A voice of some kind can speak here (the natural one or the device's). */
export const anyVoice = () => voiceSupported() || typeof Worker !== 'undefined';

/** The voice is on unless he turned it off. */
export function voiceOn(): boolean {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}
export function setVoiceOn(on: boolean) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* storage blocked: stays for this visit */ }
  if (!on) hush();
  listeners.forEach(f => f());
}
export function onVoice(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

// Natural voices first: the "premium", "enhanced", neural and "natural" voices sound like a person.
const GOOD = [/premium/i, /enhanced/i, /natural/i, /neural/i, /\b(ava|zoe|evan|nathan|serena|samantha|daniel|karen|moira|tessa)\b/i, /google (us|uk) english/i];
let chosen: SpeechSynthesisVoice | null = null;
function pick(): SpeechSynthesisVoice | null {
  if (chosen) return chosen;
  const all = speechSynthesis.getVoices().filter(v => /^en(-|_|$)/i.test(v.lang));
  if (!all.length) return null;
  const rank = (v: SpeechSynthesisVoice) => {
    const i = GOOD.findIndex(r => r.test(v.name));
    return (i < 0 ? 50 : i) + (v.localService ? 0 : 5) + (/en-(US|GB)/i.test(v.lang) ? 0 : 3);
  };
  chosen = [...all].sort((a, b) => rank(a) - rank(b))[0];
  return chosen;
}
if (voiceSupported()) speechSynthesis.addEventListener?.('voiceschanged', () => { chosen = null; });

// Note letters are read as letters: a lone capital A would be read as the word "a".
const spoken = (text: string) => text.replace(/\b([A-G])b\b/g, '$1 flat').replace(/\bA\b/g, 'ay').replace(/#/g, ' sharp');

/** Seconds a line takes to say, at the pace the voice speaks. */
export function estimate(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const pauses = (text.match(/[.,:;]/g) ?? []).length;
  return words / 2.4 + pauses * 0.18 + 0.3;
}

// ---------- The natural voice (Kokoro on the device) ----------

const NATURAL = 'hugos-piano:natural-voice';
const VOICE_ID = 'af_heart';
export type NaturalState = 'off' | 'loading' | 'ready' | 'failed';
let natural: NaturalState = 'off';
let worker: Worker | null = null;
const made = new Map<string, AudioBuffer>();
const waiting = new Map<string, ((b: AudioBuffer | null) => void)[]>();
const queue: string[] = [];
let busy = false;

export const naturalVoiceWanted = () => { try { return localStorage.getItem(NATURAL) !== 'off'; } catch { return true; } };
export function setNaturalVoice(on: boolean) {
  try { localStorage.setItem(NATURAL, on ? 'on' : 'off'); } catch { /* storage blocked */ }
  if (on) startNatural(); else natural = 'off';
  listeners.forEach(f => f());
}
export const naturalState = () => natural;

/** Starts loading the natural voice (once). */
export function startNatural() {
  if (worker || !naturalVoiceWanted() || typeof Worker === 'undefined') return;
  natural = 'loading';
  listeners.forEach(f => f());
  try {
    worker = new Worker(new URL('./kokoroWorker.ts', import.meta.url), { type: 'module' });
  } catch { natural = 'failed'; listeners.forEach(f => f()); return; }
  worker.onmessage = e => {
    const m = e.data as { type: string; id?: string; pcm?: Int16Array; rate?: number };
    if (m.type === 'ready') { natural = 'ready'; listeners.forEach(f => f()); pump(); return; }
    if (m.type === 'error' && !m.id) { console.warn('[voice] the natural voice could not start:', (m as { error?: string }).error); natural = 'failed'; listeners.forEach(f => f()); return; }
    const id = m.id!;
    busy = false;
    let buf: AudioBuffer | null = null;
    if (m.type === 'audio' && m.pcm && m.rate) {
      buf = toBuffer(m.pcm, m.rate);
      made.set(id, buf);
      set(`voice:${VOICE_ID}:${id}`, { pcm: m.pcm, rate: m.rate }).catch(() => {});
    }
    (waiting.get(id) ?? []).forEach(f => f(buf));
    waiting.delete(id);
    pump();
  };
  worker.onerror = e => { console.warn('[voice] worker error:', e.message); natural = 'failed'; listeners.forEach(f => f()); };
  worker.postMessage({ type: 'load' });
}

function toBuffer(pcm: Int16Array, rate: number) {
  const b = audioContext().createBuffer(1, pcm.length, rate);
  const ch = b.getChannelData(0);
  for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32767;
  return b;
}

function pump() {
  if (busy || natural !== 'ready' || !worker) return;
  const id = queue.shift();
  if (!id) return;
  if (made.has(id)) { pump(); return; }
  busy = true;
  worker.postMessage({ type: 'say', id, text: spoken(id), voice: VOICE_ID });
}

/**
 * Makes these lines ahead of time, in order (`first` puts them before what is already waiting):
 * the video about to play gets its lines made while the one before it is still on screen.
 */
export async function prepareVoice(texts: string[], first = false) {
  if (!naturalVoiceWanted()) return;
  startNatural();
  for (const t of texts) {
    if (made.has(t)) continue;
    const kept = await get(`voice:${VOICE_ID}:${t}`).catch(() => undefined) as { pcm: Int16Array; rate: number } | undefined;
    if (kept) { made.set(t, toBuffer(kept.pcm, kept.rate)); continue; }
    if (!queue.includes(t)) { if (first) queue.unshift(t); else queue.push(t); }
  }
  pump();
}

let playingNatural: { src: AudioBufferSourceNode; buf: AudioBuffer; text: string; started: number; offset: number; raf: number; onWord?: (c: number) => void; onEnd?: () => void } | null = null;

function playBuffer(text: string, buf: AudioBuffer, offset: number, onWord?: (c: number) => void, onEnd?: () => void) {
  const c = audioContext();
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(c.destination);
  const p = { src, buf, text, started: c.currentTime - offset, offset, raf: 0, onWord, onEnd };
  src.onended = () => { if (playingNatural === p) { cancelAnimationFrame(p.raf); playingNatural = null; onEnd?.(); } };
  src.start(0, offset);
  // The voice gives no word marks: the caption follows the audio's own clock, by characters.
  const tick = () => {
    const f = Math.min(1, (c.currentTime - p.started) / buf.duration);
    onWord?.(Math.floor(f * text.length));
    if (playingNatural === p) p.raf = requestAnimationFrame(tick);
  };
  playingNatural = p;
  p.raf = requestAnimationFrame(tick);
}

let current: SpeechSynthesisUtterance | null = null;

/** Say a line (stopping the one before); onWord reports the character the voice has reached. */
export function say(text: string, onWord?: (charIndex: number) => void, onEnd?: () => void) {
  if (!voiceOn()) return false;
  hush();
  const buf = made.get(text);
  if (buf) { playBuffer(text, buf, 0, onWord, onEnd); return true; }
  if (naturalVoiceWanted() && natural !== 'failed') prepareVoice([text], true);
  if (!voiceSupported()) return false;
  const u = new SpeechSynthesisUtterance(spoken(text));
  const v = pick();
  if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US';
  u.rate = 1;
  u.pitch = 1;
  // The spoken text is a little longer than the shown one ("ay", " sharp"): map back by proportion.
  const ratio = text.length / Math.max(1, u.text.length);
  u.onboundary = e => { if (e.name === 'word' || e.name === undefined) onWord?.(Math.round(e.charIndex * ratio)); };
  u.onend = () => { if (current === u) current = null; onEnd?.(); };
  u.onerror = () => { if (current === u) current = null; };
  current = u;
  speechSynthesis.speak(u);
  return true;
}
export function hush() {
  if (playingNatural) { const p = playingNatural; playingNatural = null; cancelAnimationFrame(p.raf); try { p.src.stop(); } catch { /* done */ } }
  pausedNatural = null;
  if (!voiceSupported()) return; current = null; speechSynthesis.cancel();
}
let pausedNatural: { text: string; buf: AudioBuffer; at: number; onWord?: (c: number) => void; onEnd?: () => void } | null = null;
export function pauseVoice() {
  if (playingNatural) {
    const p = playingNatural; playingNatural = null; cancelAnimationFrame(p.raf);
    pausedNatural = { text: p.text, buf: p.buf, at: audioContext().currentTime - p.started, onWord: p.onWord, onEnd: p.onEnd };
    try { p.src.stop(); } catch { /* done */ }
    return;
  }
  if (voiceSupported() && speechSynthesis.speaking) speechSynthesis.pause();
}
export function resumeVoice() {
  if (pausedNatural) { const q = pausedNatural; pausedNatural = null; if (q.at < q.buf.duration) playBuffer(q.text, q.buf, q.at, q.onWord, q.onEnd); return; }
  if (voiceSupported() && speechSynthesis.paused) speechSynthesis.resume();
}
export const speaking = () => !!playingNatural || (voiceSupported() && !!current && speechSynthesis.speaking);

/** iOS speaks only after a tap: an empty line on the first touch opens the voice for the visit. */
let unlocked = false;
export function unlockVoice() {
  if (unlocked || !voiceSupported()) return;
  unlocked = true;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  speechSynthesis.speak(u);
}

/** This line has its natural voice made (and kept). */
export const naturalMade = (text: string) => made.has(text);
