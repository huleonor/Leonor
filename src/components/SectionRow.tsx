/**
 * The song's sections in a row, named by its form (Intro, Verse 1, Interlude, ...; the user's choice
 * 2026-11, like the section buttons of a sheet music app): each a card with a speaker to hear it and
 * its name to go into it, and "Full song" at the end. The section he is on is the pink card. Used on
 * the Song tab and in the paused video.
 */
import { useEffect, useState } from 'react';
import { L } from '../lib/lang';
import { listenBars, listening, onListening, stopListening } from '../lib/listen';
import type { Reel } from '../lib/reels';
import type { Song } from '../lib/types';
import { IconKeysFill, IconSpeaker, IconStop } from './Icons';

interface Props {
  song: Song;
  sections: Reel[];
  /** The section he is on (its phase id). */
  current?: string;
  onEnter: (r: Reel) => void;
  onWhole?: () => void;
}

export function SectionRow({ song, sections, current, onEnter, onWhole }: Props) {
  const [, bump] = useState(0);
  useEffect(() => onListening(() => bump(x => x + 1)), []);
  // Leaving the screen ends the section that sounds.
  useEffect(() => () => stopListening(), []);
  const now = listening();
  return (
    <nav className="part-row" aria-label={L('Sections of the song', 'Secções da música')} onClick={e => e.stopPropagation()}>
      <ol>
        {sections.map(r => {
          const key = `${song.entry.id}:${r.from}-${r.to}`, on = now === key;
          return (
            <li key={r.id} className={`part-chip ${current === r.id ? 'current' : ''}`}>
              <button className="part-listen" onClick={() => (on ? stopListening() : listenBars(song, r.from, r.to))}
                aria-pressed={on} aria-label={on ? L(`Stop ${r.section}`, `Parar ${r.section}`) : L(`Hear ${r.section}`, `Ouvir ${r.section}`)}>
                {on ? <IconStop size={18} /> : <IconSpeaker size={20} />}
              </button>
              <button className="part-go" onClick={() => { stopListening(); onEnter(r); }} aria-current={current === r.id ? 'step' : undefined}>
                {r.section}
              </button>
            </li>
          );
        })}
        {onWhole && (
          <li className="part-chip whole">
            <button className="part-go" onClick={() => { stopListening(); onWhole(); }}><IconKeysFill size={18} />{L('Full song', 'Música toda')}</button>
          </li>
        )}
      </ol>
    </nav>
  );
}
