/** Today's numbers, live: the streak, XP and minutes, as pills. */
import { useEffect, useState } from 'react';
import { freezes, onStats, streak, today, totalXp } from '../lib/stats';
import { IconBolt, IconFlame, IconSnow } from './Icons';

export function useDaily() {
  const [, bump] = useState(0);
  useEffect(() => onStats(() => bump(x => x + 1)), []);
  return { streak: streak(), today: today() };
}

export function StreakPill({ days, lit }: { days: number; lit: boolean }) {
  const f = freezes();
  return (
    <span className={`pill-stat streak ${lit ? 'lit' : ''}`} aria-label={`${days}-day streak${lit ? '' : ', not yet practised today'}${f ? `, ${f} streak ${f === 1 ? 'freeze' : 'freezes'}` : ''}`}>
      <IconFlame size={18} />{days}
      {f > 0 && <span className="freeze-chip" title={`${f} streak ${f === 1 ? 'freeze' : 'freezes'}`}><IconSnow size={13} />{f}</span>}
    </span>
  );
}

/** XP earned today (and in all, for screen readers). */
export function XpPill() {
  const xp = today().xp ?? 0;
  return (
    <span className="pill-stat xp" aria-label={`${xp} XP today, ${totalXp()} in all`}>
      <IconBolt size={16} />{xp}<small>XP</small>
    </span>
  );
}

export function GoalPill({ sec, goal }: { sec: number; goal: number }) {
  const min = Math.floor(sec / 60);
  const pct = Math.min(1, sec / (goal * 60));
  return (
    <span className={`pill-stat goal ${pct >= 1 ? 'met' : ''}`} aria-label={`${min} of ${goal} minutes today`}>
      <span className="goal-n">{min}<small>/{goal} min</small></span>
      <span className="meter"><i style={{ width: `${pct * 100}%` }} /></span>
    </span>
  );
}
