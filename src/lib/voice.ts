/**
 * The voice of the phase videos. First choice: the natural voice recorded ahead of time (Kokoro-82M,
 * af_heart, by scripts/voice-bank.mjs; public/voice, listed in voiceBank.json): every line the videos
 * say is played from it, whole or from its pieces (voicePieces.ts), so it sounds like a person from
 * the first video on any phone, offline once heard. A line not recorded (a new script not yet run
 * through the recorder) is made on the device by the same model in a worker (kokoroWorker.ts, slow
 * on a phone, so it is made ahead while the video before it plays). Only with the natural voice
 * switched off, or where neither can play, the device's own speech engine. No server, no key. The
 * caption follows the word being said.
 */
import { get, set } from 'idb-keyval';
import { audioContext } from './audio';
import BANK from './voiceBank.json';
import { lang } from './lang';
import { naturalText, planLine, type Piece } from './voicePieces';

/** What was recorded: key, then its file in public/voice and its length in seconds. */
const bank = BANK as unknown as Record<string, [string, number]>;
const recordedKey = (k: string) => k in bank;
const planOf = (text: string) => (naturalVoiceWanted() ? planLine(text, recordedKey) : null);

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
let chosen: SpeechSynthesisVoice | null = null, chosenFor = '';
function pick(): SpeechSynthesisVoice | null {
  const want = lang();
  if (chosen && chosenFor === want) return chosen;
  chosenFor = want;
  const all = speechSynthesis.getVoices().filter(v => (want === 'pt' ? /^pt(-|_|$)/i : /^en(-|_|$)/i).test(v.lang));
  if (!all.length) return null;
  const rank = (v: SpeechSynthesisVoice) => {
    const i = GOOD.findIndex(r => r.test(v.name));
    return (i < 0 ? 50 : i) + (v.localService ? 0 : 5) + ((want === 'pt' ? /pt-PT/i : /en-(US|GB)/i).test(v.lang) ? 0 : 3);
  };
  chosen = [...all].sort((a, b) => rank(a) - rank(b))[0];
  return chosen;
}
if (voiceSupported()) speechSynthesis.addEventListener?.('voiceschanged', () => { chosen = null; });

