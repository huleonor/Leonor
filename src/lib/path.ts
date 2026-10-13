/**
 * The path through the course (see curriculum.ts): which nodes are done, which is next, and what
 * to play when he taps one. Generated nodes are written fresh each time, at a level chosen from his
 * skill profile, so the path quietly bends to him: a skill he keeps getting right comes back
 * harder, one he keeps missing comes back simpler, and the practice nodes go after what he is
 * getting wrong. He never sees any of it; he just keeps walking the path.
 *
 * Also the daily session: a warm-up on his weakest skill, the next lesson on the path, and a short
 * review, chosen fresh each day.
 */
import { useEffect, useState } from 'react';
import type { SongInfo } from './catalog';
import { getCourseProgress, recordStep, type CourseProgress, type CourseStep } from './course';
import { addExtra, allNodes, extraCount, MAX_EXTRAS, nodesOf, sectionOf, SECTIONS, unitSkills, UNITS, type NodeHands, type PathNode, type Unit } from './curriculum';
import { chestOpened } from './energy';
import { EXERCISE_TITLE, LEVEL_NAME, levelFor, makeExercise } from './exercises';
import { dueSkills, loadProfile, SKILLS, weakest, type SkillId } from './skills';
import { dayKey } from './stats';
import type { Song } from './types';

export { UNITS };

/** What the lesson screen needs: a song and its steps as one section. */
export interface Playable {
  id: string;
  title: string;
  /** One line under the title. */
  why: string;
  info: SongInfo;
  section: { id: string; title: string; bars: string; from: number; steps: CourseStep[]; learnt: boolean; done: number };
}

// ---------- Steps ----------

interface Plan { id: string; title: string; hands: NodeHands | 'all'; speed: number; wait: boolean; listen?: boolean; }
const P = (id: string, title: string, hands: Plan['hands'], speed: number, wait: boolean, listen = false): Plan => ({ id, title, hands, speed, wait, listen });

/**
 * The steps of a node, by kind, the way Simply Piano teaches: first free play (the music waits for
 * every note, no rhythm to keep, so he learns the notes), hand by hand for two hands, then the
 * same music with the beat and the metronome ticking, so the rhythm comes last.
 */
export function planFor(n: PathNode): Plan[] {
  const h = n.hands;
  const two = h === 'both';
  const free = two
    ? [P('R', 'Free play: right hand', 'R', 0.7, true), P('L', 'Free play: left hand', 'L', 0.7, true), P('both', 'Free play: hands together', 'both', 0.8, true)]
    : [P('free', 'Free play', h, 0.7, true), P('own', 'Free play, on your own', h, 0.9, true)];
  switch (n.kind) {
    case 'trophy': return [P('test', 'Unit test', h, 0.9, true)];
    case 'practice': return [P('go', 'Free play', 'all', 0.75, true), P('beat', 'With the beat', 'all', 0.8, false)];
    case 'listen': return [P('listen', 'Listen, then play', h, 0.8, true, true), P('own', 'Free play, on your own', h, 0.9, true), P('beat', 'With the beat', h, 0.85, false)];
    case 'technique': return [P('slow', 'Free play', h, 0.7, true), P('tempo', 'With the beat', h, 0.85, false)];
    case 'song': return [...free, P('slowbeat', 'With the beat, slowly', two ? 'both' : h, 0.75, false), P('tempo', 'With the beat, full speed', two ? 'both' : h, 1, false)];
    case 'lesson': return [...free, P('beat', 'With the beat', two ? 'both' : h, 0.8, false)];
    case 'theory': return [P('read', 'Read', h, 1, true)];
    default: return [];
  }
}

const barsOf = (song: Song) => {
  const [num, den] = song.timeSig;
  const measure = song.ppq * 4 * (num / den);
  return Math.max(1, Math.ceil(Math.max(...song.notes.map(n => n.ticks + n.durationTicks)) / measure - 1e-6));
};

function stepsFor(song: Song, plan: Plan[]): CourseStep[] {
  const to = barsOf(song);
  const all = song.hands.length === 1 ? song.hands[0] : 'both';
  return plan.map(p => ({
    id: p.id, kind: p.wait ? 'phrase' : 'tempo', title: p.title, short: p.id, from: 1, to,
    hands: p.hands === 'all' || (p.hands === 'both' && song.hands.length === 1) ? all : p.hands,
    speed: p.speed, wait: p.wait, listen: p.listen,
  }));
}

