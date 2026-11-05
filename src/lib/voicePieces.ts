/**
 * How a line of the videos is cut for the recorded voice (voiceBank.json, made by
 * scripts/voice-bank.mjs with Kokoro): a line is played whole when it was recorded whole; otherwise
 * sentence by sentence; and a sentence that lists notes ("Start with E, C, A, C.") is played from its
 * pieces: the words around the list, recorded once, and each note name recorded on its own, as it
 * sounds in the middle of a list ("E,") and at its end ("E."). So any line the rules write from a
 * song's notes is spoken by the natural voice, with nothing from his MIDI file shipped in the app.
 * Pure functions: the app, the collector (in the browser) and the recorder share them.
 */

/** A note name or a shape word as a list item, with what follows it. */
// English letters and Portuguese solfège; the shape words of both (top, middle, low; cima, meio, baixo).
const ITEM = /(?<![\wÀ-ÿ#'])(?<![Mm]iddle )((?:[A-G]|Dó|Ré|Mi|Fá|Sol|Lá|Si)(?:#|b)?m?|[Tt]op|[Mm]iddle|[Ll]owest|[Ll]ow|[Cc]ima|[Mm]eio|[Bb]aixo)(?! central)([,.:;!?]?)(?=\s|$)/g;
const NOTE = /^(?:[A-G]|Dó|Ré|Mi|Fá|Sol|Lá|Si)(?:#|b)?m?$/;

export type Piece = { key: string; gap: number };

/** The sentences of a line. */
export const sentences = (text: string) => text.trim().split(/(?<=[.!?])\s+/).filter(Boolean);

/** The key a list item is recorded under: "~E," in the middle of a list, "~E." at its end. */
export const itemKey = (item: string, end: boolean) => `~${NOTE.test(item) ? item : item.toLowerCase()}${end ? '.' : ','}`;

const gapAfter = (key: string) => (/[.!?]$/.test(key) ? 0.32 : /:$/.test(key) ? 0.16 : key.startsWith('~') ? 0.06 : 0.1);

/**
 * A sentence's pieces: the words between lists (as written, with their own punctuation) and each
 * list item. A shape word (top, middle, low) counts as an item only in a list of two or more, so
 * "Little finger low, thumb on top." stays words.
 */
export function splitSentence(s: string): string[] {
  const found: { at: number; end: number; item: string; punct: string }[] = [];
  for (const m of s.matchAll(ITEM)) found.push({ at: m.index!, end: m.index! + m[0].length, item: m[1], punct: m[2] });
  // Group items that follow each other (only a space between them) into lists.
  const lists: (typeof found)[] = [];
  for (const f of found) {
    const last = lists[lists.length - 1];
    const prev = last?.[last.length - 1];
    if (prev && prev.punct === ',' && s.slice(prev.end, f.at).trim() === '') last.push(f);
    else lists.push([f]);
  }
  const keep = lists.filter(l => l.some(f => NOTE.test(f.item)) || l.length >= 2);
  if (!keep.length) return [s.trim()];
  const out: string[] = [];
  let at = 0;
  for (const l of keep) {
    const words = s.slice(at, l[0].at).trim();
    if (words) out.push(words);
    for (const f of l) out.push(itemKey(f.item, f.punct !== ',' && f.punct !== ':' && f.punct !== ';'));
    at = l[l.length - 1].end;
  }
  const rest = s.slice(at).trim();
  if (rest && !/^[,.:;!?]+$/.test(rest)) out.push(rest);
  return out;
}

/** The pieces to play for a line, given what was recorded; null if any piece is missing. */
export function planLine(text: string, has: (key: string) => boolean): Piece[] | null {
  const line = text.trim();
  if (has(line)) return [{ key: line, gap: 0 }];
  const out: Piece[] = [];
  for (const s of sentences(line)) {
    const keys = has(s) ? [s] : splitSentence(s);
    for (const k of keys) {
      if (!has(k)) return null;
      out.push({ key: k, gap: gapAfter(k) });
    }
  }
  if (out.length) out[out.length - 1].gap = 0;
  return out;
}

/** Every list item there is, to record once: the twelve notes each way, minor chords, shape words. */
export function allItems(lang: 'en' | 'pt' = 'en'): string[] {
  const letters = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];
  const SOLF: Record<string, string> = { C: 'Dó', D: 'Ré', E: 'Mi', F: 'Fá', G: 'Sol', A: 'Lá', B: 'Si' };
  // In Portuguese the videos name notes in solfège or as letters (Settings): both are recorded.
  const notes = lang === 'pt' ? [...letters.map(n => n.replace(/^[A-G]/, l => SOLF[l])), ...letters] : letters;
  const all = [...notes, ...notes.map(n => `${n}m`), ...(lang === 'pt' ? ['cima', 'meio', 'baixo'] : ['top', 'middle', 'low', 'lowest'])];
  return all.flatMap(i => [itemKey(i, false), itemKey(i, true)]);
}

/**
 * The text the natural voice is given for a key. Note letters are spelt so the voice says them as
 * letters: a lone A is "eigh" (espeak reads "ay" as "eye" and "A" inside a sentence as "a"),
 * a sharp and a flat in words, "m" as minor.
 */
export function naturalText(key: string, lang: 'en' | 'pt' = 'en') {
  const t = key.startsWith('~') ? key.slice(1) : key;
  // Portuguese: sharps, flats and minor in words ("Fá sustenido", "Si bemol", "Lá menor").
  if (lang === 'pt') return t
    .replace(/(?<![\wÀ-ÿ])((?:[A-G]|Dó|Ré|Mi|Fá|Sol|Lá|Si)(?:#|b)?)m(?![\wÀ-ÿ])/g, '$1 menor')
    .replace(/(?<![\wÀ-ÿ])((?:[A-G]|Dó|Ré|Mi|Fá|Sol|Lá|Si))b(?![\wÀ-ÿ])/g, '$1 bemol')
    .replace(/#/g, ' sustenido')
    // Notes as letters (Settings, Note names) are said as Portuguese letter names; "A" and "E"
    // before a lowercase word are the words, unless an article comes before them.
    .replace(/(?<![\wÀ-ÿ#])([A-G])(?![\wÀ-ÿ])/g, (all, l: string, at: number, whole: string) =>
      (l === 'A' || l === 'E') && /^ (?!bemol|sustenido|menor)[a-zà-ÿ]/.test(whole.slice(at + 1)) && !/(?:^|\s)(?:o|no|do|ao|um|num|pelo|segura o)\s$/i.test(whole.slice(0, at)) ? all
        : ({ A: 'á', B: 'bê', C: 'cê', D: 'dê', E: 'é', F: 'éfe', G: 'gê' } as Record<string, string>)[l]);
  return t
    .replace(/\b([A-G])(#|b)?m\b/g, (_, l: string, a?: string) => `${l}${a ?? ''} minor`)
    .replace(/\b([A-G])b\b/g, '$1 flat')
    .replace(/#/g, ' sharp')
    .replace(/(^|[.!?]\s+)A(?= (?!sharp|flat|minor)[a-z])/g, '$1a')
    .replace(/\bA\b/g, 'eigh');
}
