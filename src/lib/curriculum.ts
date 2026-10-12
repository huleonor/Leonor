/**
 * The course, as a path: four sections of real piano teaching, each a run of units, each unit a
 * run of nodes Duolingo style, every node a different kind of lesson:
 *
 *   theory     (book)        Pip explains one idea with the staff and the keys, then asks
 *   lesson     (star)        a piece for the new skill, written for him on the spot
 *   listen     (headphones)  hear it first, then play it back
 *   technique  (hand)        scales, five-finger patterns, accompaniment patterns
 *   practice   (dumbbell)    whatever he has been getting wrong lately
 *   song       (note)        a real piece
 *   chest                    energy and gems
 *   trophy                   the unit test
 *
 * Generated nodes take a level, and the path picks it from his skill profile each time he plays:
 * he never sees a difficulty setting, the next piece is just a little harder, or a little easier.
 */
import { COURSE_SONGS, makeExercise, RHYTHMS, scale } from './exercises';
import { accompany, arpeggio, bluesScale, contrary, fiveFinger, intervals, leftAlone, notes, scaleRun, together, triads, tune, type Gen } from './generators';
import { rng } from './exercises';
import type { SkillId } from './skills';
import type { Song } from './types';
import type { Pose } from '../components/Penguin';

// ---------- Theory cards ----------

/** A few bars to show: abc notes (L:1/4), in one clef or on the grand staff. */
export interface Staff { notes: string; clef?: 'treble' | 'bass'; key?: string; meter?: string; left?: string; }
export interface KeysView { lo: number; hi: number; mark?: number[]; labels?: boolean; }
export type Card =
  | { t: 'say'; text: string; pose?: Pose; staff?: Staff; keys?: KeysView }
  | { t: 'pick'; text: string; staff?: Staff; keys?: KeysView; options: string[]; answer: number }
  /** Play these, in order; an array inside is a chord. Any octave counts unless `exact`. */
  | { t: 'play'; text: string; staff?: Staff; keys?: KeysView; play: (number | number[])[]; exact?: boolean };

const LETTERS = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const ABC = ['C', '^C', 'D', '_E', 'E', 'F', '^F', 'G', '_A', 'A', '_B', 'B'];
/** A midi note in abc: 60 → C, 72 → c, 48 → C, */
export function abcOf(m: number) {
  const o = Math.floor(m / 12) - 1;
  const n = ABC[m % 12];
  if (o >= 5) return n.slice(0, -1) + n.slice(-1).toLowerCase() + "'".repeat(o - 5);
  return n + ','.repeat(4 - o);
}
export const letterOf = (m: number) => LETTERS[m % 12];

/** "Which note is this?" cards for some notes in one clef. */
function nameQuiz(id: string, ms: number[], clef: 'treble' | 'bass' = 'treble', n = 3): Card[] {
  const r = rng([...id].reduce((h, c) => h * 31 + c.charCodeAt(0), 7));
  const out: Card[] = [];
  const names = [...new Set(ms.map(letterOf))];
  for (let k = 0; k < n; k++) {
    const m = ms[Math.floor(r() * ms.length)];
    const right = letterOf(m);
    const wrong = names.filter(x => x !== right).sort(() => r() - 0.5).slice(0, 2);
    const options = [right, ...wrong].sort(() => r() - 0.5);
    out.push({ t: 'pick', text: 'Which note is this?', staff: { notes: abcOf(m) + '4', clef }, options, answer: options.indexOf(right) });
  }
  return out;
}

const say = (text: string, more: Partial<Extract<Card, { t: 'say' }>> = {}): Card => ({ t: 'say', text, ...more });
const pickC = (text: string, options: string[], answer: number, more: { staff?: Staff; keys?: KeysView } = {}): Card => ({ t: 'pick', text, options, answer, ...more });
const playC = (text: string, play: (number | number[])[], more: { staff?: Staff; keys?: KeysView; exact?: boolean } = {}): Card => ({ t: 'play', text, play, ...more });
const K = (lo: number, hi: number, mark?: number[], labels = false): KeysView => ({ lo, hi, mark, labels });
const S = (n: string, more: Partial<Staff> = {}): Staff => ({ notes: n, ...more });

// ---------- Nodes and units ----------

export type NodeKind = 'theory' | 'lesson' | 'listen' | 'technique' | 'practice' | 'song' | 'chest' | 'trophy';
export type NodeHands = 'R' | 'L' | 'both';

export interface PathNode {
  id: string;
  kind: NodeKind;
  title: string;
  sub: string;
  hands: NodeHands;
  /** The skill a generated node trains; its mastery moves the level. */
  skill?: SkillId;
  /** Practice nodes: the skills to choose the weakest from. */
  skills?: SkillId[];
  /** Level before adapting, 0–3. */
  base?: number;
  gen?: Gen;
  song?: () => Song;
  cards?: Card[];
}

export interface Unit {
  id: string;
  title: string;
  sub: string;
  /** The guidebook: what the unit teaches, in a few lines. */
  guide: string[];
  nodes: PathNode[];
  /** The test piece: pass it with 2 stars to complete the unit. */
  test: { gen: Gen; hands: NodeHands; skill: SkillId };
}

export interface Section { id: string; title: string; sub: string; units: Unit[]; }

const theory = (id: string, title: string, cards: Card[]): PathNode => ({ id, kind: 'theory', title, sub: 'Theory with Pip', hands: 'R', cards });
const lesson = (id: string, title: string, sub: string, skill: SkillId, hands: NodeHands, gen: Gen, base = 0): PathNode => ({ id, kind: 'lesson', title, sub, skill, hands, gen, base });
const listen = (id: string, title: string, sub: string, skill: SkillId, hands: NodeHands, gen: Gen, base = 0): PathNode => ({ id, kind: 'listen', title, sub, skill, hands, gen, base });
const tech = (id: string, title: string, sub: string, skill: SkillId, hands: NodeHands, gen: Gen, base = 0): PathNode => ({ id, kind: 'technique', title, sub, skill, hands, gen, base });
const practice = (id: string, skills: SkillId[]): PathNode => ({ id, kind: 'practice', title: 'Personal practice', sub: 'Made from how you play', hands: 'R', skills });
const song = (id: string, make: () => Song, sub: string, hands: NodeHands = 'R'): PathNode => ({ id, kind: 'song', title: make().entry.title, sub, hands, song: make });
const chest = (id: string): PathNode => ({ id, kind: 'chest', title: 'Treasure chest', sub: 'Energy and gems inside', hands: 'R' });
const ex = (skill: SkillId): Gen => (lv, seed) => makeExercise(skill, lv, seed);

