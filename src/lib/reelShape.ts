/**
 * The words on a song's reels, as the model writes them (api/reels.ts) and the app checks them.
 * Shared by the app and the server, so it imports nothing.
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

/** What the model is told about one reel. */
export interface ReelFacts {
  id: string;
  kind: 'intro' | 'L' | 'R' | 'both';
  part: number;
  from: number;
  to: number;
  bars: { bar: number; bass: string; octave: boolean; held: boolean; right: string; moveTo?: string }[];
}

export const REEL_SCHEMA = {
  type: 'object',
  properties: {
    reels: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The reel id, exactly as given.' },
          title: { type: 'string', description: 'Small label, at most 32 characters, e.g. "Part 1: left hand".' },
          hook: { type: 'string', description: 'The big line on top, at most 48 characters: the one idea of this reel.' },
          cues: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                bar: { type: 'integer', description: 'A bar of this reel.' },
                text: { type: 'string', description: 'At most 56 characters, shown while that bar plays.' },
              },
              required: ['bar', 'text'],
              additionalProperties: false,
            },
          },
          tip: { type: 'string', description: 'At most 80 characters, shown at the end before he plays.' },
        },
        required: ['id', 'title', 'hook', 'cues', 'tip'],
        additionalProperties: false,
      },
    },
  },
  required: ['reels'],
  additionalProperties: false,
} as const;

/** No em or en dashes on screen, and nothing longer than the reel has room for. */
const clean = (s: unknown, max: number) => {
  if (typeof s !== 'string') return null;
  const t = s.replace(/\s*[–—]\s*/g, ', ').replace(/\s+/g, ' ').trim();
  return t && t.length <= max + 12 ? (t.length > max ? `${t.slice(0, max - 1).trimEnd()}.` : t) : null;
};

/** Keeps the model's words only where they fit their reel; a reel it got wrong keeps the rules' words. */
export function checkReelWords(raw: unknown, facts: ReelFacts[]): Record<string, ReelWords> | null {
  const list = (raw as { reels?: unknown })?.reels;
  if (!Array.isArray(list)) return null;
  const out: Record<string, ReelWords> = {};
  for (const r of list as Record<string, unknown>[]) {
    const f = facts.find(x => x.id === r?.id);
    if (!f) continue;
    const title = clean(r.title, 32), hook = clean(r.hook, 48), tip = clean(r.tip, 80);
    if (!title || !hook || !tip || !Array.isArray(r.cues)) continue;
    const cues = (r.cues as { bar?: unknown; text?: unknown }[])
      .map(c => ({ bar: Number(c?.bar), text: clean(c?.text, 56) }))
      .filter((c): c is { bar: number; text: string } => Number.isInteger(c.bar) && c.bar >= f.from && c.bar <= f.to && !!c.text);
    out[f.id] = { title, hook, cues, tip };
  }
  return Object.keys(out).length ? out : null;
}
