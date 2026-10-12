/**
 * Plans and what they unlock. Free keeps the habit going (the first two units, the daily session,
 * the difficulty coach, your skill map, up to three songs of your own); Premium opens the whole
 * course, unlimited skill practice, unlimited songs, and the AI coach with a weekly plan.
 *
 * Prices follow the business plan (9.99 a month, 59.99 a year with a free week, 89.99 a year for a
 * family) and are set per region. No store is connected yet: purchases run in test mode and unlock
 * Premium on this device only, which the paywall says plainly. The App Store (StoreKit) and the web
 * checkout plug in behind `purchase` and `restore` later.
 */
import { useEffect, useState } from 'react';
import { dayKey } from './stats';

export type PlanId = 'monthly' | 'annual' | 'family';

interface Region { id: string; currency: string; locale: string; prices: Record<PlanId, number>; }
const REGIONS: Region[] = [
  { id: 'EU', currency: 'EUR', locale: 'pt-PT', prices: { monthly: 9.99, annual: 59.99, family: 89.99 } },
  { id: 'US', currency: 'USD', locale: 'en-US', prices: { monthly: 9.99, annual: 59.99, family: 89.99 } },
  { id: 'GB', currency: 'GBP', locale: 'en-GB', prices: { monthly: 8.99, annual: 54.99, family: 79.99 } },
  { id: 'BR', currency: 'BRL', locale: 'pt-BR', prices: { monthly: 19.9, annual: 119.9, family: 179.9 } },
];

/** The region from the device language (pt-BR → Brazil, en-US → US, en-GB → UK, otherwise euros). */
export function region(lang = navigator.language): Region {
  const country = lang.split('-')[1]?.toUpperCase();
  return REGIONS.find(r => r.id === country) ?? REGIONS[0];
}

export function price(plan: PlanId, perMonth = false, r = region()) {
  const v = perMonth && plan !== 'monthly' ? r.prices[plan] / 12 : r.prices[plan];
  return new Intl.NumberFormat(r.locale, { style: 'currency', currency: r.currency }).format(Math.floor(v * 100) / 100);
}

/** Savings of the annual plan against twelve months, in whole percent. */
export const annualSaving = (r = region()) => Math.round((1 - r.prices.annual / (r.prices.monthly * 12)) * 100);

export const PLANS: { id: PlanId; name: string; note: string }[] = [
  { id: 'annual', name: '12 months', note: '7 days free, then billed yearly' },
  { id: 'monthly', name: '1 month', note: 'Billed monthly, cancel any time' },
  { id: 'family', name: 'Family, 12 months', note: 'Up to 6 people, billed yearly' },
];

// ---------- What he has ----------

const KEY = 'hugos-piano:plan';
interface Entitlement { plan: PlanId; until: number; trial: boolean; test: boolean; }

const listeners = new Set<() => void>();
const changed = () => listeners.forEach(fn => fn());

export function entitlement(): Entitlement | null {
  try {
    const e = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Entitlement | null;
    return e && e.until > Date.now() ? e : null;
  } catch { return null; }
}
export const isPremium = () => !!entitlement();

/** Test-mode purchase: unlocks on this device. The annual plan starts with a free week. */
export async function purchase(plan: PlanId): Promise<Entitlement> {
  const day = 86_400_000;
  const trial = plan === 'annual' && !localStorage.getItem(`${KEY}:trial-used`);
  const until = Date.now() + (trial ? 7 * day : plan === 'monthly' ? 30 * day : 365 * day);
  const e: Entitlement = { plan, until, trial, test: true };
  try {
    localStorage.setItem(KEY, JSON.stringify(e));
    if (trial) localStorage.setItem(`${KEY}:trial-used`, '1');
  } catch { /* storage unavailable */ }
  changed();
  return e;
}

/** Nothing to restore until a store is connected. */
export async function restore(): Promise<boolean> { return isPremium(); }

export function cancelTest() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  changed();
}

export function usePlan() {
  const [, bump] = useState(0);
  useEffect(() => { const fn = () => bump(x => x + 1); listeners.add(fn); return () => { listeners.delete(fn); }; }, []);
  return entitlement();
}

// ---------- Free plan limits ----------

/** Units the free plan includes (1 and 2). */
export const FREE_UNITS = 2;
/** Own songs the free plan holds. */
export const FREE_SONGS = 3;
/** Skill practices a day on the free plan (the daily session does not count). */
export const FREE_PRACTICE = 3;

const PRACTICE = 'hugos-piano:practice-count';
export function practicesLeft(): number {
  if (isPremium()) return Infinity;
  try {
    const s = JSON.parse(localStorage.getItem(PRACTICE) ?? '{}') as { day?: string; n?: number };
    return FREE_PRACTICE - (s.day === dayKey() ? s.n ?? 0 : 0);
  } catch { return FREE_PRACTICE; }
}
export function countPractice() {
  if (isPremium()) return;
  try {
    const s = JSON.parse(localStorage.getItem(PRACTICE) ?? '{}') as { day?: string; n?: number };
    localStorage.setItem(PRACTICE, JSON.stringify({ day: dayKey(), n: (s.day === dayKey() ? s.n ?? 0 : 0) + 1 }));
  } catch { /* ignore */ }
}

/** Why the paywall opened, in one line on top of it. */
export type PaywallReason = 'unit' | 'practice' | 'songs' | 'coach' | 'upgrade';
export const REASON: Record<PaywallReason, string> = {
  unit: 'Units 3 to 7 are part of Premium.',
  practice: `The free plan includes ${FREE_PRACTICE} skill practices a day.`,
  songs: `The free plan holds ${FREE_SONGS} songs of your own.`,
  coach: 'The AI coach and your weekly plan are part of Premium.',
  upgrade: 'Learn faster with everything unlocked.',
};
