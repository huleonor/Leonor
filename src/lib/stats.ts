/**
 * Daily practice: seconds actually played and steps finished, per local day. The streak counts
 * consecutive days with practice; today still counts as open until midnight.
 */
const KEY = 'hugos-piano:days';

export interface Day { sec: number; steps: number; }
type Days = Record<string, Day>;

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const listeners = new Set<() => void>();
export const onStats = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

function read(): Days {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Days; } catch { return {}; }
}

function write(days: Days) {
  try { localStorage.setItem(KEY, JSON.stringify(days)); } catch { /* storage unavailable */ }
  listeners.forEach(fn => fn());
}

/** A day counts towards the streak after a minute at the keys or one finished step. */
const counts = (d?: Day) => !!d && (d.sec >= 60 || d.steps > 0);

export function addPractice(sec: number, steps = 0) {
  if (sec <= 0 && steps <= 0) return;
  const days = read();
  const k = dayKey();
  const d = days[k] ?? { sec: 0, steps: 0 };
  days[k] = { sec: d.sec + Math.max(0, sec), steps: d.steps + steps };
  write(days);
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
export function lastDays(n = 7): { key: string; date: Date; day: Day; done: boolean }[] {
  const days = read();
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = dayKey(date);
    const day = days[key] ?? { sec: 0, steps: 0 };
    out.push({ key, date, day, done: counts(days[key]) });
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
  return { sec: keys.reduce((s, k) => s + days[k].sec, 0), days: keys.filter(k => counts(days[k])).length, best };
}