function playable(id: string, title: string, why: string, song: Song, plan: Plan[], prog: CourseProgress = {}): Playable {
  song.entry = { ...song.entry, id: `path:${id}`, title, composer: song.entry.composer === 'Practice' ? 'Hugo’s Piano' : song.entry.composer };
  const steps = stepsFor(song, plan);
  const done = steps.filter(st => (prog[st.id]?.stars ?? 0) > 0).length;
  return {
    id, title, why,
    info: { entry: song.entry, song, prog, stars: 0, total: steps.length * 3, done },
    section: { id, title, bars: `${barsOf(song)} bars`, from: 1, steps, learnt: done === steps.length, done },
  };
}

// ---------- The invisible difficulty ----------

const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 17);
const clampLv = (n: number) => Math.max(0, Math.min(3, n));

/**
 * The level a generated node is written at: its base, one up when its skill is strong (or he
 * already aced this node), one down when the skill is slipping.
 */
export function levelOf(n: PathNode, prog: CourseProgress = {}): number {
  let lv = n.base ?? 0;
  const s = n.skill ? loadProfile()[n.skill] : undefined;
  if (s && s.n >= 8) lv += s.m >= 0.82 ? 1 : s.m < 0.42 ? -1 : 0;
  const results = Object.values(prog);
  if (results.length && results.every(r => r.stars === 3)) lv += 1;
  return clampLv(lv);
}

/** The skill a practice node goes after: the weakest of its skills, or of everything he plays. */
function practiceSkill(n: PathNode): SkillId {
  const p = loadProfile();
  // Extra practice stays on its unit's skills.
  if (n.focus && n.skills?.length) return [...n.skills].sort((a, b) => p[a].m - p[b].m)[0];
  const pool = [...(n.skills ?? ['treble']), ...weakest(p).slice(0, 1)].filter(id => p[id].n >= 4);
  return pool.sort((a, b) => p[a].m - p[b].m)[0] ?? n.skills?.[0] ?? 'treble';
}

/** What to play for a node, written now. Theory and chests have no music. */
export function nodePlayable(n: PathNode, prog: CourseProgress = {}): Playable | null {
  const seed = hash(n.id) ^ Math.floor(Date.now() / 3_600_000);
  if (n.kind === 'song' && n.song) return playable(n.id, n.title, n.sub, n.song(), planFor(n), prog);
  if (n.kind === 'practice') {
    const skill = practiceSkill(n);
    const song = makeExercise(skill, levelFor(loadProfile()[skill].m), seed);
    return playable(n.id, n.title, n.sub, song, planFor(n), prog);
  }
  if (n.kind === 'trophy' && n.gen) return playable(n.id, n.title, n.sub, n.gen(1, hash(n.id)), planFor(n), prog);
  if (n.gen) return playable(n.id, n.title, n.sub, n.gen(levelOf(n, prog), seed), planFor(n), prog);
  return null;
}

/** Theory nodes are done once read through. */
export const finishTheory = async (n: PathNode) => { await recordStep(`path:${n.id}`, 'read', 1); pathChanged(); };

// ---------- Progress on the path ----------

export interface NodeState {
  done: boolean;
  open: boolean;
  /** The node to play next, with the START bubble. */
  current: boolean;
  stars: number;
  steps: number;
  passed: number;
  /** Skipped by a test. */
  tested?: boolean;
  /** A practice lesson he did not need: the unit's skills were already sure. */
  breezed?: boolean;
}
export type PathState = Record<string, NodeState>;

// ---------- Placement: units proved by a test count as done ----------

