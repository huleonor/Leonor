import { useEffect, useRef, useState } from 'react';
import { askCoach, CoachError, learnerPicture, makePlan, planDayToday, storedPlan, type ChatTurn, type CoachFailure, type StoredPlan } from '../lib/aicoach';
import { usePlan } from '../lib/billing';
import { skillPractice, usePath, type Playable } from '../lib/path';
import type { Settings } from '../lib/types';
import { IconClose, IconPlay, IconRestart } from './Icons';

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayName = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return offset === 0 ? 'Today' : DAY[d.getDay()]; };

const FAILURE: Record<CoachFailure, string> = {
  offline: 'You are offline. The coach needs the internet to answer.',
  unavailable: 'The coach is not switched on for this app yet.',
  busy: 'The coach is busy right now. Try again in a minute.',
  refused: 'The coach could not answer that one. Try asking another way.',
  failed: 'Something went wrong. Try again.',
};

/** A small spark for the coach, drawn here rather than a mascot. */
const Spark = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.5l2.1 5.4 5.4 2.1-5.4 2.1L10 16.5l-2.1-5.4L2.5 9l5.4-2.1z" fill="currentColor" /><circle cx="16" cy="15.5" r="1.6" fill="currentColor" /></svg>
);

interface Props {
  settings: Settings;
  onPractise: (p: Playable) => void;
  onPaywall: () => void;
}

/** This week's plan, written by the AI coach from how he plays, with a way to talk to the coach. */
export function CoachCard({ settings, onPractise, onPaywall }: Props) {
  const premium = !!usePlan();
  const path = usePath();
  const [plan, setPlan] = useState<StoredPlan | null>(storedPlan);
  const [busy, setBusy] = useState(false);
  const [chat, setChat] = useState(false);

  const refresh = async () => {
    if (!path) return;
    setBusy(true);
    try { setPlan(await makePlan(settings.lang, learnerPicture(path.state, settings.dailyGoal), settings.dailyGoal)); } finally { setBusy(false); }
  };
  // A new plan the first time a Premium learner opens this, and every seven days.
  useEffect(() => { if (premium && path && !plan && !busy) refresh(); }, [premium, path]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!premium) {
    return (
      <section className="card coach-plan locked" aria-labelledby="coach-title">
        <span className="coach-mark"><Spark /></span>
        <div>
          <h2 id="coach-title">Your AI coach <span className="premium-tag">Premium</span></h2>
          <p className="sub">A plan for your week, written from how you actually play, and a coach you can ask anything: why a skill dropped, what to practise today, how to play faster.</p>
        </div>
        <button className="btn go" onClick={onPaywall}>Try it free</button>
      </section>
    );
  }

  const today = plan ? planDayToday(plan) : 1;
  const todayPlan = plan?.plan.days.find(d => d.day === today);
  return (
    <section className="card coach-plan" aria-labelledby="coach-title" aria-busy={busy}>
      <header className="coach-head">
        <span className="coach-mark"><Spark /></span>
        <div>
          <h2 id="coach-title">This week with your coach</h2>
          <p className="coach-focus">{plan ? plan.plan.focus : busy ? 'Writing your plan…' : 'No plan yet'}</p>
        </div>
        <div className="coach-actions">
          <button className="btn blue" onClick={() => setChat(true)}>Ask your coach</button>
          <button className="icon-btn" onClick={refresh} disabled={busy} aria-label="Write a new plan"><IconRestart size={18} /></button>
        </div>
      </header>
      {plan && (
        <>
          <p className="coach-summary">{plan.plan.summary}</p>
          <ol className="plan-days">
            {plan.plan.days.map(d => (
              <li key={d.day} className={`${d.day === today ? 'today' : ''} ${d.day < today ? 'past' : ''}`}>
                <small>{dayName(d.day - today)}</small>
                <b>{d.title}</b>
                <span>{d.minutes} min</span>
              </li>
            ))}
          </ol>
          {todayPlan && (
            <div className="plan-today">
              <p><b>Today:</b> {todayPlan.note}</p>
              <button className="btn go" onClick={() => onPractise(skillPractice(todayPlan.skill))}><IconPlay size={16} />Practise {todayPlan.title.toLowerCase()}</button>
            </div>
          )}
          <p className="fine coach-tip"><b>Tip:</b> {plan.plan.tip}{plan.source === 'device' ? ' · Made on this device while the coach was offline.' : ''}</p>
        </>
      )}
      {chat && <CoachChat settings={settings} onClose={() => setChat(false)} />}
    </section>
  );
}

const CHAT = 'hugos-piano:coach-chat';
const SUGGESTIONS = ['What should I practise today?', 'Why am I slow at reading?', 'How do I get faster with both hands?', 'How did my week go?'];

/** A conversation with the coach. It sees the same picture of him as the plan does. */
export function CoachChat({ settings, onClose }: { settings: Settings; onClose: () => void }) {
  const path = usePath();
  const [turns, setTurns] = useState<ChatTurn[]>(() => { try { return JSON.parse(localStorage.getItem(CHAT) ?? '[]'); } catch { return []; } });
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { try { localStorage.setItem(CHAT, JSON.stringify(turns.slice(-30))); } catch { /* ignore */ } }, [turns]);
  useEffect(() => { listRef.current?.scrollTo({ top: 1e6, behavior: 'smooth' }); }, [turns, busy]);

  const send = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    const history = [...turns, { role: 'user' as const, content: question }];
    setTurns(history);
    setText('');
    setError(null);
    setBusy(true);
    try {
      const reply = await askCoach(settings.lang, history, learnerPicture(path?.state ?? null, settings.dailyGoal));
      setTurns(t => [...t, { role: 'assistant', content: reply }]);
    } catch (e) {
      setError(e instanceof CoachError ? FAILURE[e.kind] : FAILURE.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="scrim" onClick={onClose}>
      <aside className="side-sheet coach-chat" role="dialog" aria-modal="true" aria-labelledby="chat-title" onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <div className="chat-title"><span className="coach-mark small"><Spark size={18} /></span><h2 id="chat-title">Your coach</h2></div>
          <button className="icon-btn ghost" onClick={onClose} aria-label="Close"><IconClose /></button>
        </div>
        <div className="chat-list" ref={listRef} aria-live="polite">
          {!turns.length && <p className="chat-bubble coach">Hi! I can see your skills, your recent lessons and your week. Ask me anything about your practice.</p>}
          {turns.map((t, i) => <p key={i} className={`chat-bubble ${t.role === 'user' ? 'me' : 'coach'}`}>{t.content}</p>)}
          {busy && <p className="chat-bubble coach typing" aria-label="The coach is writing"><i /><i /><i /></p>}
          {error && <p className="chat-error" role="alert">{error}</p>}
        </div>
        {!turns.length && (
          <div className="chat-suggest">
            {SUGGESTIONS.map(s => <button key={s} className="chip" onClick={() => send(s)}>{s}</button>)}
          </div>
        )}
        <form className="chat-input" onSubmit={e => { e.preventDefault(); send(text); }}>
          <input value={text} onChange={e => setText(e.target.value)} placeholder="Ask about your practice" aria-label="Your question" maxLength={600} />
          <button className="btn go" disabled={busy || !text.trim()}>Send</button>
        </form>
        {turns.length > 0 && <button className="btn quiet" onClick={() => { setTurns([]); setError(null); }}>Start a new conversation</button>}
      </aside>
    </div>
  );
}
