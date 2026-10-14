/**
 * Forgetting, learnt from him. Everything he can play (a bar of one hand, a bar hands together,
 * a movement) fades while he stays away, at its own speed: its half-life, in days. A bar that
 * comes back clean after a week has a long half-life; one that is shaky the next morning, a short
 * one. Each time he comes back to something after a gap, the app compares how well he played it
 * with how well it expected him to, and moves the half-life towards what that shows; a clean
 * return also makes the memory sturdier (the spacing effect). New things start from his own
 * typical half-life, learnt across everything he has come back to.
 *
 * Review comes when what is left of a skill drops to DUE_AT: just before it is forgotten, which
 * is when practising it again does the most good.
 */

/** What practice leaves for good, however long he stays away (he does not forget how to read). */
export const FLOOR = 0.6;
/** Review is due once this much of a skill is left. */
const DUE_AT = 0.85;
/** A gap this long (in days) counts as coming back to it. */
export const GAP = 0.5;
/** His typical half-life before the app has seen him come back to anything. */
export const START_H = 1.5;
const MIN_H = 0.5;
const MAX_H = 60;
const clampH = (h: number) => Math.min(MAX_H, Math.max(MIN_H, h));

/** Share of a skill still there after `days` away, with a half-life of `h` days. */
export const kept = (days: number, h: number) => FLOOR + (1 - FLOOR) * 2 ** (-Math.max(0, days) / Math.max(MIN_H, h));

/** Days until review is due, for a half-life of `h` days. */
export const dueIn = (h: number) => h * Math.log2((1 - FLOOR) / (DUE_AT - FLOOR));

/** The half-life a return shows: how long it must be for `left` of the skill to remain after `days`. */
function shown(left: number, days: number) {
  const x = (Math.min(0.995, left) - FLOOR) / (1 - FLOOR);
  if (x <= 0.02) return MIN_H;
  return clampH(-days / Math.log2(x));
}

/**
 * Learns from coming back to a skill after `days` away: `before` is how strong it was when he
 * left, `q` how well he played it now (0-1). Returns the new half-life, and the half-life this
 * return showed (to learn his typical one from).
 */
export function relearn(h: number, before: number, q: number, days: number): { h: number; shown: number } {
  const left = before > 0.05 ? Math.min(1, q / before) : 1;
  // A return better than when he left is practice paying off, not proof he never forgets: cap it.
  const seen = Math.min(shown(left, days), 4 * days);
  // Half way to what this return showed: one return is a measurement, not the whole story.
  let next = Math.sqrt(h * seen);
  // Coming back clean makes it sturdier; coming back shaky, a little less so.
  next *= q >= 0.95 ? 2 : q >= 0.8 ? 1.4 : 0.8;
  // One return moves it at most threefold either way.
  return { h: clampH(Math.min(h * 3, Math.max(h / 3, next))), shown: seen };
}

/** His typical half-life, nudged by one return: an average on the log scale, slow to move. */
export const typical = (h0: number, seen: number) => clampH(Math.exp(0.85 * Math.log(h0) + 0.15 * Math.log(seen)));
