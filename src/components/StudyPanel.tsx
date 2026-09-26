import { useMemo } from 'react';
import { analyseSong, type Tip, type TipKind } from '../lib/analysis';
import type { Song } from '../lib/types';
import { IconClose, IconPlay } from './Icons';

/** Legend printed beside each tip, and the LED colour that marks its kind. */
const KIND: Record<TipKind, { legend: string; led: string }> = {
  plan: { legend: 'Plan', led: 'orange' },
  repeat: { legend: 'Repeats', led: 'green' },
  left: { legend: 'Pattern', led: 'green' },
  chords: { legend: 'Chords', led: '' },
  position: { legend: 'Hands', led: '' },
  tricky: { legend: 'Tricky', led: 'red' },
  key: { legend: 'Key', led: '' },
  rhythm: { legend: 'Rhythm', led: '' },
};

interface Props {
  song: Song;
  onPractice: (p: NonNullable<Tip['practice']>) => void;
  onClose: () => void;
}

/** What to notice before playing: repeats, patterns, chords, hard spots, each with a loop to practise. */
export function StudyPanel({ song, onPractice, onClose }: Props) {
  const analysis = useMemo(() => analyseSong(song), [song]);
  return (
    <div className="scrim" onClick={onClose}>
      <section className="sheet-panel wide" role="dialog" aria-label="Learn this song faster" onClick={e => e.stopPropagation()}>
        <header className="sheet-head">
          <div>
            <h2>Learn {song.entry.title} faster</h2>
            <p className="study-meta">{analysis.bars} bars · {analysis.uniqueBars} really different</p>
          </div>
          <button className="keycap" onClick={onClose} aria-label="Close"><IconClose /></button>
        </header>
        <ol className="tips">
          {analysis.tips.map((tip, i) => (
            <li key={i} className="tip">
              <span className="tip-kind"><i className={`led ${KIND[tip.kind].led}`} /><span className="legend">{KIND[tip.kind].legend}</span></span>
              <h3>{tip.title}</h3>
              {tip.kind === 'plan'
                ? <ol className="plan">{tip.body.split(/\s*\d+\.\s+/).filter(Boolean).map((step, j) => <li key={j}>{step}</li>)}</ol>
                : <p>{tip.body}</p>}
              {tip.practice && (
                <button className="pill go" onClick={() => onPractice(tip.practice!)}>
                  <IconPlay size={13} />
                  Practise {tip.practice.from === tip.practice.to ? `bar ${tip.practice.from}` : `bars ${tip.practice.from}–${tip.practice.to}`}
                  {tip.practice.hands === 'L' ? ' · left hand' : tip.practice.hands === 'R' ? ' · right hand' : ''}
                  {tip.practice.speed ? ` · ${tip.practice.speed}×` : ''}
                </button>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
