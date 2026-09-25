import { useMemo } from 'react';
import { analyseSong, type Tip, type TipKind } from '../lib/analysis';
import type { Song } from '../lib/types';
import { IconClose, IconPlay } from './Icons';

const KICKER: Record<TipKind, string> = {
  plan: 'Plan',
  repeat: 'Repeats',
  left: 'Pattern',
  chords: 'Chords',
  position: 'Hands',
  tricky: 'Tricky',
  key: 'Key',
  rhythm: 'Rhythm',
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
    <div className="study-scrim" onClick={onClose}>
      <section className="study" role="dialog" aria-label="Learn this song" onClick={e => e.stopPropagation()}>
        <header className="study-head">
          <div>
            <p className="study-kicker">Learn it faster</p>
            <h2>{song.entry.title}</h2>
            <p className="study-meta">{analysis.bars} bars · {analysis.uniqueBars} different</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><IconClose /></button>
        </header>
        <ol className="tips">
          {analysis.tips.map((tip, i) => (
            <li key={i} className={`tip tip-${tip.kind}`}>
              <span className="tip-kicker">{KICKER[tip.kind]}</span>
              <h3>{tip.title}</h3>
              <p>{tip.body}</p>
              {tip.practice && (
                <button className="tip-go" onClick={() => onPractice(tip.practice!)}>
                  <IconPlay size={14} />
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
