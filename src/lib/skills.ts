/**
 * The player's skill profile: one mastery level (0–1) per skill, learnt from every note he plays.
 *
 * Each written chord he is asked to play is evidence for the skills it exercises (the clef it is
 * read in, ledger lines, accidentals, its rhythm, a leap, a chord, both hands at once). How well it
 * went is scored from what the engine saw: right first time and without hesitating is full marks,
 * found after a long stall or wrong notes is partial, missed is zero. Mastery is a moving average of
 * those scores, so it follows him as he improves; a snapshot a day lets the app show then and now.
 */
import type { Engine } from './engine';
import { HIT, MISS, type Song, type SongNote } from './types';
import { dayKey } from './stats';
import { songGrade } from './analysis';

export type SkillId =
  | 'treble' | 'bass' | 'ledger' | 'accidentals'
  | 'rhythm' | 'eighths' | 'dotted'
  | 'together' | 'chords' | 'leaps';

export const SKILLS: { id: SkillId; name: string; area: 'Reading' | 'Rhythm' | 'Technique' }[] = [
  { id: 'treble', name: 'Treble clef', area: 'Reading' },
  { id: 'bass', name: 'Bass clef', area: 'Reading' },
  { id: 'ledger', name: 'Ledger lines', area: 'Reading' },
  { id: 'accidentals', name: 'Sharps and flats', area: 'Reading' },
  { id: 'rhythm', name: 'Steady beat', area: 'Rhythm' },
  { id: 'eighths', name: 'Eighth notes', area: 'Rhythm' },
  { id: 'dotted', name: 'Dotted rhythms', area: 'Rhythm' },
  { id: 'together', name: 'Hands together', area: 'Technique' },
  { id: 'chords', name: 'Chords', area: 'Technique' },
  { id: 'leaps', name: 'Leaps', area: 'Technique' },
];

export interface SkillState { m: number; n: number; }
export type Profile = Record<SkillId, SkillState>;

const KEY = 'hugos-piano:skills';
const HISTORY = 'hugos-piano:skills-history';
const START = 0.3; // where an unseen skill starts
const ALPHA = 0.06; // how fast mastery follows new evidence

const listeners = new Set<() => void>();
export const onSkills = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

export function loadProfile(): Profile {
  let saved: Partial<Profile> = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { /* none yet */ }
  return Object.fromEntries(SKILLS.map(s => [s.id, saved[s.id] ?? { m: START, n: 0 }])) as Profile;
}

function saveProfile(p: Profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
    // One snapshot a day, for "a week ago you… today you…".
    const hist = JSON.parse(localStorage.getItem(HISTORY) ?? '{}') as Record<string, Record<string, number>>;
    hist[dayKey()] = Object.fromEntries(SKILLS.map(s => [s.id, Math.round(p[s.id].m * 1000) / 1000]));
    const keys = Object.keys(hist).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - 120))) delete hist[k];
    localStorage.setItem(HISTORY, JSON.stringify(hist));
  } catch { /* storage unavailable */ }
  listeners.forEach(fn => fn());
}

/** The snapshot closest to `daysAgo` days back (the oldest one if he is newer than that). */
export function snapshotAgo(daysAgo: number): { key: string; skills: Record<string, number> } | null {
  let hist: Record<string, Record<string, number>> = {};
  try { hist = JSON.parse(localStorage.getItem(HISTORY) ?? '{}'); } catch { return null; }
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const target = dayKey(d);
  const keys = Object.keys(hist).sort().filter(k => k < dayKey());
  if (!keys.length) return null;
  const k = [...keys].reverse().find(x => x <= target) ?? keys[0];
  return { key: k, skills: hist[k] };
}

/** Skills he has practised, weakest first. */
export function weakest(p = loadProfile(), min = 4): SkillId[] {
  return SKILLS.map(s => s.id).filter(id => p[id].n >= min).sort((a, b) => p[a].m - p[b].m);
}

// ---------- What a note exercises ----------

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const inKey = (midi: number, fifths: number) => {
  const tonic = (((fifths * 7) % 12) + 12) % 12;
  return MAJOR.includes((((midi - tonic) % 12) + 12) % 12);
};

