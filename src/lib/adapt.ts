/**
 * The difficulty coach: keeps every lesson in his zone of ideal effort, never so easy it bores
 * him, never so hard it frustrates him. At the piano every wrong note is a repetition of the wrong
 * movement, so the coach keeps him accurate: it aims for 88-97% of notes right, and eases off as
 * soon as he drops below that.
 *
 * It turns three knobs, one step at a time and only after two runs agree (hysteresis), so the
 * difficulty never jumps about:
 *   speed  – how fast the music moves (a factor on each step's own speed)
 *   hints  – how soon the keys to press light up when he is stuck
 *   fingers – finger numbers on every note, only where the hand moves, or none
 * When he struggles it eases the knob that matches the cause: hesitation means reading is the
 * problem (help sooner), wrong notes in tempo mean speed is (slow down).
 */
import type { RunSummary } from './skills';
import type { FingerMode } from './types';

export const SPEED_STEPS = [0.7, 0.8, 0.9, 1, 1.1, 1.2];
/** Hints, easiest first: [wrong notes, ms stuck] before the keys light up; the last is never. */
export const HINT_STEPS: { wrongs: number; ms: number }[] = [
  { wrongs: 0, ms: 0 },
  { wrongs: 1, ms: 2500 },
  { wrongs: 2, ms: 5000 },
  { wrongs: 3, ms: 8000 },
  { wrongs: 99, ms: 1e9 },
];
export const FINGER_STEPS: FingerMode[] = ['all', 'some', 'off'];

type Knob = 'speed' | 'hints' | 'fingers';
export interface Knobs { speed: number; hints: number; fingers: number; }
export interface CoachState extends Knobs { pending?: { dir: 1 | -1; n: number }; runs: number; }

export interface Change { knob: Knob; dir: 1 | -1; why: string; }

const KEY = 'hugos-piano:coach';
const DEFAULT: CoachState = { speed: 3, hints: 2, fingers: 0, runs: 0 };

export function loadCoach(): CoachState {
  try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return { ...DEFAULT }; }
}
function saveCoach(s: CoachState) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
}

/** What a step should use now. */
export function settingsFor(baseSpeed: number, wait: boolean, s = loadCoach()) {
  const f = SPEED_STEPS[s.speed];
  return {
    // Waiting steps can go a little faster than written; tempo steps never pass full speed.
    speed: Math.round(Math.min(wait ? 1.2 : 1, Math.max(0.4, baseSpeed * f)) * 100) / 100,
    hintAfter: HINT_STEPS[s.hints],
    fingers: FINGER_STEPS[s.fingers],
  };
}

/** Where he is in the zone, from a run. */
export function zone(r: RunSummary): 'easy' | 'good' | 'hard' {
  if (r.groups < 4) return 'good';
  const firstTime = r.clean / r.groups;
  if (r.accuracy < 0.88 || firstTime < 0.75 || r.hesitation > 3) return 'hard';
  if (r.accuracy >= 0.97 && firstTime >= 0.92 && r.hesitation < 1.2) return 'easy';
  return 'good';
}

const TROUBLE: Record<string, string> = {
  treble: 'treble clef notes', bass: 'bass clef notes', ledger: 'ledger-line notes', accidentals: 'sharps and flats',
  rhythm: 'the beat', eighths: 'eighth notes', dotted: 'dotted rhythms', together: 'hands together', chords: 'chords', leaps: 'leaps',
};

/**
 * Feeds a finished run to the coach. Returns the change it made, if any, with the reason to show.
 * `tempo` says whether the run was in tempo (wrong notes there point at speed, not reading).
 */
export function coachRun(r: RunSummary, tempo: boolean): Change | null {
  const s = loadCoach();
  s.runs++;
  const z = zone(r);
  if (z === 'good' || r.groups < 4) { s.pending = undefined; saveCoach(s); return null; }
  const dir: 1 | -1 = z === 'easy' ? 1 : -1;
  // A run far below the zone acts at once; otherwise two runs in a row must agree.
  const urgent = dir === -1 && r.accuracy < 0.5;
  const n = s.pending?.dir === dir ? s.pending.n + 1 : 1;
  if (n < 2 && !urgent) { s.pending = { dir, n }; saveCoach(s); return null; }
  s.pending = undefined;

  let change: Change | null = null;
  const about = r.trouble[0] ? TROUBLE[r.trouble[0]] : 'the notes';
  if (dir === -1) {
    // Ease the knob that matches the cause.
    if (r.hesitation > 2 && !tempo && s.hints > 0) change = { knob: 'hints', dir, why: `Keys light up sooner for now: you were pausing on ${about}.` };
    else if (s.speed > 0) change = { knob: 'speed', dir, why: `A little slower for now: ${about} were tripping you up.` };
    else if (s.hints > 0) change = { knob: 'hints', dir, why: `Keys light up sooner for now, to help with ${about}.` };
    else if (s.fingers > 0) change = { knob: 'fingers', dir, why: 'Finger numbers back on every note for now.' };
  } else {
    // Take away help first, then add speed, then drop the finger numbers.
    if (s.hints < 2) change = { knob: 'hints', dir, why: 'You are reading well: the keys now wait longer before lighting up.' };
    else if (s.speed < SPEED_STEPS.length - 1 && s.speed <= s.hints) change = { knob: 'speed', dir, why: 'That was clean: a little faster now.' };
    else if (s.hints < HINT_STEPS.length - 1) change = { knob: 'hints', dir, why: 'You barely needed help: the keys now wait longer before lighting up.' };
    else if (s.fingers < FINGER_STEPS.length - 1) change = { knob: 'fingers', dir, why: 'Fewer finger numbers now: your hand knows the way.' };
    else if (s.speed < SPEED_STEPS.length - 1) change = { knob: 'speed', dir, why: 'That was clean: a little faster now.' };
  }
  if (change) s[change.knob] += change.dir;
  saveCoach(s);
  return change;
}

/** How the coach has him set up, in words, for the progress page. */
export function describeCoach(s = loadCoach()) {
  const h = HINT_STEPS[s.hints];
  return {
    speed: `${Math.round(SPEED_STEPS[s.speed] * 100)}%`,
    hints: h.wrongs >= 99 ? 'Never' : h.wrongs === 0 ? 'Right away' : `After ${h.wrongs} wrong ${h.wrongs === 1 ? 'note' : 'notes'} or ${Math.round(h.ms / 1000)} s`,
    fingers: s.fingers === 0 ? 'Every note' : s.fingers === 1 ? 'Where the hand moves' : 'None',
  };
}
