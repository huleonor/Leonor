/**
 * A course per song, the way a teacher splits a piece: short parts, each learnt phrase by phrase and
 * hand by hand (the tricky phrase twice), then hands together, then in tempo; then the whole song.
 * Parts that repeat an earlier one are marked as such and count as learnt with it.
 */
import { createStore, del, get, set } from 'idb-keyval';
import { scoreBar, splitBars } from './analysis';
import type { HandsChoice, Song } from './types';

export interface CoursePart {
  n: number;
  /** Bars, 1-based, inclusive. */
  from: number;
  to: number;
  /** This part plays the same music as an earlier one. */
  sameAs?: number;
  /** Among the hardest parts of the song. */
  hard: boolean;
}

export type StepKind = 'phrase' | 'hand' | 'together' | 'tempo' | 'join' | 'song';

export interface CourseStep {
  id: string;
  kind: StepKind;
  title: string;
  /** Short name for a keycap. */
  short: string;
  part?: number;
  parts?: [number, number];
  from: number;
  to: number;
  hands: HandsChoice;
  speed: number;
  wait: boolean;
}

export interface Course {
  parts: CoursePart[];
  steps: CourseStep[];
  twoHands: boolean;
}

export interface StepResult { stars: number; accuracy: number; }
export type CourseProgress = Record<string, StepResult>;

/** Accuracy to stars: one to pass, three for a clean run. */
export const starsFor = (accuracy: number) => (accuracy >= 0.95 ? 3 : accuracy >= 0.85 ? 2 : accuracy >= 0.7 ? 1 : 0);