const PLACED = 'hugos-piano:placed';
export function placedUnits(): string[] {
  try { return JSON.parse(localStorage.getItem(PLACED) ?? '[]'); } catch { return []; }
}
export function placeUnit(id: string) {
  const all = new Set(placedUnits());
  // Proving a unit proves the ones before it too.
  for (const u of UNITS) { all.add(u.id); if (u.id === id) break; }
  try { localStorage.setItem(PLACED, JSON.stringify([...all])); } catch { /* storage unavailable */ }
  pathChanged();
}
export const placementTaken = () => { try { return localStorage.getItem(PLACED) !== null; } catch { return false; } };
export function markPlacementTaken() {
  try { if (localStorage.getItem(PLACED) === null) localStorage.setItem(PLACED, '[]'); } catch { /* ignore */ }
  pathChanged();
}

// ---------- The adaptive course: each unit asks for its skills to be sure, not for a lesson count ----------

/** How sure a unit's skills must be before its test, rising section by section. */
const GOAL = [0.55, 0.6, 0.65, 0.7];
const goalOf = (u: Unit) => GOAL[Math.min(GOAL.length - 1, SECTIONS.indexOf(sectionOf(u)))];

/** Every skill the unit teaches has enough evidence and is at the goal. */
export function unitReady(u: Unit, p = loadProfile()) {
  const g = goalOf(u);
  return unitSkills(u).every(id => p[id].n >= 6 && p[id].m >= g);
}
/** Comfortably past the goal: the unit's practice lessons can be let go. */
function unitStrong(u: Unit, p = loadProfile()) {
  const g = goalOf(u) + 0.08;
  return unitSkills(u).every(id => p[id].n >= 12 && p[id].m >= g);
}

const BREEZED = 'hugos-piano:breezed';
function readBreezed(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(BREEZED) ?? '[]')); } catch { return new Set(); }
}

/** First tries at free play, newest last: mostly perfect means he learns fast. */
const PACE = 'hugos-piano:pace';
export function recordPace(perfect: boolean) {
  let xs: boolean[] = [];
  try { xs = JSON.parse(localStorage.getItem(PACE) ?? '[]'); } catch { /* none yet */ }
  xs = [...xs, perfect].slice(-10);
  try { localStorage.setItem(PACE, JSON.stringify(xs)); } catch { /* storage unavailable */ }
}
export function fastLearner() {
  let xs: boolean[] = [];
  try { xs = JSON.parse(localStorage.getItem(PACE) ?? '[]'); } catch { return false; }
  return xs.length >= 3 && xs.filter(Boolean).length / xs.length >= 0.6;
}

const listeners = new Set<() => void>();
export const pathChanged = () => listeners.forEach(fn => fn());

export async function loadPath(): Promise<{ state: PathState; progs: Record<string, CourseProgress> }> {
  const progs: Record<string, CourseProgress> = {};
  await Promise.all(allNodes().map(async ({ node }) => { progs[node.id] = await getCourseProgress(`path:${node.id}`); }));
  const placed = new Set(placedUnits());
  const profile = loadProfile();
  const breezed = readBreezed();
  const breezedBefore = breezed.size;
  const state: PathState = {};
  let prevDone = true, foundCurrent = false;
  for (const { node, unit } of allNodes()) {
    const prog = progs[node.id];
    const n = planFor(node).length;
    const got = Object.values(prog).filter(r => r.stars > 0);
    const isPlaced = placed.has(unit.id);
    const open = prevDone || isPlaced;
    let done: boolean;
    if (node.kind === 'chest') done = chestOpened(node.id);
    else if (node.kind === 'trophy') done = (prog.test?.stars ?? 0) >= 2 || isPlaced;
    else done = got.length >= n || isPlaced;
    // A practice lesson he does not need: the unit's skills are already well past its goal.
    const breeze = node.kind === 'practice' && !node.focus && !done && (breezed.has(node.id) || (open && unitStrong(unit, profile)));
    if (breeze) { done = true; breezed.add(node.id); }
    const stars = got.length >= n && got.length ? Math.min(...got.map(r => r.stars)) : 0;
    const current = !foundCurrent && open && !done && node.kind !== 'chest';
    if (current) foundCurrent = true;
    state[node.id] = { done, open, current, stars, steps: n, passed: got.length, tested: isPlaced && got.length < n, breezed: breeze };
    // Chests never block the way.
    if (node.kind !== 'chest') prevDone = done;
  }
  if (breezed.size !== breezedBefore) try { localStorage.setItem(BREEZED, JSON.stringify([...breezed])); } catch { /* storage unavailable */ }
  // At a unit's test with its skills not sure yet: one more lesson made from how he plays them.
  const cur = allNodes().find(({ node }) => state[node.id]?.current);
  if (cur?.node.kind === 'trophy' && !placed.has(cur.unit.id) && extraCount(cur.unit) < MAX_EXTRAS && !unitReady(cur.unit, profile)) {
    addExtra(cur.unit);
    return loadPath();
  }
  return { state, progs };
}

