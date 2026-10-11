import { useEffect, useState } from 'react';
import { continueTarget, type SongInfo } from '../lib/catalog';
import type { CourseStep } from '../lib/course';
import type { LinkState, Source } from '../lib/input';
import { onStats, streak, today } from '../lib/stats';
import type { Settings, SongEntry } from '../lib/types';
import { IconBluetooth, IconFlame, IconKeys, IconMic, IconPlay, IconStar } from './Icons';
import { stepName, Stars } from './ui';
import { byLine, Cover, SongCard } from './Songs';

export function useDaily() {
  const [, bump] = useState(0);
  useEffect(() => onStats(() => bump(x => x + 1)), []);
  return { streak: streak(), today: today() };
}

export function StreakPill({ days, lit }: { days: number; lit: boolean }) {
  return (
    <span className={`pill-stat streak ${lit ? 'lit' : ''}`} aria-label={`${days}-day streak${lit ? '' : ', not yet practised today'}`}>
      <IconFlame size={18} />{days}
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

const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? 'Late practice' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

interface Props {
  settings: Settings;
  ready: boolean;
  entries: SongEntry[];
  infos: Record<string, SongInfo>;
  links: Record<Source, LinkState>;
  onSetup: (kind: Source) => void;
  onSkipSetup: () => void;
  onOpen: (info: SongInfo) => void;
  onPlay: (info: SongInfo, step: CourseStep) => void;
  onBrowse: () => void;
}

const SETUP: [Source, string, string, (p: { size?: number }) => React.ReactElement][] = [
  ['midi', 'USB cable', 'Piano plugged into the phone', IconKeys],
  ['ble', 'Bluetooth', 'Piano with Bluetooth MIDI', IconBluetooth],
  ['mic', 'Microphone', 'Any piano, the phone listens', IconMic],
];

export function Home({ settings, ready, entries, infos, links, onSetup, onSkipSetup, onOpen, onPlay, onBrowse }: Props) {
  const daily = useDaily();
  const target = ready ? continueTarget() : undefined;

  // Today's practice: polish a step that has one or two stars, then something new.
  const all = entries.map(e => infos[e.id]).filter((i): i is SongInfo => !!i?.song && !!i.course);
  const review: { info: SongInfo; step: CourseStep; stars: number }[] = [];
  for (const info of all) {
    if (info.entry.id === target?.entry.id) continue;
    const s = info.course!.steps.find(st => { const n = info.prog[st.id]?.stars ?? 0; return n > 0 && n < 3; });
    if (s) review.push({ info, step: s, stars: info.prog[s.id].stars });
  }
  const freshList = all.filter(i => i.stars === 0 && i.entry.id !== target?.entry.id).sort((a, b) => (a.level ?? 9) - (b.level ?? 9));
  const reviews = review.slice(0, 3);
  const fresh = freshList.slice(0, Math.max(0, 3 - reviews.length));
  const recent = all.filter(i => i.stars > 0).slice(0, 8);

  return (
    <div className="page home">
      <header className="page-head">
        <h1>{greeting()}</h1>
        <div className="head-stats">
          <StreakPill days={daily.streak.days} lit={daily.streak.today} />
          <GoalPill sec={daily.today.sec} goal={settings.dailyGoal} />
        </div>
      </header>

      {!settings.setupDone && (
        <section className="card setup" aria-labelledby="setup-title">
          <div>
            <h2 id="setup-title">How is your piano connected?</h2>
            <p>The app listens to what you play and waits for the right notes. You can change this later in Settings.</p>
          </div>
          <div className="setup-choices">
            {SETUP.map(([kind, label, sub, Icon]) => (
              <button key={kind} className={`choice ${links[kind].status === 'on' ? 'on' : ''}`} onClick={() => onSetup(kind)}>
                <Icon size={22} />
                <b>{label}</b>
                <small>{links[kind].status === 'connecting' ? 'Connecting…' : links[kind].status === 'on' ? 'Connected' : sub}</small>
              </button>
            ))}
          </div>
          <button className="link" onClick={onSkipSetup}>Later</button>
        </section>
      )}

      <div className="home-grid">
        {target && target.next ? (
          <section className="card continue" aria-labelledby="continue-title">
            <button className="continue-cover" onClick={() => onOpen(target)} aria-label={`Open ${target.entry.title}`}>
              <Cover entry={target.entry} />
              {target.level && <span className={`level l${target.level}`}>Level {target.level}</span>}
            </button>
            <div className="continue-body">
              <h2 id="continue-title">{target.entry.title}</h2>
              <p className="sub">{byLine(target.entry)}</p>
              <p className="next-step"><span>Next</span>{stepName(target.next)}</p>
              <div className="song-meter wide">
                <span className="meter"><i style={{ width: `${target.total ? (target.stars / target.total) * 100 : 0}%` }} /></span>
                <span className="meter-n"><IconStar size={13} />{target.stars} of {target.total}</span>
              </div>
              <button className="btn go big" onClick={() => onPlay(target, target.next!)}><IconPlay size={18} />{target.stars > 0 ? 'Continue' : 'Start'}</button>
            </div>
          </section>
        ) : (
          <section className="card continue skeleton" aria-busy={!ready}>
            <p className="fine">{ready ? 'Pick a song to start.' : 'Loading your songs…'}</p>
            {ready && <button className="btn go" onClick={onBrowse}>Browse songs</button>}
          </section>
        )}

        <section className="card today" aria-labelledby="today-title">
          <h2 id="today-title">Today’s practice</h2>
          <ul className="today-list">
            {reviews.map(r => (
              <li key={r.info.entry.id + r.step.id}>
                <button onClick={() => onPlay(r.info, r.step)}>
                  <Cover entry={r.info.entry} className="thumb" />
                  <span className="today-text">
                    <b>{stepName(r.step)}</b>
                    <small>{r.info.entry.title} · aim for 3 stars</small>
                  </span>
                  <Stars n={r.stars} />
                </button>
              </li>
            ))}
            {fresh.map(f => (
              <li key={f.entry.id}>
                <button onClick={() => onOpen(f)}>
                  <Cover entry={f.entry} className="thumb" />
                  <span className="today-text">
                    <b>{f.entry.title}</b>
                    <small><span className="new-tag">New</span> · Level {f.level} · {f.course!.parts.length} parts</small>
                  </span>
                  <span className="go-dot"><IconPlay size={14} /></span>
                </button>
              </li>
            ))}
            {!reviews.length && !fresh.length && <li className="fine">Every song has its stars. Add a new one in Songs.</li>}
          </ul>
        </section>
      </div>

      {recent.length > 0 && (
        <section className="shelf" aria-labelledby="recent-title">
          <div className="shelf-head">
            <h2 id="recent-title">Your songs</h2>
            <button className="link" onClick={onBrowse}>All songs</button>
          </div>
          <div className="shelf-row">
            {recent.map(info => <SongCard key={info.entry.id} info={info} onOpen={() => onOpen(info)} />)}
          </div>
        </section>
      )}
    </div>
  );
}
