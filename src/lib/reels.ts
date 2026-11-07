/**
 * Reels: a song taught in short vertical videos, TikTok style, one per phase of the music (where
 * the music changes: the opening pattern, the melody, the build...). Each video explains that
 * phase's patterns and tricks: a title card with the idea, the left hand alone and slow, the right
 * hand alone and slow, then both hands at full speed with a caption on the bars that need one, and
 * a tip at the end. A reel is never a recorded video: it is drawn live from the song's own notes
 * (keys lighting up with their finger numbers, the notes falling onto them, the real piano sound),
 * so it is always right and works for any MIDI he brings.
 *
 * The phases and their words are written by hand after reading the score (reelScripts.ts); a song
 * without a script gets phases cut from its course parts and words the rules write from the notes.
 */
import { splitBars } from './analysis';
import { barIndex, barLength, barStart, type BarGrid } from './bars';
import { buildCourse } from './course';
import { readSong } from './reading';
import { RULE_SECTIONS, SCRIPTS, SECTIONS } from './reelScripts';
import { SCRIPTS_PT, STEP_TIPS_PT } from './reelScriptsPt';
import { cleanPhase, type PhaseWords, type Talk } from './reelShape';
import { difficultyOf } from './difficulty';
import { mainPart } from './preview';
import { L as tr, lang, NT, videoSolfege } from './lang';
import { estimate } from './voice';
import type { Hand, Song, SongNote } from './types';

export type { PhaseWords } from './reelShape';

/** One stretch of a phase video: a hand alone and slow, or both hands. */
export interface Segment {
  /** The opening listen: the phase at full speed under the voice's idea, before the hands are taken apart. */
  listen?: boolean;
  kind: 'L' | 'R' | 'both'; from: number; to: number; speed: number; label: string;
  /** Only this stretch of the bars, in ticks (a pattern: one beat of a figure), played `times` over. */
  ticks?: [number, number];
  times?: number;
  /** Several stretches in ticks played one after the other (a pattern on each chord, a move between two). */
  pieces?: [number, number][];
}

export interface Reel {
  id: string;
  /** Phase number, from 1. */
  n: number;
  /** Its place in the song's form ("Intro", "Verse 1"), and how the voice says it ("the intro"). */
  section: string;
  sectionSaid: string;
  /** Bars of the phase, 1-based, inclusive. */
  from: number;
  to: number;
  words: PhaseWords;
  segments: Segment[];
  /** Bass (or chord) letter of every bar of the phase. */
  chords: { bar: number; name: string }[];
}

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
/** A note's letter, spelt the way the key spells it (sharps, or flats in a flat key). */
export const letter = (m: number, flats = false) => (flats ? FLATS : SHARPS)[((m % 12) + 12) % 12];

// ---------- What each bar holds ----------

interface BarFacts {
  bar: number;
  /** Bass letter of the bar (lowest left-hand note on its first onset), or the best triad. */
  chord: string;
  /** The left hand opens the bar with an octave. */
  octave: boolean;
  /** The left hand holds its first notes through most of the bar. */
  held: boolean;
  /** Right-hand notes grouped by beat, as letters ("E C A C"). */
  groups: string[];
  /** The same groups as pitches. */
  pitches: number[][];
  /** Right-hand thumb note when the hand moves to a new place. */
  moveTo?: string;
}

const TRIADS: [number[], string][] = [[[0, 4, 7], ''], [[0, 3, 7], 'm']];

/** Best major or minor triad for a set of notes, weighted by length. */
function triadOf(ns: SongNote[], flats: boolean): string {
  const w = new Array(12).fill(0);
  for (const n of ns) w[n.midi % 12] += Math.min(2, n.duration);
  let best = '', score = -1;
  for (let root = 0; root < 12; root++) for (const [iv, q] of TRIADS) {
    const s = iv.reduce((a, i) => a + w[(root + i) % 12], 0) + w[root] * 0.5;
    if (s > score) { score = s; best = letter(root, flats) + q; }
  }
  return best;
}

function barFacts(song: Song, notes: SongNote[], bar: number, beatTicks: number, startTicks: number, barTicks: number, prevThumb?: number): BarFacts & { thumb?: number } {
  const L = notes.filter(n => n.hand === 'L');
  const R = notes.filter(n => n.hand === 'R');
  let chord = triadOf(notes, song.fifths < 0);
  let octave = false, held = false;
  if (L.length) {
    const first = Math.min(...L.map(n => n.ticks));
    const opening = L.filter(n => n.ticks === first).sort((a, b) => a.midi - b.midi);
    chord = letter(opening[0].midi, song.fifths < 0);
    octave = opening.length === 2 && opening[1].midi - opening[0].midi === 12;
    held = opening[0].durationTicks >= barTicks * 0.7;
  }
  // Right hand: the top note of each onset, grouped by beat.
  const groups: string[] = [];
  const pitches: number[][] = [];
  const onsets = new Map<number, SongNote[]>();
  for (const n of R) onsets.set(n.ticks, [...(onsets.get(n.ticks) ?? []), n]);
  const sorted = [...onsets.entries()].sort((a, b) => a[0] - b[0]);
  for (const [t, g] of sorted) {
    const beat = Math.floor((t - startTicks) / beatTicks + 1e-6);
    const top = g.reduce((a, b) => (b.midi > a.midi ? b : a));
    groups[beat] = groups[beat] ? `${groups[beat]} ${letter(top.midi, song.fifths < 0)}` : letter(top.midi, song.fifths < 0);
    (pitches[beat] ??= []).push(top.midi);
  }
  // Where the thumb sits: the note played with finger 1, if any.
  const thumbNote = R.find(n => n.finger === 1);
  const thumb = thumbNote?.midi;
  const moveTo = thumb !== undefined && prevThumb !== undefined && thumb !== prevThumb ? letter(thumb, song.fifths < 0) : undefined;
  return { bar, chord, octave, held, groups: groups.filter(Boolean), pitches: pitches.filter(Boolean), moveTo, thumb };
}

function songFacts(song: Song) {
  const { bars, grid } = splitBars(song);
  const out: BarFacts[] = [];
  let thumb: number | undefined;
  for (const b of bars) {
    const beatTicks = song.ppq * 4 / grid.sigs[b.index][1];
    const f = barFacts(song, b.notes, b.index + 1, beatTicks, barStart(grid, b.index), barLength(grid, b.index), thumb);
    if (f.thumb !== undefined) thumb = f.thumb;
    out.push(f);
  }
  return { bars: out, grid };
}

/** Seconds a bar lasts at full speed (from the song's own tempo map). */
export function barSeconds(song: Song, grid: BarGrid, bar: number) {
  return song.ticksToSeconds(barStart(grid, bar)) - song.ticksToSeconds(barStart(grid, bar - 1));
}

// ---------- The rules' phases and words ----------

const shortSeq = (xs: string[]) => {
  // "F G A E" for a sequence; a run of the same letter shows once.
  const out: string[] = [];
  for (const x of xs) if (out[out.length - 1] !== x) out.push(x);
  return out.slice(0, 6).join(' ');
};

/** The phases of a song without a script: its course parts, grouped into at most seven. */
function rulePhases(song: Song): { from: number; to: number }[] {
  const parts = buildCourse(song).parts;
  if (!parts.length) return [];
  const size = Math.max(1, Math.ceil(parts.length / 7));
  const out: { from: number; to: number }[] = [];
  for (let i = 0; i < parts.length; i += size) out.push({ from: parts[i].from, to: parts[Math.min(parts.length, i + size) - 1].to });
  return out;
}

/** Words measured from the notes: the bass line, the right hand's shape, a tip. */
function ruleWords(facts: BarFacts[], n: number, from: number, to: number, twoHands: boolean): PhaseWords {
  const seq = shortSeq(facts.map(f => f.chord));
  const octaves = facts.filter(f => f.octave).length >= facts.length / 2;
  const held = facts.some(f => f.held);
  const all = facts.flatMap(f => f.groups);
  const count = (xs: string[]) => { const m = new Map<string, number>(); xs.forEach(x => m.set(x, (m.get(x) ?? 0) + 1)); return [...m.entries()].sort((a, b) => b[1] - a[1])[0]; };
  const [fig, figN] = count(all) ?? ['', 0];
  const contour = (ps: number[]) => { const u = [...new Set(ps)].sort((a, b) => b - a); return ps.map(p => u.indexOf(p)).join(''); };
  const [shape, shapeN] = count(facts.flatMap(f => f.pitches).filter(ps => ps.length >= 3).map(contour)) ?? ['', 0];
  const repeats = !!fig && figN >= all.length * 0.6;
  const sameShape = !repeats && !!shape && shapeN >= all.length * 0.6;
  const RANK = lang() === 'pt' ? ['cima', 'meio', 'baixo', 'mais baixo'] : ['top', 'middle', 'low', 'lowest'];
  const shapeWords = shape.split('').map(r => RANK[Math.min(3, Number(r))]).join(', ');
  const right = repeats ? tr(`One pattern, again and again: ${fig}`, `Um padrão, uma e outra vez: ${fig}`) : sameShape ? tr(`One shape on every beat: ${shapeWords}`, `Uma forma em cada tempo: ${shapeWords}`) : tr('The right hand, beat by beat', 'A mão direita, tempo a tempo');
  const left = octaves ? tr(`Octaves carry it: ${seq}`, `São as oitavas que a levam: ${seq}`) : tr(`The bass line: ${seq}`, `A linha do baixo: ${seq}`);
  const cues: Record<number, string> = {};
  for (const f of facts) if (f.moveTo) cues[f.bar] = tr(`Move the right hand: thumb on ${f.moveTo}`, `Muda a mão direita: polegar no ${f.moveTo}`);
  return {
    from, to,
    title: tr(`Part ${n}`, `Parte ${n}`),
    hook: twoHands ? (repeats || sameShape ? right : left) : right,
    tricks: twoHands ? [`${tr('Left', 'Esquerda')}: ${left.charAt(0).toLowerCase()}${left.slice(1)}`, `${tr('Right', 'Direita')}: ${right.charAt(0).toLowerCase()}${right.slice(1)}`] : [right],
    L: octaves ? tr(`Octaves: ${seq}. Little finger low, thumb high`, `Oitavas: ${seq}. Mindinho em baixo, polegar em cima`) : `${tr('The bass', 'O baixo')}: ${seq}${held ? tr(', each held for the bar', ', cada um segurado o compasso todo') : ''}`,
    R: sameShape ? `${facts.find(f => f.groups.length)?.groups[0] ?? ''}: ${shapeWords}` : repeats ? tr(`${fig}, again and again`, `${fig}, uma e outra vez`) : tr('Look for the shapes that come back', 'Procura as formas que voltam'),
    cues,
    tip: sameShape ? tr('Same shape on every chord. Find the top note and the hand knows the rest.', 'A mesma forma em cada acorde. Encontra a nota de cima e a mão sabe o resto.') : held ? tr('Play on beat 1 and hold until the next one.', 'Toca no tempo 1 e segura até ao seguinte.') : tr('Slow first. Land both hands on beat 1 together.', 'Primeiro devagar. Põe as duas mãos no tempo 1 ao mesmo tempo.'),
  };
}