const C_G = () => notes('C4 D4 E4 F4 G4');
const BASS_C_G = () => notes('C3 D3 E3 F3 G3');
const PROGS = {
  hold: [['C', 'G', 'C'], ['C', 'F', 'G', 'C'], ['C', 'F', 'C', 'G', 'C'], ['C', 'Am', 'F', 'G', 'C']],
  pop: [['C', 'G', 'Am', 'F', 'C'], ['C', 'G', 'Am', 'F', 'C'], ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'C'], ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'C']],
  blues: [['C', 'C', 'F', 'C'], ['C', 'C', 'F', 'F', 'C', 'C', 'G', 'C'], ['C', 'C', 'C', 'C', 'F', 'F', 'C', 'C', 'G', 'F', 'C', 'C']],
  jazz: [['Dm7', 'G7', 'Cmaj7'], ['Dm7', 'G7', 'Cmaj7', 'Cmaj7'], ['Dm7', 'G7', 'Cmaj7', 'Am7', 'Dm7', 'G7', 'Cmaj7']],
  waltz: [['C', 'G', 'C'], ['C', 'G', 'G', 'C'], ['C', 'F', 'G', 'C'], ['C', 'Am', 'F', 'G', 'C']],
};

export const SECTIONS: Section[] = [
  {
    id: 's1', title: 'Foundations', sub: 'Find your way around the keys and read your first notes',
    units: [
      {
        id: 'u1', title: 'The keyboard', sub: 'Black keys, white keys and middle C',
        guide: [
          'The black keys come in groups of two and three.',
          'C is the white key just left of each group of two black keys.',
          'Middle C is the C nearest the middle of the piano: your home base.',
          'The white keys go C D E F G A B, then start again.',
          'Fingers have numbers: thumb 1, pointer 2, middle 3, ring 4, little finger 5.',
        ],
        nodes: [
          theory('u1-t', 'Meet the keyboard', [
            say('Hi, I’m Pip! Let’s learn the piano together. First, the keys.', { pose: 'wave', keys: K(48, 72) }),
            say('See the black keys? They come in groups of two and three.', { keys: K(48, 72, [49, 51, 54, 56, 58, 61, 63, 66, 68, 70]) }),
            say('C is the white key just left of the two black keys. The C in the middle of the piano is middle C.', { keys: K(48, 72, [60], true) }),
            playC('Find middle C and play it.', [60], { keys: K(48, 72) }),
            say('The white keys are named C D E F G A B. Then the names start again.', { keys: K(60, 72, [60, 62, 64, 65, 67, 69, 71], true) }),
            pickC('Which key comes just after C?', ['B', 'D', 'E'], 1, { keys: K(60, 67, [60], true) }),
            say('Your fingers have numbers: thumb 1, pointer 2, middle 3, ring 4, little finger 5. The same on both hands.', { pose: 'keys' }),
            playC('Play C, D and E with fingers 1, 2 and 3.', [60, 62, 64], { keys: K(60, 67, [60, 62, 64], true) }),
          ]),
          lesson('u1-cde', 'C, D and E', 'Three keys, three fingers', 'treble', 'R', tune({ hand: 'R', pool: lv => notes(lv < 2 ? 'C4 D4 E4' : 'C4 D4 E4 F4'), home: 60 })),
          tech('u1-five', 'Five fingers', 'Thumb on C, little finger on G', 'treble', 'R', fiveFinger('R')),
          lesson('u1-cg', 'C up to G', 'The whole hand on its keys', 'treble', 'R', tune({ hand: 'R', pool: C_G, home: 60 })),
          chest('u1-chest'),
          listen('u1-echo', 'Echo me', 'Listen, then play it back', 'treble', 'R', tune({ hand: 'R', pool: C_G, home: 60 })),
          song('u1-mary', COURSE_SONGS.mary, 'Your first song'),
        ],
        test: { gen: tune({ hand: 'R', pool: C_G, home: 60 }), hands: 'R', skill: 'treble' },
      },
      {
        id: 'u2', title: 'The treble clef', sub: 'Read C to G on the staff',
        guide: [
          'Music is written on a staff: five lines and four spaces.',
          'The treble clef curls around the G line. It is for the right hand.',
          'Middle C sits on its own short line below the staff.',
          'Up the staff is up the keyboard: line, space, line, space.',
        ],
        nodes: [
          theory('u2-t', 'The staff', [
            say('Music is written on a staff: five lines and four spaces.', { pose: 'read', staff: S('C D E F G A B c') }),
            say('This curl is the treble clef. It is for the right hand and the higher notes. It wraps around the line for G.', { staff: S('G4') }),
            say('Middle C has its own little line under the staff. D hangs below the staff, E sits on the bottom line.', { staff: S('C D E') }),
            say('Each step up the keyboard is one step up the staff: line, space, line, space.', { staff: S('C D E F G'), keys: K(60, 67, [60, 62, 64, 65, 67], true) }),
            ...nameQuiz('u2-q', C_G()),
            playC('This is G. Play it!', [67], { staff: S('G4'), keys: K(60, 72) }),
          ]),
          lesson('u2-read', 'Reading C to G', 'Your eyes on the staff', 'treble', 'R', tune({ hand: 'R', pool: C_G, home: 60 })),
          practice('u2-p', ['treble']),
          lesson('u2-skips', 'Steps and skips', 'Some notes jump', 'treble', 'R', tune({ hand: 'R', pool: lv => scale(60, 67 + lv * 2), home: 60 }), 1),
          chest('u2-chest'),
          song('u2-ode', COURSE_SONGS.ode, 'Beethoven, right hand'),
        ],
        test: { gen: tune({ hand: 'R', pool: lv => scale(60, 67 + lv * 2), home: 60 }), hands: 'R', skill: 'treble' },
      },
      {
        id: 'u3', title: 'Note values', sub: 'Whole, half and quarter notes',
        guide: [
          'A quarter note lasts one beat.',
          'A half note lasts two beats: keep the key down.',
          'A whole note lasts four beats.',
          'Bar lines split the music into groups of beats. In 4/4, four beats a bar.',
          'Count out loud: 1, 2, 3, 4.',
        ],
        nodes: [
          theory('u3-t', 'How long is a note?', [
            say('Music has a beat, like a heartbeat. The shape of a note says how many beats to hold it.', { pose: 'keys' }),
            say('A quarter note: one beat.', { staff: S('C C C C', { meter: '4/4' }) }),
            say('A half note: two beats. Hold it down!', { staff: S('C2 C2', { meter: '4/4' }) }),
            say('A whole note: four beats.', { staff: S('C4', { meter: '4/4' }) }),
            pickC('How many beats is a half note?', ['1', '2', '4'], 1, { staff: S('E2') }),
            pickC('Which one lasts the longest?', ['Quarter note', 'Half note', 'Whole note'], 2),
            say('Bar lines split the music into bars. With 4/4 at the start, every bar has four beats.', { staff: S('C C C C | E2 E2 | G4', { meter: '4/4' }) }),
            pickC('This bar has a half note and two quarter notes. How many beats?', ['3', '4', '5'], 1, { staff: S('C2 D E', { meter: '4/4' }) }),
          ]),
          lesson('u3-long', 'Long notes', 'Half and whole notes', 'rhythm', 'R', tune({ hand: 'R', pool: () => notes('C4 D4 E4 F4 G4'), home: 60, rhythm: () => RHYTHMS.long })),
          lesson('u3-mix', 'Mixing note values', 'Count every beat', 'rhythm', 'R', tune({ hand: 'R', pool: C_G, home: 60 }), 1),
          chest('u3-chest'),
          practice('u3-p', ['rhythm', 'treble']),
          song('u3-lightly', COURSE_SONGS.lightly, 'Half notes and quarters'),
        ],
        test: { gen: tune({ hand: 'R', pool: C_G, home: 60 }), hands: 'R', skill: 'rhythm' },
      },
      {
        id: 'u4', title: 'The bass clef', sub: 'The left hand reads C to G',
        guide: [
          'The bass clef is for the left hand and the low notes.',
          'Its two dots sit either side of the F line.',
          'The C below middle C sits in the second space.',
          'Left hand: little finger (5) on C, thumb (1) on G.',
        ],
        nodes: [
          theory('u4-t', 'The bass clef', [
            say('Now the left hand! Low notes are written in the bass clef.', { pose: 'wave', staff: S('C, D, E, F, G,', { clef: 'bass' }) }),
            say('The two dots of the bass clef sit either side of the line for F.', { staff: S('F,4', { clef: 'bass' }) }),
            say('Put your left little finger on the C below middle C. Your thumb lands on G.', { keys: K(48, 60, [48, 50, 52, 53, 55], true) }),
            ...nameQuiz('u4-q', BASS_C_G(), 'bass'),
            playC('Play the C below middle C, with your left little finger.', [48], { staff: S('C,4', { clef: 'bass' }), keys: K(48, 60), exact: false }),
          ]),
          lesson('u4-cde', 'C, D and E in the bass', 'The left hand starts', 'bass', 'L', tune({ hand: 'L', pool: lv => notes(lv < 2 ? 'C3 D3 E3' : 'C3 D3 E3 F3'), home: 48 })),
          tech('u4-five', 'Left-hand five fingers', 'Little finger on C', 'bass', 'L', fiveFinger('L')),
          lesson('u4-cg', 'Left hand, C to G', 'The whole hand reads', 'bass', 'L', tune({ hand: 'L', pool: BASS_C_G, home: 48 })),
          chest('u4-chest'),
          listen('u4-echo', 'Echo in the bass', 'Listen, then play it back', 'bass', 'L', tune({ hand: 'L', pool: BASS_C_G, home: 48 })),
          song('u4-lune', COURSE_SONGS.lune, 'A French song, left hand', 'L'),
        ],
        test: { gen: tune({ hand: 'L', pool: lv => scale(48, 55 + lv * 2), home: 48 }), hands: 'L', skill: 'bass' },
      },
      {
        id: 'u5', title: 'Hands together', sub: 'Two clefs at once',
        guide: [
          'The grand staff joins the treble and bass clefs.',
          'Notes lined up one above the other are played at the same time.',
          'Start slowly: the music waits for both hands.',
          'Keep your eyes on the music, not on your hands.',
        ],
        nodes: [
          theory('u5-t', 'The grand staff', [
            say('The grand staff: treble on top for the right hand, bass below for the left.', { pose: 'read', staff: S('E2 G2 | c4', { left: 'C,4 | C,4' }) }),
            say('When two notes line up, one above the other, play them together.', { staff: S('E G E G', { left: 'C,2 G,,2' }) }),
            pickC('Two notes line up, one in each clef. You play them…', ['One after the other', 'At the same time'], 1),
            playC('Play C with both hands: middle C and the C below it, together.', [[60, 48]], { keys: K(48, 67, [48, 60]), exact: true }),
          ]),
          tech('u5-mirror', 'Mirror hands', 'Both thumbs start on C', 'together', 'both', contrary),
          lesson('u5-hold', 'The left hand holds', 'A tune over a long C', 'together', 'both', together({ pool: C_G, lh: () => ['C3:4'] })),
          lesson('u5-move', 'The left hand moves', 'C and G under the tune', 'together', 'both', together({ pool: C_G, lh: lv => (lv < 2 ? ['C3:2 G3:2'] : ['C3 E3 G3 E3']) }), 1),
          chest('u5-chest'),
          practice('u5-p', ['together', 'bass', 'treble']),
          song('u5-ode', COURSE_SONGS.odeBoth, 'Your first two-hand song', 'both'),
        ],
        test: { gen: together({ pool: C_G, lh: () => ['C3:2 G3:2'] }), hands: 'both', skill: 'together' },
      },
    ],
  },
  {
    id: 's2', title: 'Reading and rhythm', sub: 'Rests, eighths, intervals, ledger lines and waltz time',
    units: [
      {
        id: 'u6', title: 'Rests', sub: 'The sound of silence',
        guide: [
          'A rest is a beat of silence: lift your hand, keep counting.',
          'A quarter rest lasts one beat.',
          'A half rest sits on a line like a hat: two beats.',
          'A whole rest hangs under a line: a whole bar.',
        ],
        nodes: [
          theory('u6-t', 'Rests', [
            say('A rest means: stay quiet, but keep counting.', { pose: 'idle', staff: S('C z E z | G2 z2', { meter: '4/4' }) }),
            say('A quarter rest: one beat of silence.', { staff: S('z z z z', { meter: '4/4' }) }),
            say('A half rest sits on the line like a little hat: two beats. A whole rest hangs below the line: a whole bar.', { staff: S('z2 z2 | z4', { meter: '4/4' }) }),
            pickC('How many beats is a half rest?', ['1', '2', '4'], 1, { staff: S('z2') }),
            pickC('What do you do on a rest?', ['Hold the last note', 'Lift your hand and count', 'Play softly'], 1),
          ]),
          lesson('u6-rests', 'Beats of silence', 'Lift and count', 'rhythm', 'R', tune({ hand: 'R', pool: C_G, home: 60, rests: 0.25 })),
          listen('u6-echo', 'Hear the gaps', 'Listen, then play it back', 'rhythm', 'R', tune({ hand: 'R', pool: C_G, home: 60, rests: 0.25 })),
          lesson('u6-left', 'Rests in the left hand', 'Silence in the bass', 'bass', 'L', tune({ hand: 'L', pool: BASS_C_G, home: 48, rests: 0.25 })),
          chest('u6-chest'),
          practice('u6-p', ['rhythm', 'bass', 'treble']),
          song('u6-saints', COURSE_SONGS.saints, 'Every phrase starts with a rest'),
        ],
        test: { gen: tune({ hand: 'R', pool: C_G, home: 60, rests: 0.25 }), hands: 'R', skill: 'rhythm' },
      },
      {
        id: 'u7', title: 'Eighth notes', sub: 'Two notes in one beat',
        guide: [
          'Two eighth notes fit in one beat.',
          'Count them “1 and 2 and”.',
          'Eighth notes in pairs are joined by a beam.',
          'Keep the beat steady: the eighths fit inside it.',
        ],
        nodes: [
          theory('u7-t', 'Eighth notes', [
            say('Eighth notes are quick: two of them fit in one beat. In pairs they are joined by a beam.', { pose: 'keys', staff: S('C/2D/2 E/2F/2 G2', { meter: '4/4' }) }),
            say('Count them “1 and 2 and”: the numbers fall on the beat, the “and” in between.', { staff: S('C/2C/2 D/2D/2 E/2E/2 F/2F/2', { meter: '4/4' }) }),
            pickC('How many eighth notes make one beat?', ['1', '2', '4'], 1),
            pickC('Two eighths and three quarters: how many beats?', ['3', '4', '5'], 1, { staff: S('C/2D/2 E F G', { meter: '4/4' }) }),
          ]),
          lesson('u7-pairs', 'Pairs of eighths', 'Count “1 and”', 'eighths', 'R', ex('eighths')),
          tech('u7-quick', 'Quick fingers', 'Five-finger runs in eighths', 'eighths', 'R', fiveFinger('R'), 1),
          chest('u7-chest'),
          song('u7-hot', COURSE_SONGS.hot, 'Eighth notes in a street cry'),
          practice('u7-p', ['eighths', 'rhythm']),
          song('u7-frere', COURSE_SONGS.frere, 'Eighths in a round'),
        ],
        test: { gen: ex('eighths'), hands: 'R', skill: 'eighths' },
      },
      {
        id: 'u8', title: 'Intervals', sub: 'Steps, skips and leaps',
        guide: [
          'An interval is the distance between two notes: count both of them.',
          'A 2nd is a step: line to space.',
          'A 3rd is a skip: line to line, or space to space.',
          '4ths and 5ths are leaps. C up to G is a 5th, the start of “Twinkle”.',
        ],
        nodes: [
          theory('u8-t', 'Intervals', [
            say('An interval is the distance between two notes. Count both notes: C to E is C-D-E, a 3rd.', { pose: 'read', keys: K(60, 72, [60, 64], true) }),
            say('A 2nd is a step: line to space, or space to line.', { staff: S('C D E D C2') }),
            say('A 3rd is a skip: line to line, or space to space.', { staff: S('C E G E C2') }),
            say('4ths and 5ths are leaps. C up to G is a 5th.', { staff: S('C F C G C2') }),
            pickC('C up to E is a…', ['2nd', '3rd', '5th'], 1),
            pickC('What is this interval?', ['2nd', '3rd', '4th'], 1, { staff: S('E2 G2') }),
            playC('Play a 5th: C, then G.', [60, 67], { keys: K(60, 72) }),
          ]),
          lesson('u8-steps', 'Steps and skips', '2nds and 3rds', 'leaps', 'R', intervals([2, 3])),
          listen('u8-ear', 'Hear the jump', 'Step, skip or leap?', 'leaps', 'R', intervals([2, 3, 5])),
          lesson('u8-leaps', '4ths and 5ths', 'Bigger jumps', 'leaps', 'R', intervals([3, 4, 5]), 1),
          chest('u8-chest'),
          practice('u8-p', ['leaps', 'treble']),
          song('u8-twinkle', COURSE_SONGS.twinkleRH, 'It starts with a 5th'),
        ],
        test: { gen: intervals([2, 3, 4, 5]), hands: 'R', skill: 'leaps' },
      },
      {
        id: 'u9', title: 'Ledger lines', sub: 'Notes beyond the staff',
        guide: [
          'Ledger lines are short extra lines for notes above or below the staff.',
          'Middle C sits on one ledger line, between the two clefs.',
          'A below middle C hangs under two ledger lines in the treble clef.',
          'Count from a note you know: line, space, line.',
        ],
        nodes: [
          theory('u9-t', 'Ledger lines', [
            say('Notes can go above and below the staff. Little extra lines, ledger lines, help us read them.', { pose: 'read', staff: S('A, B, C D | a b c\' d\'') }),
            say('Middle C sits on a ledger line, right between the two clefs.', { staff: S('C4') }),
            say('Below middle C in the treble clef come B, then A, on and under more ledger lines.', { staff: S('C B, A, B, C4'), keys: K(55, 67, [57, 59, 60], true) }),
            ...nameQuiz('u9-q', notes('A3 B3 C4 A5 B5 C6')),
            playC('Play the A below middle C.', [57], { staff: S('A,4'), keys: K(53, 67), exact: true }),
          ]),
          lesson('u9-low', 'Below the staff', 'Down to A', 'ledger', 'R', tune({ hand: 'R', pool: lv => scale(lv < 2 ? 57 : 55, 65), home: 60 })),
          lesson('u9-high', 'Above the staff', 'Up to C', 'ledger', 'R', tune({ hand: 'R', pool: lv => scale(74, 81 + lv * 2), home: 79 }), 1),
          chest('u9-chest'),
          practice('u9-p', ['ledger', 'treble']),
          song('u9-jingle', COURSE_SONGS.jingle, 'Down to middle C and back'),
        ],
        test: { gen: ex('ledger'), hands: 'R', skill: 'ledger' },
      },
      {
        id: 'u10', title: 'Waltz time and dots', sub: '3/4, dotted halves, long-short',
        guide: [
          'In 3/4 every bar has three beats: ONE two three.',
          'A dot adds half the note again: a dotted half note is 3 beats.',
          'A dotted quarter and an eighth: “long, short”.',
          'Feel the strong first beat of every bar.',
        ],
        nodes: [
          theory('u10-t', 'Counting in three', [
            say('Some music counts in threes: ONE two three, ONE two three. That is 3/4 time, the waltz.', { pose: 'cheer', staff: S('C E G | c3', { meter: '3/4' }) }),
            say('A dot makes a note half as long again. A half note is 2 beats, so a dotted half note is 3.', { staff: S('E3 | G3', { meter: '3/4' }) }),
            say('A dotted quarter and an eighth sound “long, short”.', { staff: S('C3/2 D/2 E2 | E3/2 F/2 G2', { meter: '4/4' }) }),
            pickC('How many beats in a bar of 3/4?', ['2', '3', '4'], 1),
            pickC('A dotted half note lasts…', ['2 beats', '3 beats', '4 beats'], 1, { staff: S('G3', { meter: '3/4' }) }),
          ]),
          lesson('u10-waltz', 'Count in three', 'ONE two three', 'rhythm', 'R', tune({ hand: 'R', pool: C_G, home: 60, waltz: true })),
          lesson('u10-dotted', 'Long, short', 'Dotted rhythms', 'dotted', 'R', ex('dotted')),
          tech('u10-oompah', 'Oom-pah-pah', 'A waltz left hand', 'chords', 'L', leftAlone('waltz', PROGS.waltz)),
          chest('u10-chest'),
          song('u10-birthday', COURSE_SONGS.birthday, 'In three, with a pick-up'),
          song('u10-london', COURSE_SONGS.london, 'Dotted rhythms'),
          song('u10-grace', COURSE_SONGS.grace, 'A hymn in three'),
        ],
        test: { gen: tune({ hand: 'R', pool: C_G, home: 60, waltz: true }), hands: 'R', skill: 'dotted' },
      },
    ],
  },
  {
    id: 's3', title: 'Keys and harmony', sub: 'Sharps and flats, scales, chords and progressions',
    units: [
      {
        id: 'u11', title: 'Sharps and flats', sub: 'The black keys get names',
        guide: [
          'A sharp ♯ raises a note to the very next key up.',
          'A flat ♭ lowers it to the very next key down.',
          'So F♯ and G♭ are the same black key, with two names.',
          'A natural ♮ cancels a sharp or a flat.',
          'From a key to the very next one is a half step; two half steps make a whole step.',
        ],
        nodes: [
          theory('u11-t', 'Sharps, flats and naturals', [
            say('The black keys have names too! A sharp ♯ means the very next key up.', { pose: 'wink', staff: S('F2 ^F2'), keys: K(60, 72, [65, 66], true) }),
            say('A flat ♭ means the very next key down. So this black key is F♯, and also G♭.', { staff: S('G2 _G2'), keys: K(60, 72, [66, 67]) }),
            say('From a key to the very next one, black or white, is a half step. Two half steps make a whole step.', { keys: K(60, 72, [64, 65, 66]) }),
            say('A natural ♮ cancels a sharp or flat.', { staff: S('^F2 =F2') }),
            pickC('F♯ is the key just…', ['Left of F', 'Right of F'], 1),
            pickC('B♭ is the key just…', ['Left of B', 'Right of B'], 0),
            playC('Play F♯.', [66], { keys: K(60, 72) }),
            playC('Now play B♭.', [70], { keys: K(60, 72) }),
          ]),
          lesson('u11-fsharp', 'Meet F♯', 'A black key in the tune', 'accidentals', 'R', tune({ hand: 'R', pool: () => notes('D4 E4 F#4 G4 A4'), home: 67 })),
          lesson('u11-bflat', 'Meet B♭', 'And one more', 'accidentals', 'R', tune({ hand: 'R', pool: () => notes('F4 G4 A4 Bb4 C5'), home: 65 })),
          listen('u11-ear', 'Sharp or natural?', 'Hear the difference', 'accidentals', 'R', tune({ hand: 'R', pool: () => notes('D4 E4 F4 F#4 G4'), home: 67 })),
          chest('u11-chest'),
          practice('u11-p', ['accidentals', 'treble']),
          song('u11-greensleeves', COURSE_SONGS.greensleeves, 'G♯ and F♯ in an old English tune'),
        ],
        test: { gen: ex('accidentals'), hands: 'R', skill: 'accidentals' },
      },
      {
        id: 'u12', title: 'Key signatures', sub: 'G major and F major',
        guide: [
          'A key signature at the start of each line says which notes are always sharp or flat.',
          'G major has one sharp: every F is F♯.',
          'F major has one flat: every B is B♭.',
          'Pieces usually end on their home note: G in G major, F in F major.',
        ],
        nodes: [
          theory('u12-t', 'Key signatures', [
            say('Writing ♯ on every F gets tiring. A key signature says it once, for the whole piece.', { pose: 'read', staff: S('G A B c d2', { key: 'G' }) }),
            say('One sharp, on the F line: that is G major. Every F is played F♯.', { staff: S('d c B A G2', { key: 'G' }), keys: K(67, 79, [66, 78]) }),
            say('One flat, on the B line: that is F major. Every B is played B♭.', { staff: S('F G A B c2', { key: 'F' }), keys: K(65, 77, [70]) }),
            pickC('One sharp in the key signature. Which key?', ['C major', 'G major', 'F major'], 1, { staff: S('G4', { key: 'G' }) }),
            pickC('In F major, every B is played…', ['B', 'B♭', 'B♯'], 1),
          ]),
          lesson('u12-g', 'In G major', 'Every F is sharp', 'accidentals', 'R', tune({ hand: 'R', pool: lv => scale(62, 72 + lv, 1), home: 67, fifths: 1 })),
          lesson('u12-f', 'In F major', 'Every B is flat', 'accidentals', 'R', tune({ hand: 'R', pool: lv => scale(60, 70 + lv, -1), home: 65, fifths: -1 })),
          chest('u12-chest'),
          song('u12-macdonald', COURSE_SONGS.macdonald, 'In G major'),
          practice('u12-p', ['accidentals', 'treble', 'leaps']),
          song('u12-minuet', COURSE_SONGS.minuet, 'Petzold, both hands', 'both'),
        ],
        test: { gen: tune({ hand: 'R', pool: lv => scale(62, 72 + lv, 1), home: 67, fifths: 1 }), hands: 'R', skill: 'accidentals' },
      },
      {
        id: 'u13', title: 'Scales', sub: 'Thumb under: the pianist’s trick',
        guide: [
          'A major scale: whole, whole, half, whole, whole, whole, half.',
          'Right hand going up: 1 2 3, thumb under, 1 2 3 4 5.',
          'Coming down: 5 4 3 2 1, then finger 3 crosses over.',
          'Keep the wrist level and still while the thumb passes under.',
        ],
        nodes: [
          theory('u13-t', 'The major scale', [
            say('A scale is eight notes in a row, from one note up to the next with the same name.', { pose: 'keys', staff: S('C D E F G A B c') }),
            say('Every major scale has the same steps: whole, whole, half, whole, whole, whole, half.', { keys: K(60, 72, [60, 62, 64, 65, 67, 69, 71, 72], true) }),
            say('Five fingers, eight notes? After finger 3 on E, slide your thumb under to F. Then 1 2 3 4 5 to the top.', { keys: K(60, 72, [64, 65]) }),
            pickC('Right hand going up the C scale: where does the thumb pass under?', ['After E, onto F', 'After G, onto A', 'It never does'], 0),
            pickC('Between E and F there is a…', ['Half step', 'Whole step'], 0, { keys: K(60, 67, [64, 65], true) }),
          ]),
          tech('u13-c', 'C major scale', 'Right hand, thumb under', 'leaps', 'R', scaleRun(0, 'R')),
          tech('u13-cl', 'C major, left hand', 'Finger 3 crosses over', 'bass', 'L', scaleRun(0, 'L')),
          tech('u13-g', 'G major scale', 'With F♯', 'accidentals', 'R', scaleRun(1, 'R')),
          chest('u13-chest'),
          tech('u13-f', 'F major scale', 'With B♭', 'accidentals', 'R', scaleRun(-1, 'R')),
          song('u13-joy', COURSE_SONGS.joy, 'A scale, top to bottom', 'both'),
        ],
        test: { gen: scaleRun(0, 'R'), hands: 'R', skill: 'leaps' },
      },
      {
        id: 'u14', title: 'Triads', sub: 'Your first chords',
        guide: [
          'A triad is three notes stacked in 3rds: root, 3rd, 5th.',
          'Play a C triad with fingers 1, 3 and 5: C E G.',
          'Major sounds bright; lower the middle note a half step and it turns minor, sad.',
          'On the staff a triad looks like a snowman: line-line-line or space-space-space.',
        ],
        nodes: [
          theory('u14-t', 'Triads', [
            say('A chord is notes played together. A triad stacks three: play one, skip one, play one, skip one, play one.', { pose: 'keys', keys: K(60, 72, [60, 64, 67], true), staff: S('[CEG]4') }),
            say('It is named after its bottom note, the root. C E G is the C major chord.', { staff: S('[CEG]2 [FAc]2 | [GBd]4') }),
            say('Lower the middle note a half step and it turns minor: C E♭ G. Hear how sad it is?', { staff: S('[CEG]2 [C_EG]2') }),
            pickC('The notes of the G major triad?', ['G B D', 'G A B', 'G C E'], 0),
            pickC('A minor chord sounds more…', ['Bright', 'Sad'], 1),
            playC('Play the C major chord: C, E and G together.', [[60, 64, 67]], { keys: K(60, 72, [60, 64, 67]) }),
          ]),
          lesson('u14-rh', 'Triads, right hand', 'C, F and G', 'chords', 'R', triads(['C', 'F', 'G', 'C'], 'R')),
          lesson('u14-lh', 'Triads, left hand', 'Chords in the bass', 'chords', 'L', triads(['C', 'F', 'G', 'C'], 'L')),
          listen('u14-ear', 'Major or minor?', 'Bright or sad', 'chords', 'R', triads(['C', 'Am', 'F', 'Dm', 'G'], 'R', true)),
          chest('u14-chest'),
          practice('u14-p', ['chords', 'together']),
          song('u14-twinkle', COURSE_SONGS.twinkle, 'Melody over chords', 'both'),
        ],
        test: { gen: triads(['C', 'F', 'G', 'C'], 'L'), hands: 'L', skill: 'chords' },
      },
      {
        id: 'u15', title: 'Chord progressions', sub: 'I, IV and V',
        guide: [
          'Chords are numbered by the scale note they start on. In C: C is I, F is IV, G is V.',
          'I-IV-V-I is in thousands of songs.',
          'Move to the nearest notes: C-E-G, C-F-A, B-D-G.',
          'The left hand plays the chords, the right hand the tune.',
        ],
        nodes: [
          theory('u15-t', 'I, IV and V', [
            say('In C major, C is chord I, F is chord IV and G is chord V.', { pose: 'read', staff: S('[CEG]2 [FAc]2 | [GBd]2 [CEG]2') }),
            say('Jumping between chords is hard. Move to the nearest notes instead: C-E-G, then C-F-A, then B-D-G.', { staff: S('[CEG]2 [CFA]2 | [B,DG]2 [CEG]2') }),
            pickC('In C major, chord V is…', ['F', 'G', 'A'], 1),
            pickC('Which is chord IV in C major?', ['F A C', 'G B D', 'D F A'], 0),
          ]),
          lesson('u15-hold', 'Chords under a tune', 'The left hand holds chords', 'chords', 'both', accompany('hold', PROGS.hold)),
          lesson('u15-roots', 'Roots and fifths', 'A bass line that moves', 'together', 'both', accompany('roots', PROGS.hold), 1),
          chest('u15-chest'),
          practice('u15-p', ['chords', 'together', 'bass']),
          song('u15-saints', COURSE_SONGS.saintsBoth, 'Both hands', 'both'),
          song('u15-jingle', COURSE_SONGS.jingleBoth, 'With I, IV and V', 'both'),
        ],
        test: { gen: accompany('hold', PROGS.hold), hands: 'both', skill: 'chords' },
      },
    ],
  },
  {
    id: 's4', title: 'Styles', sub: 'Classical, pop, blues, film music and jazz',
    units: [
      {
        id: 'u16', title: 'Classical', sub: 'Alberti bass and the waltz',
        guide: [
          'Alberti bass breaks a chord into bottom, top, middle, top, as Mozart did.',
          'Keep it light and even so the tune can sing on top.',
          'A classical waltz: a bass note on beat 1, the chord on 2 and 3.',
        ],
        nodes: [
          theory('u16-t', 'The classical style', [
            say('Mozart’s trick: break the chord into a pattern. Bottom, top, middle, top. It’s called Alberti bass.', { pose: 'grad', staff: S('C,/2G,/2E,/2G,/2 C,/2G,/2E,/2G,/2 C,/2A,/2F,/2A,/2 C,/2G,/2E,/2G,/2', { clef: 'bass' }) }),
            say('The left hand stays light and even, so the tune can sing on top.'),
            say('In a waltz, the left hand plays the bass note on beat 1 and the chord on 2 and 3: oom-pah-pah!', { staff: S('C, [E,G,] [E,G,] | G,, [B,,F,] [B,,F,]', { clef: 'bass', meter: '3/4' }) }),
            pickC('Alberti bass plays a chord’s notes in which order?', ['Bottom, top, middle, top', 'Top, middle, bottom', 'All together'], 0),
          ]),
          tech('u16-alberti', 'Alberti bass', 'Bottom, top, middle, top', 'bass', 'L', leftAlone('alberti', PROGS.hold)),
          lesson('u16-tune', 'A tune over Alberti', 'Mozart style', 'together', 'both', accompany('alberti', PROGS.hold)),
          chest('u16-chest'),
          song('u16-sonata', COURSE_SONGS.sonata, 'Mozart, simplified', 'both'),
          lesson('u16-waltz', 'Waltz', 'Oom-pah-pah', 'together', 'both', accompany('waltz', PROGS.waltz)),
          song('u16-waltz-song', COURSE_SONGS.waltz, 'Written for Pip', 'both'),
          song('u16-elise', COURSE_SONGS.elise, 'Beethoven, the opening', 'both'),
        ],
        test: { gen: accompany('alberti', PROGS.hold), hands: 'both', skill: 'together' },
      },
      {
        id: 'u17', title: 'Pop', sub: 'Four chords and a groove',
        guide: [
          'So many pop songs use the same four chords: C, G, Am and F (I-V-vi-IV).',
          'Am is the minor chord on A: A C E.',
          'Left hand: the root with its octave, on the beat.',
          'A little push before beat 3 gives the groove.',
        ],
        nodes: [
          theory('u17-t', 'Four chords', [
            say('A huge number of pop songs use just four chords: C, G, Am and F.', { pose: 'cheer', staff: S('[CEG]2 [B,DG]2 | [A,CE]2 [A,CF]2') }),
            say('Am is the minor chord on A: A C E. In C major it’s chord vi.', { keys: K(57, 69, [57, 60, 64], true) }),
            say('The left hand plays the root with its octave. A little push just before beat 3 gives it the groove.', { staff: S('[C,C]3/2 G,/2 [C,C]2 | [G,,G,]3/2 D,/2 [G,,G,]2', { clef: 'bass', meter: '4/4' }) }),
            pickC('The four pop chords in C?', ['C G Am F', 'C D E F', 'C F G C'], 0),
          ]),
          tech('u17-lh', 'Pop left hand', 'Roots, octaves and a push', 'bass', 'L', leftAlone('pop', PROGS.pop)),
          lesson('u17-four', 'Four chords', 'A tune on top', 'chords', 'both', accompany('pop', PROGS.pop)),
          listen('u17-ear', 'Hear the change', 'Listen, then play', 'chords', 'both', accompany('pop', PROGS.pop), 1),
          chest('u17-chest'),
          song('u17-pop', COURSE_SONGS.pop, 'Written for Pip', 'both'),
          song('u17-canon', COURSE_SONGS.canon, 'Pachelbel’s chords', 'both'),
        ],
        test: { gen: accompany('pop', PROGS.pop), hands: 'both', skill: 'chords' },
      },
      {
        id: 'u18', title: 'Blues', sub: 'Twelve bars and blue notes',
        guide: [
          'The 12-bar blues: four bars of C, two of F, two of C, then G, F, C, C.',
          'The C blues scale: C E♭ F F♯ G B♭ C.',
          'Left-hand boogie: root and fifth, then root and sixth.',
          'Call and answer: play a riff, then leave a gap.',
        ],
        nodes: [
          theory('u18-t', 'The blues', [
            say('The blues has its own scale, with “blue notes”: C E♭ F F♯ G B♭ C.', { pose: 'wink', staff: S('C _E F ^F G _B c2'), keys: K(60, 72, [60, 63, 65, 66, 67, 70, 72]) }),
            say('The 12-bar blues goes C C C C, F F, C C, G F, C C, and round again.'),
            say('The left hand rocks between the fifth and the sixth: that’s the boogie.', { staff: S('[C,G,] [C,A,] [C,G,] [C,A,]', { clef: 'bass', meter: '4/4' }) }),
            pickC('How many bars in a classic blues?', ['8', '12', '16'], 1),
            pickC('Which is a blue note in C?', ['E♭', 'E', 'D'], 0),
            playC('Play the first three notes of the blues scale: C, E♭, F.', [60, 63, 65], { keys: K(60, 72) }),
          ]),
          tech('u18-scale', 'The blues scale', 'C E♭ F F♯ G B♭ C', 'accidentals', 'R', bluesScale('R')),
          tech('u18-boogie', 'Boogie left hand', 'Fifth, sixth, fifth, sixth', 'bass', 'L', leftAlone('blues', PROGS.blues)),
          lesson('u18-riffs', 'Riffs', 'Call and answer', 'together', 'both', accompany('blues', PROGS.blues)),
          chest('u18-chest'),
          song('u18-blues', COURSE_SONGS.blues, 'Twelve bars, written for Pip', 'both'),
        ],
        test: { gen: accompany('blues', PROGS.blues), hands: 'both', skill: 'together' },
      },
      {
        id: 'u19', title: 'Film and arpeggios', sub: 'Chords that flow',
        guide: [
          'An arpeggio plays a chord’s notes one after another.',
          'Let the notes flow into each other, smooth and even.',
          'Film music loves slow arpeggios under a long melody.',
          'Minor chords sound mysterious: try A minor.',
        ],
        nodes: [
          theory('u19-t', 'Arpeggios', [
            say('An arpeggio is a chord played one note at a time. It ripples.', { pose: 'idle', staff: S('C E G c G E C2') }),
            say('Under a slow tune, flowing arpeggios sound like a film score.', { staff: S('A,/2C/2E/2A/2 E/2C/2A,/2C/2 F,/2A,/2C/2F/2 C/2A,/2F,/2A,/2') }),
            pickC('An arpeggio plays a chord’s notes…', ['All at once', 'One after another'], 1),
            playC('Play a C arpeggio: C, E, G, C.', [60, 64, 67, 72], { keys: K(60, 72), exact: true }),
          ]),
          tech('u19-arp', 'Arpeggios, right hand', 'C, G, Am and F', 'leaps', 'R', arpeggio(['C', 'G', 'Am', 'F'], 'R')),
          tech('u19-arpl', 'Arpeggios, left hand', 'Down in the bass', 'bass', 'L', arpeggio(['C', 'Am', 'F', 'G'], 'L')),
          lesson('u19-film', 'Flowing chords', 'A tune over arpeggios', 'together', 'both', accompany('arp', PROGS.hold)),
          chest('u19-chest'),
          song('u19-rising', COURSE_SONGS.rising, 'A folk song in arpeggios', 'both'),
        ],
        test: { gen: arpeggio(['C', 'G', 'Am', 'F'], 'R'), hands: 'R', skill: 'leaps' },
      },
      {
        id: 'u20', title: 'Jazz', sub: 'Seventh chords and ii-V-I',
        guide: [
          'A seventh chord stacks one more 3rd on a triad: C E G B is Cmaj7.',
          'Dm7 is D F A C. G7 is G B D F: it wants to go home to C.',
          'ii-V-I (Dm7, G7, Cmaj7) is the most played progression in jazz.',
          'Left-hand shells: just the root, 3rd and 7th.',
        ],
        nodes: [
          theory('u20-t', 'Seventh chords', [
            say('Stack one more 3rd on a triad and you get a seventh chord. C E G B is Cmaj7: dreamy.', { pose: 'grad', staff: S('[CEG]2 [CEGB]2') }),
            say('Dm7 is D F A C. G7 is G B D F, and it really wants to go home to C.', { staff: S('[DFAc]2 [GBdf]2 | [CEGB]4') }),
            say('Jazz players love ii-V-I: Dm7, G7, Cmaj7. The left hand plays just root, 3rd and 7th: a shell.', { staff: S('[D,F,C]2 [G,,B,,F,]2 | [C,E,B,]4', { clef: 'bass' }) }),
            pickC('The notes of Cmaj7?', ['C E G B', 'C E G', 'C F A'], 0),
            pickC('In C major, ii-V-I is…', ['Dm7 G7 Cmaj7', 'C F G', 'Am F C'], 0),
          ]),
          lesson('u20-shells', 'Shell chords', 'Root, 3rd, 7th', 'chords', 'L', triads(['Dm7', 'G7', 'Cmaj7', 'Cmaj7'], 'L')),
          lesson('u20-251', 'ii-V-I', 'Jazz harmony', 'chords', 'both', accompany('jazz', PROGS.jazz)),
          listen('u20-ear', 'Jazz ears', 'Listen, then play', 'chords', 'both', accompany('jazz', PROGS.jazz), 1),
          chest('u20-chest'),
          song('u20-cool', COURSE_SONGS.cool, 'Written for Pip', 'both'),
        ],
        test: { gen: accompany('jazz', PROGS.jazz), hands: 'both', skill: 'chords' },
      },
    ],
  },
];

export const UNITS: Unit[] = SECTIONS.flatMap(s => s.units);
export const sectionOf = (u: Unit) => SECTIONS.find(s => s.units.includes(u))!;

/** The trophy at the end of every unit is its test. */
export const trophyOf = (u: Unit): PathNode => ({ id: `${u.id}-test`, kind: 'trophy', title: `${u.title}: unit test`, sub: 'Pass with 2 stars to finish the unit', hands: u.test.hands, skill: u.test.skill, gen: u.test.gen, base: 1 });
export const nodesOf = (u: Unit): PathNode[] => [...u.nodes, trophyOf(u)];
export const ALL_NODES: { node: PathNode; unit: Unit }[] = UNITS.flatMap(u => nodesOf(u).map(node => ({ node, unit: u })));
