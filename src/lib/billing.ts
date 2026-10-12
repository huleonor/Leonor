/**
 * Plans, Duolingo's way: the whole course is free, paced by energy (see energy.ts); Premium makes
 * energy unlimited, so the only limit is how long he wants to play.
 *
 * Prices follow the business plan (9.99 a month, 59.99 a year with a free week, 89.99 a year for a
 * family) and are set per region. No store is connected yet: purchases run in test mode and unlock
 * Premium on this device only, which the paywall says plainly. The App Store (StoreKit) and the web
 * checkout plug in behind `purchase` and `restore` later.
 */
import { useEffect, useState } from 'react';

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

/** Why the paywall opened, in one line on top of it. */
export type PaywallReason = 'energy' | 'upgrade';
export const REASON: Record<PaywallReason, string> = {
  energy: 'Out of energy? With Premium it never runs out.',
  upgrade: 'Learn as long as you like, every day.',
};
