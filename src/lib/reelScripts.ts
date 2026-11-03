/**
 * The words on each song's reels, written by hand after reading the score bar by bar (what each
 * hand plays, where the patterns come back, where the hand moves). No model is asked at runtime.
 *
 * Each script is for one exact version of a song's notes (`version` is the reading's hash,
 * src/lib/reading.ts), keyed by the song's id (or the slot an imported file fills). A song with no
 * script here, or a MIDI file whose notes differ, gets the words the rules write from the notes.
 * To write one: run the app, `await window.__reelFacts('song-id')` in the console lists every reel
 * with its bars, bass and right hand, and `readSong` gives the full score as text.
 *
 * Limits on screen: title 32 characters, hook 48, a cue 56, the tip 80. No em or en dashes.
 */
import type { ReelWords } from './reelShape';

type Script = { version: string; reels: Record<string, ReelWords> };
const w = (title: string, hook: string, cues: [number, string][], tip: string): ReelWords => ({ title, hook, cues: cues.map(([bar, text]) => ({ bar, text })), tip });

export const REEL_SCRIPTS: Record<string, Script> = {
  'gymnopedie-1': {
    version: 'xjnbbq',
    reels: {
      intro: w('Gymnopédie No. 1', 'A slow waltz that floats over two chords', [
        [1, 'The left hand rocks between two chords'],
        [5, 'The tune comes in high, on beat 2'],
      ], 'It never hurries. Count 1 2 3, slow and even.'),
      'p1-L': w('Part 1: left hand', 'Bass on 1, chord on 2: G, then D, again', [
        [1, 'Low G, then jump up to the chord B D F#'],
        [2, 'Low D, then the chord A C# F#'],
        [3, 'Back to G: the same two bars again'],
        [5, 'Still G then D, all through the part'],
      ], 'Look at where the hand lands, not at the jump. Let the low note ring.'),
      'p1-R': w('Part 1: right hand', 'The tune starts on beat 2: F# A', [
        [5, 'Rest on beat 1, then F# and A'],
        [6, 'G, F#, then down to C#'],
        [7, 'Climb back up: B, C#, D'],
        [8, 'Land on A and hold the whole bar'],
      ], 'Each note gets one beat. Play them soft and joined.'),
      'p1-both': w('Part 1: both hands', 'The tune floats over the rocking chords', [
        [1, 'Left hand alone for four bars: count them'],
        [5, 'The right hand joins on beat 2, with the chord'],
        [6, 'Beat 1: low D and high G together'],
        [7, 'Beat 1: low G and B together'],
      ], 'Four bars of left hand first. Count them, then the tune joins.'),

      'p3-L': w('Part 3: left hand', 'The bass walks down: F#, B, E, D, A', [
        [17, 'Low F#, then the chord A C# F#'],
        [18, 'A big drop to low B, then B D F#'],
        [19, 'Low E, and only two notes on top: G B'],
        [20, 'Same low E, now B D G'],
        [21, 'Low D, then F A D'],
        [22, 'The lowest note yet: A, then A C E'],
        [23, 'Low D, then G B E'],
      ], 'The low notes move a lot. Find each one before you play it.'),
      'p3-R': w('Part 3: right hand', 'Long notes, then a little climb', [
        [17, 'C#: hold it for three beats'],
        [18, 'Up to F#, three beats again'],
        [19, 'Down to E and hold it for three bars'],
        [22, 'Climb up: A, B, C'],
        [23, 'Then down: E, D, B'],
      ], 'Hold the long notes their full length. Count them.'),
      'p3-both': w('Part 3: both hands', 'Hold the tune while the left keeps rocking', [
        [17, 'Both hands on beat 1: low F#, high C#'],
        [19, 'The right hand holds E for three bars'],
        [20, 'Keep counting: the left hand carries on'],
        [22, 'Now the right moves on every beat'],
      ], 'Let the long notes sing while the left hand keeps time.'),

      'p4-L': w('Part 4: left hand', 'One low D under every bar', [
        [25, 'Low D stays: the chord on top is C E A'],
        [26, 'Same D, the chord C F# A'],
        [27, 'Same D, the chord moves up: A C F'],
        [28, 'Same D, now A C E'],
        [29, 'Down to D G B'],
        [30, 'Back to C E A, like the start'],
      ], 'The low D never moves. Only the chord on top changes.'),
      'p4-R': w('Part 4: right hand', 'D high and D low, then a climb to A', [
        [25, 'High D held, and a low D on beat 2'],
        [26, 'Low D, then high D again'],
        [27, 'Climb: E, F, G'],
        [28, 'A at the top, then C and D'],
        [29, 'E, then two notes together, then B'],
        [30, 'High D and low D again'],
      ], 'The two D notes are an octave apart: thumb low, little finger high.'),
      'p4-both': w('Part 4: both hands', 'The low D holds it all together', [
        [25, 'Three D notes: one low left, two in the right'],
        [27, 'The right hand climbs, the left keeps its D'],
        [29, 'Beat 2: both hands play chords together'],
      ], 'Keep it soft. The climb in the right hand is the music.'),

      'p5-L': w('Part 5: left hand', 'The bass walks to the end: F#, B, E, A, D', [
        [33, 'Low F#, then A C# F#'],
        [34, 'Drop to low B, then B D F#'],
        [35, 'Low E, then C# E A'],
        [36, 'Same E, now four notes: A C# F# A'],
        [37, 'The rhythm changes: a note on every beat'],
        [38, 'A and G together, held'],
        [39, 'D, A, D: the end of the phrase'],
      ], 'Bar 37 breaks the pattern. Watch it slowly.'),
      'p5-R': w('Part 5: right hand', 'Little steps, then two big chords', [
        [33, 'F#, held for three beats'],
        [34, 'B, A, B: a little turn'],
        [35, 'C#, D, E: step up'],
        [36, 'The same steps again'],
        [37, 'Hold F# while D and G play under it'],
        [38, 'A four-note chord: C E A C'],
        [39, 'Then D F# A D'],
      ], 'For the chords, shape the hand in the air before you play.'),
      'p5-both': w('Part 5: both hands', 'Two big chords end the phrase together', [
        [33, 'Both hands on beat 1'],
        [35, 'The right steps up, the left keeps rocking'],
        [37, 'Here the left plays on every beat'],
        [38, 'Both hands together: a held chord'],
        [39, 'And the last one, held'],
      ], 'Play the last two chords with both hands at once.'),

      'p6-L': w('Part 6: left hand', 'The start again: D, then G, rocking', [
        [41, 'Low D, then A C# F#'],
        [42, 'Low G, then B D F#'],
        [44, 'Still the same two chords'],
      ], 'You know this already: the same chords as part 1.'),
      'p6-R': w('Part 6: right hand', 'The first tune again, ending on a long F#', [
        [44, 'F# and A, on beats 2 and 3'],
        [45, 'G, F#, down to C#'],
        [46, 'Up again: B, C#, D'],
        [47, 'A, held'],
        [48, 'Down to F#, held for four bars'],
      ], 'The same tune as part 1. Let the last F# ring.'),
      'p6-both': w('Part 6: both hands', 'Part 1 again, both hands together', [
        [41, 'Three bars of left hand alone'],
        [44, 'The tune joins on beat 2'],
        [45, 'Low D and high G together on beat 1'],
      ], 'Count the three bars before the tune comes in.'),

      'p8-L': w('Part 8: left hand', 'Like part 3: the bass walks down to A', [
        [57, 'Low B, then B D F#'],
        [58, 'Low E, then G B'],
        [59, 'Same E, now B D G'],
        [60, 'Low D, then F A D'],
        [61, 'Down to low A, then A C E'],
        [62, 'Low D, then G B E'],
        [63, 'Same D, the chord D G B'],
      ], 'This is part 3 again: the same low notes.'),
      'p8-R': w('Part 8: right hand', 'High F#, a long low E, then a climb', [
        [57, 'F#, held three beats'],
        [58, 'Down to E: hold it for three bars'],
        [61, 'A, B, C: climb'],
        [62, 'E, D, B: come down'],
        [63, 'D, then two notes together, then B'],
      ], 'The same as part 3, with a new last bar.'),
      'p8-both': w('Part 8: both hands', 'Hold the long notes, keep the left moving', [
        [57, 'Both on beat 1: low B, high F#'],
        [58, 'The right hand holds E for three bars'],
        [61, 'Now the right moves on every beat'],
        [63, 'Beat 2: both hands play chords'],
      ], 'Count the long E: three full bars.'),

      'p9-L': w('Part 9: left hand', 'One low D again, then an E at the end', [
        [65, 'Low D, the chord C F# A'],
        [66, 'Same D, now A C F'],
        [67, 'Same D, A C E'],
        [68, 'Down to D G B'],
        [69, 'C E A'],
        [70, 'C F# A'],
        [71, 'The bass moves at last: low E'],
      ], 'Like part 4: the low D stays until the last bar.'),
      'p9-R': w('Part 9: right hand', 'D low, D high, a climb, and a long G', [
        [65, 'Low D, then high D'],
        [66, 'Climb: E, F, G'],
        [67, 'A, then C and D'],
        [68, 'E, two notes together, then B'],
        [69, 'High D held, low D on beat 2'],
        [71, 'Up to G and hold it'],
      ], 'The same as part 4. Reach the octave without looking.'),
      'p9-both': w('Part 9: both hands', 'The right hand climbs, the left holds D', [
        [65, 'Low D in the left, the right on beats 2 and 3'],
        [68, 'Beat 2: chords in both hands'],
        [71, 'Both on beat 1: low E, high G'],
      ], 'Keep the left soft. The right hand carries the tune.'),

      'p10-L': w('Part 10: left hand', 'The last bars: E, E, E, then A and D', [
        [73, 'Low E, then A C F'],
        [74, 'Same E, the chord C E A'],
        [75, 'Same E, four notes: A C F A'],
        [76, 'A note on every beat here'],
        [77, 'A and G together, held'],
        [78, 'D, A, D: the end'],
      ], 'Slow down at the end and let the last chord ring.'),
      'p10-R': w('Part 10: right hand', 'Little steps down, then the last two chords', [
        [73, 'B, C, then up to F'],
        [74, 'E, D, C: step down'],
        [75, 'The same: E, D, C'],
        [76, 'Hold F while D and G play'],
        [77, 'Chord: C E A C'],
        [78, 'Last chord: D F A D. Hold it'],
      ], 'Like the end of part 5, with F where it had F#.'),
      'p10-both': w('Part 10: both hands', 'Both hands land the last chords together', [
        [73, 'The right steps, the left rocks'],
        [76, 'The left plays on every beat here'],
        [77, 'Both hands at once, held'],
        [78, 'The last chord. Let it ring'],
      ], 'Take your time. The last chord is D F A D, in both hands.'),
    },
  },

  'fur-elise': {
    version: 'v2ainq',
    reels: {
      intro: w('Für Elise', 'The most famous turn on the piano: E D# E', [
        [1, 'Two neighbour notes rock: E and D#'],
        [3, 'Then the left hand rolls a chord: A E A'],
      ], 'Light and even. The left hand answers the right.'),
      'p1-R': w('Part 1: right hand', 'E D# E D# E, then B D C, landing on A', [
        [1, 'Start on the last beat: E, D#'],
        [2, 'E D# E, then B, D, C'],
        [3, 'Land on A, then climb C, E, A'],
        [4, 'B, then E, G#, B'],
        [5, 'C, then E, and the turn again: E D#'],
        [6, 'The same turn: E D# E B D C'],
        [7, 'A, then C E A'],
        [8, 'B, then E, C, B'],
      ], 'E and D# are neighbours: rock between two fingers, the hand stays still.'),
      'p1-L': w('Part 1: left hand', 'Two shapes only: A E A and E E G#', [
        [3, 'Low A, E, A: roll up'],
        [4, 'Low E, E an octave up, then G#'],
        [5, 'A E A again'],
        [6, 'Rest: the right hand plays alone'],
        [7, 'A E A'],
        [8, 'E E G#'],
      ], 'Roll each shape up from the low note. The hand barely moves.'),
      'p1-both': w('Part 1: both hands', 'The hands take turns: left rolls, right climbs', [
        [1, 'The right hand alone at first'],
        [3, 'Left rolls A E A, then the right climbs C E A'],
        [4, 'Left rolls E E G#, then the right E G# B'],
        [6, 'The right hand alone again'],
      ], 'On beat 1 both hands play together, then they take turns.'),
      'p2-R': w('Part 2: right hand', 'The same tune again, ending on A', [
        [9, 'A, then the turn: E D#'],
        [10, 'E D# E B D C'],
        [11, 'A, then C E A'],
        [12, 'B, then E G# B'],
        [13, 'C, then E, and the turn'],
        [14, 'E D# E B D C'],
        [15, 'A, then C E A'],
        [16, 'B, then E C B'],
        [17, 'Land on A and hold it'],
      ], 'Bar 16 ends C B, not G# B: that is how it closes.'),
      'p2-L': w('Part 2: left hand', 'A E A and E E G#, to the end', [
        [9, 'A E A'],
        [10, 'Rest: the right hand alone'],
        [12, 'E E G#'],
        [17, 'A E A, and hold the last A'],
      ], 'The same two shapes as part 1.'),
      'p2-both': w('Part 2: both hands', 'Hands take turns, to the last A', [
        [9, 'Both on beat 1: an A in each hand'],
        [10, 'The right hand alone'],
        [11, 'The left rolls, then the right climbs'],
        [17, 'Both end on A together'],
      ], 'Keep it light. The last A is soft in both hands.'),
    },
  },
};
