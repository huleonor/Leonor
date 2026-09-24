export type Hand = 'R' | 'L';
export type HandsChoice = 'R' | 'L' | 'both';
export type InputKind = 'mic' | 'ble' | 'midi' | 'none';
export type ViewMode = 'notes' | 'sheet';
export type NoteNaming = 'solfege' | 'letters';

export interface SongNote {
  id: number;
  midi: number;
  time: number;
  duration: number;
  hand: Hand;
  velocity: number;
  ticks: number;
  durationTicks: number;
}

export interface SongEntry {
  id: string;
  title: string;
  film?: string;
  /** Portuguese release title, when it differs. */
  filmPt?: string;
  year?: number;
  composer?: string;
  /** Cover photo (Unsplash) and its credit. */
  image?: { src: string; by: string; alt: string };
  builtIn: boolean;
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
  /** Key signature as a count of sharps (positive) or flats (negative). */
  fifths: number;
  ticksToSeconds: (ticks: number) => number;
  hands: Hand[];
  range: [number, number];
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
  localSound: boolean;
}

export type NoteStatus = 0 | 1 | 2 | 3; // pending, hit, miss, played by the app
export const PENDING = 0, HIT = 1, MISS = 2, AUTO = 3;
