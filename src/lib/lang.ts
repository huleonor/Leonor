/**
 * The app's language (Settings): English or Portuguese, for the screens, the videos' words and the
 * voice. Set once per render of the app (App.tsx), before anything below it reads it; the app is
 * remounted when it changes, so every text is written again in the new language.
 */
import type { Lang } from './types';

let current: Lang = 'en';
export const lang = (): Lang => current;
export function setLang(l: Lang) { current = l; }
/** A text in the language of the app: the English and the Portuguese side by side. */
export const L = (en: string, pt: string) => (current === 'pt' ? pt : en);

/** How the videos go, from Settings: their speed (a factor on the planned pace) and whether they
 *  stop for him to play. Set by App.tsx on each render, read by the videos as they start. */
export const videoPrefs = { pace: 1, wait: true };
export function setVideoPrefs(p: { pace?: number; wait?: boolean }) { Object.assign(videoPrefs, p); }
/** The hands drawn over the keys in the videos, on or off (Settings and the Hands button share it). */
export const handsShown = () => { try { return localStorage.getItem('leonor:hands') !== 'off'; } catch { return true; } };
export function showHands(on: boolean) {
  try { localStorage.setItem('leonor:hands', on ? 'on' : 'off'); } catch { /* this visit only */ }
  window.dispatchEvent(new Event('leonor:hands'));
}

/** The staff over the falling notes in the videos, on or off (Settings and the Staff button share it). */
export const staffShown = () => { try { return localStorage.getItem('leonor:staff') !== 'off'; } catch { return true; } };
export function showStaff(on: boolean) {
  try { localStorage.setItem('leonor:staff', on ? 'on' : 'off'); } catch { /* this visit only */ }
  window.dispatchEvent(new Event('leonor:staff'));
}

/** The note names he reads (Settings, Note names): letters, or Dó Ré Mi. */
export const notePrefs = { solfege: false };
const SOLF: Record<string, string> = { C: 'Dó', D: 'Ré', E: 'Mi', F: 'Fá', G: 'Sol', A: 'Lá', B: 'Si' };
/** The videos name notes in solfège in Portuguese with Dó Ré Mi chosen; letters otherwise. */
export const videoSolfege = () => current === 'pt' && notePrefs.solfege;
/** A note token ("C#", "Bb", "Am") as the videos name it. */
export const N = (x: string) => (videoSolfege() ? x.replace(/^([A-G])/, l => SOLF[l]) : x);
/**
 * Every note token in a line of the videos written in Portuguese ("Mi, Dó, Lá" for "E, C, A"). "A"
 * and "E" are also words (the article, "and"): before a lowercase word they stay words, unless an
 * article or preposition comes before them ("o A em cada mão", "no E").
 */
export function NT(text: string) {
  if (!videoSolfege()) return text;
  return text.replace(/(?<![\wÀ-ÿ#])([A-G])(#|b)?(m)?(?![\wÀ-ÿ])/g, (all, l: string, a = '', m = '', at: number) => {
    if ((l === 'A' || l === 'E') && !a && !m && /^ [a-zà-ÿ]/.test(text.slice(at + 1)) && !/(?:^|\s)(?:o|no|do|ao|um|num|pelo|segura o)\s$/i.test(text.slice(0, at))) return all;
    return `${SOLF[l]}${a}${m}`;
  });
}
/** A solfège or letter note token, for the regular expressions that look for notes in a line. */
export const NOTE_RE = '(?:[A-G]|Dó|Ré|Mi|Fá|Sol|Lá|Si)(?:#|b)?m?';