/** The skills a chord of notes exercises. `prev` is the last note of the same hand before it. */
export function skillsOf(song: Song, group: SongNote[], prev: Map<'R' | 'L', SongNote>): SkillId[] {
  const out = new Set<SkillId>(['rhythm']);
  const beat = song.ppq;
  for (const n of group) {
    // Right hand reads the treble staff, left hand the bass staff (as the score is engraved).
    if (n.hand === 'R') { out.add('treble'); if (n.midi < 62 || n.midi > 79) out.add('ledger'); }
    else { out.add('bass'); if (n.midi < 41 || n.midi > 59) out.add('ledger'); }
    if (!inKey(n.midi, song.fifths) || song.fifths !== 0) out.add('accidentals');
    const d = n.durationTicks / beat;
    if (d <= 0.55) out.add('eighths');
    if (Math.abs(d - 1.5) < 0.12 || Math.abs(d - 0.75) < 0.08 || Math.abs(d - 3) < 0.2) out.add('dotted');
    const p = prev.get(n.hand);
    if (p && Math.abs(p.midi - n.midi) > 7) out.add('leaps');
  }
  if (new Set(group.map(n => n.hand)).size > 1) out.add('together');
  if (group.filter(n => n.hand === group[0].hand).length > 1 || group.length > 2) out.add('chords');
  return [...out];
}

// ---------- Listening to a run ----------

export interface RunSummary {
  /** Chords he was asked for, and how many he got right first time. */
  groups: number;
  clean: number;
  /** Seconds stuck before finding the notes, median over the chords he waited on. */
  hesitation: number;
  /** Wrong notes per chord. */
  wrongRate: number;
  accuracy: number;
  /** The skills that went worst in this run, worst first. */
  trouble: SkillId[];
}

/**
 * Follows an engine and turns every chord he finishes into skill evidence. Returns `stop`, which
 * saves the profile and gives the run's summary (for the difficulty coach).
 */
export function listenForSkills(engine: Engine): { stop: () => RunSummary; summary: () => RunSummary } {
  const profile = loadProfile();
  const song = engine.song;
  const ceiling = song.ceiling ?? 0.5 + 0.1 * songGrade(song);
  let cur = engine.gi, wrongs = 0, waitStart = 0, dirty = false;
  const hes: number[] = [];
  let groups = 0, clean = 0, wrongTotal = 0;
  const runScore: Partial<Record<SkillId, { sum: number; n: number }>> = {};
  const prevOf = (gi: number) => {
    const prev = new Map<'R' | 'L', SongNote>();
    const g = engine.groups[gi - 1];
    if (g) for (const id of g.ids) prev.set(song.notes[id].hand, song.notes[id]);
    return prev;
  };

  const settle = (gi: number, now: number) => {
    const g = engine.groups[gi];
    if (!g) return;
    const st = g.ids.map(id => engine.status[id]);
    if (st.some(s => s !== HIT && s !== MISS)) return;
    const hit = st.every(s => s === HIT);
    const stuck = gi === cur && waitStart ? (now - waitStart) / 1000 : 0;
    const w = gi === cur ? wrongs : 0;
    // Full marks: right, first time, quickly. Partial: found after a stall or wrong notes.
    // Playing an easy piece well proves only so much: the piece's difficulty caps the score.
    let q = hit ? ceiling : 0;
    if (hit) q -= Math.min(0.5, Math.max(0, stuck - 1.2) * 0.12) + Math.min(0.4, w * 0.2);
    q = Math.max(0, q);
    groups++;
    if (hit && w === 0 && stuck < 1.5) clean++;
    wrongTotal += w;
    if (stuck > 0) hes.push(stuck);
    for (const id of skillsOf(song, g.ids.map(i => song.notes[i]), prevOf(gi))) {
      const s = profile[id];
      s.m = s.m + ALPHA * (q - s.m);
      s.n++;
      const r = runScore[id] ?? { sum: 0, n: 0 };
      r.sum += q; r.n++;
      runScore[id] = r;
    }
    dirty = true;
  };

  const check = () => {
    const now = performance.now();
    // A restart or a jump back: follow the cursor from where it now is.
    if (engine.gi < cur) { cur = engine.gi; wrongs = 0; waitStart = 0; }
    if (engine.waiting && !waitStart) waitStart = engine.waitSince || now;
    while (cur < engine.gi) { settle(cur, now); cur++; wrongs = 0; waitStart = engine.waiting ? now : 0; }
  };
  const off = engine.on(e => {
    if (e.type === 'wrong') wrongs++;
    check();
  });

  const summary = (): RunSummary => {
    const sorted = [...hes].sort((a, b) => a - b);
    // The beat is in every chord: it only names the trouble when he plays in tempo.
    const trouble = (Object.keys(runScore) as SkillId[])
      .filter(id => runScore[id]!.n >= 3 && (id !== 'rhythm' || !(engine.opts.wait || engine.opts.follow)))
      .sort((a, b) => runScore[a]!.sum / runScore[a]!.n - runScore[b]!.sum / runScore[b]!.n);
    return {
      groups, clean,
      hesitation: sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0,
      wrongRate: groups ? wrongTotal / groups : 0,
      accuracy: engine.stats().accuracy,
      trouble,
    };
  };
  return {
    summary,
    stop: () => {
      check();
      off();
      if (dirty) saveProfile(profile);
      return summary();
    },
  };
}
