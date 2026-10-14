/**
 * A song's cover, the same for every piece: a tile in one of the unit colours with a staff across
 * it and a big Phosphor glyph on top, chosen from the song itself so a song always looks the same
 * and two songs rarely look alike. No photos: an imported MIDI gets a cover like any other.
 */
import { Headphones, MusicNote, MusicNotes, MusicNotesSimple, PianoKeys, VinylRecord, Waveform, type Icon as PhIcon } from '@phosphor-icons/react';
import type { SongEntry } from '../lib/types';

const GLYPHS: PhIcon[] = [MusicNotes, PianoKeys, MusicNotesSimple, Waveform, MusicNote, VinylRecord, Headphones];
const COLOURS = 6;

/** A small stable number from the song's title and id. */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function coverOf(entry: Pick<SongEntry, 'id' | 'title'>) {
  const h = hash(`${entry.title}|${entry.id}`);
  return { colour: (h % COLOURS) + 1, Icon: GLYPHS[Math.floor(h / COLOURS) % GLYPHS.length] };
}

export function SongCover({ entry, className = '' }: { entry: Pick<SongEntry, 'id' | 'title'>; className?: string }) {
  const { colour, Icon } = coverOf(entry);
  return (
    <span className={`song-cover ${className}`} style={{ '--cover': `var(--cover-${colour})`, '--cover-edge': `var(--cover-${colour}-edge)` } as React.CSSProperties} aria-hidden="true">
      <span className="song-cover-staff" />
      <Icon className="song-cover-glyph" weight="fill" />
    </span>
  );
}
