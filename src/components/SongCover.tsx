/**
 * A song's cover, the same design for every piece: a tile in one of the cover colours with a staff
 * across it. When the song's notes are at hand, the staff carries its real opening (the first
 * notes of the melody, at their pitch), so every cover is that song's own music; otherwise a big
 * Phosphor glyph. Colour and glyph come from the song, so it always looks the same. No photos.
 */
import { Headphones, MusicNote, MusicNotes, MusicNotesSimple, PianoKeys, VinylRecord, Waveform, type Icon as PhIcon } from '@phosphor-icons/react';
import { motion } from 'motion/react';
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
export function opening(song: Song, count = 7) {
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

/**
 * The song's opening across a wide staff, in the colour of the text around it: the picture of the
 * song on the Song and Library pages. Nothing when its notes are not loaded.
 */
export function OpeningStaff({ song, count = 10 }: { song?: Song; count?: number }) {
  const steps = useMemo(() => (song ? opening(song, count) : []), [song, count]);
  if (steps.length < 3) return null;
  const W = 300, gap = 8, mid = 30;
  const centre = Math.round((Math.min(...steps) + Math.max(...steps)) / 2);
  const dx = (W - 40) / Math.max(1, steps.length - 1);
  return (
    <svg className="opening-staff" viewBox={`0 0 ${W} 60`} aria-hidden="true">
      {[-2, -1, 0, 1, 2].map(k => <line key={k} x1={0} x2={W} y1={mid + k * gap} y2={mid + k * gap} />)}
      {steps.map((st, i) => {
        const y = Math.max(mid - 3.2 * gap, Math.min(mid + 3.2 * gap, mid - (st - centre) * gap / 2));
        const x = 20 + i * dx;
        const up = y >= mid;
        return (
          <g key={i} className="n">
            <ellipse cx={x} cy={y} rx={4.8} ry={3.5} transform={`rotate(-22 ${x} ${y})`} />
            <line x1={up ? x + 4.2 : x - 4.2} x2={up ? x + 4.2 : x - 4.2} y1={y} y2={up ? y - 22 : y + 22} />
          </g>
        );
      })}
    </svg>
  );
}

/**
 * The song on the Song page (the user's "a more creative home", 2026-11): its opening written
 * across a wide staff, ruled in line by line and the notes set down one by one each time the page
 * opens, printed in the two inks (a pink head on a teal plate a little off register), with a pink
 * line where he has got to in the song.
 */
export function HomeStaff({ song, done = 0 }: { song: Song; done?: number }) {
  const steps = useMemo(() => opening(song, 12), [song]);
  if (steps.length < 3) return null;
  const W = 340, gap = 9, mid = 50;
  const centre = Math.round((Math.min(...steps) + Math.max(...steps)) / 2);
  const dx = (W - 60) / Math.max(1, steps.length - 1);
  const EXPO = [0.16, 1, 0.3, 1] as const;
  const at = 14 + Math.max(0, Math.min(1, done)) * (W - 28);
  return (
    <svg className="home-staff" viewBox={`0 0 ${W} 100`} aria-hidden="true">
      {[-2, -1, 0, 1, 2].map((k, i) => (
        <motion.line key={k} className="rule" x1={6} x2={W - 6} y1={mid + k * gap} y2={mid + k * gap}
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: i * 0.05, ease: EXPO }} />
      ))}
      {done > 0 && (
        <motion.line className="now" x1={at} x2={at} y1={mid - 3 * gap} y2={mid + 3 * gap}
          initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} style={{ transformOrigin: `${at}px ${mid}px` }} transition={{ duration: 0.4, delay: 0.9, ease: EXPO }} />
      )}
      {steps.map((st, i) => {
        const y = Math.max(mid - 4 * gap, Math.min(mid + 4 * gap, mid - (st - centre) * gap / 2));
        const x = 30 + i * dx, up = y >= mid;
        return (
          <motion.g key={i} initial={{ opacity: 0, y: -24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.3 + i * 0.05, ease: EXPO }}>
            <ellipse className="plate" cx={x + 1.8} cy={y + 1.8} rx={5.6} ry={4} transform={`rotate(-22 ${x + 1.8} ${y + 1.8})`} />
            <ellipse className="head" cx={x} cy={y} rx={5.6} ry={4} transform={`rotate(-22 ${x} ${y})`} />
            <line className="stem" x1={up ? x + 4.9 : x - 4.9} x2={up ? x + 4.9 : x - 4.9} y1={y} y2={up ? y - 24 : y + 24} />
          </motion.g>
        );
      })}
    </svg>
  );
}

/**
 * A loading or empty state drawn in the notebook (the user's "loading and empty states drawn",
 * 2026-11): a staff ruled across the page once, line by line, with a bar line and, for an empty
 * page, a whole rest in its first bar; and a line saying what is happening.
 */
export function Ruling({ text, rest }: { text: string; rest?: boolean }) {
  const EXPO = [0.16, 1, 0.3, 1] as const;
  return (
    <div className="ruling" role="status" aria-live="polite">
      <svg viewBox="0 0 340 60" aria-hidden="true">
        {[-2, -1, 0, 1, 2].map((k, i) => (
          <motion.line key={k} x1={4} x2={336} y1={30 + k * 8} y2={30 + k * 8}
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, delay: i * 0.06, ease: EXPO }} />
        ))}
        <motion.line className="bar" x1={170} x2={170} y1={14} y2={46} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} />
        {rest && <motion.rect className="rest" x={74} y={22} width={18} height={6} initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.35, ease: EXPO }} />}
      </svg>
      <p>{text}</p>
    </div>
  );
}
