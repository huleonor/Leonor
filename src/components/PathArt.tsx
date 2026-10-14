/**
 * The pictures beside the path, Duolingo style but without characters: each unit gets a big
 * Phosphor glyph on a tinted disc in its own colour, with a few notes floating around it. A unit
 * he has not reached yet shows its picture in grey, so the path ahead is there to look forward to.
 */
import {
  Books, Crown, Ear, Equalizer, Guitar, HandPalm, Headphones, Lightning, MapTrifold, Metronome, Microphone, MusicNote,
  MusicNotes, MusicNotesPlus, MusicNotesSimple, Path, PianoKeys, Sparkle, VinylRecord, Waveform, type Icon as PhIcon,
} from '@phosphor-icons/react';
import { motion } from 'motion/react';
import { SOFT } from './Motion';

/** One picture per unit, in path order. */
const UNIT_ART: PhIcon[] = [
  PianoKeys, MusicNotesSimple, Metronome, MusicNote, HandPalm, Waveform, MusicNotes, Ear, Equalizer, Crown,
  Sparkle, MapTrifold, Path, MusicNotesPlus, Lightning, Books, Microphone, Guitar, VinylRecord, Headphones,
];
/** One picture per section, for the sections page. */
export const SECTION_ART: PhIcon[] = [PianoKeys, MusicNotesSimple, Sparkle, VinylRecord];

/** A big glyph on a tinted disc with notes around it; grey until the unit is open. */
export function Spot({ Icon, lit, size = 150 }: { Icon: PhIcon; lit: boolean; size?: number }) {
  return (
    <span className={`spot-art ${lit ? 'lit' : ''}`} style={{ '--art': `${size}px` } as React.CSSProperties} aria-hidden="true">
      <span className="spot-disc"><Icon weight="fill" /></span>
      <MusicNote className="spot-bit b1" weight="fill" />
      <Sparkle className="spot-bit b2" weight="fill" />
      <MusicNotes className="spot-bit b3" weight="fill" />
    </span>
  );
}

/**
 * A unit's picture, beside the trail where the path bends away from it: on the left of the first
 * bend for even units, on the right of the second for odd ones.
 */
export function UnitArt({ index, lit }: { index: number; lit: boolean }) {
  const Icon = UNIT_ART[index % UNIT_ART.length];
  return (
    <motion.div className={`unit-art ${index % 2 ? 'right' : 'left'}`} initial={{ scale: 0.85, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true, margin: '-40px' }} transition={SOFT}>
      <Spot Icon={Icon} lit={lit} />
    </motion.div>
  );
}
