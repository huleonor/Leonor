/**
 * How a song is taught: the plan the model writes after reading the score (api/plan.ts), or the
 * one the rules write when it cannot be reached (strategy.ts). Shared by the app and the server,
 * so it imports nothing. Mastery (mastery.ts) follows it and keeps adapting to him on top.
 */

export type HandMode = 'together' | 'hand-by-phrase' | 'lead-hand-first';
export type StrategyHand = 'R' | 'L' | 'both';

export interface PartPlan {
  /** A part number from the reading (never a repeat). */
  n: number;
  /** First bar of each phrase inside the part, starting with the part's first bar. */
  phrases: number[];
  /**
   * together: both hands from the start (hands move together, chords and melody in one rhythm).
   * hand-by-phrase: each phrase hand by hand, then both (the usual way).
   * lead-hand-first: the lead hand through the whole part first, then the other, then together
   * phrase by phrase (independent hands, an ostinato or a busy hand that must run by itself).
   */
  hands: HandMode;
  lead: 'R' | 'L';
  /** First tempo rung with the beat: 0 = 60%, 1 = 70%, 2 = 80% of full speed. */
  rung: 0 | 1 | 2;
}

export interface Stretch { from: number; to: number; hand: StrategyHand; why: string; }

export interface Strategy {
  /** Who wrote it. */
  source: 'ai' | 'rules';
  /** The reading's version it was written for. */
  version: string;
  /** The model that wrote it, when one did (for the developer). */
  by?: string;
  /** For the developer: the approach in a few sentences. Never shown to the learner. */
  summary: string;
  /** Part numbers in the order to learn them. */
  order: number[];
  parts: PartPlan[];
  /** Patterns to learn on their own first, because they come back all through the song. */
  patterns: Stretch[];
  /** The hard spots to drill as soon as their part starts. */
  focus: Stretch[];
}

const stretchSchema = {
  type: 'object',
  properties: {
    from: { type: 'integer', description: 'First bar, 1-based.' },
    to: { type: 'integer', description: 'Last bar, inclusive. At least from + 1.' },
    hand: { type: 'string', enum: ['R', 'L', 'both'] },
    why: { type: 'string', description: 'One short reason, for the developer.' },
  },
  required: ['from', 'to', 'hand', 'why'],
  additionalProperties: false,
} as const;

/** The JSON schema the model answers in (structured outputs). */
export const STRATEGY_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'The teaching approach for this piece in 2-4 sentences.' },
    order: { type: 'array', items: { type: 'integer' }, description: 'Every non-repeat part number, in the order to learn them.' },
    parts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          n: { type: 'integer' },
          phrases: { type: 'array', items: { type: 'integer' }, description: 'First bar of each musical phrase in the part, ascending, starting with the part\'s first bar; phrases of 2 to 8 bars.' },
          hands: { type: 'string', enum: ['together', 'hand-by-phrase', 'lead-hand-first'] },
          lead: { type: 'string', enum: ['R', 'L'] },
          rung: { type: 'integer', enum: [0, 1, 2] },
        },
        required: ['n', 'phrases', 'hands', 'lead', 'rung'],
        additionalProperties: false,
      },
    },
    patterns: { type: 'array', items: stretchSchema, description: 'At most 2.' },
    focus: { type: 'array', items: stretchSchema, description: 'At most 4.' },
  },
  required: ['summary', 'order', 'parts', 'patterns', 'focus'],
  additionalProperties: false,
} as const;

export interface Shape { bars: number; hands: ('R' | 'L')[]; parts: { n: number; from: number; to: number; sameAs?: number }[]; }

const int = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x);

/**
 * Checks a plan against the song and mends what it can: parts it left out go to the end, bad
 * phrases fall back to fours, stretches outside the song are dropped. Returns null when the plan
 * is not a plan at all.
 */
export function checkStrategy(raw: unknown, shape: Shape, source: Strategy['source'], version: string): Strategy | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const own = shape.parts.filter(p => !p.sameAs);
  const partOf = new Map(own.map(p => [p.n, p]));
  const hand = (h: unknown): 'R' | 'L' => (h === 'L' || h === 'R') && shape.hands.includes(h) ? h : shape.hands[0];
  const order = (Array.isArray(r.order) ? r.order : []).filter((n, i, a): n is number => int(n) && partOf.has(n) && a.indexOf(n) === i);
  for (const p of own) if (!order.includes(p.n)) order.push(p.n);
  const given = new Map((Array.isArray(r.parts) ? r.parts : []).filter((p): p is Record<string, unknown> => !!p && typeof p === 'object' && int((p as Record<string, unknown>).n)).map(p => [p.n as number, p]));
  const parts: PartPlan[] = own.map(p => {
    const g = given.get(p.n) ?? {};
    let phrases = (Array.isArray(g.phrases) ? g.phrases : []).filter((b): b is number => int(b) && b >= p.from && b <= p.to);
    phrases = [...new Set([p.from, ...phrases])].sort((a, b) => a - b);
    // Every phrase 2 to 8 bars, and a part the plan left out goes in fours.
    const ends = [...phrases.slice(1), p.to + 1];
    if (!given.has(p.n) || phrases.some((b, i) => ends[i] - b < 2 || ends[i] - b > 8)) {
      phrases = [];
      for (let b = p.from; b <= p.to; b += 4) phrases.push(b);
      if (phrases.length > 1 && p.to + 1 - phrases[phrases.length - 1] < 2) phrases.pop();
    }
    const two = shape.hands.length === 2;
    const hands: HandMode = !two ? 'together' : g.hands === 'together' || g.hands === 'lead-hand-first' ? g.hands : 'hand-by-phrase';
    const rung = g.rung === 0 || g.rung === 2 ? g.rung : 1;
    return { n: p.n, phrases, hands, lead: hand(g.lead), rung };
  });
  const stretches = (x: unknown, max: number): Stretch[] => (Array.isArray(x) ? x : []).flatMap(s => {
    if (!s || typeof s !== 'object') return [];
    const o = s as Record<string, unknown>;
    if (!int(o.from) || !int(o.to) || o.from < 1 || o.to > shape.bars || o.to < o.from) return [];
    const to = Math.min(shape.bars, Math.max(o.to, o.from + 1));
    const h: StrategyHand = o.hand === 'both' && shape.hands.length === 2 ? 'both' : o.hand === 'both' ? shape.hands[0] : hand(o.hand);
    return [{ from: o.from, to, hand: h, why: typeof o.why === 'string' ? o.why.slice(0, 200) : '' }];
  }).slice(0, max);
  return {
    source, version, ...(typeof r.by === 'string' ? { by: r.by.slice(0, 80) } : {}), summary: typeof r.summary === 'string' ? r.summary.slice(0, 1200) : '',
    order, parts, patterns: stretches(r.patterns, 2), focus: stretches(r.focus, 4),
  };
}
