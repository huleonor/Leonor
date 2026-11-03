/**
 * The words on a song's reels: written by hand in reelScripts.ts, checked here before they show.
 */

export interface ReelWords {
  /** Small label over the reel ("Part 1: left hand"). */
  title: string;
  /** The big line at the top, what this reel is about. */
  hook: string;
  /** One short caption per bar, shown while that bar plays. */
  cues: { bar: number; text: string }[];
  /** One line at the end, before he plays it himself. */
  tip: string;
}

/** What one reel shows, bar by bar: what a script is written from. */
export interface ReelFacts {
  id: string;
  kind: 'intro' | 'L' | 'R' | 'both';
  part: number;
  from: number;
  to: number;
  bars: { bar: number; bass: string; octave: boolean; held: boolean; right: string; moveTo?: string }[];
}

/** No em or en dashes on screen, and nothing longer than the reel has room for. */
const clean = (s: unknown, max: number) => {
  if (typeof s !== 'string') return null;
  const t = s.replace(/\s*[\u2013\u2014]\s*/g, ', ').replace(/\s+/g, ' ').trim();
  return t && t.length <= max ? t : null;
};

export const LIMITS = { title: 32, hook: 48, cue: 56, tip: 80 };

/** A script's words if they fit the reel; null sends the reel back to the rules' words. */
export function cleanWords(w: ReelWords): ReelWords | null {
  const title = clean(w.title, LIMITS.title), hook = clean(w.hook, LIMITS.hook), tip = clean(w.tip, LIMITS.tip);
  if (!title || !hook || !tip) return null;
  const cues = w.cues.map(c => ({ bar: c.bar, text: clean(c.text, LIMITS.cue) })).filter((c): c is { bar: number; text: string } => !!c.text);
  return { title, hook, cues, tip };
}
