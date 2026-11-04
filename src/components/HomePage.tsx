import { motion } from 'motion/react';
import type { Clip } from '../lib/reels';
import type { Song } from '../lib/types';
import { IconGear, IconImport, IconPlay, IconTabLibrary, IconTabSong, IconTabWatch } from './Icons';
import { SOFT } from './Motion';
import { ReelPreview } from './Reels';

const LAST = 'leonor:last-reel:';

/** The video he was last on, per song (its id, so it survives a change in the list). */
export function lastReel(songId: string): string | null {
  try { return localStorage.getItem(LAST + songId); } catch { return null; }
}
export function rememberReel(songId: string, clipId: string) {
  try { localStorage.setItem(LAST + songId, clipId); } catch { /* storage blocked: only for this visit */ }
}

interface Props {
  title?: string;
  song?: Song;
  clips: Clip[];
  /** Where the feed would open: the video he was on, or the next one he has not watched. */
  at: number;
  onContinue: () => void;
  onTab: (tab: 'watch' | 'song' | 'library') => void;
  onSettings: () => void;
  onAddMidi: () => void;
}

/**
 * Home, the first screen: the video he was on, as a still to pick up again, and the menu (the
 * videos, the song's path, his songs, settings) as index cards.
 */
export function HomePage({ title, song, clips, at, onContinue, onTab, onSettings, onAddMidi }: Props) {
  const clip = clips[at];
  const items = [
    { id: 'watch' as const, icon: <IconTabWatch size={26} />, name: 'Watch', line: 'The videos, one pattern at a time.' },
    { id: 'song' as const, icon: <IconTabSong size={26} />, name: 'Song', line: 'The path through the song, phase by phase.' },
    { id: 'library' as const, icon: <IconTabLibrary size={26} />, name: 'Library', line: 'Your songs, and new ones to bring.' },
  ];
  return (
    <div className="page home">
      <header className="home-head">
        <p className="journey-by">{title ? `Learning now: ${title}` : 'Leonor'}</p>
        <h1>{clip ? 'Pick up where you left off' : 'Your first song'}</h1>
      </header>
      {song && clip ? (
        <motion.button className="home-continue taped" onClick={onContinue} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={SOFT}
          aria-label={`Continue: phase ${clip.n}, video ${clip.k} of ${clip.of}`}>
          <ReelPreview song={song} reel={clip} />
          <span className="home-continue-foot">
            <span><b>Phase {clip.n}: {clip.words.title}</b><small>Video {clip.k} of {clip.of}</small></span>
            <span className="btn go"><IconPlay size={16} />Continue</span>
          </span>
        </motion.button>
      ) : (
        <section className="home-continue empty">
          <p className="sub">The videos are made from the song's own notes. Add a MIDI file and they are ready in a second.</p>
          <button className="btn go big" onClick={onAddMidi}><IconImport size={18} />Add the MIDI file</button>
        </section>
      )}
      <nav className="home-menu" aria-label="Menu">
        {items.map(x => (
          <button key={x.id} className="home-item" onClick={() => onTab(x.id)}>{x.icon}<span><b>{x.name}</b><small>{x.line}</small></span></button>
        ))}
        <button className="home-item" onClick={onSettings}><IconGear size={26} /><span><b>Settings</b><small>Your piano, the voice, the sound.</small></span></button>
      </nav>
    </div>
  );
}
