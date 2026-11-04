/**
 * The words of a song's phase videos: written by hand in reelScripts.ts, checked here before they show.
 */

/** One phase of a song, as its video explains it. */
export interface PhaseWords {
  /** Bars, 1-based, inclusive. */
  from: number;
  to: number;
  /** The phase's name ("The melody"). */
  title: string;
  /** The big line at the top: the idea of the phase. */
  hook: string;
  /** The tricks, one short line each, shown while the video plays. */
  tricks: string[];
  /** What to see while the left hand plays alone, and the right hand alone. */
  L: string;
  R: string;
  /** A caption for some bars, shown while both hands play them. */
  cues: Record<number, string>;
  /** One line at the end, before he plays it himself. */
  tip: string;
}

export const LIMITS = { title: 32, hook: 52, line: 56, tip: 80 };

/** No em or en dashes on screen, and nothing longer than the video has room for. */
const clean = (s: unknown, max: number) => {
  if (typeof s !== 'string') return null;
  const t = s.replace(/\s*[–—]\s*/g, ', ').replace(/\s+/g, ' ').trim();
  return t && t.length <= max ? t : null;
};

/** A phase's words if they fit the screen; null sends the phase back to the rules' words. */
export function cleanPhase(w: PhaseWords): PhaseWords | null {
  const title = clean(w.title, LIMITS.title), hook = clean(w.hook, LIMITS.hook), tip = clean(w.tip, LIMITS.tip);
  const L = clean(w.L, LIMITS.line), R = clean(w.R, LIMITS.line);
  if (!title || !hook || !tip || !L || !R) return null;
  const tricks = w.tricks.map(t => clean(t, LIMITS.line)).filter((t): t is string => !!t);
  const cues: Record<number, string> = {};
  for (const [bar, text] of Object.entries(w.cues)) { const c = clean(text, LIMITS.line); if (c) cues[Number(bar)] = c; }
  return { from: w.from, to: w.to, title, hook, tricks, L, R, cues, tip };
}
