import type { NoteNaming } from './types';

const SOLFEGE = ['Dó', 'Dó♯', 'Ré', 'Ré♯', 'Mi', 'Fá', 'Fá♯', 'Sol', 'Sol♯', 'Lá', 'Lá♯', 'Si'];
const LETTERS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

export const isBlack = (m: number) => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);

export function noteName(midi: number, naming: NoteNaming, withOctave = false): string {
  const list = naming === 'solfege' ? SOLFEGE : LETTERS;
  const name = list[((midi % 12) + 12) % 12];
  return withOctave ? name + (Math.floor(midi / 12) - 1) : name;
}

export function formatTime(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function formatSpeed(s: number): string {
  return (s === 1 ? '1' : s.toFixed(1)) + '×';
}
