export type Hand = 'R' | 'L';
export type HandsChoice = 'R' | 'L' | 'both';
export type InputKind = 'mic' | 'ble' | 'midi' | 'none';
export type ViewMode = 'notes' | 'sheet';
export type NoteNaming = 'solfege' | 'letters';
export type FingerMode = 'off' | 'some' | 'all';

export interface SongNote {
  id: number;
  midi: number;
  time: number;
  duration: number;
  hand: Hand;
  velocity: number;
  ticks: number;
  durationTicks: number;
  /** Suggested finger, 1 (thumb) to 5 (little finger). */
  finger?: number;
  /** Hand changes position here: label it even when only some fingers are shown. */
  fingerCue?: boolean;
}

export interface SongEntry {
  id: string;
  title: string;
  film?: string;
  /** Portuguese release title, when it differs. */
  filmPt?: string;
  year?: number;
  composer?: string;
  /** Cover photo (Unsplash) and its credit; no longer shown (covers are drawn, SongCover.tsx). */
  image?: { src: string; by: string; alt: string };
  /** What the piece is like, in a line, for the marketplace. */
  about?: string;
  builtIn: boolean;
  /** Library shelf: film scores, modern piano, classical (imports go to "My songs"). */
  collection?: 'film' | 'modern' | 'classical';
  /** Overrides a time signature the MIDI file gets wrong (bars drive the course parts). */
  timeSig?: [number, number];
  /** Built-in slot whose MIDI is not shipped yet: the can asks for the file. */
  missing?: boolean;
  /** For an import that fills a built-in slot. */
  slot?: string;
  file?: string;
  addedAt?: number;
}

export interface Song {
  entry: SongEntry;
  notes: SongNote[];
  /** End of the last note, in seconds. */
  duration: number;
  firstNoteTime: number;
  ppq: number;
  timeSig: [number, number];
  /** Time-signature changes after the first (bars.ts builds the bar grid from them). */
  meter?: { ticks: number; sig: [number, number] }[];
  /** Key signature as a count of sharps (positive) or flats (negative). */
  fifths: number;
  ticksToSeconds: (ticks: number) => number;
  hands: Hand[];
  range: [number, number];
  /** Highest mastery playing this piece well can prove (0–1); set on course pieces and exercises. */
  ceiling?: number;
}

export interface Progress {
  bestAccuracy: number;
  bestSpeed: number;
  plays: number;
  lastPlayed: number;
}

export type Lang = 'pt' | 'en';

export interface Settings {
  input: InputKind;
  lang: Lang;
  naming: NoteNaming;
  view: ViewMode;
  speed: number;
  wait: boolean;
  hands: HandsChoice;
  accompaniment: boolean;
  /** The app sounds the keys played on a MIDI / Bluetooth keyboard. */
  localSound: boolean;
  /** Finger numbers on the notes: none, only where the hand moves, or every note. */
  fingers: FingerMode;
  /** Minutes of practice a day that fill the daily goal. */
  dailyGoal: number;
  /** A daily practice reminder at this time ("19:00"), or none. */
  reminder?: string | null;
  /** The first-run "connect your piano" card has been answered. */
  setupDone: boolean;
  /** Settings format, for one-off migrations. */
  v?: number;
}

export type NoteStatus = 0 | 1 | 2 | 3; // pending, hit, miss, played by the app
export const PENDING = 0, HIT = 1, MISS = 2, AUTO = 3;