export function usePath() {
  const [data, setData] = useState<Awaited<ReturnType<typeof loadPath>> | null>(null);
  useEffect(() => {
    let live = true;
    const load = () => loadPath().then(d => live && setData(d));
    load();
    listeners.add(load);
    return () => { live = false; listeners.delete(load); };
  }, []);
  return data;
}

/** The node to play next on the path. */
export function currentNode(state: PathState): { node: PathNode; unit: Unit } | undefined {
  return allNodes().find(({ node }) => state[node.id]?.current);
}

/** Where a unit sits: "Section 2, Unit 7". */
export function unitLabel(u: Unit) {
  const s = sectionOf(u);
  return `Section ${s.id.slice(1)}, Unit ${UNITS.indexOf(u) + 1}`;
}

// ---------- The daily session ----------

const seedOfDay = (salt: number) => [...dayKey()].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, salt);
const WARMUP = [P('go', 'Free play', 'all', 0.8, true), P('beat', 'With the beat', 'all', 0.8, false)];

/** Today's session: warm-up on the weakest skill, the next lesson on the path, then a short review. */
export function dailySession(state: PathState, progs: Record<string, CourseProgress>): Playable[] {
  const profile = loadProfile();
  const weak = weakest(profile);
  const name = (id: SkillId) => SKILLS.find(s => s.id === id)!.name;
  const out: Playable[] = [];
  const first: SkillId = weak[0] ?? 'treble';
  const lv = levelFor(profile[first].m);
  out.push(playable(`warm-${first}`, EXERCISE_TITLE[first],
    weak[0] ? `Your weakest skill right now: ${name(first)} (${LEVEL_NAME[lv]})` : 'A first look at how you read',
    makeExercise(first, lv, seedOfDay(1)), WARMUP));
  // The next node on the path that has music to play.
  const next = allNodes().find(({ node }) => state[node.id]?.open && !state[node.id]?.done && node.kind !== 'theory' && node.kind !== 'chest' && node.kind !== 'trophy');
  const lesson = next && nodePlayable(next.node, progs[next.node.id]);
  if (next && lesson) out.push({ ...lesson, why: `Next on your path: ${next.node.sub}` });
  // The review is spaced: a skill whose gap has run out, else the next weakest.
  const due = dueSkills(profile).find(d => d.id !== first);
  const second: SkillId = due?.id ?? weak.find(id => id !== first) ?? (first === 'rhythm' ? 'treble' : 'rhythm');
  const lv2 = levelFor(profile[second].m);
  out.push(playable(`review-${second}`, EXERCISE_TITLE[second],
    due ? `Due for review: last practised ${due.days === 0 ? 'today' : due.days === 1 ? 'yesterday' : `${due.days} days ago`}` : `To keep it fresh: ${name(second)} (${LEVEL_NAME[lv2]})`,
    makeExercise(second, lv2, seedOfDay(2)), WARMUP));
  return out;
}

/** A practice piece for any skill at his level, for the skill map's "Practise" buttons. */
export function skillPractice(skill: SkillId): Playable {
  const lv = levelFor(loadProfile()[skill].m);
  return playable(`skill-${skill}`, EXERCISE_TITLE[skill], `${LEVEL_NAME[lv]} level, made for you just now`, makeExercise(skill, lv), WARMUP);
}

/** A unit's test as a one-step piece: passing takes 2 stars (85%). */
export function unitTest(u: Unit): Playable {
  const trophy = nodesOf(u).find(n => n.kind === 'trophy')!;
  return nodePlayable(trophy)!;
}

/** The placement test: each unit's test in order, stopping at the first one he does not pass. */
export function placementTest(): Playable[] {
  return UNITS.map(unitTest);
}
