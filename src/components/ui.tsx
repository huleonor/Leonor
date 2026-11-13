import type { CourseStep } from '../lib/course';
import { IconStar } from './Icons';

export const stepName = (s: CourseStep) => (s.part !== undefined ? `Part ${s.part}, ${s.title}` : s.title);

export function Stars({ n, of = 3 }: { n: number; of?: number }) {
  return (
    <span className="stars" aria-label={`${n} of ${of} stars`}>
      {Array.from({ length: of }, (_, i) => <IconStar key={i} size={14} className={i < n ? 'won' : ''} />)}
    </span>
  );
}

export function Segmented<V extends string | number>({ label, value, options, onChange }: { label: string; value: V; options: [V, string][]; onChange: (v: V) => void }) {
  return (
    <div className="seg-row">
      <span className="seg-label">{label}</span>
      <div className="seg" role="radiogroup" aria-label={label}>
        {options.map(([v, text]) => (
          <button key={String(v)} role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{text}</button>
        ))}
      </div>
    </div>
  );
}
