import { useEffect, useState } from 'react';
import { onMoment, type Moment } from '../lib/stats';
import { IconBolt, IconFlame, IconSnow, IconStar } from './Icons';

/** Short celebrations over whatever screen is open: daily goal, session done, streak freezes. */
export function Celebrate() {
  const [m, setM] = useState<Moment | null>(null);
  useEffect(() => onMoment(setM), []);
  useEffect(() => {
    if (!m) return;
    const id = window.setTimeout(() => setM(null), m.kind === 'freeze-used' ? 6000 : 4200);
    return () => window.clearTimeout(id);
  }, [m]);
  if (!m) return null;
  const [icon, title, line] =
    m.kind === 'goal' ? [<IconFlame size={30} key="i" />, 'Daily goal reached', `${m.minutes} minutes at the piano today${m.streak > 1 ? ` · ${m.streak}-day streak` : ''}`]
    : m.kind === 'session' ? [<IconStar size={30} key="i" />, 'Today’s session done', `${m.xp} XP today${m.streak > 0 ? ` · ${m.streak}-day streak` : ''}`]
    : m.kind === 'freeze-earned' ? [<IconSnow size={30} key="i" />, 'Streak freeze earned', `Seven days in a row. A missed day is now covered (${m.have} of 2).`]
    : [<IconSnow size={30} key="i" />, 'Your streak is safe', `A streak freeze covered ${m.days === 1 ? 'the day' : `${m.days} days`} you missed.`];
  return (
    <div className={`celebrate ${m.kind}`} role="status" onClick={() => setM(null)}>
      <span className="celebrate-icon">{icon}</span>
      <span className="celebrate-text"><b>{title}</b><small>{line}</small></span>
      {m.kind === 'session' && <IconBolt size={18} className="celebrate-bolt" />}
    </div>
  );
}
