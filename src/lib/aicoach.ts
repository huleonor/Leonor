/**
 * The AI coach, client side: builds a compact picture of the learner from what the app already
 * knows (skills, the difficulty coach's settings, recent runs, the week, the course) and sends it
 * to /api/coach, where Claude answers as the coach. Nothing here decides difficulty: that stays
 * on the device. When the coach cannot be reached the weekly plan is written here instead, from
 * the same data, so the plan is never missing.
 */
import { describeCoach, loadCoach } from './adapt';
import { isNative } from './input';
import { nextLesson, UNITS, type PathState } from './path';
import { dueSkills, loadProfile, SKILLS, weakest, type RunSummary, type SkillId } from './skills';
import { dayKey, freezes, lastDays, streak, today } from './stats';
import type { Lang } from './types';
import { LEVEL_NAME, levelFor } from './exercises';
import { isPremium } from './billing';

const URL_WEB = '/api/coach';
const URL_APP = 'https://hugos-piano.vercel.app/api/coach';
const endpoint = () => (isNative ? URL_APP : URL_WEB);

// ---------- Recent runs, for the coach to read ----------

export interface RunLog { at: number; title: string; acc: number; first: number; hes: number; worst?: SkillId; tempo: boolean; }
const RUNS = 'hugos-piano:runs';

export function logRun(title: string, r: RunSummary, tempo: boolean) {
  if (r.groups < 4) return;
  try {
    const runs = recentRuns();
    runs.push({ at: Date.now(), title, acc: Math.round(r.accuracy * 100), first: Math.round((r.clean / r.groups) * 100), hes: Math.round(r.hesitation * 10) / 10, worst: r.trouble[0], tempo });
    localStorage.setItem(RUNS, JSON.stringify(runs.slice(-40)));
  } catch { /* storage unavailable */ }
}
export function recentRuns(): RunLog[] {
  try { return JSON.parse(localStorage.getItem(RUNS) ?? '[]'); } catch { return []; }
}

// ---------- The learner, in a few hundred tokens ----------

export function learnerPicture(state: PathState | null, dailyGoal: number) {
  const p = loadProfile();
  const now = Date.now();
  const next = state ? nextLesson(state) : undefined;
  const unitOf = (id?: string) => UNITS.findIndex(u => u.lessons.some(l => l.id === id));
  return {
    skills: SKILLS.map(s => ({
      skill: s.id, name: s.name, level: Math.round(p[s.id].m * 100), stage: LEVEL_NAME[levelFor(p[s.id].m)],
      chords: p[s.id].n, daysSince: p[s.id].at ? Math.floor((now - p[s.id].at!) / 86_400_000) : null,
    })),
    dueForReview: dueSkills(p).map(d => d.id),
    engineSettings: describeCoach(loadCoach()),
    recentRuns: recentRuns().slice(-10).map(r => ({ ...r, at: undefined, daysAgo: Math.floor((now - r.at) / 86_400_000) })),
    last7Days: lastDays(7).map(d => ({ day: d.key, minutes: Math.round(d.day.sec / 60), xp: d.day.xp ?? 0 })),
    today: { minutes: Math.round(today().sec / 60), xp: today().xp ?? 0 },
    dailyGoalMinutes: dailyGoal,
    streak: { days: streak().days, practisedToday: streak().today, freezes: freezes() },
    course: {
      unitsDone: state ? UNITS.filter(u => u.lessons.every(l => state[l.id]?.done)).map(u => u.title) : [],
      nextLesson: next ? { title: next.title, unit: unitOf(next.id) + 1, unitTitle: UNITS[unitOf(next.id)]?.title } : null,
    },
    premium: isPremium(),
  };
}

// ---------- Talking to the coach ----------

export type CoachFailure = 'offline' | 'unavailable' | 'busy' | 'refused' | 'failed';
export class CoachError extends Error { constructor(public kind: CoachFailure) { super(kind); } }

async function call(body: unknown): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(endpoint(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new CoachError('offline');
  }
  if (res.ok) return res.json();
  throw new CoachError(res.status === 503 || res.status === 404 ? 'unavailable' : res.status === 429 ? 'busy' : res.status === 422 ? 'refused' : 'failed');
}

export interface ChatTurn { role: 'user' | 'assistant'; content: string; }

export async function askCoach(lang: Lang, history: ChatTurn[], learner: object): Promise<string> {
  const r = await call({ kind: 'chat', lang, learner, messages: history });
  return String(r.reply ?? '');
}

export interface PlanDay { day: number; title: string; skill: SkillId; minutes: number; note: string; }
export interface Plan { summary: string; focus: string; days: PlanDay[]; tip: string; }
export interface StoredPlan { plan: Plan; from: string; source: 'ai' | 'device'; }

const PLAN = 'hugos-piano:plan-week';
export function storedPlan(): StoredPlan | null {
  try {
    const s = JSON.parse(localStorage.getItem(PLAN) ?? 'null') as StoredPlan | null;
    // A plan covers seven days from the day it was made.
    return s && daysSince(s.from) < 7 ? s : null;
  } catch { return null; }
}
const daysSince = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(y, m - 1, d).getTime()) / 86_400_000);
};
/** Which plan day today is (1–7). */
export const planDayToday = (s: StoredPlan) => Math.min(7, daysSince(s.from) + 1);

/** This week's plan: from the coach when it can be reached, otherwise written on the device. */
export async function makePlan(lang: Lang, learner: object, dailyGoal: number): Promise<StoredPlan> {
  let stored: StoredPlan;
  try {
    const r = await call({ kind: 'plan', lang, learner });
    const plan = r.plan as Plan;
    if (!plan?.days?.length) throw new CoachError('failed');
    stored = { plan, from: dayKey(), source: 'ai' };
  } catch (e) {
    if (!(e instanceof CoachError)) throw e;
    stored = { plan: devicePlan(lang, dailyGoal), from: dayKey(), source: 'device' };
  }
  try { localStorage.setItem(PLAN, JSON.stringify(stored)); } catch { /* ignore */ }
  return stored;
}

/** The plan written on the device: the weakest and most overdue skills in turn, one lighter day. */
export function devicePlan(lang: Lang, dailyGoal: number): Plan {
  const p = loadProfile();
  const pt = lang === 'pt';
  const order: SkillId[] = [...new Set([...dueSkills(p).map(d => d.id), ...weakest(p), 'treble', 'bass', 'rhythm', 'together'] as SkillId[])];
  const name = (id: SkillId) => SKILLS.find(s => s.id === id)!.name;
  const minutes = (n: number) => ([5, 10, 15, 20].reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a)));
  const days: PlanDay[] = Array.from({ length: 7 }, (_, i) => {
    const skill = order[i % Math.min(3, order.length)];
    const light = i === 3;
    return {
      day: i + 1, skill, title: name(skill), minutes: minutes(light ? dailyGoal / 2 : dailyGoal),
      note: light ? (pt ? 'Dia leve: uma revisão curta para manter o hábito.' : 'A lighter day: a short review to keep the habit.')
        : (pt ? 'Devagar e sem ajudas: o objetivo é acertar à primeira.' : 'Slowly, without help: aim for right first time.'),
    };
  });
  const top = order[0];
  return {
    summary: pt ? `O treinador está offline, por isso este plano foi feito no teu aparelho a partir das tuas competências. ${name(top)} é onde tens mais a ganhar agora.`
      : `The coach is offline, so this plan was made on your device from your skill map. ${name(top)} is where you have most to gain right now.`,
    focus: name(top),
    days,
    tip: pt ? 'Diz o nome de cada nota antes de a tocar.' : 'Say each note name before you play it.',
  };
}
