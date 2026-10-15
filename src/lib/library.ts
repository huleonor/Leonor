import { createStore, del, get, keys, set } from 'idb-keyval';
import { clearCourseProgress } from './course';
import { parseSong } from './midi';
import type { Progress, Settings, Song, SongEntry } from './types';

/**
 * Songs the app offers. Public-domain pieces ship with it, served from /songs. The others are
 * slots (`missing`): they are listed in the marketplace and take his own MIDI file of the piece.
 */
export const BUILT_IN: SongEntry[] = [
  // Classical, shipped
  { id: 'gymnopedie-1', collection: 'classical', title: 'Gymnopédie No. 1', film: 'Trois Gymnopédies', year: 1888, composer: 'E. Satie', builtIn: true, file: '/songs/gymnopedie-1.mid', timeSig: [3, 4], about: 'A slow, floating waltz: a quiet melody over a rocking left hand.' },
  { id: 'fur-elise', collection: 'classical', title: 'Für Elise', film: 'Bagatelle WoO 59, the opening', year: 1810, composer: 'L. van Beethoven', builtIn: true, file: '/songs/fur-elise.mid', about: 'The famous turn in the right hand over broken chords in the left.' },
  { id: 'sarabande', collection: 'classical', title: 'Sarabande', film: 'Suite in D minor, HWV 437', year: 1733, composer: 'G. F. Handel', builtIn: true, file: '/songs/sarabande.mid', about: 'Solemn chords in a slow three, both hands moving together.' },
  { id: 'passacaglia', collection: 'classical', title: 'Passacaglia', film: 'Suite in G minor, HWV 432', year: 1720, composer: 'G. F. Handel', builtIn: true, file: '/songs/passacaglia.mid', about: 'One chord pattern played again and again, a little busier each time.' },
  { id: 'clair-de-lune', collection: 'classical', title: 'Clair de Lune', film: 'Suite bergamasque', year: 1905, composer: 'C. Debussy', builtIn: true, file: '/songs/clair-de-lune.mid', about: 'Soft and flowing, free in time, with wide hands and many flats.' },
  // Film scores and modern piano: bring your own MIDI
  { id: 'comptine', collection: 'film', title: "Comptine d'un autre été", film: 'Amélie', year: 2001, composer: 'Y. Tiersen', builtIn: true, missing: true, about: 'Running broken chords in the left hand under a simple tune.' },
  { id: 'cornfield-chase', collection: 'film', title: 'Cornfield Chase', film: 'Interstellar', year: 2014, composer: 'H. Zimmer', builtIn: true, missing: true, about: 'A ticking pattern that builds and builds.' },
  { id: 'hes-a-pirate', collection: 'film', title: "He's a Pirate", film: 'Pirates of the Caribbean', year: 2003, composer: 'K. Badelt, H. Zimmer', builtIn: true, missing: true, about: 'Fast and driving, in six-eight.' },
  { id: 'now-we-are-free', collection: 'film', title: 'Now We Are Free', film: 'Gladiator', year: 2000, composer: 'H. Zimmer, L. Gerrard', builtIn: true, missing: true, about: 'A wide, slow melody over a steady left hand.' },
  { id: 'time', collection: 'film', title: 'Time', film: 'Inception', year: 2010, composer: 'H. Zimmer', builtIn: true, missing: true, about: 'Four chords that grow from a whisper.' },
  { id: 'nuvole-bianche', collection: 'modern', title: 'Nuvole Bianche', film: 'Una Mattina', year: 2004, composer: 'L. Einaudi', builtIn: true, missing: true, about: 'Gentle arpeggios and a melody that keeps coming back.' },
  { id: 'una-mattina', collection: 'modern', title: 'Una Mattina', film: 'Una Mattina', year: 2004, composer: 'L. Einaudi', builtIn: true, missing: true, about: 'Calm and repetitive, good for steady hands.' },
  { id: 'experience', collection: 'modern', title: 'Experience', film: 'In a Time Lapse', year: 2013, composer: 'L. Einaudi', builtIn: true, missing: true, about: 'A pulsing pattern that gathers strength.' },
];

