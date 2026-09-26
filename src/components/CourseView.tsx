import { useEffect, useMemo, useState } from 'react';
import { analyseSong, keyName, songLevel } from '../lib/analysis';
import {
  buildCourse, courseStars, getCourseProgress, nextStep, partLearnt, stepOpen,
  type Course, type CourseProgress, type CourseStep,
} from '../lib/course';
import { filmName, useI18n } from '../lib/i18n';
import { GENERIC_COVER } from '../lib/library';
import { formatTime } from '../lib/names';
import type { Song } from '../lib/types';
import { IconBack, IconLock, IconPlay } from './Icons';

interface Props {
  song: Song;
  onBack: () => void;
  onStep: (step: CourseStep, course: Course) => void;
  onFree: () => void;
}

const LEGEND: Record<string, string> = { R: 'Right', L: 'Left', 'R+L': 'Both', '1×': 'Tempo', '.6': 'Slow', '.8': 'Faster' };

export const stepLabel = (_course: Course, s: CourseStep) =>
  s.part !== undefined ? `Part ${s.part} · ${s.title}` : s.title;

function Stars({ n }: { n: number }) {
  return (
    <span className="stars" aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map(i => <i key={i} className={`led ${i < n ? 'orange' : ''}`} />)}
    </span>
  );
}

function StepKey({ step, prog, course, next, onStep }: { step: CourseStep; prog: CourseProgress; course: Course; next?: CourseStep; onStep: Props['onStep'] }) {
  const open = stepOpen(course, prog, step);
  const stars = prog[step.id]?.stars ?? 0;
  const isNext = next?.id === step.id;
  return (
    <div className={`step ${isNext ? 'is-next' : ''}`}>
      <button
        className={`keycap ${stars ? 'dark' : ''}`}
        disabled={!open}
        onClick={() => onStep(step, course)}
        aria-label={`${stepLabel(course, step)}${open ? '' : ' (locked)'}, ${stars} stars`}
      >
        {open ? step.short : <IconLock size={15} />}
      </button>
      <span className="legend">{step.part !== undefined ? LEGEND[step.short] ?? step.short : step.short}</span>
      <Stars n={stars} />
    </div>
  );
}

/** A song's course: its parts, the steps to master each, then joining them into the whole song. */
export function CourseView({ song, onBack, onStep, onFree }: Props) {
  const { t, lang } = useI18n();
  const course = useMemo(() => buildCourse(song), [song]);
  const facts = useMemo(() => {
    const a = analyseSong(song);
    return a.tips.filter(tip => ['left', 'chords', 'rhythm', 'position'].includes(tip.kind)).slice(0, 3);
  }, [song]);
  const level = useMemo(() => songLevel(song), [song]);
  const key = useMemo(() => keyName(song).name, [song]);
  const [prog, setProg] = useState<CourseProgress>({});
  useEffect(() => { getCourseProgress(song.entry.id).then(setProg); }, [song]);

  const next = nextStep(course, prog);
  const { got, total } = courseStars(course, prog);
  const learnt = course.parts.filter(p => partLearnt(course, prog, p.n)).length;
  const film = filmName(song.entry, lang);
  const img = song.entry.image ?? GENERIC_COVER;
  const partSteps = (n: number) => course.steps.filter(s => s.part === n);
  const joins = course.steps.filter(s => s.kind === 'join');
  const whole = course.steps.filter(s => s.kind === 'song');

  return (
    <div className="course">
      <header className="bar">
        <button className="keycap" onClick={onBack} aria-label={t('back')}><IconBack /></button>
        <div className="bar-title">
          <h1>{song.entry.title}</h1>
          <p className="course-sub">{[film, song.entry.composer, formatTime(song.duration)].filter(Boolean).join(' · ')}</p>
        </div>
        <button className="pill" onClick={onFree}><IconPlay size={14} />Play whole song</button>
      </header>

      <div className="course-body">
        <aside className="course-side">
          <figure className="photo"><img src={img.src} alt={img.alt} draggable={false} /></figure>
          <dl className="lcd course-meter">
            <div><dt>Parts learnt</dt><dd>{learnt}/{course.parts.length}</dd></div>
            <div><dt>Stars</dt><dd>{got}/{total}</dd></div>
          </dl>
          {next && (
            <button className="pill go continue" onClick={() => onStep(next, course)}>
              <IconPlay size={14} />
              <span>{got ? 'Continue' : 'Start'}<small>{stepLabel(course, next)}</small></span>
            </button>
          )}
          <p className="course-level">
            <span className="level" aria-label={`Level ${level} of 3`}>{[1, 2, 3].map(i => <i key={i} className={`led ${i <= level ? 'lvl' : ''}`} />)}</span>
            {level === 1 ? 'First pieces' : level === 2 ? 'Intermediate' : 'Advanced'} · {key}
          </p>
        </aside>

        <main className="course-path" aria-label="Course">
          {course.parts.map(p => (
            <section key={p.n} className={`part-row ${p.sameAs ? 'same' : ''} ${partLearnt(course, prog, p.n) ? 'learnt' : ''}`}>
              <div className="part-name">
                <h3>Part {p.n}{p.hard && !p.sameAs && <span className="hard"><i className="led red" />tricky</span>}</h3>
                <p>Bars {p.from}–{p.to}</p>
              </div>
              {p.sameAs
                ? <p className="same-note">Same music as Part {p.sameAs}. Learn that one and this is done.</p>
                : <div className="part-steps">{partSteps(p.n).map(s => <StepKey key={s.id} step={s} prog={prog} course={course} next={next} onStep={onStep} />)}</div>}
            </section>
          ))}

          {joins.length > 0 && (
            <section className="part-row join">
              <div className="part-name"><h3>Join the parts</h3><p>With Wait, at 0.8×</p></div>
              <div className="part-steps">{joins.map(s => <StepKey key={s.id} step={s} prog={prog} course={course} next={next} onStep={onStep} />)}</div>
            </section>
          )}

          <section className="part-row whole">
            <div className="part-name"><h3>The whole song</h3><p>Bars {course.parts[0]?.from}–{course.parts[course.parts.length - 1]?.to}</p></div>
            <div className="part-steps">{whole.map(s => <StepKey key={s.id} step={s} prog={prog} course={course} next={next} onStep={onStep} />)}</div>
          </section>

          {facts.length > 0 && (
            <section className="song-notes">
              <h3>What helps with this song</h3>
              {facts.map((f, i) => <p key={i}><b>{f.title}.</b> {f.body}</p>)}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