export function buildCourse(song: Song): Course {
  const { bars } = splitBars(song);
  const withNotes = bars.map((b, i) => (b.notes.length ? i : -1)).filter(i => i >= 0);
  const twoHands = song.hands.length === 2;
  if (!withNotes.length) return { parts: [], steps: [], twoHands };
  const first = withNotes[0], last = withNotes[withNotes.length - 1];

  // Part length: about 10–16 seconds of music at full speed, in 2, 4 or 8 bars; long songs get
  // longer parts (up to 8 bars) so the course stays a size you can see through.
  const barSeconds = song.duration / Math.max(1, bars.length);
  const want = 13 / Math.max(0.3, barSeconds);
  let len = want >= 6 ? 8 : want >= 3 ? 4 : 2;
  while (len < 8 && (last - first + 1) / len > 16) len *= 2;

  const parts: CoursePart[] = [];
  for (let b = first; b <= last; b += len) {
    parts.push({ n: parts.length + 1, from: b + 1, to: Math.min(last, b + len - 1) + 1, hard: false });
  }
  // A short tail joins the part before it.
  const tail = parts[parts.length - 1];
  if (parts.length > 1 && tail.to - tail.from + 1 < len / 2) {
    parts.pop();
    parts[parts.length - 1].to = tail.to;
  }

  // Same music as an earlier part (80% of the notes in the same place): learnt once, counted twice.
  const [num, den] = song.timeSig;
  const measureTicks = song.ppq * 4 * (num / den);
  const q = song.ppq / 4;
  const tokensOf = (p: CoursePart) => {
    const start = (p.from - 1) * measureTicks;
    const t = new Map<string, number>();
    for (const b of bars.slice(p.from - 1, p.to)) {
      for (const n of b.notes) {
        const k = `${Math.round((n.ticks - start) / q)}:${n.midi}`;
        t.set(k, (t.get(k) ?? 0) + 1);
      }
    }
    return t;
  };
  const alike = (a: Map<string, number>, b: Map<string, number>) => {
    let inter = 0, na = 0, nb = 0;
    for (const [k, v] of a) { na += v; inter += Math.min(v, b.get(k) ?? 0); }
    for (const v of b.values()) nb += v;
    return inter / Math.max(na, nb, 1);
  };
  const toks = parts.map(tokensOf);
  parts.forEach((p, i) => {
    if (p.to - p.from !== len - 1) return;
    const j = parts.slice(0, i).findIndex((q2, k) => !q2.sameAs && q2.to - q2.from === p.to - p.from && alike(toks[k], toks[i]) >= 0.8);
    if (j >= 0) p.sameAs = parts[j].n;
  });

  // The hardest third of the parts get a warning light.
  const score = (p: CoursePart) => Math.max(0, ...bars.slice(p.from - 1, p.to).map(scoreBar));
  const ranked = parts.filter(p => !p.sameAs).map(p => ({ p, s: score(p) })).sort((a, b) => b.s - a.s);
  const mean = ranked.reduce((a, r) => a + r.s, 0) / Math.max(1, ranked.length);
  ranked.slice(0, Math.max(1, Math.round(ranked.length / 3))).forEach(r => { if (r.s > mean * 1.1) r.p.hard = true; });

  // Each part is a lesson of short steps, Simply Piano style: a phrase or two bars at a time, hand by
  // hand, the trickiest phrase once more and slower, then the hands together and in tempo. So the
  // number of steps follows the music: an easy two-bar part has four, a busy eight-bar part fifteen.
  const scores = bars.filter(b => b.notes.length).map(scoreBar).sort((a, b) => a - b);
  const median = scores[Math.floor(scores.length / 2)] ?? 0;
  const steps: CourseStep[] = [];
  const both: HandsChoice = twoHands ? 'both' : song.hands[0];
  for (const p of parts) {
    if (p.sameAs) continue;
    const at = { part: p.n, from: p.from, to: p.to };
    const n = p.to - p.from + 1;
    // Phrases of about five seconds or more, at most three to a part.
    let plen = n <= 2 ? n : barSeconds * 2 >= 4.5 || n <= 4 ? 2 : 4;
    while (Math.ceil(n / plen) > 3) plen *= 2;
    const phrases: { i: number; from: number; to: number; hard: boolean }[] = [];
    for (let b = p.from; b <= p.to; b += plen) phrases.push({ i: phrases.length + 1, from: b, to: Math.min(p.to, b + plen - 1), hard: false });
    // The hardest phrase, if it is clearly harder than the song's typical bar, gets a second, slower go.
    const pScore = (ph: { from: number; to: number }) => Math.max(0, ...bars.slice(ph.from - 1, ph.to).map(scoreBar));
    const hardest = [...phrases].sort((a, b) => pScore(b) - pScore(a))[0];
    if (hardest && pScore(hardest) > median * 1.15) hardest.hard = true;
    const has = (h: 'R' | 'L', ph: { from: number; to: number }) => bars.slice(ph.from - 1, ph.to).some(b => b.notes.some(x => x.hand === h));
    const span = (ph: { from: number; to: number }) => (ph.from === ph.to ? `bar ${ph.from}` : `bars ${ph.from}–${ph.to}`);
    const many = phrases.length > 1;

    const drill = (key: string, label: string, hands: HandsChoice, speed: number, h?: 'R' | 'L') => {
      for (const ph of phrases) {
        if (h && !has(h, ph)) continue;
        const where = { part: p.n, from: ph.from, to: ph.to };
        if (many) steps.push({ id: `p${p.n}-${key}${ph.i}`, kind: 'phrase', title: `${label} · ${span(ph)}`, short: `${key}${ph.i}`, ...where, hands, speed, wait: true });
        if (ph.hard) steps.push({ id: `p${p.n}-${key}${ph.i}x`, kind: 'phrase', title: `Tricky bit · ${label.toLowerCase()} · ${span(ph)}`, short: `${key}!`, ...where, hands, speed: Math.max(0.5, speed - 0.2), wait: true });
      }
    };
    if (twoHands) {
      for (const [h, label] of [['R', 'Right hand'], ['L', 'Left hand']] as const) {
        if (!has(h, p)) continue;
        drill(h, label, h, 0.6, h);
        steps.push({ id: `p${p.n}-${h}`, kind: 'hand', title: many ? `${label} · whole part` : label, short: h, ...at, hands: h, speed: 0.7, wait: true });
      }
      drill('B', 'Hands together', 'both', 0.6);
      steps.push({ id: `p${p.n}-both`, kind: 'together', title: 'Hands together · whole part', short: 'R+L', ...at, hands: 'both', speed: 0.8, wait: true });
    } else {
      drill('S', 'Slowly', both, 0.6);
      steps.push({ id: `p${p.n}-slow`, kind: 'hand', title: 'Whole part, slowly', short: '.6', ...at, hands: both, speed: 0.6, wait: true });
      steps.push({ id: `p${p.n}-both`, kind: 'together', title: 'A little faster', short: '.8', ...at, hands: both, speed: 0.8, wait: true });
    }
    steps.push({ id: `p${p.n}-tempo`, kind: 'tempo', title: 'In tempo', short: '1×', ...at, hands: both, speed: 1, wait: false });
  }
  // Then the whole song: once with Wait, then the final performance in tempo.
  const from = parts[0].from, to = parts[parts.length - 1].to;
  steps.push({ id: 'song-wait', kind: 'song', title: 'Whole song', short: 'All', from, to, hands: both, speed: 0.8, wait: true });
  steps.push({ id: 'song', kind: 'song', title: 'Final performance', short: '1×', from, to, hands: both, speed: 1, wait: false });
  return { parts, steps, twoHands };
}