const songStore = createStore('hugos-piano', 'songs');
const progressStore = createStore('hugos-piano-progress', 'progress');

interface StoredSong { entry: SongEntry; data: ArrayBuffer; }

const cache = new Map<string, Song>();

export async function listSongs(): Promise<SongEntry[]> {
  let imported: SongEntry[] = [];
  try {
    const ids = (await keys(songStore)) as string[];
    const rows = await Promise.all(ids.map(id => get<StoredSong>(id, songStore)));
    imported = rows.filter((r): r is StoredSong => !!r).map(r => r.entry)
      .sort((a, b) => (a.addedAt ?? 0) - (b.addedAt ?? 0));
  } catch {
    // Private mode or blocked storage: the built-in reel still works.
  }
  const filled = BUILT_IN.map(b => (b.missing && imported.find(i => i.slot === b.id)) || b);
  return [...filled, ...imported.filter(i => !i.slot)];
}

export async function loadSong(entry: SongEntry): Promise<Song> {
  const hit = cache.get(entry.id);
  if (hit) return hit;
  let data: ArrayBuffer;
  if (entry.builtIn && entry.file) {
    const res = await fetch(entry.file);
    if (!res.ok) throw new Error('err.loadFailed');
    data = await res.arrayBuffer();
  } else {
    const row = await get<StoredSong>(entry.id, songStore);
    if (!row) throw new Error('err.missing');
    data = row.data;
  }
  const song = parseSong(data, entry);
  cache.set(entry.id, song);
  return song;
}

