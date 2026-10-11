import { useMemo } from 'react';
import { dailySession, lessonPlayable, UNITS, usePath, type Playable } from '../lib/path';
import { dayKey } from '../lib/stats';
import type { Settings } from '../lib/types';
import { GoalPill, StreakPill, useDaily } from './Home';
import { IconCap, IconCheck, IconLock, IconMusic, IconPlay, IconStar } from './Icons';
import { Stars } from './ui';

const SESSION_KEY = 'hugos-piano:session';

/** How many of today's session items are done. */
export function sessionDone(): number {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}') as { day?: string; done?: number };
    return s.day === dayKey() ? s.done ?? 0 : 0;
  } catch { return 0; }
}
export function markSession(done: number) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ day: dayKey(), done: Math.max(done, sessionDone()) })); } catch { /* ignore */ }
}

/** Today's session, made fresh from his skill profile and his place on the path. */
export function useSession(): Playable[] | null {
  const path = usePath();
  return useMemo(() => (path ? dailySession(path.state, path.progs) : null), [path]);
}

const KIND_LABEL = ['Warm-up', 'Lesson', 'Review'];

export function DailyCard({ items, onStart }: { items: Playable[] | null; onStart: (items: Playable[], from: number) => void }) {
  const done = sessionDone();
  const all = !!items && done >= items.length;
  return (
    <section className="card daily" aria-labelledby="daily-title">
      <div className="daily-head">
        <div>
          <h2 id="daily-title">Today’s session</h2>
          <p className="sub">{all ? 'Done for today. Come back tomorrow for a new one.' : 'About 10 minutes, made for you from how you played.'}</p>
        </div>
        {items && !all && (
          <button className="btn go big" onClick={() => onStart(items, Math.min(done, items.length - 1))}>
            <IconPlay size={18} />{done ? 'Continue' : 'Start'}
          </button>
        )}
      </div>
      <ol className="daily-list">
        {(items ?? []).map((it, i) => (
          <li key={it.id} className={i < done ? 'done' : i === done ? 'now' : ''}>
            <span className="daily-dot">{i < done ? <IconCheck size={16} /> : i + 1}</span>
            <span className="daily-text">
              <small>{KIND_LABEL[items!.length === 2 && i === 1 ? 2 : i] ?? 'Practice'}</small>
              <b>{it.title}</b>
              <em>{it.why}</em>
            </span>
          </li>
        ))}
        {!items && <li className="fine">Getting your session ready…</li>}
      </ol>
    </section>
  );
}

interface Props {
  settings: Settings;
  onPlay: (items: Playable[], from: number, session: boolean) => void;
}

/** The main course: today's session on top, then the path of units, each ending in a song. */
export function Learn({ settings, onPlay }: Props) {
  const daily = useDaily();
  const path = usePath();
  const session = useMemo(() => (path ? dailySession(path.state, path.progs) : null), [path]);

  return (
    <div className="page learn">
      <header className="page-head">
        <h1>Learn</h1>
        <div className="head-stats">
          <StreakPill days={daily.streak.days} lit={daily.streak.today} />
          <GoalPill sec={daily.today.sec} goal={settings.dailyGoal} />
        </div>
      </header>

      <DailyCard items={session} onStart={(items, from) => onPlay(items, from, true)} />

      {UNITS.map((u, ui) => {
        const states = u.lessons.map(l => path?.state[l.id]);
        const doneN = states.filter(s => s?.done).length;
        return (
          <section key={u.id} className="unit" aria-labelledby={`${u.id}-title`}>
            <header className="unit-head">
              <span className="unit-n">Unit {ui + 1}</span>
              <h2 id={`${u.id}-title`}>{u.title}</h2>
              <p className="sub">{u.sub}</p>
              <span className="unit-meter" aria-label={`${doneN} of ${u.lessons.length} lessons done`}>
                <span className="meter"><i style={{ width: `${(doneN / u.lessons.length) * 100}%` }} /></span>
                {doneN}/{u.lessons.length}
              </span>
            </header>
            <ol className="path">
              {u.lessons.map((l, li) => {
                const st = path?.state[l.id];
                const open = !!st?.open;
                const isNext = open && !st?.done;
                return (
                  <li key={l.id} className={`path-node ${st?.done ? 'done' : ''} ${isNext ? 'next' : ''} ${open ? '' : 'locked'}`} style={{ '--sway': [0, 1, 2, 1, 0, -1, -2, -1][li % 8] } as React.CSSProperties}>
                    <button disabled={!open} onClick={() => onPlay([lessonPlayable(l, path?.progs[l.id])], 0, false)}
                      aria-label={`${l.title}${st?.done ? `, ${st.stars} stars` : open ? '' : ', locked'}`}>
                      <span className="node-disc">
                        {!open ? <IconLock size={22} /> : l.kind === 'song' ? <IconMusic size={24} /> : st?.done ? <IconStar size={24} /> : <IconCap size={24} />}
                      </span>
                      <span className="node-text">
                        <b>{l.title}</b>
                        <small>{st?.done ? <Stars n={st.stars} /> : open && st && st.passed > 0 ? `${st.passed} of ${st.steps} steps` : l.sub}</small>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
      <p className="fine learn-more">More units are on the way: chords, eighth notes, sharps and flats.</p>
    </div>
  );
}
