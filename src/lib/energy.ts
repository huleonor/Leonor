/**
 * Energy and gems, Duolingo's freemium model applied to the piano.
 *
 * Energy: 25 at most. Every lesson step costs 1; it refills by itself, 1 every 12 minutes (full in
 * five hours); playing well earns it back: every 10 chords right first time in a row gives +1, and
 * chests on the path hold more. A practice from the Practice tab costs nothing and gives +2. With no
 * energy left he can wait, refill with gems, or go Premium, where energy is unlimited.
 *
 * Gems: earned by finishing lessons (more for more stars) and opening chests; spent in the shop on
 * a full refill or a streak freeze.
 */
import { useEffect, useState } from 'react';
import { isPremium } from './billing';
import { addFreeze, freezes } from './stats';

export const MAX_ENERGY = 25;
export const REGEN_MS = 12 * 60_000;
export const STREAK_FOR_ENERGY = 10;
export const PRICES = { refill: 350, freeze: 200 } as const;

const KEY = 'hugos-piano:economy';
interface State { energy: number; at: number; gems: number; chests: string[]; }

const listeners = new Set<() => void>();
const changed = () => listeners.forEach(fn => fn());

function read(): State {
  let s: State = { energy: MAX_ENERGY, at: Date.now(), gems: 100, chests: [] };
  try { s = { ...s, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { /* first run */ }
  // Refill for the time that passed, keeping the part of a tick already earned.
  if (s.energy < MAX_ENERGY) {
    const ticks = Math.floor((Date.now() - s.at) / REGEN_MS);
    if (ticks > 0) { s.energy = Math.min(MAX_ENERGY, s.energy + ticks); s.at += ticks * REGEN_MS; }
  }
  if (s.energy >= MAX_ENERGY) s.at = Date.now();
  return s;
}
function write(s: State) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
  changed();
}

export function energy(): number { return isPremium() ? Infinity : read().energy; }
export function gems(): number { return read().gems; }
/** Milliseconds until the next +1, and until full. */
export function refillIn(): { next: number; full: number } {
  const s = read();
  if (s.energy >= MAX_ENERGY) return { next: 0, full: 0 };
  const next = REGEN_MS - (Date.now() - s.at);
  return { next, full: next + (MAX_ENERGY - s.energy - 1) * REGEN_MS };
}

/** Takes energy for a lesson step. False when there is not enough (Premium always has enough). */
export function spendEnergy(n = 1): boolean {
  if (isPremium()) return true;
  const s = read();
  if (s.energy < n) return false;
  if (s.energy >= MAX_ENERGY) s.at = Date.now();
  s.energy -= n;
  write(s);
  return true;
}

export function gainEnergy(n: number) {
  const s = read();
  s.energy = Math.min(MAX_ENERGY, s.energy + n);
  write(s);
}

export function addGems(n: number) {
  const s = read();
  s.gems += n;
  write(s);
}

/** Gems for a finished step, by stars. */
export const gemsForStars = (stars: number) => [0, 2, 4, 6][stars] ?? 0;

// ---------- Chests on the path ----------

export type ChestReward = { energy: number; gems: number };
export const chestOpened = (id: string) => read().chests.includes(id);
/** Opens a chest once: half of them hold energy, the others gems. */
export function openChest(id: string, i: number): ChestReward | null {
  const s = read();
  if (s.chests.includes(id)) return null;
  const reward = i % 2 === 0 ? { energy: 10, gems: 5 } : { energy: 0, gems: 25 };
  s.chests.push(id);
  s.energy = Math.min(MAX_ENERGY, s.energy + reward.energy);
  s.gems += reward.gems;
  write(s);
  return reward;
}

// ---------- Shop ----------

export function buyRefill(): boolean {
  const s = read();
  if (s.gems < PRICES.refill || s.energy >= MAX_ENERGY) return false;
  s.gems -= PRICES.refill;
  s.energy = MAX_ENERGY;
  s.at = Date.now();
  write(s);
  return true;
}

export function buyFreeze(): boolean {
  const s = read();
  if (s.gems < PRICES.freeze || freezes() >= 2) return false;
  s.gems -= PRICES.freeze;
  write(s);
  addFreeze();
  return true;
}

/** Re-renders when energy or gems change, and once a minute for the refill timer. */
export function useEconomy() {
  const [, bump] = useState(0);
  useEffect(() => {
    const fn = () => bump(x => x + 1);
    listeners.add(fn);
    const id = window.setInterval(fn, 30_000);
    return () => { listeners.delete(fn); window.clearInterval(id); };
  }, []);
  return { energy: energy(), gems: gems(), premium: isPremium() };
}

/** "2 h 05 min" / "11 min". */
export const formatWait = (ms: number) => {
  const m = Math.ceil(ms / 60_000);
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`;
};
