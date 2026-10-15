/**
 * A song's cover, the same design for every piece: a tile in one of the cover colours with a staff
 * across it. When the song's notes are at hand, the staff carries its real opening (the first
 * notes of the melody, at their pitch), so every cover is that song's own music; otherwise a big
 * Phosphor glyph. Colour and glyph come from the song, so it always looks the same. No photos.
 */
import { Headphones, MusicNote, MusicNotes, MusicNotesSimple, PianoKeys, VinylRecord, Waveform, type Icon as PhIcon } from '@phosphor-icons/react';
import { useMemo } from 'react';
import { BUILT_IN } from '../lib/library';
import type { Song, SongEntry } from '../lib/types';

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
  // The app's own songs take the colours in turn, so no two neighbours match; imports go by hash.
  const i = BUILT_IN.findIndex(e => e.id === entry.id);
  return { colour: ((i >= 0 ? i : h) % COLOURS) + 1, Icon: GLYPHS[Math.floor(h / COLOURS) % GLYPHS.length] };
}

// White keys from C: a pitch's place on the staff, a line or space per step.
const STEP = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
const stepOf = (midi: number) => Math.floor(midi / 12) * 7 + STEP[midi % 12];

/** The opening melody: the top note of each of the first few onsets the right hand plays. */
function opening(song: Song, count = 7) {
  const hand = song.hands.includes('R') ? 'R' : song.hands[0];
  const byTick = new Map<number, number>();
  for (const n of song.notes) if (n.hand === hand) byTick.set(n.ticks, Math.max(byTick.get(n.ticks) ?? 0, n.midi));
  return [...byTick.entries()].sort((a, b) => a[0] - b[0]).slice(0, count).map(([, m]) => stepOf(m));
}

// The staff on the tile, in a 100 x 100 box: five lines 8 apart, the middle one at 50.
const GAP = 8, MID = 50;

function Melody({ steps }: { steps: number[] }) {
  // Centre the tune on the staff: its middle step sits on the middle line.
  const mid = Math.round((Math.min(...steps) + Math.max(...steps)) / 2);
  const x0 = 22, dx = steps.length > 1 ? 60 / (steps.length - 1) : 0;
  return (
    <svg className="song-cover-melody" viewBox="0 0 100 100" aria-hidden="true">
      {steps.map((st, i) => {
        // Half a gap per step, kept on the tile (ledger room above and below).
        const y = Math.max(MID - 3.2 * GAP, Math.min(MID + 3.2 * GAP, MID - (st - mid) * GAP / 2));
        const x = x0 + i * dx;
        const up = y >= MID;
        return (
          <g key={i}>
            <ellipse cx={x} cy={y} rx={4.6} ry={3.4} transform={`rotate(-22 ${x} ${y})`} />
            <line x1={up ? x + 4 : x - 4} x2={up ? x + 4 : x - 4} y1={y} y2={up ? y - 20 : y + 20} />
          </g>
        );
      })}
    </svg>
  );
}

export function SongCover({ entry, song, className = '' }: { entry: Pick<SongEntry, 'id' | 'title'>; song?: Song; className?: string }) {
  const { colour, Icon } = coverOf(entry);
  const steps = useMemo(() => (song ? opening(song) : []), [song]);
  return (
    <span className={`song-cover ${className}`} style={{ '--cover': `var(--cover-${colour})`, '--cover-edge': `var(--cover-${colour}-edge)` } as React.CSSProperties} aria-hidden="true">
      <span className="song-cover-staff" />
      {steps.length >= 3 ? <Melody steps={steps} /> : <Icon className="song-cover-glyph" weight="fill" />}
    </span>
  );
}
