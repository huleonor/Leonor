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
  { id: 'gymnopedie-1', collection: 'classical', title: 'Gymnopédie No. 1', film: 'Trois Gymnopédies', year: 1888, composer: 'E. Satie', builtIn: true, file: '/songs/gymnopedie-1.mid', timeSig: [3, 4], about: 'A slow, floating waltz: a quiet melody over a rocking left hand.', aboutPt: 'Uma valsa lenta e a flutuar: uma melodia calma sobre uma mão esquerda que embala.' },
  { id: 'fur-elise', collection: 'classical', title: 'Für Elise', film: 'Bagatelle WoO 59, the opening', year: 1810, composer: 'L. van Beethoven', builtIn: true, file: '/songs/fur-elise.mid', about: 'The famous turn in the right hand over broken chords in the left.', aboutPt: 'A famosa volta da mão direita sobre acordes partidos na esquerda.' },
  { id: 'sarabande', collection: 'classical', title: 'Sarabande', film: 'Suite in D minor, HWV 437', year: 1733, composer: 'G. F. Handel', builtIn: true, file: '/songs/sarabande.mid', about: 'Solemn chords in a slow three, both hands moving together.', aboutPt: 'Acordes solenes num três lento, as duas mãos a moverem-se juntas.' },
  { id: 'passacaglia', collection: 'classical', title: 'Passacaglia', film: 'Suite in G minor, HWV 432', year: 1720, composer: 'G. F. Handel', builtIn: true, file: '/songs/passacaglia.mid', about: 'One chord pattern played again and again, a little busier each time.', aboutPt: 'Um padrão de acordes tocado uma e outra vez, um pouco mais cheio de cada vez.' },
  { id: 'clair-de-lune', collection: 'classical', title: 'Clair de Lune', film: 'Suite bergamasque', year: 1905, composer: 'C. Debussy', builtIn: true, file: '/songs/clair-de-lune.mid', about: 'Soft and flowing, free in time, with wide hands and many flats.', aboutPt: 'Suave e a correr, livre no tempo, com mãos abertas e muitos bemóis.' },
  // Film scores and modern piano: bring your own MIDI. Interstellar Experience is the first song the reels teach.
  { id: 'interstellar-experience', collection: 'modern', title: 'Interstellar Experience', film: 'after the Interstellar theme by H. Zimmer', composer: 'T. Ann', builtIn: true, missing: true, about: 'Tony Ann on Hans Zimmer\'s Interstellar theme: a pattern that turns and turns and grows to a big finish.', aboutPt: 'Tony Ann sobre o tema de Interstellar de Hans Zimmer: um padrão que roda e roda e cresce até um grande final.' },
  // A jazz standard (the user's own score from Musicnotes, 2026-11): the tune in the right hand, the walking bass in the left.
  { id: 'fly-me-to-the-moon', collection: 'modern', title: 'Fly Me to the Moon', film: 'In Other Words', year: 1954, composer: 'B. Howard', builtIn: true, missing: true, about: 'A swinging tune that steps down the scale over chords that fall in fifths, a walking bass under it.', aboutPt: 'Uma melodia com swing que desce a escala sobre acordes que caem em quintas, com um baixo a andar por baixo.' },
  { id: 'comptine', collection: 'film', title: "Comptine d'un autre été", film: 'Amélie', year: 2001, composer: 'Y. Tiersen', builtIn: true, missing: true, about: 'Running broken chords in the left hand under a simple tune.', aboutPt: 'Acordes partidos a correr na mão esquerda sob uma melodia simples.' },
  { id: 'cornfield-chase', collection: 'film', title: 'Cornfield Chase', film: 'Interstellar', year: 2014, composer: 'H. Zimmer', builtIn: true, missing: true, about: 'A ticking pattern that builds and builds.', aboutPt: 'Um padrão como um relógio que cresce e cresce.' },
  { id: 'hes-a-pirate', collection: 'film', title: "He's a Pirate", film: 'Pirates of the Caribbean', year: 2003, composer: 'K. Badelt, H. Zimmer', builtIn: true, missing: true, about: 'Fast and driving, in six-eight.', aboutPt: 'Rápido e com força, em seis por oito.' },
  { id: 'now-we-are-free', collection: 'film', title: 'Now We Are Free', film: 'Gladiator', year: 2000, composer: 'H. Zimmer, L. Gerrard', builtIn: true, missing: true, about: 'A wide, slow melody over a steady left hand.', aboutPt: 'Uma melodia larga e lenta sobre uma mão esquerda firme.' },
  { id: 'time', collection: 'film', title: 'Time', film: 'Inception', year: 2010, composer: 'H. Zimmer', builtIn: true, missing: true, about: 'Four chords that grow from a whisper.', aboutPt: 'Quatro acordes que crescem a partir de um sussurro.' },
  { id: 'nuvole-bianche', collection: 'modern', title: 'Nuvole Bianche', film: 'Una Mattina', year: 2004, composer: 'L. Einaudi', builtIn: true, missing: true, about: 'Gentle arpeggios and a melody that keeps coming back.', aboutPt: 'Arpejos suaves e uma melodia que volta sempre.' },
  { id: 'una-mattina', collection: 'modern', title: 'Una Mattina', film: 'Una Mattina', year: 2004, composer: 'L. Einaudi', builtIn: true, missing: true, about: 'Calm and repetitive, good for steady hands.', aboutPt: 'Calmo e repetitivo, bom para mãos firmes.' },
  { id: 'experience', collection: 'modern', title: 'Experience', film: 'In a Time Lapse', year: 2013, composer: 'L. Einaudi', builtIn: true, missing: true, about: 'A pulsing pattern that gathers strength.', aboutPt: 'Um padrão a pulsar que ganha força.' },
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
    // Served from the app's own folder (the site may live under a path, GitHub Pages).
    const res = await fetch(`${import.meta.env.BASE_URL}${entry.file.replace(/^\//, '')}`);
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
  input: 'mic', lang: 'en', naming: 'letters', view: 'sheet', speed: 0.8, wait: true, hands: 'both', accompaniment: true, localSound: true, fingers: 'some', dailyGoal: 10, setupDone: false, v: 5, videoPace: 1, videoWait: true,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as Partial<Settings>;
      const saved = { ...DEFAULT_SETTINGS, ...stored } as Settings;
      // v5: Portuguese is back (screens, videos and voice); older saved Portuguese meant the old app.
      // The practice reminder is gone from Settings, so a reminder set before is switched off.
      if ((stored.v ?? 1) < 5) Object.assign(saved, { lang: 'en', naming: 'letters', reminder: null, v: 5 });
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
  // Interstellar Experience is always in it (the user's choice), even in a library saved before.
  let ids: string[];
  try { ids = JSON.parse(localStorage.getItem(LIBRARY) ?? '["interstellar-experience","gymnopedie-1"]'); } catch { ids = ['interstellar-experience', 'gymnopedie-1']; }
  return ids.includes('interstellar-experience') ? ids : ['interstellar-experience', ...ids];
}
function saveLibrary(ids: string[]) {
  try { localStorage.setItem(LIBRARY, JSON.stringify(ids)); } catch { /* storage unavailable */ }
  libListeners.forEach(fn => fn());
}
export const inLibrary = (id: string) => myLibrary().includes(id);
export const addToLibrary = (id: string) => { if (!inLibrary(id)) saveLibrary([...myLibrary(), id]); };
export const removeFromLibrary = (id: string) => saveLibrary(myLibrary().filter(x => x !== id));
export const onLibrary = (fn: () => void) => { libListeners.add(fn); return () => { libListeners.delete(fn); }; };
