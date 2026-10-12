/**
 * The game marks, all Phosphor glyphs in fill weight, coloured by role: the pink energy battery,
 * the blue gem, the orange flame, the gold chest, and the glyphs on the round lesson nodes (they
 * take `currentColor`, so a node colours them).
 */
import {
  BatteryCharging, BookOpen, Crown, Diamond, Fire, HandPalm, Headphones, Lock, MusicNote, PianoKeys, Star, TreasureChest, Trophy,
  Barbell, type Icon as PhIcon,
} from '@phosphor-icons/react';

type P = { size?: number; className?: string };

export const Energy = ({ size = 26, className }: P) => <BatteryCharging size={size * 1.15} weight="fill" className={`gi-energy ${className ?? ''}`} aria-hidden="true" />;
export const Gem = ({ size = 26, className }: P) => <Diamond size={size} weight="fill" className={`gi-gem ${className ?? ''}`} aria-hidden="true" />;
export const Flame = ({ size = 26, className, lit = true }: P & { lit?: boolean }) => (
  <Fire size={size} weight="fill" className={`gi-flame ${lit ? 'lit' : ''} ${className ?? ''}`} aria-hidden="true" />
);
export const Chest = ({ size = 72, open = false, className }: P & { open?: boolean }) => (
  <TreasureChest size={size} weight={open ? 'duotone' : 'fill'} className={`gi-chest ${open ? 'open' : ''} ${className ?? ''}`} aria-hidden="true" />
);

/* Node glyphs (drawn at 34px on a 70px disc, in the disc's text colour). */
const glyph = (G: PhIcon) => () => <G size={34} weight="fill" aria-hidden="true" />;
export const GlyphStar = glyph(Star);
export const GlyphBook = glyph(BookOpen);
export const GlyphHeadphones = glyph(Headphones);
export const GlyphDumbbell = glyph(Barbell);
export const GlyphTrophy = glyph(Trophy);
export const GlyphNote = glyph(MusicNote);
export const GlyphHand = glyph(HandPalm);
export const GlyphKeys = glyph(PianoKeys);
export const GlyphLock = glyph(Lock);
export const GlyphCrown = glyph(Crown);
