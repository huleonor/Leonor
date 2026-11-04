/**
 * The voice of the phase videos: the device's own speech engine (Web Speech API), so there is no
 * recording, no model and no API key. It reads the lines written in reelScripts.ts, picks the most
 * natural English voice the device has, and reports each word it reaches so the captions follow it.
 */

const KEY = 'hugos-piano:reel-voice';
const listeners = new Set<() => void>();

export const voiceSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

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
const spoken = (text: string) => text.replace(/\bA\b/g, 'ay').replace(/#/g, ' sharp');

/** Seconds a line takes to say, at the pace the voice speaks. */
export function estimate(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const pauses = (text.match(/[.,:;]/g) ?? []).length;
  return words / 2.6 + pauses * 0.18 + 0.3;
}

let current: SpeechSynthesisUtterance | null = null;

/** Say a line (stopping the one before); onWord reports the character the voice has reached. */
export function say(text: string, onWord?: (charIndex: number) => void, onEnd?: () => void) {
  if (!voiceSupported() || !voiceOn()) return false;
  hush();
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
export function hush() { if (!voiceSupported()) return; current = null; speechSynthesis.cancel(); }
export function pauseVoice() { if (voiceSupported() && speechSynthesis.speaking) speechSynthesis.pause(); }
export function resumeVoice() { if (voiceSupported() && speechSynthesis.paused) speechSynthesis.resume(); }
export const speaking = () => voiceSupported() && !!current && speechSynthesis.speaking;

/** iOS speaks only after a tap: an empty line on the first touch opens the voice for the visit. */
let unlocked = false;
export function unlockVoice() {
  if (unlocked || !voiceSupported()) return;
  unlocked = true;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  speechSynthesis.speak(u);
}
