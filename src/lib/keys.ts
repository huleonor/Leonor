import { isBlack } from './names';

export interface KeyGeom { x: number; w: number; black: boolean; }

/** Pick a keyboard range around the song: at least two octaves, starting on C or F, ending on E or B. */
export function pickRange(min: number, max: number, minSpan = 24): [number, number] {
  let lo = min - 1, hi = max + 1;
  if (hi - lo < minSpan) {
    const mid = (lo + hi) / 2;
    lo = Math.round(mid - minSpan / 2);
    hi = Math.round(mid + minSpan / 2);
  }
  while (![0, 5].includes(((lo % 12) + 12) % 12)) lo--;
  while (![4, 11].includes(((hi % 12) + 12) % 12)) hi++;
  return [Math.max(21, lo), Math.min(108, hi)];
}

/** Key rectangles in fractions of the keyboard width (0..1). */
export function keyLayout(lo: number, hi: number): Record<number, KeyGeom> {
  const whites: number[] = [];
  for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites.push(m);
  const ww = 1 / whites.length;
  const bw = ww * 0.62;
  const map: Record<number, KeyGeom> = {};
  whites.forEach((m, i) => (map[m] = { x: i * ww, w: ww, black: false }));
  for (let m = lo; m <= hi; m++) {
    if (!isBlack(m)) continue;
    const left = map[m - 1];
    if (!left) continue;
    // Nudge black keys the way a real keyboard groups them (2 + 3).
    const pc = m % 12;
    const nudge = pc === 1 || pc === 6 ? -0.08 : pc === 3 || pc === 10 ? 0.08 : 0;
    map[m] = { x: left.x + ww - bw / 2 + nudge * bw, w: bw, black: true };
  }
  return map;
}

export const whiteCount = (lo: number, hi: number) => {
  let c = 0;
  for (let m = lo; m <= hi; m++) if (!isBlack(m)) c++;
  return c;
};