// Note letters are read as letters: a lone capital A would be read as the word "a" (only a capital
// A opening a sentence before a word is the article).
const spoken = (text: string) => lang() === 'pt' ? naturalText(text, 'pt') : text.replace(/\b([A-G])(#|b)?m\b/g, (_, l: string, a?: string) => `${l}${a ?? ''} minor`)
  .replace(/\b([A-G])b\b/g, '$1 flat').replace(/(^|[.!?]\s+)A(?= (?!sharp|flat|minor)[a-z])/g, '$1a').replace(/\bA\b/g, 'ay').replace(/#/g, ' sharp');

/** Seconds a line takes to say: exactly, when it was recorded; else at the pace the voice speaks. */
export function estimate(text: string) {
  const plan = planOf(text);
  if (plan) return plan.reduce((a, p) => a + bank[p.key][1] + p.gap, 0) + 0.15;
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
/** Where each piece of a recorded line starts, in seconds and in characters of the line. */
type Mark = { t0: number; t1: number; c0: number; c1: number };
const marks = new Map<string, Mark[]>();
const files = new Map<string, Promise<AudioBuffer | null>>();
const joining = new Map<string, Promise<AudioBuffer | null>>();

function file(name: string) {
  let p = files.get(name);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}voice/${name}`).then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then(b => audioContext().decodeAudioData(b)).catch(err => { console.warn('[voice] recorded piece missing:', name, err); files.delete(name); return null; });
    files.set(name, p);
  }
  return p;
}

/** A recorded line as one buffer: its pieces one after the other with their pauses, and its marks. */
function joined(text: string, plan: Piece[]) {
  let p = joining.get(text);
  if (p) return p;
  p = Promise.all(plan.map(x => file(bank[x.key][0]))).then(bufs => {
    if (bufs.some(b => !b)) { joining.delete(text); return null; }
    const c = audioContext(), rate = c.sampleRate;
    const len = bufs.reduce((a, b, i) => a + b!.length + Math.round(plan[i].gap * rate), 0);
    const out = c.createBuffer(1, Math.max(1, len), rate);
    const ch = out.getChannelData(0);
    const ms: Mark[] = [];
    let at = 0, cursor = 0;
    bufs.forEach((b, i) => {
      // Resampled by the browser to the context's rate; any channel will do (they are mono).
      ch.set(b!.getChannelData(0).subarray(0, Math.min(b!.length, len - at)), at);
      const key = plan[i].key, said = key.startsWith('~') ? key.slice(1, -1) : key;
      const c0 = Math.max(cursor, text.indexOf(said, cursor));
      const c1 = c0 + said.length;
      ms.push({ t0: at / rate, t1: (at + b!.length) / rate, c0, c1 });
      cursor = c1;
      at += b!.length + Math.round(plan[i].gap * rate);
    });
    made.set(text, out);
    marks.set(text, ms);
    return out;
  });
  joining.set(text, p);
  return p;
}
const waiting = new Map<string, ((b: AudioBuffer | null) => void)[]>();
const queue: string[] = [];
let busy = false;

export const naturalVoiceWanted = () => { try { return localStorage.getItem(NATURAL) !== 'off'; } catch { return true; } };
export function setNaturalVoice(on: boolean) {
  try { localStorage.setItem(NATURAL, on ? 'on' : 'off'); } catch { /* storage blocked */ }
  if (!on) natural = 'off';
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
  worker.postMessage({ type: 'say', id, text: naturalText(id), voice: VOICE_ID });
}

/**
 * Makes these lines ahead of time, in order (`first` puts them before what is already waiting):
 * the video about to play gets its lines made while the one before it is still on screen.
 */
export async function prepareVoice(texts: string[], first = false) {
  if (!naturalVoiceWanted()) return;
  const rest = texts.filter(t => { const plan = planOf(t); if (plan) joined(t, plan); return !plan; });
  // The model on the device reads only English: a Portuguese line not recorded is spoken by the
  // device's own voice.
  if (!rest.length || lang() === 'pt') return;
  startNatural();
  for (const t of rest) {
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
  // The caption follows the audio's own clock: piece by piece for a recorded line, else by characters.
  const ms = marks.get(text);
  const tick = () => {
    const el = c.currentTime - p.started;
    const m = ms?.find(x => el < x.t1) ?? ms?.[ms.length - 1];
    if (m) onWord?.(Math.floor(m.c0 + (m.c1 - m.c0) * Math.max(0, Math.min(1, (el - m.t0) / Math.max(0.05, m.t1 - m.t0)))));
    else onWord?.(Math.floor(Math.min(1, el / buf.duration) * text.length));
    if (playingNatural === p) p.raf = requestAnimationFrame(tick);
  };
  playingNatural = p;
  p.raf = requestAnimationFrame(tick);
}

let current: SpeechSynthesisUtterance | null = null;

/** Say a line (stopping the one before); onWord reports the character the voice has reached. */
let asked = 0;
export function say(text: string, onWord?: (charIndex: number) => void, onEnd?: () => void) {
  if (!voiceOn()) return false;
  hush();
  const ask = ++asked;
  const buf = made.get(text);
  if (buf) { playBuffer(text, buf, 0, onWord, onEnd); return true; }
  const plan = planOf(text);
  if (plan) {
    // Recorded: a moment to fetch its pieces (kept after the first time), then it plays.
    joined(text, plan).then(b => {
      if (ask !== asked) return;
      if (b) { if (heldBack) pausedNatural = { text, buf: b, at: 0, onWord, onEnd }; else playBuffer(text, b, 0, onWord, onEnd); }
    });
    return true;
  }
  if (naturalVoiceWanted() && natural !== 'failed' && lang() !== 'pt') prepareVoice([text], true);
  if (!voiceSupported()) return false;
  const u = new SpeechSynthesisUtterance(spoken(text));
  const v = pick();
  if (v) { u.voice = v; u.lang = v.lang; } else u.lang = lang() === 'pt' ? 'pt-PT' : 'en-US';
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
let heldBack = false;
export function hush() {
  asked++;
  heldBack = false;
  if (playingNatural) { const p = playingNatural; playingNatural = null; cancelAnimationFrame(p.raf); try { p.src.stop(); } catch { /* done */ } }
  pausedNatural = null;
  if (!voiceSupported()) return; current = null; speechSynthesis.cancel();
}
let pausedNatural: { text: string; buf: AudioBuffer; at: number; onWord?: (c: number) => void; onEnd?: () => void } | null = null;
export function pauseVoice() {
  heldBack = true;
  if (playingNatural) {
    const p = playingNatural; playingNatural = null; cancelAnimationFrame(p.raf);
    pausedNatural = { text: p.text, buf: p.buf, at: audioContext().currentTime - p.started, onWord: p.onWord, onEnd: p.onEnd };
    try { p.src.stop(); } catch { /* done */ }
    return;
  }
  if (voiceSupported() && speechSynthesis.speaking) speechSynthesis.pause();
}
export function resumeVoice() {
  heldBack = false;
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
