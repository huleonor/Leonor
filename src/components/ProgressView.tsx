import { useEffect, useState } from 'react';
import type { SongInfo } from '../lib/catalog';
import { LEVEL_NAME, levelFor } from '../lib/exercises';
import { skillPractice, type Playable } from '../lib/path';
import { loadProfile, onSkills, SKILLS, snapshotAgo } from '../lib/skills';
import { freezes, lastDays, totals } from '../lib/stats';
import type { Settings, SongEntry } from '../lib/types';
import { GoalPill, StreakPill, useDaily, XpPill } from './Home';
import { IconFlame, IconSnow } from './Icons';
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
export function SkillMap({ onPractice }: { onPractice: (p: Playable) => void }) {
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

/** This week against last week: time, XP, and the skills that grew most, so progress is felt. */
function WeekCard() {
  const days = lastDays(14);
  const sum = (ds: typeof days, f: (d: (typeof days)[number]) => number) => ds.reduce((t, d) => t + f(d), 0);
  const [prev, cur] = [days.slice(0, 7), days.slice(7)];
  const min = Math.round(sum(cur, d => d.day.sec) / 60), minPrev = Math.round(sum(prev, d => d.day.sec) / 60);
  const xp = sum(cur, d => d.day.xp ?? 0), steps = sum(cur, d => d.day.steps);
  const p = loadProfile();
  const then = snapshotAgo(7);
  const gains = then ? SKILLS.map(sk => ({ sk, from: then.skills[sk.id] ?? 0.3, to: p[sk.id].m }))
    .filter(g => p[g.sk.id].n > 0 && g.to - g.from >= 0.02).sort((a, b) => (b.to - b.from) - (a.to - a.from)).slice(0, 3) : [];
  return (
    <section className="card week-card" aria-labelledby="week-title">
      <h2 id="week-title">This week</h2>
      <dl className="week-stats">
        <div><dt>At the piano</dt><dd>{min} min{minPrev > 0 && <small className={min >= minPrev ? 'up' : 'down'}>{min >= minPrev ? '+' : ''}{min - minPrev} vs last week</small>}</dd></div>
        <div><dt>XP</dt><dd>{xp}</dd></div>
        <div><dt>Steps passed</dt><dd>{steps}</dd></div>
      </dl>
      {gains.length > 0 ? (
        <ul className="gains">
          {gains.map(g => (
            <li key={g.sk.id}><b>{g.sk.name}</b><span>{LEVEL_NAME[levelFor(g.from)]} → {LEVEL_NAME[levelFor(g.to)]}</span><em>+{Math.round((g.to - g.from) * 100)}</em></li>
          ))}
        </ul>
      ) : <p className="fine">{then ? 'Play a few lessons this week and your biggest gains show up here.' : 'Next week this card compares your skills with today.'}</p>}
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
          <XpPill />
          <StreakPill days={daily.streak.days} lit={daily.streak.today} />
          <GoalPill sec={daily.today.sec} goal={settings.dailyGoal} />
        </div>
      </header>

      <WeekCard />

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
              <li key={d.key} className={`${d.done ? 'done' : ''} ${d.frozen ? 'frozen' : ''} ${i === 6 ? 'today' : ''}`}>
                <span className="week-dot">{d.done ? <IconFlame size={14} /> : d.frozen ? <IconSnow size={13} /> : null}</span>
                <span className="week-day">{DAY[d.date.getDay()]}</span>
              </li>
            ))}
          </ol>
          <p className="fine">{freezes() ? `${freezes()} streak ${freezes() === 1 ? 'freeze' : 'freezes'} ready: a missed day will not break your streak. ` : 'Seven days in a row earn a streak freeze (two at most). '}Best streak: {Math.max(all.best, daily.streak.days)} {Math.max(all.best, daily.streak.days) === 1 ? 'day' : 'days'}</p>
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
