import { motion } from 'motion/react';
import { L } from '../lib/lang';
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
  /** The song is still being read: a loading card, never the "add the file" one. */
  loading?: boolean;
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
export function HomePage({ title, song, loading, clips, at, onContinue, onTab, onSettings, onAddMidi }: Props) {
  const clip = clips[at];
  const items = [
    { id: 'watch' as const, icon: <IconTabWatch size={26} />, name: L('Watch', 'Ver'), line: L('The videos, one pattern at a time.', 'Os vídeos, um padrão de cada vez.') },
    { id: 'song' as const, icon: <IconTabSong size={26} />, name: L('Song', 'Música'), line: L('The path through the song, phase by phase.', 'O caminho pela música, fase a fase.') },
    { id: 'library' as const, icon: <IconTabLibrary size={26} />, name: L('Library', 'Biblioteca'), line: L('Your songs, and new ones to bring.', 'As tuas músicas, e novas para trazer.') },
  ];
  return (
    <div className="page home">
      <header className="home-head">
        <p className="journey-by">{title ? L(`Learning now: ${title}`, `A aprender: ${title}`) : 'Leonor'}</p>
        <h1>{clip || loading ? L('Pick up where you left off', 'Continua onde ficaste') : L('Your first song', 'A tua primeira música')}</h1>
      </header>
      {song && clip ? (
        <motion.button className="home-continue taped" onClick={onContinue} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={SOFT}
          aria-label={clip.phase.n === 0 ? L('Continue: overview of the song', 'Continuar: visão geral da música') : L(`Continue: ${clip.phase.section}, video ${clip.k} of ${clip.of}`, `Continuar: ${clip.phase.section}, vídeo ${clip.k} de ${clip.of}`)}>
          <ReelPreview song={song} reel={clip} />
          <span className="home-continue-foot">
            <span><b>{clip.phase.section === clip.words.title ? clip.phase.section : `${clip.phase.section}: ${clip.words.title}`}</b><small>{L(`Video ${clip.k} of ${clip.of}`, `Vídeo ${clip.k} de ${clip.of}`)}</small></span>
            <span className="btn go"><IconPlay size={16} />{L('Continue', 'Continuar')}</span>
          </span>
        </motion.button>
      ) : loading ? (
        <section className="home-continue empty" aria-busy="true">
          <span className="home-loading skeleton" aria-hidden="true" />
          <p className="sub">{L('Getting your song ready.', 'A preparar a tua música.')}</p>
        </section>
      ) : (
        <section className="home-continue empty">
          <p className="sub">{L("The videos are made from the song's own notes. Add a MIDI file and they are ready in a second.", 'Os vídeos são feitos das notas da própria música. Junta um ficheiro MIDI e ficam prontos num segundo.')}</p>
          <button className="btn go big" onClick={onAddMidi}><IconImport size={18} />{L('Add the MIDI file', 'Juntar o ficheiro MIDI')}</button>
        </section>
      )}
      <nav className="home-menu" aria-label="Menu">
        {items.map(x => (
          <button key={x.id} className="home-item" onClick={() => onTab(x.id)}>{x.icon}<span><b>{x.name}</b><small>{x.line}</small></span></button>
        ))}
        <button className="home-item" onClick={onSettings}><IconGear size={26} /><span><b>{L('Settings', 'Definições')}</b><small>{L('Your piano, the voice, the sound.', 'O teu piano, a voz, o som.')}</small></span></button>
      </nav>
    </div>
  );
}

/**
 * The video he was on, as a still to pick up again (the top of the Song tab, the 2026-11 audit:
 * three destinations, the song first): its kicker, its notes on the keys, the section and Continue.
 */
export function ContinueCard({ song, clip, onContinue }: { song: Song; clip: Clip; onContinue: () => void }) {
  return (
    <motion.button className="home-continue taped" onClick={onContinue} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={SOFT}
      aria-label={clip.phase.n === 0 ? L('Continue: overview of the song', 'Continuar: visão geral da música') : L(`Continue: ${clip.phase.section}, video ${clip.k} of ${clip.of}`, `Continuar: ${clip.phase.section}, vídeo ${clip.k} de ${clip.of}`)}>
      <ReelPreview song={song} reel={clip} />
      <span className="home-continue-foot">
        {clip.phase.n === 0
          ? <span><b>{L('Overview of the song', 'Visão geral da música')}</b><small>{L('Its sections and how each is learnt', 'As secções e como se aprende cada uma')}</small></span>
          : <span><b>{clip.phase.section === clip.words.title ? clip.phase.section : `${clip.phase.section}: ${clip.words.title}`}</b><small>{L(`Video ${clip.k} of ${clip.of}`, `Vídeo ${clip.k} de ${clip.of}`)}</small></span>}
        <span className="btn go"><IconPlay size={16} />{L('Continue', 'Continuar')}</span>
      </span>
    </motion.button>
  );
}

