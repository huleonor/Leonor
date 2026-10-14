/**
 * His profile: a name, a penguin he dresses himself, and the day he started. Stored on the
 * device like everything else.
 */
import { useEffect, useState } from 'react';

export const AV_BG = ['sky', 'lime', 'mint', 'peach', 'pink', 'lilac'] as const;
export const AV_BODY = ['navy', 'ink', 'blue', 'teal', 'plum'] as const;
export const AV_EXTRA = ['none', 'glasses', 'headphones', 'beanie', 'bowtie', 'crown'] as const;
export type AvBg = typeof AV_BG[number];
export type AvBody = typeof AV_BODY[number];
export type AvExtra = typeof AV_EXTRA[number];
export interface Look { bg: AvBg; body: AvBody; extra: AvExtra; }

export interface Profile { name: string; look: Look; /** When he started (ms). */ since: number; }

const KEY = 'hugos-piano:profile';
const DEFAULT: Profile = { name: 'Hugo', look: { bg: 'sky', body: 'navy', extra: 'glasses' }, since: Date.now() };

const listeners = new Set<() => void>();

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT, ...JSON.parse(raw) };
    // The first time: remember today as the day he started.
    localStorage.setItem(KEY, JSON.stringify(DEFAULT));
  } catch { /* storage unavailable */ }
  return { ...DEFAULT };
}

export function saveProfile(p: Profile) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage unavailable */ }
  listeners.forEach(fn => fn());
}

export function useProfile(): Profile {
  const [p, setP] = useState(loadProfile);
  useEffect(() => { const fn = () => setP(loadProfile()); listeners.add(fn); return () => { listeners.delete(fn); }; }, []);
  return p;
}
