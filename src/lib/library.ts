import { createStore, del, get, keys, set } from 'idb-keyval';
import { clearCourseProgress } from './course';
import { parseSong } from './midi';
import type { Progress, Settings, Song, SongEntry } from './types';

const unsplash = (id: string) => `https://images.unsplash.com/${id}?w=560&h=440&fit=crop&crop=entropy&q=70&auto=format`;
const cover = (id: string, by: string, alt: string) => ({ src: unsplash(id), by, alt });

/** Shown on imported songs, which have no cover of their own. */
export const GENERIC_COVER = cover('photo-1689506422730-6a8e09038b1b', 'Bogdan Arhipov', 'Close-up of piano keys in low light');

/** Songs shipped with the app, served from /songs. Missing ones are slots that ask for the .mid. */
export const BUILT_IN: SongEntry[] = [
  // Film scores
  { id: 'cornfield-chase', collection: 'film', image: cover('photo-1530797670390-7b7118ec3f3a', 'Quaritsch Photography', 'Corn stalks against a low sun'), title: 'Cornfield Chase', film: 'Interstellar', year: 2014, composer: 'H. Zimmer', builtIn: true, file: '/songs/cornfield-chase.mid' },
  { id: 'hes-a-pirate', collection: 'film', image: cover('photo-1625509972901-9c6c8e8d1069', 'Raimond Klavins', 'A tall ship in silhouette at sunset'), title: "He's a Pirate", film: 'Pirates of the Caribbean', filmPt: 'Piratas das Caraíbas', year: 2003, composer: 'K. Badelt · H. Zimmer', builtIn: true, file: '/songs/hes-a-pirate.mid' },
  { id: 'comptine', collection: 'film', image: cover('photo-1623009070764-45002990256e', 'Bastien Nvs', 'A Paris street in the morning'), title: "Comptine d'un autre été", film: 'Amélie', year: 2001, composer: 'Y. Tiersen', builtIn: true, file: '/songs/comptine-dun-autre-ete.mid' },
  { id: 'time', collection: 'film', image: cover('photo-1594848421556-19ee3f85d417', 'Ash Amplifies', 'A metal spinning top on a table'), title: 'Time', film: 'Inception', filmPt: 'A Origem', year: 2010, composer: 'H. Zimmer', builtIn: true, missing: true },
  { id: 'interstellar-main-theme', collection: 'film', image: cover('photo-1670884307458-4977f638a933', 'BoliviaInteligente', 'A black hole ringed with light'), title: 'Interstellar Main Theme', film: 'Interstellar', year: 2014, composer: 'H. Zimmer', builtIn: true, missing: true },
  { id: 'now-we-are-free', collection: 'film', image: cover('photo-1764138747893-a05666926e62', 'Alina Chernovolova', 'A hand brushing through wheat at sunset'), title: 'Now We Are Free', film: 'Gladiator', filmPt: 'Gladiador', year: 2000, composer: 'H. Zimmer · L. Gerrard', builtIn: true, missing: true },
  { id: 'a-way-of-life', collection: 'film', image: cover('photo-1615790469537-7c9d8e95c047', 'Susann Schuster', 'A gold and red samurai helmet'), title: 'A Way of Life', film: 'The Last Samurai', filmPt: 'O Último Samurai', year: 2003, composer: 'H. Zimmer', builtIn: true, missing: true },
  { id: 'maestro', collection: 'film', image: cover('photo-1510798831971-661eb04b3739', 'Ian Keefe', 'A wooden cottage in the snow at dusk'), title: 'Maestro', film: 'The Holiday', filmPt: 'O Amor Não Tira Férias', year: 2006, composer: 'H. Zimmer', builtIn: true, missing: true },
  // Modern piano
  { id: 'nuvole-bianche', collection: 'modern', image: cover('photo-1657598339759-fd1432d833f0', 'Nick Fewings', 'White clouds in a pale sky'), title: 'Nuvole Bianche', film: 'Una Mattina', year: 2004, composer: 'L. Einaudi', builtIn: true, file: '/songs/nuvole-bianche.mid' },
  { id: 'una-mattina', collection: 'modern', image: cover('photo-1662038271111-5b1c0b4157e8', 'Aimee Giles', 'A steaming mug by a sunlit window'), title: 'Una Mattina', film: 'Una Mattina', year: 2004, composer: 'L. Einaudi', builtIn: true, missing: true },
  { id: 'experience', collection: 'modern', image: cover('photo-1559827260-dc66d52bef19', 'Silas Baisch', 'A wave rolling in'), title: 'Experience', film: 'In a Time Lapse', year: 2013, composer: 'L. Einaudi', builtIn: true, missing: true },
  { id: 'icarus', collection: 'modern', image: cover('photo-1506624682682-13fa0130f321', 'Sawyer Bengtson', 'Sunlight breaking through clouds'), title: 'Icarus', composer: 'T. Ann', builtIn: true, missing: true },
  { id: 'van-gogh', collection: 'modern', image: cover('photo-1628498188904-036f5e25e93e', 'Olena Bohovyk', 'A sky full of stars'), title: 'Van Gogh', composer: 'V. Aiello', builtIn: true, missing: true },
  { id: 'idea-10', collection: 'modern', image: cover('photo-1509635022432-0220ac12960b', 'Suhyeon Choi', 'Rain drops on a window'), title: 'Idea 10', composer: 'G. Alcocer', builtIn: true, missing: true },
  { id: 'idea-12', collection: 'modern', image: cover('photo-1516900557549-41557d405adf', 'Filip Mroz', 'A tram stop at night'), title: 'Idea 12', composer: 'G. Alcocer', builtIn: true, missing: true },
  // Classical
  { id: 'gymnopedie-1', collection: 'classical', image: cover('photo-1550188225-af2e1c2529b2', 'Fernando Jorge', 'A calm grey sea'), title: 'Gymnopédie No. 1', film: 'Trois Gymnopédies', year: 1888, composer: 'E. Satie', builtIn: true, file: '/songs/gymnopedie-1.mid', timeSig: [3, 4] },
  { id: 'sarabande', collection: 'classical', image: cover('photo-1529684991332-3e055de04091', 'Denny Müller', 'Six white candles'), title: 'Sarabande', film: 'Suite in D minor, HWV 437', year: 1733, composer: 'G. F. Handel', builtIn: true, file: '/songs/sarabande.mid' },
  { id: 'passacaglia', collection: 'classical', image: cover('photo-1778568284518-68de9b1fbc06', 'Bernd Dittrich', 'Rows of lit candles in a church'), title: 'Passacaglia', film: 'Suite in G minor, HWV 432', year: 1720, composer: 'G. F. Handel', builtIn: true, file: '/songs/passacaglia.mid' },
  { id: 'clair-de-lune', collection: 'classical', image: cover('photo-1535332371349-a5d229f49cb5', 'Guzmán Barquín', 'A full moon over the sea'), title: 'Clair de Lune', film: 'Suite bergamasque', year: 1905, composer: 'C. Debussy', builtIn: true, file: '/songs/clair-de-lune.mid' },
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
