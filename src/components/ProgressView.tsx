import { useEffect, useState } from 'react';
import { describeCoach } from '../lib/adapt';
import type { SongInfo } from '../lib/catalog';
import { LEVEL_NAME, levelFor } from '../lib/exercises';
import { skillPractice, type Playable } from '../lib/path';
import { loadProfile, onSkills, SKILLS, snapshotAgo } from '../lib/skills';
import { lastDays, totals } from '../lib/stats';
import type { Settings, SongEntry } from '../lib/types';
import { GoalPill, StreakPill, useDaily } from './Home';
import { IconFlame } from './Icons';
import { Segmented } from './ui';

const DAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface Props {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  entries: SongEntry[];
  infos: Record<string, SongInfo>;
  onPractice: (p: Playable) => void;
}

const AREAS = ['Reading', 'Rhythm', 'Technique'] as const;

/** The skill map: every skill's level, how it moved since about a week ago, and a practice button. */
function SkillMap({ onPractice }: { onPractice: (p: Playable) => void }) {
  const [, bump] = useState(0);
  useEffect(() => onSkills(() => bump(x => x + 1)), []);
  const p = loadProfile();
  const then = snapshotAgo(7);
  const since = then ? new Date(then.key).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : null;
  const tried = SKILLS.filter(sk => p[sk.id].n > 0);
  return (
    <section className="card skills-card" aria-labelledby="skills-title">
      <div className="skills-head">
        <h2 id="skills-title">Your skills</h2>
        <p className="sub">{tried.length ? `Learnt from every note you play${since ? `; arrows compare with ${since}` : ''}.` : 'Play a lesson and the app starts learning how you read and play.'}</p>
      </div>
      <div className="skill-areas">
        {AREAS.map(area => (
          <div key={area} className="skill-area">
            <h3>{area}</h3>
            <ul>
              {SKILLS.filter(sk => sk.area === area).map(sk => {
                const st = p[sk.id];
                const pct = Math.round(st.m * 100);
                const before = then?.skills[sk.id];
                const delta = before !== undefined && st.n > 0 ? Math.round((st.m - before) * 100) : 0;
                return (
                  <li key={sk.id} className={st.n ? '' : 'untried'}>
                    <span className="skill-name"><b>{sk.name}</b><small>{st.n ? LEVEL_NAME[levelFor(st.m)] : 'Not tried yet'}</small></span>
                    <span className="meter skill-meter" aria-label={`${sk.name}: ${pct}%`}><i style={{ width: `${st.n ? pct : 0}%` }} /></span>
                    <span className={`skill-delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`}>{delta > 0 ? `+${delta}` : delta < 0 ? delta : ''}</span>
                    <button className="btn small" onClick={() => onPractice(skillPractice(sk.id))}>Practise</button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/** What the coach has set, so changes are never a mystery. */
function CoachCard() {
  const c = describeCoach();
  return (
    <section className="card coach-card" aria-labelledby="coach-title">
      <h2 id="coach-title">Your coach</h2>
      <p className="sub">Keeps each lesson hard enough to grow and easy enough to enjoy: about 85% right first time.</p>
      <dl>
        <div><dt>Speed</dt><dd>{c.speed}</dd></div>
        <div><dt>Keys light up</dt><dd>{c.hints}</dd></div>
        <div><dt>Finger numbers</dt><dd>{c.fingers}</dd></div>
      </dl>
    </section>
  );
}

export function ProgressView({ settings, update, entries, infos, onPractice }: Props) {
  const daily = useDaily();
  const week = lastDays(7);
  const all = totals();
  const maxMin = Math.max(settings.dailyGoal * 1.3, ...week.map(d => d.day.sec / 60));
  const list = entries.map(e => infos[e.id]).filter((i): i is SongInfo => !!i?.course);
  const stars = list.reduce((s, i) => s + i.stars, 0);
  const steps = list.reduce((s, i) => s + i.done, 0);
  const finished = list.filter(i => (i.prog.song?.stars ?? 0) > 0).length;
  const hours = Math.floor(all.sec / 3600), mins = Math.round((all.sec % 3600) / 60);

  return (
    <div className="page progress">
      <header className="page-head">
        <h1>Progress</h1>
        <div className="head-stats">
          <StreakPill days={daily.streak.days} lit={daily.streak.today} />
          <GoalPill sec={daily.today.sec} goal={settings.dailyGoal} />
        </div>
      </header>

      <SkillMap onPractice={onPractice} />

      <div className="progress-grid">
        <section className="card streak-card" aria-labelledby="streak-title">
          <div className="streak-big">
            <IconFlame size={44} className={daily.streak.today ? 'lit' : ''} />
            <div>
              <h2 id="streak-title">{daily.streak.days} {daily.streak.days === 1 ? 'day' : 'days'} in a row</h2>
              <p className="sub">{daily.streak.today ? 'Today counts. See you tomorrow.' : daily.streak.days ? 'Play a minute today to keep it going.' : 'Play a minute today to start a streak.'}</p>
            </div>
          </div>
          <ol className="week" aria-label="The last seven days">
            {week.map((d, i) => (
              <li key={d.key} className={`${d.done ? 'done' : ''} ${i === 6 ? 'today' : ''}`}>
                <span className="week-dot">{d.done && <IconFlame size={14} />}</span>
                <span className="week-day">{DAY[d.date.getDay()]}</span>
              </li>
            ))}
          </ol>
          <p className="fine">Best streak: {Math.max(all.best, daily.streak.days)} {Math.max(all.best, daily.streak.days) === 1 ? 'day' : 'days'}</p>
          <Segmented label="Daily goal, minutes" value={settings.dailyGoal} onChange={v => update({ dailyGoal: v })} options={[5, 10, 15, 20, 30].map(v => [v, String(v)] as [number, string])} />
        </section>

        <section className="card minutes-card" aria-labelledby="minutes-title">
          <h2 id="minutes-title">Minutes this week</h2>
          <div className="bars" role="img" aria-label={week.map(d => `${DAY[d.date.getDay()]} ${Math.round(d.day.sec / 60)} minutes`).join(', ')}>
            <span className="goal-line" style={{ '--at': settings.dailyGoal / maxMin } as React.CSSProperties}><small>{settings.dailyGoal} min</small></span>
            {week.map((d, i) => {
              const m = d.day.sec / 60;
              return (
                <div key={d.key} className={`bar ${m >= settings.dailyGoal ? 'met' : ''} ${i === 6 ? 'today' : ''}`}>
                  <span className="bar-n">{m >= 1 ? Math.round(m) : ''}</span>
                  <i style={{ height: `${Math.max(m > 0 ? 3 : 0, (m / maxMin) * 100)}%` }} />
                  <span className="week-day">{DAY[d.date.getDay()]}</span>
                </div>
              );
            })}
          </div>
        </section>

        <CoachCard />

        <section className="card totals" aria-label="All time">
          <dl>
            <div><dt>Practice time</dt><dd>{hours ? `${hours} h ${mins} min` : `${mins} min`}</dd></div>
            <div><dt>Stars</dt><dd>{stars}</dd></div>
            <div><dt>Steps passed</dt><dd>{steps}</dd></div>
            <div><dt>Songs performed</dt><dd>{finished}</dd></div>
          </dl>
        </section>
      </div>
    </div>
  );
}
