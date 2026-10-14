/**
 * The prediction model: before he plays an exercise, how likely is a good run (90% right, at most
 * one slip)? Mastery asks it about every exercise it could give him next and picks the one whose
 * chance sits in the zone of ideal effort, around 80-85%: hard enough to teach him something, easy
 * enough that he keeps winning.
 *
 * It is a small logistic regression that runs on the device. Each exercise is described by a few
 * numbers (how strong its bars, hands-together and movements are, how fast, how long, how dense,
 * whether the beat is on, whether finger numbers show, how long since he played it). Each weight
 * says how much that number matters for him. It starts from weights set by hand, so it is sensible
 * from the first day, and after every run it moves them a little towards what really happened.
 * A gentle pull back to the starting weights keeps a handful of runs from throwing it off.
 *
 * Every run is logged with its prediction and outcome, so the model can be checked: when it says
 * 80%, about 80% of those runs should be good (`calibration()`; `window.__predict()` in dev).
 */

export const FEATURES = [
  'bars', 'together', 'move', 'tried', 'last', 'streak',
  'beat', 'speed', 'size', 'density', 'both', 'noFingers', 'away',
] as const;
export type Feature = (typeof FEATURES)[number];
/** An exercise as the model sees it; every value is roughly 0-1. */
export type Features = Record<Feature, number>;
type Weights = Record<Feature | 'bias', number>;

/** Where the model starts: a fair guess for any learner, before it has seen him play. */
const PRIOR: Weights = {
  bias: -1,
  bars: 3.5, // strength of the bars, per hand, he will play
  together: 1, // strength of those bars hands together (1 for one hand)
  move: 0.8, // strength of the weakest movement in it (1 when there is none)
  tried: -0.9, // played this exact exercise before...
  last: 1.5, // ...and how well it went last time
  streak: 0.8, // good runs in a row on it
  beat: -0.6, // with the metronome
  speed: -1.2, // how fast, from 60% (0) to 100% (1)
  size: -0.8, // how many bars
  density: -0.6, // notes per bar
  both: -0.3, // both hands at once
  noFingers: -0.4, // finger numbers hidden
  away: -0.5, // days since he last played these bars
};

/** The chance the planner aims for. */
export const TARGET = 0.82;
/** How well a chance fits the zone of ideal effort (1 at the target, near 0 below 60% or at 100%). */
export const fit = (p: number) => Math.exp(-(((p - TARGET) / 0.12) ** 2));

const RATE = 0.05;
const PULL = 0.01;
const KEY = 'hugos-piano:predict';
const LOG = 'hugos-piano:runlog';
const LOG_MAX = 500;

interface State { w: Weights; n: number; }

function load(): State {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as State | null;
    if (s?.w) return { w: { ...PRIOR, ...s.w }, n: s.n ?? 0 };
  } catch { /* storage unavailable */ }
  return { w: { ...PRIOR }, n: 0 };
}
function save(s: State) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const logit = (w: Weights, x: Features) => FEATURES.reduce((z, f) => z + w[f] * x[f], w.bias);

/** The chance of a good run. */
export function predict(x: Features): number {
  return sigmoid(logit(load().w, x));
}

/** One run in the log: what was predicted, and what happened. */
export interface RunLog { at: number; song: string; chunk: string; kind: string; p: number; good: 0 | 1; acc: number; }

export function runLog(): RunLog[] {
  try { return JSON.parse(localStorage.getItem(LOG) ?? '[]'); } catch { return []; }
}

/** Learns from a finished run: logs it, then moves the weights towards what happened. */
export function observe(x: Features, good: boolean, meta: { song: string; chunk: string; kind: string; acc: number }) {
  const s = load();
  const p = sigmoid(logit(s.w, x));
  const y = good ? 1 : 0;
  const err = y - p;
  s.w.bias += RATE * (err - PULL * (s.w.bias - PRIOR.bias));
  for (const f of FEATURES) s.w[f] += RATE * (err * x[f] - PULL * (s.w[f] - PRIOR[f]));
  s.n++;
  save(s);
  const log = runLog();
  log.push({ at: Date.now(), ...meta, p: Math.round(p * 1000) / 1000, good: y, acc: Math.round(meta.acc * 1000) / 1000 });
  try { localStorage.setItem(LOG, JSON.stringify(log.slice(-LOG_MAX))); } catch { /* storage unavailable */ }
}

/**
 * How honest the model is: runs grouped by predicted chance, against how many were really good.
 * Also the share of runs in the zone (good between 70% and 90% of the time is the aim) and the
 * Brier score (mean squared error of the predictions; lower is better, 0.25 is a coin toss).
 */
export function calibration(log = runLog()) {
  const buckets = Array.from({ length: 5 }, (_, i) => ({ from: 0.5 + i * 0.1 - (i === 0 ? 0.5 : 0), to: 0.6 + i * 0.1, n: 0, predicted: 0, actual: 0 }));
  for (const r of log) {
    const b = buckets.find(k => r.p >= k.from && (r.p < k.to || k.to >= 1)) ?? buckets[buckets.length - 1];
    b.n++; b.predicted += r.p; b.actual += r.good;
  }
  for (const b of buckets) if (b.n) { b.predicted /= b.n; b.actual /= b.n; }
  const n = log.length;
  const good = n ? log.reduce((a, r) => a + r.good, 0) / n : 0;
  const brier = n ? log.reduce((a, r) => a + (r.p - r.good) ** 2, 0) / n : 0;
  // Runs that failed straight after a failure: the frustration the planner tries to avoid.
  let worst = 0, cur = 0;
  for (const r of log) { cur = r.good ? 0 : cur + 1; worst = Math.max(worst, cur); }
  return { n, good, brier, worstFailStreak: worst, buckets, weights: load().w };
}

export function resetPredict() {
  try { localStorage.removeItem(KEY); localStorage.removeItem(LOG); } catch { /* ignore */ }
}
