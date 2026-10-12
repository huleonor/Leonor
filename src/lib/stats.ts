/**
 * Daily practice: seconds actually played, steps finished and XP earned, per local day. The streak
 * counts consecutive days with practice; today still counts as open until midnight. A streak
 * freeze, earned every seven days in a row (two at most), covers a missed day, Duolingo style.
 */
const KEY = 'hugos-piano:days';

export interface Day { sec: number; steps: number; xp?: number; /** Covered by a streak freeze. */ frozen?: boolean; }
type Days = Record<string, Day>;

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const listeners = new Set<() => void>();
export const onStats = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

/** Celebrations: the daily goal reached, a freeze earned or used. */
export type Moment = { kind: 'goal'; minutes: number; streak: number } | { kind: 'freeze-earned'; have: number } | { kind: 'freeze-used'; days: number } | { kind: 'session'; xp: number; streak: number };
const moments = new Set<(m: Moment) => void>();
export const onMoment = (fn: (m: Moment) => void) => { moments.add(fn); return () => { moments.delete(fn); }; };
const celebrate = (m: Moment) => moments.forEach(fn => fn(m));

let goalMinutes = 10;
export const setGoalMinutes = (m: number) => { goalMinutes = m; };

function read(): Days {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Days; } catch { return {}; }
}

function write(days: Days) {
  try { localStorage.setItem(KEY, JSON.stringify(days)); } catch { /* storage unavailable */ }
  listeners.forEach(fn => fn());
}

/** A day counts towards the streak after a minute at the keys or one finished step. */
const played = (d?: Day) => !!d && (d.sec >= 60 || d.steps > 0);
/** For the streak, a frozen day keeps the chain going. */
const counts = (d?: Day) => played(d) || !!d?.frozen;

export function addPractice(sec: number, steps = 0, xp = 0) {
  if (sec <= 0 && steps <= 0 && xp <= 0) return;
  const days = read();
  const k = dayKey();
  const d = days[k] ?? { sec: 0, steps: 0 };
  const wasPlayed = played(d);
  const before = d.sec;
  days[k] = { ...d, sec: d.sec + Math.max(0, sec), steps: d.steps + steps, xp: (d.xp ?? 0) + xp };
  write(days);
  if (before < goalMinutes * 60 && days[k].sec >= goalMinutes * 60) celebrate({ kind: 'goal', minutes: goalMinutes, streak: streak().days });
  if (!wasPlayed && played(days[k])) earnFreeze();
}

// ---------- Streak freezes ----------

const FREEZE = 'hugos-piano:freezes';
interface Freezes { have: number; /** The streak length last rewarded, so each 7 is rewarded once. */ rewarded: number; }
function readFreezes(): Freezes {
  try { return { have: 0, rewarded: 0, ...JSON.parse(localStorage.getItem(FREEZE) ?? '{}') }; } catch { return { have: 0, rewarded: 0 }; }
}
function writeFreezes(f: Freezes) { try { localStorage.setItem(FREEZE, JSON.stringify(f)); } catch { /* ignore */ } }
export const freezes = () => readFreezes().have;
/** A freeze bought in the shop (two at most). */
export function addFreeze() {
  const f = readFreezes();
  if (f.have >= 2) return;
  f.have++;
  writeFreezes(f);
  listeners.forEach(fn => fn());
}

/** Every seven days in a row earns a freeze, two at most. */
function earnFreeze() {
  const f = readFreezes();
  const n = streak().days;
  if (n < f.rewarded) f.rewarded = 0; // a new streak
  // Each new stretch of seven days earns one, even if a frozen day made the count skip past 7.
  if (n >= f.rewarded + 7 && f.have < 2) {
    f.have++;
    f.rewarded = n - (n % 7);
    writeFreezes(f);
    celebrate({ kind: 'freeze-earned', have: f.have });
  }
}

/**
 * Run when the app opens: days missed since the last practice are covered by freezes, one each,
 * if there are enough of them for every missed day (otherwise the streak ends, as it should).
 */
export function applyFreezes() {
  const f = readFreezes();
  if (!f.have) return;
  const days = read();
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const missed: string[] = [];
  while (!counts(days[dayKey(d)]) && missed.length <= f.have) { missed.push(dayKey(d)); d.setDate(d.getDate() - 1); }
  // Only worth it when there was a streak to save just before the gap.
  if (!missed.length || missed.length > f.have || !counts(days[dayKey(d)])) return;
  for (const k of missed) days[k] = { ...(days[k] ?? { sec: 0, steps: 0 }), frozen: true };
  f.have -= missed.length;
  writeFreezes(f);
  write(days);
  celebrate({ kind: 'freeze-used', days: missed.length });
}

// ---------- XP ----------

/** XP for a finished step: more for more stars, a bonus for a perfect one. */
export const xpForStars = (stars: number) => (stars <= 0 ? 0 : 10 + stars * 5 + (stars === 3 ? 5 : 0));

/** Today's session done: a bonus and a moment to celebrate. */
export function sessionComplete(bonus = 20) {
  addPractice(0, 0, bonus);
  celebrate({ kind: 'session', xp: (today().xp ?? 0), streak: streak().days });
}

export function totalXp(): number {
  return Object.values(read()).reduce((s, d) => s + (d.xp ?? 0), 0);
}

export function today(): Day { return read()[dayKey()] ?? { sec: 0, steps: 0 }; }

export function streak(): { days: number; today: boolean } {
  const days = read();
  const d = new Date();
  const todayDone = counts(days[dayKey(d)]);
  if (!todayDone) d.setDate(d.getDate() - 1);
  let n = 0;
  while (counts(days[dayKey(d)])) { n++; d.setDate(d.getDate() - 1); }
  return { days: n, today: todayDone };
}

/** The last `n` days, oldest first, for the week chart. */
export function lastDays(n = 7): { key: string; date: Date; day: Day; done: boolean; frozen: boolean }[] {
  const days = read();
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = dayKey(date);
    const day = days[key] ?? { sec: 0, steps: 0 };
    out.push({ key, date, day, done: played(days[key]), frozen: !played(days[key]) && !!days[key]?.frozen });
  }
  return out;
}

export function totals(): { sec: number; days: number; best: number } {
  const days = read();
  const keys = Object.keys(days).sort();
  let best = 0, run = 0, prev: Date | null = null;
  for (const k of keys) {
    if (!counts(days[k])) continue;
    const [y, m, dd] = k.split('-').map(Number);
    const date = new Date(y, m - 1, dd);
    run = prev && Math.round((date.getTime() - prev.getTime()) / 86400000) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = date;
  }
  return { sec: keys.reduce((s, k) => s + days[k].sec, 0), days: keys.filter(k => played(days[k])).length, best };
}
