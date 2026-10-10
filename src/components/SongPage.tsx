import { useMemo, useState } from 'react';
import { analyseSong, keyName } from '../lib/analysis';
import type { SongInfo } from '../lib/catalog';
import { partLearnt, stepOpen, type CourseStep } from '../lib/course';
import { formatTime } from '../lib/names';
import { IconBack, IconCheck, IconEdit, IconLock, IconPlay, IconSpeed, IconStar, IconTrash } from './Icons';
import { stepName, Stars } from './Practice';
import { byLine, Cover } from './Songs';

const STEP_LABEL: Record<string, string> = { R: 'Right hand', L: 'Left hand', 'R+L': 'Hands together', '1×': 'In tempo', '.6': 'Slowly', '.8': 'Faster' };
const STEP_HAND: Record<string, string> = { R: 'R', L: 'L', 'R+L': 'R+L', '.6': '0.6×', '.8': '0.8×' };

interface Props {
  info: SongInfo;
  onBack: () => void;
  onStep: (step: CourseStep) => void;
  onFree: () => void;
  onRename?: (title: string, composer: string) => void;
  onDelete?: () => void;
}

function StepTile({ info, step, isNext, onStep, label }: { info: SongInfo; step: CourseStep; isNext: boolean; onStep: (s: CourseStep) => void; label?: string }) {
  const open = stepOpen(info.course!, info.prog, step);
  const stars = info.prog[step.id]?.stars ?? 0;
  const text = label ?? STEP_LABEL[step.short] ?? step.title;
  return (
    <button
      className={`tile ${isNext ? 'next' : ''} ${stars ? 'done' : ''}`}
      disabled={!open}
      onClick={() => onStep(step)}
      aria-label={`${stepName(step)}${open ? '' : ', locked'}, ${stars} of 3 stars`}
    >
      <span className="tile-badge">{!open ? <IconLock size={14} /> : step.part !== undefined && STEP_HAND[step.short] ? STEP_HAND[step.short] : step.speed >= 1 && !step.wait ? <IconSpeed size={16} /> : <IconPlay size={14} />}</span>
      <span className="tile-name">{text}</span>
      <Stars n={stars} />
      {isNext && <span className="tile-next">Next</span>}
    </button>
  );
}

export function SongPage({ info, onBack, onStep, onFree, onRename, onDelete }: Props) {
  const { entry, song, course, next } = info;
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [title, setTitle] = useState(entry.title);
  const [composer, setComposer] = useState(entry.composer ?? '');
  const tips = useMemo(() => (song ? analyseSong(song).tips.filter(t => ['repeat', 'position', 'left', 'tricky'].includes(t.kind)).slice(0, 3) : []), [song]);
  if (!song || !course) return null;
  const key = keyName(song);
  const joins = course.steps.filter(s => s.kind === 'join');
  const finals = course.steps.filter(s => s.kind === 'song');
  const pct = info.total ? info.stars / info.total : 0;

  return (
    <div className="page song-page">
      <aside className="song-side">
        <button className="icon-btn ghost back" onClick={onBack} aria-label="Back"><IconBack /></button>
        <div className="song-hero">
          <Cover entry={entry} />
          {info.level && <span className={`level l${info.level}`}>Level {info.level}</span>}
        </div>
        {editing ? (
          <form className="edit-form" onSubmit={e => { e.preventDefault(); onRename?.(title, composer); setEditing(false); }}>
            <label>Title<input value={title} onChange={e => setTitle(e.target.value)} autoFocus /></label>
            <label>Composer<input value={composer} onChange={e => setComposer(e.target.value)} /></label>
            <div className="actions">
              <button className="btn go" type="submit">Save</button>
              <button className="btn quiet" type="button" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        ) : (
          <>
            <h1>{entry.title}</h1>
            <p className="sub">{byLine(entry) || 'Imported song'}</p>
          </>
        )}
        <ul className="facts">
          {info.level && <li className={`fact-level l${info.level}`}>Level {info.level}</li>}
          <li>{formatTime(song.duration)}</li>
          <li>{key.name}</li>
          <li>{song.hands.length === 2 ? 'Two hands' : 'One hand'}</li>
          <li>{course.parts.length} parts</li>
        </ul>
        <div className="song-meter wide">
          <span className="meter"><i style={{ width: `${pct * 100}%` }} /></span>
          <span className="meter-n"><IconStar size={13} />{info.stars} of {info.total}</span>
        </div>
        <div className="side-actions">
          {next && <button className="btn go big" onClick={() => onStep(next)}><IconPlay size={18} />{info.stars ? 'Continue' : 'Start'}</button>}
          <button className="btn" onClick={onFree}>Play freely</button>
        </div>
        {onRename && !editing && (
          <div className="own-actions">
            <button className="link muted" onClick={() => setEditing(true)}><IconEdit size={15} />Rename</button>
            {confirm
              ? <span className="confirm">Delete this song and its stars? <button className="link danger" onClick={onDelete}>Delete</button><button className="link" onClick={() => setConfirm(false)}>Keep</button></span>
              : <button className="link muted" onClick={() => setConfirm(true)}><IconTrash size={15} />Delete</button>}
          </div>
        )}
      </aside>

      <div className="course">
        {next && <p className="course-next">Next up: <b>{stepName(next)}</b></p>}
        {course.parts.map(p => {
          const steps = course.steps.filter(s => s.part === p.n);
          const learnt = partLearnt(course, info.prog, p.n);
          return (
            <section key={p.n} className={`part ${learnt ? 'learnt' : ''}`} aria-labelledby={`part-${p.n}`}>
              <header>
                <h2 id={`part-${p.n}`}>Part {p.n}{learnt && <IconCheck size={16} />}</h2>
                <span className="part-bars">Bars {p.from}–{p.to}</span>
                {p.hard && <span className="tag">Tricky</span>}
              </header>
              {p.sameAs
                ? <p className="same">Same music as part {p.sameAs}: {learnt ? 'learnt with it.' : 'learn it there and this one comes free.'}</p>
                : <div className="tiles">{steps.map(s => <StepTile key={s.id} info={info} step={s} isNext={next?.id === s.id} onStep={onStep} />)}</div>}
            </section>
          );
        })}
        {joins.length > 0 && (
          <section className="part" aria-labelledby="joins">
            <header><h2 id="joins">Put it together</h2></header>
            <div className="tiles">{joins.map(s => <StepTile key={s.id} info={info} step={s} isNext={next?.id === s.id} onStep={onStep} label={`Parts ${s.parts![0]} + ${s.parts![1]}`} />)}</div>
          </section>
        )}
        <section className="part final" aria-labelledby="whole">
          <header><h2 id="whole">Whole song</h2></header>
          <div className="tiles">{finals.map(s => <StepTile key={s.id} info={info} step={s} isNext={next?.id === s.id} onStep={onStep} label={s.title} />)}</div>
        </section>
        {tips.length > 0 && (
          <section className="tips" aria-labelledby="tips">
            <h2 id="tips">Good to know</h2>
            {tips.map((t, i) => (
              <article key={i}>
                <h3>{t.title}</h3>
                <p>{t.body}</p>
              </article>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