/**
 * What the voice says when no line was written for a phase: its own words, as sentences a teacher
 * would say (note letters always as a list with commas, so the recorded voice can read them).
 */
function ruleTalk(w: PhaseWords, twoHands: boolean): Talk {
  const end = (x: string) => (/[.!?]$/.test(x.trim()) ? x.trim() : `${x.trim()}.`);
  const commas = (x: string) => x.replace(/\b([A-G](?:#|b)?m?) (?=[A-G](?:#|b)?m?\b)/g, '$1, ');
  const [left, right] = w.tricks.map(t => t.replace(/^(Left|Right|Esquerda|Direita): /, ''));
  const useful = (x?: string) => !!x && !/beat by beat|tempo a tempo/.test(x);
  const cap1 = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
  const intro = twoHands
    ? [left, useful(right) ? right : ''].filter(Boolean).map(x => end(commas(cap1(x)))).join(' ')
    : useful(w.hook) ? end(commas(w.hook)) : tr('Listen first. Then we take it slowly, a few bars at a time.', 'Primeiro ouve. Depois vamos devagar, poucos compassos de cada vez.');
  return {
    intro,
    L: `${tr('Left hand.', 'Mão esquerda.')} ${end(commas(w.L))}`,
    R: /shapes that come back|formas que voltam/.test(w.R) ? tr('Right hand. Look for the shapes that come back.', 'Mão direita. Procura as formas que voltam.') : `${tr('Right hand.', 'Mão direita.')} ${end(commas(w.R))}`,
    both: twoHands ? tr('Now both hands together, at full speed.', 'Agora as duas mãos juntas, à velocidade real.') : tr('Now at full speed.', 'Agora à velocidade real.'),
    outro: end(w.tip),
  };
}

// ---------- The written scripts ----------

/** Which script fits these notes (its key in SCRIPTS): the song's own, or one whose score his notes match. */
function scriptIdFor(song: Song, bars: BarFacts[]): string | undefined {
  const fits = (sc: (typeof SCRIPTS)[string]) => {
    if (sc.version && sc.version !== readSong(song).version) return false;
    if (sc.fingerprint) {
      const marks = Object.entries(sc.fingerprint);
      const same = marks.filter(([bar, bass]) => bars[Number(bar) - 1]?.chord === bass).length;
      if (same < marks.length * 0.7) return false;
    }
    return !!sc.version || !!sc.fingerprint;
  };
  const ownId = song.entry.slot ?? song.entry.id;
  if (SCRIPTS[ownId] && fits(SCRIPTS[ownId])) return ownId;
  return Object.entries(SCRIPTS).find(([, sc]) => sc.fingerprint && fits(sc))?.[0];
}

/** A phase's words with their notes named as he reads them (Portuguese videos, lang.ts NT). */
function ntWords(w: PhaseWords): PhaseWords {
  const t = (x?: string) => (x === undefined ? x : NT(x));
  return {
    ...w, title: NT(w.title), hook: NT(w.hook), tricks: w.tricks.map(NT), L: NT(w.L), R: NT(w.R), tip: NT(w.tip),
    cues: Object.fromEntries(Object.entries(w.cues).map(([k, v]) => [k, NT(v)])),
    talk: w.talk && { intro: NT(w.talk.intro), L: t(w.talk.L), R: t(w.talk.R), both: NT(w.talk.both), outro: NT(w.talk.outro) },
    steps: w.steps && Object.fromEntries(Object.entries(w.steps).map(([k, v]) => [k, NT(v)])),
  };
}

/** The song's script if it fits these notes: the exact version, or the bass at the fingerprint bars. */
function scriptFor(song: Song, bars: BarFacts[]): PhaseWords[] | null {
  // The song's own script; or, for a MIDI he added as a new song (not into its slot), the script
  // whose printed score his notes match.
  const id = scriptIdFor(song, bars);
  const s = id ? SCRIPTS[id] : undefined;
  if (!s) return null;
  const phases = s.phases.filter(p => p.from <= bars.length).map(p => ({ ...p, to: Math.min(p.to, bars.length) }));
  return phases.length ? phases : null;
}

// ---------- The reels of a song ----------

/** Seconds from the start of bar a to the end of bar b at full speed. */
function seconds(song: Song, grid: BarGrid, a: number, b: number) {
  return song.ticksToSeconds(barStart(grid, b)) - song.ticksToSeconds(barStart(grid, a - 1));
}

const reelCaches = new Map<string, WeakMap<Song, Reel[]>>();
const cache = { get: (s: Song) => reelCaches.get(langKey())?.get(s), set: (s: Song, v: Reel[]) => { if (!reelCaches.has(langKey())) reelCaches.set(langKey(), new WeakMap()); reelCaches.get(langKey())!.set(s, v); } };

/** One reel per phase, in order. */
export function reelsOf(song: Song): Reel[] {
  const hit = cache.get(song);
  if (hit) return hit;
  const { bars, grid } = songFacts(song);
  const songBars = splitBars(song).bars;
  const twoHands = song.hands.length === 2;
  const scripted = scriptFor(song, bars);
  const scriptId = scripted ? scriptIdFor(song, bars) : undefined;
  // A script may cover only the start of a long arrangement (Fly Me to the Moon: the first chorus,
  // the tune as it is sung); the bars after it are cut and worded by the rules, as Part n.
  const written = scripted?.length ?? 0;
  const lastScripted = scripted?.[written - 1]?.to ?? 0;
  const rest = scripted && lastScripted < bars.length
    ? rulePhases(song).filter(p => p.to > lastScripted).map(p => ({ from: Math.max(p.from, lastScripted + 1), to: p.to }))
    : [];
  const phases = scripted
    ? [...scripted, ...rest.map((p, k) => ruleWords(bars.slice(p.from - 1, p.to), written + k + 1, p.from, p.to, twoHands))]
    : rulePhases(song).map((p, i) => ruleWords(bars.slice(p.from - 1, p.to), i + 1, p.from, p.to, twoHands));
  const plays = (bar: number, h: Hand) => songBars[bar - 1]?.notes.some(n => n.hand === h);
  // A stretch that fits its time: from the first bar the hand plays, as many bars as the budget allows.
  const fit = (from: number, to: number, speed: number, budget: number, maxBars: number, h?: Hand) => {
    let a = from;
    if (h) while (a < to && !plays(a, h)) a++;
    let b = a;
    while (b < to && b - a + 1 < maxBars && seconds(song, grid, a, b + 1) / speed <= budget) b++;
    return { from: a, to: b };
  };
  const reels = phases.map((p, i): Reel => {
    // In Portuguese, the script's own Portuguese words (reelScriptsPt.ts), checked the same way.
    const byScript = !!scripted && i < written;
    const pt = lang() === 'pt' && byScript ? SCRIPTS_PT[scriptId ?? '']?.[i] : undefined;
    const ptSteps = pt ? Object.fromEntries(Object.entries(STEP_TIPS_PT[scriptId ?? ''] ?? {}).filter(([k]) => { const bar = Number(k.slice(1)); return bar >= p.from && bar <= p.to; })) : undefined;
    const source = pt ? { ...p, ...pt, steps: ptSteps } : p;
    const own = (byScript && cleanPhase(source)) || (byScript ? ruleWords(bars.slice(p.from - 1, p.to), i + 1, p.from, p.to, twoHands) : p);
    const spoken = own.talk ? own : { ...own, talk: ruleTalk(own, twoHands) };
    const words = lang() === 'pt' ? ntWords(spoken) : spoken;
    const segments: Segment[] = [];
    if (twoHands) {
      for (const h of ['L', 'R'] as Hand[]) {
        if (!bars.slice(p.from - 1, p.to).length || !songBars.slice(p.from - 1, p.to).some(b => b.notes.some(n => n.hand === h))) continue;
        segments.push({ kind: h, ...fit(p.from, p.to, 0.7, 10, 2, h), speed: 0.7, label: h === 'L' ? tr('Left hand, slow', 'Mão esquerda, devagar') : tr('Right hand, slow', 'Mão direita, devagar') });
      }
    } else {
      segments.push({ kind: 'both', ...fit(p.from, p.to, 0.7, 10, 2), speed: 0.7, label: tr('Slow', 'Devagar') });
    }
    segments.push({ kind: 'both', ...fit(p.from, p.to, 1, 20, 12), speed: 1, label: twoHands ? tr('Both hands', 'Duas mãos') : tr('Full speed', 'Velocidade real') });
    // Its name in the song's form, written with the script (reelScripts.ts SECTIONS), else "Part n".
    // Without a script, a name written for the bars the rules cut (RULE_SECTIONS), only if they match.
    const ruled = !scripted ? RULE_SECTIONS[song.entry.id]?.find(x => x[0] === p.from && x[1] === p.to) : undefined;
    const sec = byScript ? SECTIONS[scriptId ?? '']?.[i] : ruled ? ([ruled[2], ruled[3], ruled[4], ruled[5]] as [string, string, string, string]) : undefined;
    const inPt = lang() === 'pt';
    return {
      id: `phase-${i + 1}`, n: i + 1, from: p.from, to: p.to, words: ruled ? { ...words, title: ruled[inPt ? 3 : 2] } : words, segments,
      section: sec ? sec[inPt ? 1 : 0] : tr(`Part ${i + 1}`, `Parte ${i + 1}`),
      sectionSaid: sec ? sec[inPt ? 3 : 2] : tr(`part ${i + 1}`, `a parte ${i + 1}`),
      chords: bars.slice(p.from - 1, p.to).map(f => ({ bar: f.bar, name: f.chord })),
    };
  });
  cache.set(song, reels);
  return reels;
}

// ---------- The videos: each phase in small steps, slow first ----------

/**
 * One short video of the feed. Each phase is cut into small steps he copies as they loop, TikTok
 * style: first the idea (the phase heard once), then two bars at a time, a hand alone and slow
 * (only for a shape he has not met yet), both hands slow, and at the end the whole phase, still
 * below full speed. A shape that comes back (the same notes, or the same shape from another note)
 * is not taught again: only both hands, with the voice saying where it starts now.
 */
export interface Clip extends Reel {
  /** The phase it belongs to. */
  phase: Reel;
  /** Its place in the phase, from 1, and how many the phase has. */
  k: number;
  of: number;
  kind: 'intro' | 'pattern' | 'tour' | 'move' | 'jump' | 'L' | 'R' | 'both' | 'run' | 'fix' | 'explain' | 'read';
  /** A 'read' item: the lesson step (course.ts) he plays on the staff, in the feed. */
  stepId?: string;
  /** The big line of the video: the idea, or the notes of the step. */
  head: string;
  /** What the voice says. */
  say: string;
  /** The stretch in words ("bars 3 and 4"). */
  where: string;
  /** What the next video teaches, said at the end so the series carries on ("the left hand"). */
  next?: string;
  /** The step of the phase it teaches (videos of one step share it). */
  step?: number;
  /** A both-hands video of shapes he already knows, and its bass line. */
  knownStep?: boolean;
  bassLine?: string[];
  /** How hard its music is to play, 0 to 1 (difficulty.ts): the gentler pace and the rounds follow it. */
  difficulty?: number;
}

// Speeds: a hand alone at half speed, both hands a little faster, the whole phase at three quarters.
const SLOW_HAND = 0.5, SLOW_BOTH = 0.6, RUN = 0.75;

// Kept per language and note names: the words are written in them.
const clipCaches = new Map<string, WeakMap<Song, Clip[]>>();
const langKey = () => `${lang()}:${videoSolfege() ? 's' : 'l'}`;
const clipCache = { get: (s: Song) => clipCaches.get(langKey())?.get(s), set: (s: Song, v: Clip[]) => { if (!clipCaches.has(langKey())) clipCaches.set(langKey(), new WeakMap()); clipCaches.get(langKey())!.set(s, v); } };

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
const barsText = (a: number, b: number) => (a === b ? tr(`bar ${a}`, `compasso ${a}`) : b === a + 1 ? tr(`bars ${a} and ${b}`, `compassos ${a} e ${b}`) : tr(`bars ${a} to ${b}`, `compassos ${a} a ${b}`));
const listOf = (xs: string[]) => xs.join(', ');

/**
 * The right hand of a stretch in words, the way a teacher says it: a figure that keeps its shape is
 * named once (top, middle, low, middle) with the note that moves; a melody is read note by note.
 */
function rightWords(facts: BarFacts[], flats: boolean) {
  const groups = facts.flatMap(f => f.pitches);
  const RANK = lang() === 'pt' ? ['cima', 'meio', 'baixo', 'mais baixo'] : ['top', 'middle', 'low', 'lowest'];
  const contour = (ps: number[]) => { const u = [...new Set(ps)].sort((x, y) => y - x); return ps.map(p => u.indexOf(p)).join(''); };
  const figure = groups.length >= 2 && groups.every(g => g.length >= 3 && contour(g) === contour(groups[0]));
  if (figure) {
    const shape = contour(groups[0]).split('').map(r => RANK[Math.min(3, Number(r))]).join(', ');
    const first = groups[0].map(m => letter(m, flats));
    const moves = groups[0].map((_, i) => new Set(groups.map(g => g[i])).size > 1);
    const tops: string[] = [];
    for (const g of groups) { const l = letter(g[0], flats); if (tops[tops.length - 1] !== l) tops.push(l); }
    const moving = moves.filter(Boolean).length;
    const tail = moving === 0 ? tr('The same notes on every beat.', 'As mesmas notas em cada tempo.') : moves[0] && moving === 1 ? tr(`Only the top note moves: ${listOf(tops.slice(0, 6))}.`, `Só a nota de cima muda: ${listOf(tops.slice(0, 6))}.`) : tr('The shape stays, the notes move with the chord.', 'A forma fica, as notas mudam com o acorde.');
    return { said: tr(`${cap(shape)}, on every beat. Start with ${listOf(first)}. ${tail}`, `${cap(shape)}, em cada tempo. Começa com ${listOf(first)}. ${tail}`), head: first.slice(0, 5).join(' ') };
  }
  const notes: string[] = [];
  for (const g of groups) for (const m of g) { const l = letter(m, flats); if (notes[notes.length - 1] !== l) notes.push(l); }
  return { said: `${listOf(notes.slice(0, 8))}${notes.length > 8 ? tr(', and on', ', e assim por diante') : ''}.`, head: notes.slice(0, 5).join(' ') };
}

/** The left hand of a stretch in words: its bass notes, as octaves or held when they are. */
function leftWords(facts: BarFacts[]) {
  const bass: string[] = [];
  for (const f of facts) if (bass[bass.length - 1] !== f.chord) bass.push(f.chord);
  const octaves = facts.every(f => f.octave), held = facts.every(f => f.held);
  const what = octaves ? tr(`An octave on ${bass.join(', then ')}`, `Uma oitava em ${bass.join(', depois ')}`) : tr(`The bass: ${listOf(bass)}`, `O baixo: ${listOf(bass)}`);
  const simple = octaves ? tr(`The left hand only holds an octave: ${listOf(bass)}. Little finger low, thumb on top.`, `A mão esquerda só segura uma oitava: ${listOf(bass)}. Mindinho em baixo, polegar em cima.`) : tr(`The left hand only holds the bass: ${listOf(bass)}.`, `A mão esquerda só segura o baixo: ${listOf(bass)}.`);
  return { said: `${what}${held ? tr(', held for the whole bar', ', segurada o compasso todo') : ''}. ${octaves ? tr('Little finger low, thumb on top.', 'Mindinho em baixo, polegar em cima.') : ''}`.trim(), simple, head: octaves ? `${bass.join(' ')} ${tr('octaves', 'oitavas')}` : bass.join(' ') };
}

/** At most this many videos a section: a short series, not a course (the 2026-11 audit). */
const SERIES = 12;
const BOTH = () => (lang() === 'pt' ? ['Agora as duas mãos juntas. Com calma e devagar.', 'Junta-as, devagar, as duas mãos a cair no tempo um.', 'Agora as duas mãos. Sem pressa.'] : ['Both hands together now. Nice and slow.', 'Put them together, slowly, both hands landing on beat one.', 'Now both hands. Take your time.']);

/**
 * Every video of a song, phase by phase, in the order he watches them.
 *
 * A phase is cut into steps by musical phrase: two bars at least, more (up to four) until the step
 * holds enough to learn (a dozen notes and four seconds of music), so no video is one held note. In
 * a step, a hand gets its own slow video only when it plays a shape he has not met and has
 * something to learn in it (six notes over three keys or more); a hand that only holds a note or an
 * octave is said in the both-hands video instead. A run of steps made of shapes he knows becomes
 * one both-hands video (up to eight bars), and the very same notes again get none.
 */
export function clipsOf(song: Song): Clip[] {
  const hit = clipCache.get(song);
  if (hit) return hit;
  const reels = reelsOf(song);
  const { bars, grid } = songFacts(song);
  const songBars = splitBars(song).bars;
  const twoHands = song.hands.length === 2;
  const handNotes = (a: number, b: number, h?: Hand) => songBars.slice(a - 1, b).flatMap(x => x.notes).filter(n => !h || n.hand === h).sort((x, y) => x.ticks - y.ticks || x.midi - y.midi);
  const onsets = (a: number, b: number, h?: Hand) => new Set(handNotes(a, b, h).map(n => n.ticks)).size;
  const keys = (a: number, b: number, h?: Hand) => new Set(handNotes(a, b, h).map(n => n.midi)).size;
  // A bar's shape for one hand, whatever note it starts from: its rhythm, and its intervals from the
  // lowest note; for a figure (six notes or more over three pitches or more, like top, middle, low,
  // middle) the order of its pitches from the top, so the same figure over a new chord counts as known.
  const barShape = (bar: number, h?: Hand) => {
    const ns = handNotes(bar, bar, h);
    if (!ns.length) return null;
    const t0 = barStart(grid, bar - 1);
    const pitches = [...new Set(ns.map(n => n.midi))].sort((x, y) => y - x);
    const on = new Set(ns.map(n => n.ticks)).size;
    const figure = on >= 6 && pitches.length >= 3;
    const low = pitches[pitches.length - 1];
    const shape = new Map<number, string>();
    // The top note of each onset carries the shape (an inner note more or less is the same shape).
    const tops = new Map<number, number>();
    for (const n of ns) { const k = n.ticks - t0; tops.set(k, Math.max(tops.get(k) ?? 0, n.midi)); }
    for (const [k, m] of tops) shape.set(k, figure ? `f${pitches.indexOf(m)}` : `i${m - low}`);
    return { shape, len: barLength(grid, bar - 1) };
  };
  // Near enough the same: three quarters of its onsets land at the same place with the same shape
  // (a bar with one more inner note, or one note changed, is still the shape he knows).
  type Shape = NonNullable<ReturnType<typeof barShape>>;
  const alike = (x: Shape, y: Shape) => {
    if (x.len !== y.len) return false;
    let same = 0;
    for (const [k, v] of x.shape) if (y.shape.get(k) === v) same++;
    return same / Math.max(x.shape.size, y.shape.size) >= 0.75;
  };
  // Every bar of the stretch already met, for that hand (bars it does not play count as met).
  const known = (a: number, b: number, h: Hand | undefined, set: Shape[]) => {
    let any = false;
    for (let bar = a; bar <= b; bar++) { const x = barShape(bar, h); if (x) { any = true; if (!set.some(y => alike(x, y))) return false; } }
    return any;
  };
  const remember = (a: number, b: number, h: Hand | undefined, set: Shape[]) => { for (let bar = a; bar <= b; bar++) { const x = barShape(bar, h); if (x) set.push(x); } };
  const plays = (a: number, b: number, h?: Hand) => handNotes(a, b, h).length > 0;
  // Something to learn for this hand alone: six notes or more, over three keys or more.
  const worth = (a: number, b: number, h?: Hand) => onsets(a, b, h) >= 6 && keys(a, b, h) >= 3;
  const seen = { L: [] as Shape[], R: [] as Shape[], both: new Set<string>() };
  const taught = new Set<string>();
  // How hard a stretch is (difficulty.ts): its speed, reach, leaps, black keys, chords and how
  // independent the hands are, 0 to 1.
  const hardness = (a: number, b: number, h?: Hand) => difficultyOf(handNotes(a, b, h), seconds(song, grid, a, b)).score;
  // Slow enough to follow, and gentler the harder it is (the user's choice 2026-11): about this many
  // notes a second at most for an easy stretch, down to 60% of it for the hardest, never faster than
  // half speed for a hand (60% for both hands, less again when it is hard), never slower than 25%.
  const slow = (a: number, b: number, h: Hand | undefined, perSecond: number, most = SLOW_HAND) => {
    const d = hardness(a, b, h);
    const dens = onsets(a, b, h) / Math.max(0.5, seconds(song, grid, a, b));
    return Math.round(Math.max(0.25, Math.min(most * (1 - 0.25 * d), (perSecond * (1 - 0.4 * d)) / Math.max(0.1, dens))) * 20) / 20;
  };
  const flats = song.fifths < 0;
  // The figure a hand plays from this bar: the first beat holding three notes or more over three
  // keys or more, when most beats of the bar repeat its shape (top, middle, low, middle).
  const figureAt = (from: number, to: number, h: Hand | undefined) => {
    for (let bar = from; bar <= to; bar++) {
      const t0 = barStart(grid, bar - 1), len = barLength(grid, bar - 1), beat = song.ppq * 4 / grid.sigs[bar - 1][1];
      const ns = handNotes(bar, bar, h);
      const beats: SongNote[][] = [];
      for (let k = 0; k * beat < len - 1; k++) {
        const on = new Map<number, SongNote>();
        for (const n of ns) if (n.ticks >= t0 + k * beat && n.ticks < t0 + (k + 1) * beat && (!on.get(n.ticks) || n.midi > on.get(n.ticks)!.midi)) on.set(n.ticks, n);
        beats.push([...on.values()].sort((x, y) => x.ticks - y.ticks));
      }
      const shapeOf = (g: SongNote[]) => { const u = [...new Set(g.map(n => n.midi))].sort((x, y) => y - x); return g.map(n => `${n.ticks % beat}:${u.indexOf(n.midi)}`).join(','); };
      const k = beats.findIndex(g => g.length >= 3 && new Set(g.map(n => n.midi)).size >= 3);
      if (k < 0) continue;
      const g = beats[k], shape = shapeOf(g);
      if (beats.filter(x => x.length && shapeOf(x) === shape).length < Math.max(2, beats.length / 2)) continue;
      const names = g.map(n => letter(n.midi, flats));
      const fingers: string[] = [];
      const done = new Set<number>();
      for (const n of g) if (!done.has(n.midi)) { done.add(n.midi); if (n.finger) fingers.push(n.finger === 1 ? tr(`Thumb on ${letter(n.midi, flats)}.`, `Polegar no ${letter(n.midi, flats)}.`) : tr(`Finger ${n.finger} on ${letter(n.midi, flats)}.`, `Dedo ${n.finger} no ${letter(n.midi, flats)}.`)); }
      const low = Math.min(...g.map(n => n.midi));
      const where = lang() === 'pt'
        ? (low >= 84 ? 'lá em cima, duas oitavas acima do Dó central' : low >= 72 ? 'uma oitava acima do Dó central' : low >= 60 ? 'logo acima do Dó central' : low >= 48 ? 'logo abaixo do Dó central' : low >= 36 ? 'uma oitava abaixo do Dó central' : 'lá em baixo, duas oitavas abaixo do Dó central')
        : (low >= 84 ? 'high up, two octaves above middle C' : low >= 72 ? 'an octave above middle C' : low >= 60 ? 'just above middle C' : low >= 48 ? 'just below middle C' : low >= 36 ? 'an octave below middle C' : 'low down, two octaves below middle C');
      const say = [tr(`First, just the pattern. ${listOf(names)}.`, `Primeiro, só o padrão. ${listOf(names)}.`), fingers.length === done.size ? fingers.join(' ') : '', tr(`It sits ${where}.`, `Fica ${where}.`)].filter(Boolean).join(' ');
      return { bar, ticks: [t0 + k * beat, t0 + (k + 1) * beat] as [number, number], shape, head: names.join(' '), say, names, pitches: g.map(n => n.midi) };
    }
    return undefined;
  };
  const out: Clip[] = [];
  const hR0: Hand | undefined = twoHands ? 'R' : undefined;
  // Every section measured, so a section's tips say what stands out in it against the rest of the
  // song (a whole song may be hard; only its hardest section is called the hardest).
  const secD = reels.map(r => difficultyOf(handNotes(r.from, r.to), seconds(song, grid, r.from, r.to)));
  const mean = (k: keyof (typeof secD)[number]) => secD.reduce((a, d) => a + d[k], 0) / Math.max(1, secD.length);
  const byHard = secD.map((d, i) => ({ i, s: d.score })).sort((a, b) => b.s - a.s).map(x => x.i);
  for (const r of reels) {
    const talk = r.words.talk;
    const mine: Omit<Clip, 'k' | 'of'>[] = [];
    const make = (kind: Clip['kind'], from: number, to: number, speed: number, label: string, head: string, say: string, step: number, listen = false, extra?: Partial<Segment>): Omit<Clip, 'k' | 'of'> => ({
      ...r, id: `${r.id}-${mine.length + 1}`, phase: r, kind, head, say, from, to, where: barsText(from, to), step,
      segments: [{ kind: kind === 'L' || kind === 'R' ? kind : 'both', from, to, speed, label, listen, ...extra }],
      chords: r.chords.filter(c => c.bar >= from && c.bar <= to),
    });
    // The idea: the opening of the phase heard once, at its real speed, while the voice explains.
    let a0 = r.from, b0 = r.from;
    while (b0 < r.to && seconds(song, grid, a0, b0 + 1) <= Math.max(6, (talk ? estimate(talk.intro) : 6) - 2)) b0++;
    mine.push(make('intro', a0, b0, 1, tr('Listen', 'Ouve'), r.words.hook, talk?.intro ?? r.words.hook, 0, true));
    // The patterns first (the user's choice 2026-11: patterns and moves, explained and repeated, are
    // where it is learnt): every figure the phase is built on, for each hand, taught on its own;
    // then the same shape on each chord it lands on, one after the other, so the hand learns to
    // carry the shape; then the moves from one chord to the next, back and forth, with what stays
    // and what moves said. The steps after them only put the patterns in their place.
    for (const h of (twoHands ? ['R', 'L'] : [undefined]) as (Hand | undefined)[]) {
      const found: NonNullable<ReturnType<typeof figureAt>>[] = [];
      for (let bar = r.from; bar <= r.to; bar++) { const f = figureAt(bar, bar, h); if (f) found.push(f); }
      const shapes = [...new Set(found.map(f => f.shape))].slice(0, 3);
      const RANK = lang() === 'pt' ? ['cima', 'meio', 'baixo', 'mais baixo'] : ['top', 'middle', 'low', 'lowest'];
      for (const shape of shapes) {
        if (taught.has(`${h}:${shape}`)) continue;
        taught.add(`${h}:${shape}`);
        const all = found.filter(f => f.shape === shape);
        const first = all[0];
        const pitches = (f: typeof first) => f.pitches;
        const contour = (ps: number[]) => { const u = [...new Set(ps)].sort((x, y) => y - x); return ps.map(p => RANK[Math.min(3, u.indexOf(p))]); };
        const shapeWords = cap(listOf(contour(pitches(first))));
        const hk = (h ?? 'both') as Segment['kind'];
        const handLabel = (en: string, pt: string, enL: string, ptL: string) => (h === 'L' ? tr(enL, ptL) : tr(en, pt));
        mine.push(make('pattern', first.bar, first.bar, slow(first.bar, first.bar, h, 2), h === 'L' ? tr('Left hand pattern, slow', 'Padrão da mão esquerda, devagar') : twoHands ? tr('Right hand pattern, slow', 'Padrão da mão direita, devagar') : tr('The pattern, slow', 'O padrão, devagar'),
          first.head, `${first.say} ${tr(`The shape: ${shapeWords}.`, `A forma: ${shapeWords}.`)}`, 0, false, { ticks: first.ticks, times: 4, kind: hk }));
        // Each chord it lands on, in the order it comes (the same notes once).
        const chords: typeof all = [];
        for (const f of all) if (!chords.some(c => c.pitches.join() === f.pitches.join())) chords.push(f);
        if (chords.length >= 2) {
          const tour = chords.slice(0, 4);
          mine.push(make('tour', tour[0].bar, tour[tour.length - 1].bar, slow(tour[0].bar, tour[0].bar, h, 2), handLabel('Each chord, slow', 'Cada acorde, devagar', 'Left hand, each chord', 'Esquerda, cada acorde'),
            tour.map(c => c.names[0]).join(' '),
            tr(`Now the same shape on each chord. ${tour.map(c => `${listOf(c.names)}.`).join(' ')} Keep the hand in its shape and move it as one.`,
              `Agora a mesma forma em cada acorde. ${tour.map(c => `${listOf(c.names)}.`).join(' ')} Mantém a mão na forma e move-a inteira.`),
            0, false, { pieces: tour.map(c => c.ticks), times: 1, kind: hk }));
          // The moves between them: the two chords back and forth, what stays and what moves said.
          for (let i = 0; i + 1 < chords.length && i < 2; i++) {
            const A = chords[i], B = chords[i + 1];
            const moved = A.pitches.map((p, k) => p !== B.pitches[k]);
            const topIdx = A.pitches.indexOf(Math.max(...A.pitches));
            const shift = B.pitches[0] - A.pitches[0];
            const sameShift = A.pitches.every((p, k) => B.pitches[k] - p === shift);
            const to = [...new Set(B.pitches.filter((_, k) => moved[k]).map(p => letter(p, flats)))];
            const how = sameShift ? tr('The whole hand moves, the shape stays.', 'A mão toda muda de sítio, a forma fica.')
              : !moved[topIdx] ? tr(`The top note stays. The other fingers move to ${listOf(to)}.`, `A nota de cima fica. Os outros dedos vão para ${listOf(to)}.`)
                : tr(`Only some fingers move: to ${listOf(to)}.`, `Só alguns dedos mudam: para ${listOf(to)}.`);
            mine.push(make('move', A.bar, B.bar, slow(A.bar, A.bar, h, 1.8), handLabel('The move, slow', 'A mudança, devagar', 'Left hand, the move', 'Esquerda, a mudança'),
              B.names.join(' '),
              tr(`The move. From ${listOf(A.names)}. To ${listOf(B.names)}. ${how}`, `A mudança. De ${listOf(A.names)}. Para ${listOf(B.names)}. ${how}`),
              0, false, { pieces: [A.ticks, B.ticks, A.ticks, B.ticks, A.ticks, B.ticks], times: 1, kind: hk }));
          }
        }
      }
    }
    // The steps: by phrase, two to four bars, until a step has enough in it.
    const chunks: [number, number][] = [];
    for (let a = r.from; a <= r.to;) {
      let b = Math.min(r.to, a + 1);
      // A hard stretch is taught in smaller steps: fewer notes a step, two bars at most when it is
      // really hard (never under two bars, never one held note).
      const d = hardness(a, b);
      const most = d >= 0.5 ? 2 : d >= 0.35 ? 3 : 4, enough = Math.round(12 - 6 * d);
      while (b < r.to && b - a + 1 < most && (onsets(a, b) < enough || seconds(song, grid, a, b) < 4)) b++;
      chunks.push([a, b]);
      a = b + 1;
    }
    const tail = chunks[chunks.length - 1];
    if (chunks.length > 1 && (tail[0] === tail[1] || onsets(tail[0], tail[1]) < 8) && tail[1] - chunks[chunks.length - 2][0] < 5) { chunks.pop(); chunks[chunks.length - 1][1] = tail[1]; }
    let firstBoth = true, said = 0, jumps = 0, repeats = 0;
    // The hand-written tip for a video of the step starting at this bar, said after its own line.
    const withTip = (line: string, key: string) => { const t = r.words.steps?.[key]; return t ? `${line} ${t}` : line; };
    chunks.forEach(([a, b], ci) => {
      const first = ci === 0;
      const facts = bars.slice(a - 1, b);
      const hR: Hand | undefined = twoHands ? 'R' : undefined;
      // The very same notes again (a repeat in the score): nothing new to show.
      const exact = handNotes(a, b).map(n => `${n.ticks - barStart(grid, a - 1)}:${n.midi}:${n.hand}`).join(',');
      if (seen.both.has(exact)) { repeats++; return; }
      const newL = twoHands && plays(a, b, 'L') && !known(a, b, 'L', seen.L);
      const newR = plays(a, b, hR) && !known(a, b, hR, seen.R);
      // A hard step gets each new hand on its own even with less in it, so the hands never meet a
      // hard place for the first time together.
      const hard = hardness(a, b) >= 0.45;
      const soloL = newL && (worth(a, b, 'L') || (hard && onsets(a, b, 'L') >= 4));
      const soloR = newR && (worth(a, b, hR) || (hard && onsets(a, b, hR) >= 4));
      const lw = leftWords(facts), rw = rightWords(facts, song.fifths < 0);
      // When the step opens with a bar he knows, the voice starts from the new one.
      const freshFrom = (h: Hand | undefined, set: Shape[]) => { for (let bar = a; bar <= b; bar++) if (!known(bar, bar, h, set)) return bar; return a; };
      const fromL = twoHands ? freshFrom('L', seen.L) : a, fromR = freshFrom(hR, seen.R);
      const knownBars = (from: number) => (from - a === 1 ? tr('You know the first bar already. Here is the new one.', 'O primeiro compasso já sabes. Aqui está o novo.') : tr('You know the first bars already. Here is the new part.', 'Os primeiros compassos já sabes. Aqui está a parte nova.'));
      const lLine = first && talk?.L ? talk.L : fromL > a ? `${tr('Left hand.', 'Mão esquerda.')} ${knownBars(fromL)} ${leftWords(bars.slice(fromL - 1, b)).said}` : `${tr('Left hand.', 'Mão esquerda.')} ${lw.said}`;
      const rNew = fromR > a ? rightWords(bars.slice(fromR - 1, b), song.fifths < 0).said : '';
      const rLine = first && talk?.R ? talk.R : `${twoHands ? tr('Right hand', 'Mão direita') : tr('Slowly now', 'Agora devagar')}. ${rNew ? `${knownBars(fromR)} ${rNew}` : rw.said}`;
      // A new figure is taught on its own first: one beat of it, slowly, four times, its keys named.
      const patternOf = (h: Hand | undefined, from: number) => {
        const pat = figureAt(from, b, h);
        if (!pat || taught.has(`${h}:${pat.shape}`)) return;
        taught.add(`${h}:${pat.shape}`);
        const extra = { ticks: pat.ticks, times: 4, kind: (h ?? 'both') as Segment['kind'] };
        const m = make('pattern', pat.bar, pat.bar, slow(pat.bar, pat.bar, h, 2), h === 'L' ? tr('Left hand pattern, slow', 'Padrão da mão esquerda, devagar') : twoHands ? tr('Right hand pattern, slow', 'Padrão da mão direita, devagar') : tr('The pattern, slow', 'O padrão, devagar'), pat.head, pat.say, ci, false, extra);
        mine.push(m);
      };
      // The hard spot of the step, learnt on its own first: the biggest jump of a hand (a ninth or
      // more, quickly), the two keys either side of it, four times, slowly.
      const jumpOf = (h: Hand | undefined) => {
        const on = new Map<number, number>();
        for (const n of handNotes(a, b, h)) { const v = on.get(n.ticks); on.set(n.ticks, v === undefined ? n.midi : h === 'L' ? Math.min(v, n.midi) : Math.max(v, n.midi)); }
        const seq = [...on.entries()].sort((x, y) => x[0] - y[0]);
        let best: { i: number; size: number } | undefined;
        for (let i = 1; i < seq.length; i++) {
          const size = Math.abs(seq[i][1] - seq[i - 1][1]);
          const quick = song.ticksToSeconds(seq[i][0]) - song.ticksToSeconds(seq[i - 1][0]) < 0.7;
          if (size >= 13 && quick && (!best || size > best.size)) best = { i, size };
        }
        if (!best) return;
        const [t0, m0] = seq[best.i - 1], [t1, m1] = seq[best.i];
        // The same kind of jump is taught once, and at most two a phase, so the hard spots stand out.
        const key = `${h}:jump:${m1 > m0 ? 'up' : 'down'}:${Math.round(Math.abs(m1 - m0) / 6)}`;
        if (taught.has(key) || jumps >= 2) return;
        jumps++;
        taught.add(key);
        const tail = seq[best.i + 1]?.[0] ?? t1 + song.ppq / 2;
        const up = m1 > m0, from = letter(m0, flats), to = letter(m1, flats);
        const say = tr(`Watch the jump. From ${from}, ${up ? 'up to the high' : 'down to the low'} ${to}. Look at the new key before you move.`, `Atenção ao salto. Do ${from}, ${up ? 'para cima até ao' : 'para baixo até ao'} ${to}. Olha para a tecla nova antes de mexeres a mão.`);
        mine.push(make('jump', barIndex(grid, t0) + 1, barIndex(grid, t1) + 1, slow(a, b, h, 1.6, 0.45), h === 'L' ? tr('Left hand jump, slow', 'Salto da mão esquerda, devagar') : tr('The jump, slow', 'O salto, devagar'), `${from} ${to}`, (r.words.steps?.[`J${a}`] ? say.replace(tr(' Look at the new key before you move.', ' Olha para a tecla nova antes de mexeres a mão.'), ` ${r.words.steps[`J${a}`]}`) : say), ci, false, { ticks: [t0, tail], times: 4, kind: (h ?? 'both') as Segment['kind'] }));
        return true;
      };
      // A step with a jump goes slower: fewer notes a second.
      const pace = (h: Hand | undefined) => (jumpOf(h) ? 2 : 2.5);
      if (soloL) { patternOf('L', fromL); const ps = pace('L'); mine.push(make('L', a, b, slow(a, b, 'L', ps), tr('Left hand, slow', 'Mão esquerda, devagar'), lw.head, withTip(lLine, `L${a}`), ci)); }
      if (soloR) { patternOf(hR, fromR); const ps = pace(hR); mine.push(make('R', a, b, slow(a, b, hR, ps), twoHands ? tr('Right hand, slow', 'Mão direita, devagar') : tr('Slow', 'Devagar'), rw.head, withTip(rLine, `R${a}`), ci)); }
      // Only the right hand plays here and it had its own video: nothing to put together.
      const together = twoHands && plays(a, b, 'L') && plays(a, b, hR);
      if (twoHands && (together || !(soloL || soloR))) {
        // What a simple hand does is said here, in the both-hands video.
        const folded = [newL && !soloL ? (first && talk?.L ? talk.L : lw.simple) : '',
          newR && !soloR ? (first && talk?.R ? talk.R : `${tr('The right hand is simple here.', 'Aqui a mão direita é simples.')} ${rw.said}`) : ''].filter(Boolean);
        const bass: string[] = [];
        for (const f of facts) if (bass[bass.length - 1] !== f.chord) bass.push(f.chord);
        const knownStep = !newL && !newR;
        const prev = mine[mine.length - 1];
        // Shapes he knows, right after shapes he knows: one longer video instead of several (not
        // where it is hard: there every step keeps its own video).
        if (knownStep && prev?.kind === 'both' && prev.knownStep && prev.to === a - 1 && b - prev.from < 6 && hardness(prev.from, b) < 0.5) {
          const merged = make('both', prev.from, b, slow(prev.from, b, undefined, 3, SLOW_BOTH), tr('Both hands, slow', 'Duas mãos, devagar'), prev.head, '', prev.step ?? ci);
          const chords = [...(prev.bassLine ?? []), ...bass].filter((x, i, xs) => xs[i - 1] !== x);
          mine[mine.length - 1] = { ...merged, id: prev.id, knownStep: true, bassLine: chords, say: withTip(tr(`Same shapes as before, now on new chords: ${listOf(chords.slice(0, 6))}. Both hands, slowly.`, `As mesmas formas de antes, agora em acordes novos: ${listOf(chords.slice(0, 6))}. Duas mãos, devagar.`), `B${prev.from}`) };
        } else {
          const say = knownStep
            ? tr(`Same shapes as before, now on new chords: ${listOf(bass.slice(0, 6))}. Both hands, slowly.`, `As mesmas formas de antes, agora em acordes novos: ${listOf(bass.slice(0, 6))}. Duas mãos, devagar.`)
            : folded.length
              ? `${folded.join(' ')} ${folded.length < 2 ? (soloL || soloR ? tr('Now both hands, slowly.', 'Agora as duas mãos, devagar.') : tr('Both hands, slowly.', 'Duas mãos, devagar.')) : ''}`.trim()
              : firstBoth ? tr('Now put the hands together, slowly. Land them on beat one together.', 'Agora junta as mãos, devagar. Põe-nas no tempo um ao mesmo tempo.') : BOTH()[said++ % BOTH().length];
          // The head shows the keys: the right hand's first notes (or the bass when only it plays).
          mine.push({ ...make('both', a, b, slow(a, b, undefined, 3, SLOW_BOTH), tr('Both hands, slow', 'Duas mãos, devagar'), plays(a, b, hR) ? rw.head : lw.head, withTip(say, `B${a}`), ci), knownStep, bassLine: bass });
        }
        firstBoth = false;
      }
      if (twoHands) remember(a, b, 'L', seen.L);
      remember(a, b, hR, seen.R);
      seen.both.add(exact);
    });
    // The whole phase, still below full speed, at most sixteen bars a video (split evenly).
    // A hard phase runs slower and in shorter stretches (eight bars instead of sixteen).
    const pd = hardness(r.from, r.to);
    const run = Math.round((RUN - 0.2 * pd) * 20) / 20;
    const len = r.to - r.from + 1, parts = Math.ceil(len / (pd >= 0.45 ? 8 : 16)), size = Math.ceil(len / parts);
    for (let a = r.from, part = 0; a <= r.to; a += size, part++) {
      const b = Math.min(r.to, a + size - 1);
      const what = lang() === 'pt'
        ? (parts === 1 ? 'a secção toda' : part === 0 ? 'a primeira parte da secção' : b === r.to ? 'o fim da secção' : 'o meio da secção')
        : (parts === 1 ? 'the whole section' : part === 0 ? 'the first part of the section' : b === r.to ? 'the end of the section' : 'the middle of the section');
      mine.push(make('run', a, b, run, run >= 0.75 ? tr('Three quarter speed', 'Três quartos da velocidade') : tr('A little faster, still slow', 'Um pouco mais rápido, ainda devagar'), parts === 1 ? tr('The whole section', 'A secção toda') : tr(`Bars ${a} to ${b}`, `Compassos ${a} a ${b}`),
        `${tr(`Now ${what}, a little slower than the real thing.`, `Agora ${what}, um pouco mais devagar do que a música.`)} ${b === r.to ? (talk?.outro ?? r.words.tip) : tr('Keep going.', 'Continua.')}`, 100 + part));
    }
    // A section is a short series (the 2026-11 audit, the user's yes: 19 to 26 videos read as a
    // course): at most SERIES videos. What goes first: a second move, the hand-alone videos of later
    // steps (the both-hands video of the same bars follows), a second jump, a second tour, a third
    // pattern. Then neighbouring both-hands steps merge into one longer video (up to six bars,
    // then eight). The idea, the first patterns, the first step's hands and the run stay.
    const dropFirst: ((c: (typeof mine)[number], i: number) => boolean)[] = [
      (c, i) => c.kind === 'move' && mine.findIndex(x => x.kind === 'move') !== i,
      c => (c.kind === 'L' || c.kind === 'R') && (c.step ?? 0) > 0 && mine.some(x => x.kind === 'both' && x.from <= c.from && x.to >= c.to),
      (c, i) => c.kind === 'jump' && mine.findIndex(x => x.kind === 'jump') !== i,
      (c, i) => c.kind === 'tour' && mine.findIndex(x => x.kind === 'tour') !== i,
      (c, i) => c.kind === 'pattern' && mine.filter((x, j) => x.kind === 'pattern' && j < i).length >= 2,
    ];
    for (const rule of dropFirst) {
      for (let i = mine.length - 1; i >= 0 && mine.length > SERIES; i--) if (rule(mine[i], i)) mine.splice(i, 1);
    }
    for (const most of [6, 8]) {
      while (mine.length > SERIES) {
        // The shortest pair of neighbouring both-hands videos that fits.
        let best = -1, size = Infinity;
        for (let i = 0; i + 1 < mine.length; i++) {
          const x = mine[i], y = mine[i + 1];
          if (x.kind === 'both' && y.kind === 'both' && y.from === x.to + 1 && y.to - x.from + 1 <= most && y.to - x.from < size) { best = i; size = y.to - x.from; }
        }
        if (best < 0) break;
        const x = mine[best], y = mine[best + 1];
        const merged = make('both', x.from, y.to, slow(x.from, y.to, undefined, 3, SLOW_BOTH), tr('Both hands, slow', 'Duas mãos, devagar'), x.head, x.say, x.step ?? 0);
        mine.splice(best, 2, { ...merged, id: x.id, knownStep: x.knownStep && y.knownStep });
      }
      if (mine.length <= SERIES) break;
    }
    // How the section is learnt and what to watch for, said in its opening (the user's choice
    // 2026-11: "an overview of each part, how it will be approached, and tips from its content"):
    // the patterns it opens with, how many steps, then the whole section; and up to two tips read
    // from its own notes (a jump, how hard, hands apart, a wide reach, black keys, speed, repeats).
    {
      const count = (k: Clip['kind'], seg?: Segment['kind']) => mine.filter(c => c.kind === k && (!seg || c.segments[0].kind === seg)).length;
      const pr = twoHands ? count('pattern', 'R') : count('pattern'), pl = twoHands ? count('pattern', 'L') : 0;
      const steps = count('L') + count('R') + count('both');
      const pt = lang() === 'pt';
      const W = pt ? ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze'] : ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
      const n = (x: number) => W[x] ?? String(x);
      const pats = pt
        ? (pr && pl ? `primeiro ${pr === 1 ? 'o padrão' : `os ${n(pr)} padrões`} da mão direita e ${n(pl)} da esquerda` : pr || pl ? `primeiro ${(pr || pl) === 1 ? 'o padrão' : `os ${n(pr || pl)} padrões`}${twoHands ? (pr ? ' da mão direita' : ' da mão esquerda') : ''}` : '')
        : (pr && pl ? `first its ${pr === 1 ? 'pattern' : `${n(pr)} patterns`} for the right hand and ${n(pl)} for the left` : pr || pl ? `first its ${(pr || pl) === 1 ? 'pattern' : `${n(pr || pl)} patterns`}${twoHands ? (pr ? ' for the right hand' : ' for the left hand') : ''}` : '');
      const st = steps ? (pt ? `${n(steps)} ${steps === 1 ? 'passo pequeno' : 'passos pequenos'}, devagar` : `${n(steps)} small ${steps === 1 ? 'step' : 'steps'}, slowly`) : '';
      const how = pt
        ? `Como a vamos aprender: ${[pats, pats && st ? `depois ${st}` : st].filter(Boolean).join(', ')}, e no fim a secção toda.`
        : `How we learn it: ${[pats, pats && st ? `then ${st}` : st].filter(Boolean).join(', ')}, then the whole section.`;
      const ri = reels.indexOf(r), d = secD[ri], rank = byHard.indexOf(ri), many = reels.length >= 3;
      const ex = (k: 'apart' | 'reach' | 'black' | 'speed' | 'leaps') => d[k] - mean(k);
      const cands: [number, string][] = [
        [count('jump') && ex('leaps') > 0 ? 0.5 + ex('leaps') : 0, tr('Watch for the jump: look at the new key before you move.', 'Atenção ao salto: olha para a tecla nova antes de mexer a mão.')],
        [many && rank === 0 ? 0.95 : 0, tr('This is the hardest section of the song, so it goes slowest. Take your time.', 'Esta é a secção mais difícil da música, por isso vai mais devagar. Sem pressa.')],
        [many && rank === reels.length - 1 ? 0.6 : 0, tr('One of the easier sections, so it comes quickly.', 'Uma das secções mais fáceis, por isso vai depressa.')],
        [twoHands && ex('apart') > 0.1 ? 0.3 + ex('apart') : 0, tr('The hands do different things here, so each one learns alone first.', 'Aqui as mãos fazem coisas diferentes, por isso cada uma aprende primeiro sozinha.')],
        [ex('reach') > 0.1 ? 0.3 + ex('reach') : 0, tr('The hands open wide here: let the wrist move, not just the fingers.', 'Aqui as mãos abrem muito: deixa o pulso mexer, não só os dedos.')],
        [ex('black') > 0.1 ? 0.3 + ex('black') : 0, tr('More black keys here: keep the hand a little forward on the keys.', 'Aqui há mais teclas pretas: mantém a mão um pouco mais à frente nas teclas.')],
        [ex('speed') > 0.1 ? 0.3 + ex('speed') : 0, tr('This is the quickest part, so we start slowly.', 'Esta é a parte mais rápida, por isso começamos devagar.')],
        [repeats || mine.some(c => c.knownStep) ? 0.35 : 0, tr('Some of it repeats, so it comes quickly.', 'Parte dela repete-se, por isso vai depressa.')],
      ];
      const tips = cands.filter(c => c[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, 2).map(c => c[1]);
      if (!tips.length) tips.push(tr('Calm and even: count the beats as you go.', 'Calmo e igual: conta os tempos.'));
      const intro = mine[0];
      if (intro?.kind === 'intro') {
        const say = `${intro.say} ${how} ${tips.join(' ')}`;
        // The opening plays on under the voice for as long as it speaks.
        let b1 = intro.from;
        while (b1 < r.to && seconds(song, grid, intro.from, b1 + 1) <= Math.max(6, estimate(say) - 2)) b1++;
        mine[0] = { ...make('intro', intro.from, b1, 1, tr('Listen', 'Ouve'), intro.head, say, 0, true), id: intro.id };
      }
    }
    // Short staff steps in the middle of the videos (the user's choice 2026-11: "short lessons on
    // the staff where it makes sense, to go with the videos"): after a both-hands video of new
    // shapes (the only hand's in a one-hand piece), its bars on the staff, when they are a short
    // step (four bars at most), at most three a section. Not counted in the series.
    let reads = 0;
    mine.forEach((c, i) => {
      const v: Clip = { ...c, say: NT(c.say), head: NT(c.head), k: i + 1, of: mine.length, difficulty: hardness(c.from, c.to, c.kind === 'L' ? 'L' : c.kind === 'R' ? hR0 : undefined) };
      out.push(v);
      const readable = twoHands ? c.kind === 'both' && !c.knownStep : c.kind === 'R';
      if (readable && c.to - c.from < 4 && reads < 3) { out.push(readClip(v)); reads++; }
    });
  }
  // The song first (the user's choice 2026-11: "start with an overview of the song and how it is
  // divided"): its theme heard at its real speed while the voice says what the song is, its sections
  // in order, and how each one is learnt. Its own phase (n 0), outside every section's series.
  if (reels.length > 1 && out.length) {
    const part = mainPart(song);
    const ns = part.notes;
    const from = ns.length ? barIndex(grid, Math.min(...ns.map(x => x.ticks))) + 1 : reels[0].from;
    const pt = lang() === 'pt';
    const names = reels.map(r => r.sectionSaid);
    const title = song.entry.title;
    const say = pt
      ? `Isto é ${title}. Divide-se em ${reels.length} secções: ${listOf(names)}. Cada uma aprende-se da mesma maneira: primeiro os padrões, depois passos pequenos, devagar, e no fim a secção toda. Ouve primeiro como soa.`
      : `This is ${title}. It comes in ${reels.length} sections: ${listOf(names)}. Each one is learnt the same way: first its patterns, then small steps, slowly, and then the whole section. First, hear how it sounds.`;
    let b = from;
    while (b < reels[reels.length - 1].to && seconds(song, grid, from, b + 1) <= Math.max(8, estimate(say) - 2)) b++;
    const phase: Reel = { ...reels[0], id: 'overview', n: 0, section: tr('The song', 'A música'), sectionSaid: tr('the song', 'a música'), from, to: b,
      words: { ...reels[0].words, title, hook: reels.map(r => r.section).join(', ') }, chords: [] };
    out.unshift({
      ...phase, id: 'overview-1', phase, kind: 'intro', head: phase.words.hook, say, from, to: b, where: '', step: 0, k: 1, of: 1,
      segments: [{ kind: 'both', from, to: b, speed: 1, label: tr('The song', 'A música'), listen: true }],
    } as Clip);
  }
  // Each video says what the next one teaches, so the series reads as one lesson.
  const about = (c: Clip, before: Clip) => {
    if (c.kind === 'intro') return `${c.phase.sectionSaid}${SCRIPTS[song.entry.slot ?? song.entry.id] && !/^(phase|fase|part|parte) \d/i.test(c.words.title) ? `, ${c.words.title.toLowerCase()}` : ''}`;
    if (c.kind === 'run') return c.from === c.phase.from ? tr('the whole section, a little faster', 'a secção toda, um pouco mais rápido') : tr('the next part of the section', 'a parte seguinte da secção');
    if (c.kind === 'read') return tr('the same bars on the staff', 'os mesmos compassos na pauta');
    if (c.kind === 'jump') return tr('the jump', 'o salto');
    if (c.kind === 'tour') return tr('the same pattern on each chord', 'o mesmo padrão em cada acorde');
    if (c.kind === 'move') return tr('the move between the chords', 'a mudança entre os acordes');
    if (c.kind === 'pattern') return c.segments[0].kind === 'L' ? tr('the left hand pattern', 'o padrão da mão esquerda') : twoHands ? tr('the right hand pattern', 'o padrão da mão direita') : tr('the pattern', 'o padrão');
    const further = c.step !== before.step ? tr(', a bit further on', ', um pouco mais à frente') : '';
    return `${c.kind === 'L' ? tr('the left hand', 'a mão esquerda') : c.kind === 'R' ? (twoHands ? tr('the right hand', 'a mão direita') : tr('the next bars', 'os compassos seguintes')) : tr('both hands together', 'as duas mãos juntas')}${further}`;
  };
  out.forEach((c, i) => { if (out[i + 1]) c.next = about(out[i + 1], c); });
  clipCache.set(song, out);
  return out;
}

// ---------- Timeline: what plays when ----------

export interface ReelNote { t: number; dur: number; midi: number; hand: Hand; finger?: number; vel: number; seg: number; bar: number; /** Beat of the bar, from 0. */ beat: number; /** Where it is in the song. */ ticks: number; /** In "Train with me": he plays it, the piano only guides. */ train?: boolean; /** Its round of Train with me, from 0, and how loud the piano guides it (0 to 1). */ round?: number; guide?: number; }
export interface ReelCard { t: number; until: number; kind: 'title' | 'end'; }
/** A line the voice says, from this time; `until` is about when it ends. */
export interface ReelLine { t: number; until: number; text: string; seg?: number }
/** A sound effect on a visible action (HyperFrames' rule: few and exact). */
export interface ReelSfx { t: number; name: 'whoosh-short' | 'whoosh' | 'pop' | 'click-soft' | 'riser' | 'impact'; gain: number }
export interface ReelTimeline {
  notes: ReelNote[]; cards: ReelCard[]; lines: ReelLine[]; sfx: ReelSfx[];
  passes: { t: number; until: number; speed: number; seg: number }[];
  /** "Train with me": the count-in, then the same music for him to play along with. */
  countIn?: { t: number; beat: number; n: number };
  /** Every round's count-in (Train with me comes in rounds, the help fading each time). */
  countIns?: { t: number; beat: number; n: number }[];
  train?: { t: number; until: number };
  /** Where the video stops by itself for him to practise on his own ("two more times"). */
  hold?: { t: number; reps: number };
  duration: number; lo: Record<Hand, number>; hi: Record<Hand, number>;
  /** Beats in a bar where the video starts (the keyboard counts them). */
  beats?: number;
  /** Where a loop starts again. */ loopFrom: number;
}

// A video teaches in four beats: the voice explains (keys lit as it names them) while the notes
// fall in; the music, slow; "Train with me", in rounds: a count-in and the same music again for him
// to play along, the piano guiding a little less each round; then it says what comes next. The idea
// (first video of a phase) is only heard.
const TITLE = 3, BREATH = 1, REST = 1.2, LEAD = 0.35;
/** Seconds a note takes to fall onto the keys in a video (Reels.tsx draws this much ahead). */
export const FALL = 2;
const TURN = () => (lang() === 'pt' ? ['A tua vez. Toca comigo.', 'Agora tu. Toca comigo.', 'A tua vez, junto comigo.'] : ['Your turn. Play it with me.', 'Now you. Play along with me.', 'Your turn, together with me.']);
const AGAIN = () => tr('Once more. The piano plays softer.', 'Mais uma vez. O piano toca mais baixo.');
const LAST = () => tr('One last time. You lead.', 'Uma última vez. Tu é que guias.');

/**
 * The timeline of a video. `pace` follows him (1 at first): faster when he plays the videos clean,
 * slower when they go wrong (Reels.tsx keeps it per song); the idea is always at its real speed.
 */
export function timelineOf(song: Song, clip: Clip, pace = 1): ReelTimeline {
  // A staff item has no timeline of its own: the lesson page runs it.
  if (clip.kind === 'read') return { notes: [], cards: [], lines: [], sfx: [], passes: [], duration: 1, lo: { R: 60, L: 48 }, hi: { R: 72, L: 60 }, loopFrom: 0 } as unknown as ReelTimeline;
  const { grid } = splitBars(song);
  const at = (bar: number) => song.ticksToSeconds(barStart(grid, bar - 1));
  const placeOf = (ticks: number) => { const i = barIndex(grid, ticks); return { bar: i + 1, beat: Math.floor((ticks - barStart(grid, i)) / (song.ppq * 4 / grid.sigs[i][1]) + 1e-6) }; };
  const notes: ReelNote[] = [], cards: ReelCard[] = [], lines: ReelLine[] = [], passes: ReelTimeline['passes'] = [], sfx: ReelSfx[] = [];
  const line = (t: number, text: string, seg?: number) => { const d = estimate(text); lines.push({ t, until: t + d, text, seg }); return d; };
  let t = 0;
  const said = line(0.3, clip.say, clip.kind === 'intro' ? undefined : 0);
  sfx.push({ t: 0.05, name: clip.k % 2 ? 'whoosh-short' : 'whoosh', gain: 0.35 });
  if (clip.kind === 'intro') { cards.push({ t: 0, until: TITLE, kind: 'title' }); t = TITLE; }
  const sg0 = clip.segments[0];
  const sg = clip.kind === 'intro' ? sg0 : { ...sg0, speed: Math.max(0.25, Math.min(clip.kind === 'run' ? 1 : 0.85, sg0.speed * pace)) };
  const hands: Hand[] = sg.kind === 'both' ? song.hands : [sg.kind];
  const [tLo, tHi] = sg.ticks ?? [barStart(grid, sg.from - 1), barStart(grid, sg.to)];
  const ns = song.notes.filter(n => hands.includes(n.hand) && n.ticks >= tLo - 1 && n.ticks < tHi - 1);
  const start = song.ticksToSeconds(tLo);
  // A pattern loops in time (its beat, again and again); a stretch lets its last notes ring.
  const times = sg.times ?? 1;
  const end = sg.ticks ? song.ticksToSeconds(tHi) : Math.max(at(sg.to + 1), ...ns.map(n => n.time + n.duration));
  // Stretches played one after the other, each `times` over (pieces); or one stretch looped.
  const cuts = sg.pieces ?? (sg.ticks ? [sg.ticks] : null);
  const cutSeconds = (c: [number, number]) => (song.ticksToSeconds(c[1]) - song.ticksToSeconds(c[0])) / sg.speed;
  const length = cuts ? cuts.reduce((a, c) => a + cutSeconds(c) * times, 0) : (end - start) / sg.speed;
  const lay = (t0: number, train = false) => {
    if (!cuts) {
      for (const n of ns) notes.push({ t: t0 + LEAD + (n.time - start) / sg.speed, dur: Math.max(0.08, n.duration / sg.speed), midi: n.midi, hand: n.hand, finger: n.finger, vel: n.velocity, seg: 0, ...placeOf(n.ticks), ticks: n.ticks, train });
      return;
    }
    let at0 = t0 + LEAD;
    for (const c of cuts) {
      const c0 = song.ticksToSeconds(c[0]), c1 = song.ticksToSeconds(c[1]);
      const cn = song.notes.filter(n => hands.includes(n.hand) && n.ticks >= c[0] - 1 && n.ticks < c[1] - 1);
      for (let k = 0; k < times; k++) {
        for (const n of cn) notes.push({ t: at0 + (n.time - c0) / sg.speed, dur: Math.max(0.08, Math.min(n.duration, c1 - n.time) / sg.speed), midi: n.midi, hand: n.hand, finger: n.finger, vel: n.velocity, seg: 0, ...placeOf(n.ticks), ticks: n.ticks, train });
        at0 += (c1 - c0) / sg.speed;
      }
    }
  };
  // The payoff (the whole phase): a riser into an impact as the music starts.
  // 1. The voice explains while the notes fall in; 2. the music.
  const breath = clip.kind === 'intro' ? 0.2 : Math.min(5, Math.max(BREATH, said * 0.6));
  const passStart = t;
  t += breath;
  if (clip.kind === 'run') { sfx.push({ t: t + LEAD - 2.4, name: 'riser', gain: 0.22 }, { t: t + LEAD - 0.02, name: 'impact', gain: 0.25 }); }
  lay(t);
  let until = t + LEAD + length;
  passes.push({ t: passStart, until, speed: sg.speed, seg: 0 });
  if (clip.kind === 'intro') {
    t = Math.max(until, 0.3 + said) + REST;
    const lo0 = { R: 127, L: 127 } as Record<Hand, number>, hi0 = { R: 0, L: 0 } as Record<Hand, number>;
    for (const n of notes) { lo0[n.hand] = Math.min(lo0[n.hand], n.midi); hi0[n.hand] = Math.max(hi0[n.hand], n.midi); }
    return { notes, cards, lines, sfx, passes, duration: t, lo: lo0, hi: hi0, loopFrom: passStart };
  }
  // 3. Train with me, in rounds (the user's choice 2026-11: practising alone was no use, he cannot
  // remember the notes yet): every round has its count-in and the notes falling for him to play, and
  // the help fades each round (the piano guiding at 75%, then 60%, then 50%: always heard, the user found it went silent at 10%), so the notes stay on
  // screen while the music moves into his hands. A step takes two rounds, three when it is hard; a
  // pattern, a jump or a fix (already four times over) and the whole phase take one.
  // A move between chords is repeated in rounds too: repeating the movement is how it is learnt.
  // The rounds add up to about seventy seconds of music at most, so no video runs to three minutes
  // (a long merged step takes one); he can loop it as often as he likes.
  const planned = clip.kind === 'run' || clip.kind === 'pattern' || clip.kind === 'jump' || clip.kind === 'fix' ? 1 : clip.kind === 'tour' || clip.kind === 'move' ? 2 : (clip.difficulty ?? 0) >= 0.6 ? 3 : 2;
  const rounds = Math.max(1, Math.min(planned, Math.floor(70 / Math.max(1, length))));
  const GUIDE = [0.75, 0.6, 0.5];
  const beat = Math.max(0.45, Math.min(1, song.ticksToSeconds(song.ppq) / sg.speed));
  // Count 1, 2, 3 (the user's choice), then the notes start falling in silence (no more clicks
  // after the 3), landing on the beat the count set.
  const n = 3;
  const fallBeats = Math.ceil(FALL / beat);
  const countIns: ReelTimeline['countIns'] = [];
  let trainFrom = 0;
  t = Math.max(until, 0.3 + said) + 0.5;
  for (let r = 0; r < rounds; r++) {
    const words = r === 0 ? TURN()[clip.k % 3] : r === rounds - 1 ? LAST() : AGAIN();
    const spoken = line(t, words, 0);
    const ci = t + spoken + 0.2;
    for (let k = 0; k < n; k++) sfx.push({ t: ci + k * beat, name: 'click-soft', gain: k === 0 ? 0.6 : 0.4 });
    const trainStart = ci + (n + fallBeats) * beat - LEAD;
    const first = notes.length;
    lay(trainStart, true);
    for (let i = first; i < notes.length; i++) { notes[i].round = r; notes[i].guide = GUIDE[r]; }
    until = trainStart + LEAD + length;
    passes.push({ t: ci, until, speed: sg.speed, seg: 0 });
    countIns.push({ t: ci, beat, n });
    if (r === 0) trainFrom = trainStart + LEAD;
    t = until + 0.7;
  }
  // 4. It says what comes next, so the videos read as one lesson.
  const after = until + 0.6;
  const nextLine = clip.next ? tr(`Nice. Next up, ${clip.next}. Swipe up.`, `Boa. A seguir, ${clip.next}. Desliza para cima.`) : tr('Nice. That is this section. Now practise it in the lessons.', 'Boa. Esta secção está feita. Agora pratica-a nas lições.');
  const nextSaid = line(after, nextLine, 0);
  const duration = after + nextSaid + REST;
  const lo = { R: 127, L: 127 } as Record<Hand, number>, hi = { R: 0, L: 0 } as Record<Hand, number>;
  for (const x of notes) { lo[x.hand] = Math.min(lo[x.hand], x.midi); hi[x.hand] = Math.max(hi[x.hand], x.midi); }
  // The loop is Train with me again: the rounds, without the voice.
  return { notes, cards, lines, sfx, passes, countIn: countIns[0], countIns, train: { t: trainFrom, until }, duration, lo, hi, loopFrom: countIns[0].t - 0.2, beats: grid.sigs[Math.max(0, sg.from - 1)]?.[0] ?? 4 };
}

/** What every bar holds, to write a script from (window.__reelFacts in the dev console). */
export function reelFacts(song: Song) {
  const { bars } = songFacts(song);
  return {
    phases: reelsOf(song).map(r => ({ n: r.n, from: r.from, to: r.to, title: r.words.title, segments: r.segments })),
    bars: bars.map(f => ({ bar: f.bar, bass: f.chord, octave: f.octave, held: f.held, right: f.groups.join(' | '), moveTo: f.moveTo })),
  };
}

// ---------- What he has watched ----------

const SEEN = 'hugos-piano:reels-seen';
const seenListeners = new Set<() => void>();
export function seenReels(songId: string): string[] {
  try { return (JSON.parse(localStorage.getItem(SEEN) ?? '{}') as Record<string, string[]>)[songId] ?? []; } catch { return []; }
}
export function markSeen(songId: string, reelId: string) {
  try {
    const all = JSON.parse(localStorage.getItem(SEEN) ?? '{}') as Record<string, string[]>;
    const list = all[songId] ?? [];
    if (list.includes(reelId)) return;
    all[songId] = [...list, reelId];
    localStorage.setItem(SEEN, JSON.stringify(all));
    seenListeners.forEach(fn => fn());
  } catch { /* storage blocked: nothing to remember */ }
}
export function onSeen(fn: () => void) { seenListeners.add(fn); return () => { seenListeners.delete(fn); }; }

/**
 * A video made on the spot for the place he keeps missing: the group he missed with the one before
 * and the one after it, four times, slower, the voice naming the key he missed.
 */
export function fixClip(song: Song, clip: Clip, ticks: number, missed: number[]): Clip {
  const { grid } = splitBars(song);
  const sg = clip.segments[0];
  const hands: Hand[] = sg.kind === 'both' ? song.hands : [sg.kind];
  const onsets = [...new Set(song.notes.filter(n => hands.includes(n.hand)).map(n => n.ticks))].sort((x, y) => x - y);
  const k = Math.max(0, onsets.findIndex(x => x >= ticks - 1));
  const a = onsets[Math.max(0, k - 1)], z = onsets[Math.min(onsets.length - 1, k + 2)] ?? a + song.ppq;
  const flats = song.fifths < 0;
  const names = [...new Set(missed.map(m => letter(m, flats)))];
  const span = song.notes.filter(n => hands.includes(n.hand) && n.ticks >= a && n.ticks < z).sort((x, y) => x.ticks - y.ticks || y.midi - x.midi);
  const seq: string[] = [];
  for (const n of span) { const l = letter(n.midi, flats); if (seq[seq.length - 1] !== l) seq.push(l); }
  return {
    ...clip, id: `${clip.id}-fix-${ticks}`, kind: 'fix', head: NT(seq.slice(0, 5).join(' ')),
    say: NT(tr(`Let's fix this spot. You missed ${listOf(names)}. Here it is again, slowly. ${listOf(seq.slice(0, 6))}.`, `Vamos corrigir este sítio. Falhaste ${listOf(names)}. Aqui está outra vez, devagar. ${listOf(seq.slice(0, 6))}.`)),
    from: barIndex(grid, a) + 1, to: barIndex(grid, Math.max(a, z - 1)) + 1, where: '',
    segments: [{ ...sg, speed: Math.max(0.3, sg.speed * 0.75), label: tr('Fix this spot, slow', 'Corrigir este sítio, devagar'), ticks: [a, z], times: 4 }],
  };
}

/** The fixed lines of an explanation (for the voice recorder, main.tsx __voiceKeys). */
export const explainLines = () => [
  tr("Let's take it apart, slower.", 'Vamos por partes, mais devagar.'),
  tr('Nice. Next up, the whole part again. Swipe up.', 'Boa. A seguir, a parte toda outra vez. Desliza para cima.'),
];

/**
 * "Explain it slower" (the button on a video, the user's choice 2026-11): the video's music taken
 * apart into small pieces, a bar or half a bar (two bars of a long stretch), each hand alone and
 * then both, slower than the video was, every piece its own short video with its notes named; then
 * the whole part again. The pieces are cut from the song's own notes, as everything else.
 */
export function explainClips(song: Song, clip: Clip): Clip[] {
  const { grid } = splitBars(song);
  const flats = song.fifths < 0;
  const sg = clip.segments[0];
  const hands: Hand[] = sg.kind === 'both' ? song.hands : [sg.kind];
  const notesIn = (t0: number, t1: number, h: Hand) => song.notes.filter(n => n.hand === h && n.ticks >= t0 && n.ticks < t1).sort((a, b) => a.ticks - b.ticks || b.midi - a.midi);
  const pieces: [number, number][] = [];
  if (sg.ticks) pieces.push(sg.ticks);
  else {
    const per = Math.max(1, Math.ceil((sg.to - sg.from + 1) / 6));
    for (let b = sg.from; b <= sg.to; b += per) {
      const t0 = barStart(grid, b - 1), t1 = barStart(grid, Math.min(sg.to, b + per - 1));
      const busy = new Set(hands.flatMap(h => notesIn(t0, t1, h)).map(n => n.ticks)).size > 10;
      if (per === 1 && busy) { const mid = Math.round(t0 + (t1 - t0) / 2); pieces.push([t0, mid], [mid, t1]); } else pieces.push([t0, t1]);
    }
  }
  const speed = Math.max(0.25, Math.round(sg.speed * 0.7 * 20) / 20);
  const out: Clip[] = [];
  const names = (ns: SongNote[]) => { const seq: string[] = []; for (const n of ns) { const l = letter(n.midi, flats); if (seq[seq.length - 1] !== l) seq.push(l); } return seq; };
  pieces.slice(0, 8).forEach(([t0, t1], pi) => {
    const playing = hands.filter(h => notesIn(t0, t1, h).length);
    const videos: (Hand | 'both')[] = playing.length > 1 ? [...playing, 'both'] : playing;
    for (const v of videos) {
      const ns = v === 'both' ? [] : notesIn(t0, t1, v);
      const seq = v === 'both' ? names(notesIn(t0, t1, playing.includes('R') ? 'R' : playing[0])) : names(ns);
      const first = out.length === 0;
      const handLine = v === 'L' ? tr('Left hand.', 'Mão esquerda.') : v === 'R' ? tr('Right hand.', 'Mão direita.') : tr('Now both hands, slowly.', 'Agora as duas mãos, devagar.');
      const list = v === 'both' ? '' : ` ${seq.slice(0, 8).join(', ')}.`;
      const label = v === 'L' ? tr('Left hand, piece by piece', 'Mão esquerda, por partes') : v === 'R' ? tr('Right hand, piece by piece', 'Mão direita, por partes') : tr('Both hands, piece by piece', 'Duas mãos, por partes');
      out.push({
        ...clip, id: `${clip.id}-explain-${pi}-${v}`, kind: 'explain', knownStep: false,
        head: NT(seq.slice(0, 5).join(' ')),
        say: NT(`${first ? `${tr("Let's take it apart, slower.", 'Vamos por partes, mais devagar.')} ` : ''}${handLine}${list}`),
        from: barIndex(grid, t0) + 1, to: barIndex(grid, Math.max(t0, t1 - 1)) + 1, where: '',
        segments: [{ ...sg, kind: v, speed, label, ticks: [t0, t1], times: 1, listen: false }],
      });
    }
  });
  const about = (c: Clip) => (c.segments[0].kind === 'L' ? tr('the left hand', 'a mão esquerda') : c.segments[0].kind === 'R' ? tr('the right hand', 'a mão direita') : tr('both hands together', 'as duas mãos juntas'));
  out.forEach((c, i) => { c.next = out[i + 1] ? about(out[i + 1]) : tr('the whole part again', 'a parte toda outra vez'); });
  return out;
}

/**
 * A section played through at its real speed with the hands on the keys (Hear on the Song tab, the
 * 2026-11 audit): one video, no voice, the notes falling and the piano playing, to hear and watch
 * the music before learning it. Not part of the series (it is never counted as watched).
 */
export function listenClip(song: Song, reel: Reel): Clip | undefined {
  const first = clipsOf(song).find(c => c.phase.id === reel.id);
  if (!first) return undefined;
  return {
    ...first, id: `${reel.id}-listen`, kind: 'intro', head: reel.section, say: '', from: reel.from, to: reel.to, where: '', k: 1, of: 1, next: undefined,
    segments: [{ kind: 'both', from: reel.from, to: reel.to, speed: 1, label: tr('Listen', 'Ouve'), listen: true }],
    chords: reel.chords,
  };
}

/**
 * The same bars on the staff, put in the feed right after a both-hands video he did not play clean
 * (the user's choice 2026-11: "the practice not separate from the videos, mixed in where it is
 * needed"): Simply Piano's lesson page for those bars (App.tsx makes it), then he scrolls on.
 */
export function readClip(clip: Clip): Clip {
  return { ...clip, id: `${clip.id}-read`, kind: 'read', head: tr('Read it on the staff', 'Lê na pauta'), say: '', stepId: `read-${clip.from}-${clip.to}`,
    segments: [{ kind: 'both', from: clip.from, to: clip.to, speed: 1, label: tr('On the staff', 'Na pauta') }], next: undefined };
}

