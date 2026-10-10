import { useEffect, useState } from 'react';
import { songGrade } from './analysis';
import { buildCourse, courseStars, getCourseProgress, lastPractised, nextStep, type Course, type CourseProgress, type CourseStep } from './course';
import { listSongs, loadSong } from './library';
import type { Song, SongEntry } from './types';

/** What the lists need to know about a song: its level, course and how far he got. */
export interface SongInfo {
  entry: SongEntry;
  song?: Song;
  level?: number;
  course?: Course;
  prog: CourseProgress;
  stars: number;
  total: number;
  next?: CourseStep;
  /** Steps with at least one star. */
  done: number;
  error?: boolean;
}

let entries: SongEntry[] = [];
let infos: Record<string, SongInfo> = {};
let ready = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(fn => fn());

async function summarise(entry: SongEntry): Promise<SongInfo> {
  if (entry.missing) return { entry, prog: {}, stars: 0, total: 0, done: 0 };
  try {
    const song = await loadSong(entry);
    const course = buildCourse(song);
    const prog = await getCourseProgress(entry.id);
    const { got, total } = courseStars(course, prog);
    return {
      entry, song, course, prog, stars: got, total, level: songGrade(song), next: nextStep(course, prog),
      done: course.steps.filter(s => (prog[s.id]?.stars ?? 0) > 0).length,
    };
  } catch {
    return { entry, prog: {}, stars: 0, total: 0, done: 0, error: true };
  }
}

/** Reloads the song list and every summary. */
export async function refreshCatalog() {
  entries = await listSongs();
  const rows = await Promise.all(entries.map(summarise));
  infos = Object.fromEntries(rows.map(r => [r.entry.id, r]));
  ready = true;
  emit();
}

/** One song's summary after a step: cheaper than reloading everything. */
export async function refreshSong(id: string) {
  const e = entries.find(x => x.id === id);
  if (!e) return refreshCatalog();
  infos = { ...infos, [id]: await summarise(e) };
  emit();
}

export function useCatalog() {
  const [, bump] = useState(0);
  useEffect(() => {
    const fn = () => bump(x => x + 1);
    listeners.add(fn);
    if (!ready) refreshCatalog();
    return () => { listeners.delete(fn); };
  }, []);
  return { ready, entries, infos };
}

/** The song to continue: the one practised last, else the first started, else the easiest. */
export function continueTarget(): SongInfo | undefined {
  const last = lastPractised();
  const list = entries.map(e => infos[e.id]).filter((i): i is SongInfo => !!i && !!i.song && !!i.next);
  return (last && list.find(i => i.entry.id === last.songId))
    ?? list.find(i => i.stars > 0)
    ?? [...list].sort((a, b) => (a.level ?? 9) - (b.level ?? 9))[0];
}