const stars = (prog: CourseProgress, id: string) => prog[id]?.stars ?? 0;

/** A part is learnt when its "hands together" step has at least one star (or the part it repeats has). */
export function partLearnt(course: Course, prog: CourseProgress, n: number): boolean {
  const p = course.parts.find(q => q.n === n);
  if (!p) return false;
  return stars(prog, `p${p.sameAs ?? p.n}-both`) > 0;
}

/**
 * Steps inside a part open one after the other; every part can be started at any time.
 * Joins open once their parts are learnt, the whole song once every part is.
 */
export function stepOpen(course: Course, prog: CourseProgress, step: CourseStep): boolean {
  if (step.part !== undefined) {
    const inPart = course.steps.filter(s => s.part === step.part);
    const i = inPart.indexOf(step);
    return i <= 0 || stars(prog, inPart[i - 1].id) > 0;
  }
  if (step.kind === 'join') {
    const [a, b] = step.parts!;
    return partLearnt(course, prog, a) && partLearnt(course, prog, b);
  }
  if (step.id === 'song') return stars(prog, 'song-wait') > 0;
  return course.parts.every(p => partLearnt(course, prog, p.n));
}

/** The step to do next: the first open step without a star, in course order. */
export function nextStep(course: Course, prog: CourseProgress): CourseStep | undefined {
  return course.steps.find(s => stepOpen(course, prog, s) && stars(prog, s.id) === 0)
    ?? course.steps.find(s => stars(prog, s.id) < 3 && stepOpen(course, prog, s));
}

export function courseStars(course: Course, prog: CourseProgress) {
  return { got: course.steps.reduce((a, s) => a + stars(prog, s.id), 0), total: course.steps.length * 3 };
}

const courseStore = createStore('hugos-piano-course', 'progress');

export async function clearCourseProgress(songId: string) {
  try { await del(songId, courseStore); } catch { /* storage unavailable */ }
}

export async function getCourseProgress(songId: string): Promise<CourseProgress> {
  try { return (await get<CourseProgress>(songId, courseStore)) ?? {}; } catch { return {}; }
}

/** Keeps the best result of each step. */
export async function recordStep(songId: string, stepId: string, accuracy: number): Promise<CourseProgress> {
  const prog = await getCourseProgress(songId);
  const prev = prog[stepId];
  const result = { stars: starsFor(accuracy), accuracy };
  if (!prev || result.accuracy > prev.accuracy) prog[stepId] = { stars: Math.max(result.stars, prev?.stars ?? 0), accuracy: Math.max(accuracy, prev?.accuracy ?? 0) };
  try { await set(songId, prog, courseStore); } catch { /* storage unavailable */ }
  try { localStorage.setItem('hugos-piano:last', JSON.stringify({ songId, at: Date.now() })); } catch { /* ignore */ }
  return prog;
}

/** The song practised most recently, for the library's Continue panel. */
export function lastPractised(): { songId: string; at: number } | null {
  try { return JSON.parse(localStorage.getItem('hugos-piano:last') ?? 'null'); } catch { return null; }
}
