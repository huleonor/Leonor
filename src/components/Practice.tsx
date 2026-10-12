import { useMemo } from 'react';
import { dailySession, usePath, type Playable } from '../lib/path';
import { dayKey } from '../lib/stats';
import { Energy } from './GameIcons';
import { IconCheck, IconPlay } from './Icons';
import { Penguin } from './Penguin';
import { SkillMap } from './ProgressView';

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

const KIND_LABEL = ['Warm-up', 'Lesson', 'Review'];

function DailyCard({ items, onStart }: { items: Playable[] | null; onStart: (items: Playable[], from: number) => void }) {
  const done = sessionDone();
  const all = !!items && done >= items.length;
  return (
    <section className="card daily" aria-labelledby="daily-title">
      <div className="daily-head">
        <Penguin pose={all ? 'cheer' : 'keys'} size={84} />
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
  onSession: (items: Playable[], from: number) => void;
  onPractice: (p: Playable) => void;
}

/** Practice: today's session and any skill on its own. Free, and it earns energy back. */
export function Practice({ onSession, onPractice }: Props) {
  const path = usePath();
  const session = useMemo(() => (path ? dailySession(path.state, path.progs) : null), [path]);
  return (
    <div className="page practice">
      <header className="page-head">
        <h1>Practice</h1>
        <span className="practice-free"><Energy size={18} />Free · +2 energy each</span>
      </header>
      <DailyCard items={session} onStart={onSession} />
      <SkillMap onPractice={onPractice} />
    </div>
  );
}