function titleFromFile(name: string): string {
  const base = name.replace(/\.(mid|midi|kar)$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  // "now-we-are-free" reads as "Now We Are Free"; titles already in mixed case keep theirs.
  return base === base.toLowerCase() ? base.replace(/(^|\s)\p{L}/gu, c => c.toUpperCase()) : base.charAt(0).toUpperCase() + base.slice(1);
}

/** Reads a MIDI file without storing it, for the Add song preview. Throws a readable error. */
export async function readMidi(file: File, slot?: SongEntry): Promise<{ song: Song; data: ArrayBuffer }> {
  const data = await file.arrayBuffer();
  const entry: SongEntry = {
    id: 'preview', title: slot?.title ?? titleFromFile(file.name), composer: slot?.composer, builtIn: false,
    timeSig: slot?.timeSig,
  };
  return { song: parseSong(data, entry), data };
}

/** Stores a song read by readMidi under its own id, with the title and composer he typed. */
export async function saveImported(data: ArrayBuffer, meta: { title: string; composer?: string }, slot?: SongEntry): Promise<SongEntry> {
  const entry: SongEntry = {
    id: 'imp-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title: meta.title.trim() || slot?.title || 'Untitled',
    composer: meta.composer?.trim() || slot?.composer,
    film: slot?.film, filmPt: slot?.filmPt, year: slot?.year, image: slot?.image,
    collection: slot?.collection, timeSig: slot?.timeSig,
    slot: slot?.id,
    builtIn: false,
    addedAt: Date.now(),
  };
  const song = parseSong(data, entry);
  await set(entry.id, { entry, data } satisfies StoredSong, songStore);
  cache.set(entry.id, song);
  return entry;
}

export async function importMidi(file: File, slot?: SongEntry): Promise<SongEntry> {
  const data = await file.arrayBuffer();
  const entry: SongEntry = {
    id: 'imp-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title: slot?.title ?? titleFromFile(file.name),
    film: slot?.film, filmPt: slot?.filmPt, year: slot?.year, composer: slot?.composer, image: slot?.image,
    collection: slot?.collection, timeSig: slot?.timeSig,
    slot: slot?.id,
    builtIn: false,
    addedAt: Date.now(),
  };
  const song = parseSong(data, entry); // throws a readable error if the file is not usable
  await set(entry.id, { entry, data } satisfies StoredSong, songStore);
  cache.set(entry.id, song);
  return entry;
}

export async function renameSong(entry: SongEntry, title: string, composer?: string): Promise<SongEntry> {
  const row = await get<StoredSong>(entry.id, songStore);
  if (!row) return entry;
  const next = { ...row.entry, title: title.trim() || row.entry.title, composer: composer?.trim() || undefined };
  await set(entry.id, { ...row, entry: next }, songStore);
  cache.delete(entry.id);
  return next;
}

export async function removeSong(entry: SongEntry): Promise<void> {
  await del(entry.id, songStore);
  await del(entry.id, progressStore).catch(() => {});
  await clearCourseProgress(entry.id);
  cache.delete(entry.id);
}

export async function getProgress(id: string): Promise<Progress | undefined> {
  try { return await get<Progress>(id, progressStore); } catch { return undefined; }
}

export async function recordRun(id: string, accuracy: number, speed: number): Promise<Progress> {
  const prev = (await getProgress(id)) ?? { bestAccuracy: 0, bestSpeed: 0, plays: 0, lastPlayed: 0 };
  const next: Progress = {
    bestAccuracy: Math.max(prev.bestAccuracy, accuracy),
    // "Best speed" counts only runs he actually got through well.
    bestSpeed: accuracy >= 0.85 ? Math.max(prev.bestSpeed, speed) : prev.bestSpeed,
    plays: prev.plays + 1,
    lastPlayed: Date.now(),
  };
  try { await set(id, next, progressStore); } catch { /* storage unavailable */ }
  return next;
}

const SETTINGS_KEY = 'hugos-piano:settings';
export const DEFAULT_SETTINGS: Settings = {
  input: 'mic', lang: 'en', naming: 'letters', view: 'sheet', speed: 0.8, wait: true, hands: 'both', accompaniment: true, localSound: true, fingers: 'some', dailyGoal: 10, setupDone: false, v: 4,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as Partial<Settings>;
      const saved = { ...DEFAULT_SETTINGS, ...stored } as Settings;
      // The app is English-only now; older Portuguese settings also switch the note names.
      if (saved.lang !== 'en') Object.assign(saved, { lang: 'en', naming: 'letters' });
      // v3: keys played on a MIDI keyboard sound in the app by default (read the stored version,
      // not the default's).
      if ((stored.v ?? 1) < 3) Object.assign(saved, { localSound: true, v: 3 });
      // v4: the Simply Piano redesign leads with the scrolling staff; an existing player has set up an input.
      if ((stored.v ?? 1) < 4) Object.assign(saved, { view: 'sheet', setupDone: true, v: 4 });
      return saved;
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: Settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

// ---------- My library: the built-in songs he chose from the marketplace ----------

const LIBRARY = 'hugos-piano:library';
const libListeners = new Set<() => void>();
export function myLibrary(): string[] {
  // A new library starts with the one song the app teaches for now.
  try { return JSON.parse(localStorage.getItem(LIBRARY) ?? '["gymnopedie-1"]'); } catch { return ['gymnopedie-1']; }
}
function saveLibrary(ids: string[]) {
  try { localStorage.setItem(LIBRARY, JSON.stringify(ids)); } catch { /* storage unavailable */ }
  libListeners.forEach(fn => fn());
}
export const inLibrary = (id: string) => myLibrary().includes(id);
export const addToLibrary = (id: string) => { if (!inLibrary(id)) saveLibrary([...myLibrary(), id]); };
export const removeFromLibrary = (id: string) => saveLibrary(myLibrary().filter(x => x !== id));
export const onLibrary = (fn: () => void) => { libListeners.add(fn); return () => { libListeners.delete(fn); }; };
