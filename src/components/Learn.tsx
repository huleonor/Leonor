import { useMemo } from 'react';
import { dailySession, lessonPlayable, placementTaken, placementTest, unitTest, UNITS, usePath, type Playable } from '../lib/path';
import { dayKey } from '../lib/stats';
import type { Settings } from '../lib/types';
import { GoalPill, StreakPill, useDaily, XpPill } from './Home';
import { IconCap, IconCheck, IconLock, IconMusic, IconPlay, IconStar } from './Icons';
import { Stars } from './ui';
import { CoachCard } from './Coach';
import { FREE_UNITS, usePlan, type PaywallReason } from '../lib/billing';

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

/** Each unit has its own colour, as on Duolingo's path. */
const UNIT_COLORS = [
  ['var(--go)', 'var(--go-edge)'], ['var(--purple)', 'var(--purple-edge)'], ['var(--blue)', 'var(--blue-edge)'],
  ['var(--flame)', 'var(--flame-edge)'], ['#ff86d0', '#e070b4'], ['#00cd9c', '#00a57d'], ['#ff4b4b', '#ea2b2b'],
];

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
  onTest: (items: Playable[]) => void;
  onPaywall: (reason: PaywallReason) => void;
}

/** The main course: today's session on top, then the path of units, each ending in a song. */
export function Learn({ settings, onPlay, onTest, onPaywall }: Props) {
  const premium = !!usePlan();
  const daily = useDaily();
  const path = usePath();
  const session = useMemo(() => (path ? dailySession(path.state, path.progs) : null), [path]);

  return (
    <div className="page learn">
      <header className="page-head">
        <h1>Learn</h1>
        <div className="head-stats">
          <XpPill />
          <StreakPill days={daily.streak.days} lit={daily.streak.today} />
          <GoalPill sec={daily.today.sec} goal={settings.dailyGoal} />
        </div>
      </header>

      {path && !placementTaken() && !Object.values(path.state).some(st => st.passed > 0) && (
        <section className="card placement" aria-labelledby="placement-title">
          <div>
            <h2 id="placement-title">Already play a little?</h2>
            <p className="sub">Take the placement test: one short piece per unit, about 30 seconds each. Each one you pass with 2 stars skips that unit; it stops at the first one you do not.</p>
          </div>
          <div className="actions">
            <button className="btn go" onClick={() => onTest(placementTest())}><IconPlay size={16} />Take the test</button>
          </div>
        </section>
      )}

      <DailyCard items={session} onStart={(items, from) => onPlay(items, from, true)} />

      <CoachCard settings={settings} onPractise={p => onPlay([p], 0, false)} onPaywall={() => onPaywall('coach')} />

      {UNITS.map((u, ui) => {
        const states = u.lessons.map(l => path?.state[l.id]);
        const doneN = states.filter(s => s?.done).length;
        return (
          <section key={u.id} className="unit" aria-labelledby={`${u.id}-title`}
            style={{ '--unit': UNIT_COLORS[ui % UNIT_COLORS.length][0], '--unit-edge': UNIT_COLORS[ui % UNIT_COLORS.length][1] } as React.CSSProperties}>
            <header className="unit-head">
              <span className="unit-n">Unit {ui + 1}{ui >= FREE_UNITS && !premium && <> · <span className="premium-tag">Premium</span></>}</span>
              <h2 id={`${u.id}-title`}>{u.title}</h2>
              <p className="sub">{u.sub}</p>
              {path && !states[0]?.open && (
                <button className="btn small test-out" onClick={() => (ui >= FREE_UNITS && !premium ? onPaywall('unit') : onTest([unitTest(u)]))}>Test out</button>
              )}
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
                    {isNext && <span className="node-start" aria-hidden="true">{st && st.passed > 0 ? 'Continue' : 'Start'}</span>}
                    <button disabled={!open} onClick={() => (ui >= FREE_UNITS && !premium ? onPaywall('unit') : onPlay([lessonPlayable(l, path?.progs[l.id])], 0, false))}
                      aria-label={`${l.title}${st?.done ? `, ${st.stars} stars` : open ? '' : ', locked'}`}>
                      <span className="node-disc">
                        {!open ? <IconLock size={22} /> : l.kind === 'song' ? <IconMusic size={24} /> : st?.done ? <IconStar size={24} /> : <IconCap size={24} />}
                      </span>
                      <span className="node-text">
                        <b>{l.title}</b>
                        <small>{st?.tested ? 'Skipped by a test' : st?.done ? <Stars n={st.stars} /> : open && st && st.passed > 0 ? `${st.passed} of ${st.steps} steps` : l.sub}</small>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
      {!premium && (
        <section className="card upsell" aria-labelledby="upsell-title">
          <div>
            <h2 id="upsell-title">Unlock all 7 units</h2>
            <p className="sub">Premium opens the whole course, unlimited skill practice and unlimited songs. The first week is free.</p>
          </div>
          <button className="btn go" onClick={() => onPaywall('upgrade')}>Try 1 week free</button>
        </section>
      )}
      <p className="fine learn-more">More units are on the way: chords, eighth notes, sharps and flats.</p>
    </div>
  );
}
