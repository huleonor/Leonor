import { createStore, del, get, keys, set } from 'idb-keyval';
import { parseSong } from './midi';
import type { Progress, Settings, Song, SongEntry } from './types';

/** Songs shipped with the app, served from /songs. */
export const BUILT_IN: SongEntry[] = [
  { id: 'cornfield-chase', title: 'Cornfield Chase', film: 'Interstellar', year: 2014, composer: 'H. Zimmer', builtIn: true, file: '/songs/cornfield-chase.mid' },
  { id: 'hes-a-pirate', title: "He's a Pirate", film: 'Pirates of the Caribbean', filmPt: 'Piratas das Caraíbas', year: 2003, composer: 'K. Badelt · H. Zimmer', builtIn: true, file: '/songs/hes-a-pirate.mid' },
  // Wanted, but no usable free MIDI yet: each can asks for the file and keeps its credits.
  { id: 'time', title: 'Time', film: 'Inception', filmPt: 'A Origem', year: 2010, composer: 'H. Zimmer', builtIn: true, missing: true },
  { id: 'interstellar-main-theme', title: 'Interstellar Main Theme', film: 'Interstellar', year: 2014, composer: 'H. Zimmer', builtIn: true, missing: true },
  { id: 'now-we-are-free', title: 'Now We Are Free', film: 'Gladiator', filmPt: 'Gladiador', year: 2000, composer: 'H. Zimmer · L. Gerrard', builtIn: true, missing: true },
  { id: 'a-way-of-life', title: 'A Way of Life', film: 'The Last Samurai', filmPt: 'O Último Samurai', year: 2003, composer: 'H. Zimmer', builtIn: true, missing: true },
  { id: 'maestro', title: 'Maestro', film: 'The Holiday', filmPt: 'O Amor Não Tira Férias', year: 2006, composer: 'H. Zimmer', builtIn: true, missing: true },
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
    film: slot?.film, filmPt: slot?.filmPt, year: slot?.year, composer: slot?.composer,
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
  input: 'mic', lang: 'pt', naming: 'solfege', view: 'notes', speed: 0.8, wait: true, hands: 'both', accompaniment: true, localSound: false,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  const en = !/^pt\b/i.test(navigator.language || 'pt');
  return { ...DEFAULT_SETTINGS, lang: en ? 'en' : 'pt', naming: en ? 'letters' : 'solfege' };
}

export function saveSettings(s: Settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
