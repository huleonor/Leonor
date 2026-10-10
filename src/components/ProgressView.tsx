import type { SongInfo } from '../lib/catalog';
import { lastDays, totals } from '../lib/stats';
import type { Settings, SongEntry } from '../lib/types';
import { GoalPill, StreakPill, useDaily } from './Home';
import { IconFlame } from './Icons';
import { Segmented } from './Practice';

const DAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface Props {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  entries: SongEntry[];
  infos: Record<string, SongInfo>;
}

export function ProgressView({ settings, update, entries, infos }: Props) {
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
