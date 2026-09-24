import { createStore, del, get, keys, set } from 'idb-keyval';
import { parseSong } from './midi';
import type { Progress, Settings, Song, SongEntry } from './types';

const unsplash = (id: string) => `https://images.unsplash.com/${id}?w=560&h=440&fit=crop&crop=entropy&q=70&auto=format`;
const cover = (id: string, by: string, alt: string) => ({ src: unsplash(id), by, alt });

/** Shown on imported songs, which have no cover of their own. */
export const GENERIC_COVER = cover('photo-1689506422730-6a8e09038b1b', 'Bogdan Arhipov', 'Close-up of piano keys in low light');

/** Songs shipped with the app, served from /songs. */
export const BUILT_IN: SongEntry[] = [
  { id: 'cornfield-chase', image: cover('photo-1530797670390-7b7118ec3f3a', 'Quaritsch Photography', 'Corn stalks against a low sun'), title: 'Cornfield Chase', film: 'Interstellar', year: 2014, composer: 'H. Zimmer', builtIn: true, file: '/songs/cornfield-chase.mid' },
  { id: 'hes-a-pirate', image: cover('photo-1625509972901-9c6c8e8d1069', 'Raimond Klavins', 'A tall ship in silhouette at sunset'), title: "He's a Pirate", film: 'Pirates of the Caribbean', filmPt: 'Piratas das Caraíbas', year: 2003, composer: 'K. Badelt · H. Zimmer', builtIn: true, file: '/songs/hes-a-pirate.mid' },
  // Wanted, but no usable free MIDI yet: each can asks for the file and keeps its credits.
  { id: 'time', image: cover('photo-1594848421556-19ee3f85d417', 'Ash Amplifies', 'A metal spinning top on a table'), title: 'Time', film: 'Inception', filmPt: 'A Origem', year: 2010, composer: 'H. Zimmer', builtIn: true, missing: true },
  { id: 'interstellar-main-theme', image: cover('photo-1670884307458-4977f638a933', 'BoliviaInteligente', 'A black hole ringed with light'), title: 'Interstellar Main Theme', film: 'Interstellar', year: 2014, composer: 'H. Zimmer', builtIn: true, missing: true },
  { id: 'now-we-are-free', image: cover('photo-1764138747893-a05666926e62', 'Alina Chernovolova', 'A hand brushing through wheat at sunset'), title: 'Now We Are Free', film: 'Gladiator', filmPt: 'Gladiador', year: 2000, composer: 'H. Zimmer · L. Gerrard', builtIn: true, missing: true },
  { id: 'a-way-of-life', image: cover('photo-1615790469537-7c9d8e95c047', 'Susann Schuster', 'A gold and red samurai helmet'), title: 'A Way of Life', film: 'The Last Samurai', filmPt: 'O Último Samurai', year: 2003, composer: 'H. Zimmer', builtIn: true, missing: true },
  { id: 'maestro', image: cover('photo-1510798831971-661eb04b3739', 'Ian Keefe', 'A wooden cottage in the snow at dusk'), title: 'Maestro', film: 'The Holiday', filmPt: 'O Amor Não Tira Férias', year: 2006, composer: 'H. Zimmer', builtIn: true, missing: true },
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
  const base = name.replace(/\.(mid|midi|kar)$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export async function importMidi(file: File, slot?: SongEntry): Promise<SongEntry> {
  const data = await file.arrayBuffer();
  const entry: SongEntry = {
    id: 'imp-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title: slot?.title ?? titleFromFile(file.name),
    film: slot?.film, filmPt: slot?.filmPt, year: slot?.year, composer: slot?.composer, image: slot?.image,
    slot: slot?.id,
    builtIn: false,
    addedAt: Date.now(),
  };
  const song = parseSong(data, entry); // throws a readable error if the file is not usable
  await set(entry.id, { entry, data } satisfies StoredSong, songStore);
  cache.set(entry.id, song);
  return entry;
}

export async function renameSong(entry: SongEntry, title: string, film?: string): Promise<SongEntry> {
  const row = await get<StoredSong>(entry.id, songStore);
  if (!row) return entry;
  const next = { ...row.entry, title, film };
  await set(entry.id, { ...row, entry: next }, songStore);
  cache.delete(entry.id);
  return next;
}

export async function removeSong(entry: SongEntry): Promise<void> {
  await del(entry.id, songStore);
  await del(entry.id, progressStore).catch(() => {});
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
  input: 'mic', lang: 'en', naming: 'letters', view: 'notes', speed: 0.8, wait: true, hands: 'both', accompaniment: true, localSound: false,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const saved = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as Settings;
      // The app is English-only now; older Portuguese settings also switch the note names.
      if (saved.lang !== 'en') return { ...saved, lang: 'en', naming: 'letters' };
      return saved;
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: Settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
