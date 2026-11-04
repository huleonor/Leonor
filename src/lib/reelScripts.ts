/**
 * Each song's phase videos, written by hand after reading the score bar by bar: the song is cut
 * where the music changes (its phases), and every phase gets one TikTok-style video that explains
 * its patterns and tricks, the left hand, the right hand, then both. No model is asked at runtime.
 *
 * A script fits a song's notes in one of two ways:
 * - `version`: the reading's hash (src/lib/reading.ts) of the exact MIDI shipped with the app;
 * - `fingerprint`: for a song he brings as his own MIDI, the bass (the lowest left-hand note of the
 *   bar's first chord) at some bars of the printed score; a file matches when most of them agree.
 * A song with no script, or notes that do not match, gets phases and words written by the rules.
 * To write one, `await window.__reelFacts('song-id')` in the dev console gives every bar's bass and
 * right hand and the whole score as text.
 *
 * Limits on screen (reelShape.ts): title 32 characters, hook 52, a trick, hand line or cue 56, the
 * tip 80. No em or en dashes.
 */
import type { PhaseWords, Talk } from './reelShape';

export interface SongScript { version?: string; fingerprint?: Record<number, string>; phases: PhaseWords[] }

const ph = (from: number, to: number, title: string, hook: string, tricks: string[], L: string, R: string, cues: Record<number, string>, tip: string): PhaseWords =>
  ({ from, to, title, hook, tricks, L, R, cues, tip });

export const SCRIPTS: Record<string, SongScript> = {
  'gymnopedie-1': {
    version: 'xjnbbq',
    phases: [
      ph(1, 16, 'The rocking start', 'Two chords rock, then a slow tune floats in', [
        'Left: a low note on 1, a chord on 2. G, then D',
        'Right: the tune starts on beat 2, F# then A',
      ], 'Low G, jump up to B D F#. Then low D, up to A C# F#', 'Rest on 1, then F# A. G F# C#. B C# D. Then A', {
        1: 'Four bars of left hand alone: count them',
        5: 'The tune joins on beat 2',
        8: 'A, held for the whole bar',
        9: 'F#, held for four bars',
        13: 'The tune again, the same notes',
      }, 'Never hurry. Count 1 2 3, slow and even.'),
      ph(17, 24, 'Long notes', 'The bass walks down while the tune holds', [
        'Left: each bar a new low note, then its chord',
        'Right: hold the long notes their full length',
      ], 'Low F#, B, E, D, A: find each one before you play', 'C#, then F#, then a long low E for three bars', {
        17: 'Both on beat 1: low F#, high C#',
        19: 'Hold E for three bars and keep counting',
        22: 'Climb: A, B, C',
        23: 'Then down: E, D, B',
      }, 'Count the long notes. They are the music here.'),
      ph(25, 39, 'A low D, then big chords', 'A low D holds it all, then two big chords', [
        'Left: the low D never moves, only the chord on top',
        'Right: D high and D low, an octave apart',
      ], 'Low D every bar, the chord on 2: C E A, C F# A, A C F', 'High D held, low D on 2, then climb E F G', {
        25: 'Three D notes: one low left, two in the right',
        27: 'Climb: E, F, G',
        29: 'Beat 2: chords in both hands',
        33: 'Little steps: B A B, then C# D E',
        37: 'Hold F# while D and G play under it',
        38: 'A big chord: C E A C',
        39: 'Then D F# A D, held',
      }, 'Shape the hand for the big chords before you play them.'),
      ph(40, 56, 'The start again', 'The opening comes back: same chords, same tune', [
        'Left: D then G, rocking, like the start',
        'Right: the same tune, ending on a long F#',
      ], 'Low D, up to A C# F#. Low G, up to B D F#', 'F# A, then G F# C#, then B C# D, then A', {
        40: 'The left hand alone again: count',
        44: 'The tune joins on beat 2',
        48: 'Down to F#, held for four bars',
      }, 'You know this one. Let it float.'),
      ph(57, 72, 'Long notes, then the low D', 'Phases 2 and 3 again, with a new ending', [
        'Left: the same walking bass, then the low D',
        'Right: the long E, the climb, then D low and high',
      ], 'Low B, E, D, A, then the low D under every bar', 'F#, a long low E, then A B C up', {
        57: 'Both on beat 1: low B, high F#',
        58: 'Hold E for three bars',
        61: 'Climb: A, B, C',
        65: 'Low D, then high D',
        71: 'Up to G and hold it',
      }, 'The same as before, so trust your hands.'),
      ph(73, 78, 'The ending', 'Little steps down, then the last two chords', [
        'Left: a low E three times, then A and D',
        'Right: like the end of phase 3, with F instead of F#',
      ], 'Low E, then A C F. E, then C E A', 'B C F, then E D C, then E D C again', {
        73: 'The right steps, the left rocks',
        76: 'Hold F while D and G play',
        77: 'Both hands at once: a held chord',
        78: 'The last chord. Let it ring',
      }, 'Slow down at the end and let the last chord ring.'),
    ],
  },

  'fur-elise': {
    version: 'v2ainq',
    phases: [
      ph(1, 8, 'The famous turn', 'E D# E D# E, then the hands take turns', [
        'Right: rock between two neighbour keys, E and D#',
        'Left: only two shapes, A E A and E E G#',
      ], 'Low A, E, A rolling up. Then E, E, G#', 'E D# E D# E, then B D C, landing on A', {
        1: 'Start on the last beat: E, D#',
        3: 'Left rolls A E A, then the right climbs C E A',
        4: 'Left rolls E E G#, then the right E G# B',
        6: 'The turn again: E D# E B D C',
      }, 'Keep it light. The hand stays still for the turn.'),
      ph(9, 17, 'Again, to the end', 'The same tune, ending on A', [
        'Left: the same two shapes as before',
        'Right: bar 16 ends C B, not G# B. That closes it',
      ], 'A E A, then E E G#, to the last A', 'A, the turn, then C E A and E G# B', {
        9: 'Both on beat 1: an A in each hand',
        10: 'The turn: E D# E B D C',
        16: 'B, then E C B',
        17: 'Both end on A together',
      }, 'Soft at the end. The last A in both hands.'),
    ],
  },

  /**
   * Tony Ann, The Interstellar Experience: read from the MuseScore score (82 bars, 4/4, crotchet
   * 99, two bars of 3/4 at 57-58). One right-hand shape (top, middle, low, middle) over four bass
   * notes, F G A E; a melody of little scales over broken chords; the shape again over wide
   * arpeggios; a build; big chords; and a quiet run to the top.
   */
  'interstellar-experience': {
    fingerprint: { 2: 'F', 3: 'G', 4: 'A', 5: 'E', 6: 'F', 7: 'F', 9: 'G', 10: 'A', 11: 'A', 12: 'G', 17: 'D', 18: 'E', 25: 'G', 26: 'E', 59: 'F', 61: 'A', 63: 'G', 65: 'E' },
    phases: [
      ph(1, 13, 'The pattern', 'One shape over four octaves: F G A E', [
        'Right: top, middle, low, middle on every beat',
        'Left: one octave a bar, little finger and thumb',
      ], 'Octaves F, G, A, E: 5 low, 1 high, hold 4 beats', 'E C A C, then E B G B: only the top note moves', {
        1: 'It starts with one note: E, four times',
        2: 'Both on beat 1: octave low, pattern high',
        6: 'Accent beat 1. The left crosses over for one note',
        8: 'Now with B: E B G B',
        13: 'The pattern breaks into a run down',
      }, 'Find the top note and the hand knows the rest.'),
      ph(14, 22, 'The melody', 'A melody of little scales over broken chords', [
        'Right: runs up A B C D and back down',
        'Left: one chord broken on every beat, F A C A',
      ], 'F A C A, E A C A, D G B G, E G B G', 'A B C D E D C B, then from the top A G F E', {
        14: 'A, four times: a breath',
        15: 'Both hands on every beat now',
        17: 'Climb B C D G, then higher',
        19: 'The melody again, an octave higher',
        22: 'G# this time: B C D G#',
      }, 'Each run is a scale. Keep the fingers close to the keys.'),
      ph(23, 38, 'Flowing arpeggios', 'The pattern comes back over wide arpeggios', [
        'Left: up the chord and back down, F C F A C',
        'Right: the first pattern, then big leaps',
      ], 'From F, then A, G, E: the same shape each time', 'E C A C, then wider, with a leap to the high E', {
        23: 'The left hand flows under the pattern',
        27: 'Both hands wide: watch the leap',
        31: 'An octave higher, the same left hand',
        35: 'The same shapes, from B',
      }, 'Let the wrist carry the left hand. The leaps can come slower.'),
      ph(39, 46, 'The melody, higher', 'The melody comes back, an octave up', [
        'Right: the same scales as the melody, higher',
        'Left: waits, then joins with broken chords',
      ], 'A rest, one chord, then broken chords from bar 41', 'A B C D E D C B, climbing to the top', {
        39: 'The right hand alone for a bar',
        41: 'The left joins with broken chords',
        46: 'B C D G#, then down',
      }, 'Same notes as the melody, just higher.'),
      ph(47, 58, 'The build', 'Eighths in the left, the pattern loud on top', [
        'Left: steady eighths, then pounding chords',
        'Right: the top note leads, A, then B, then C',
      ], 'A high note, low eighths, then F, G, A in eighths', 'E C A C loud, then A E C A, B E D B, C E D C', {
        47: 'The left eighths drive it forward',
        51: 'A on top now: A E C A',
        53: 'B on top: B E D B',
        55: 'C on top: C E D C',
        57: 'Two bars of three beats: count 1 2 3',
      }, 'Keep the eighths even, like a clock. Loud, not hard.'),
      ph(59, 74, 'Big chords', 'Big chords, then the melody at full power', [
        'Right: shape each chord in the air before you play',
        'Left: the arpeggios again, F A G E',
      ], 'F, A, G, E arpeggios, the same shape each time', 'Chords on 1, between 2 and 3, and on 4', {
        59: 'Chords above, arpeggios below',
        61: 'Hold the tied chord over the bar line',
        67: 'The melody, loud: A B C D E D C B',
        71: 'The wide leaps come back',
      }, 'Loud, but even. The top notes are the melody.'),
      ph(75, 82, 'The ending', 'The pattern one last time, then a run to the top', [
        'Right: the top note climbs, A, B, C, then D',
        'Left: one held chord every two bars',
      ], 'A low F octave, then D G B, E A C, E G B', 'A E C A, B E D B, C G E C, D B G D, then up', {
        75: 'Softer: held chords under the pattern',
        77: 'B on top',
        79: 'C on top',
        81: 'D on top, slowing down',
        82: 'The run to the top. Let it ring',
      }, 'Let it slow down. The last run is right hand alone.'),
    ],
  },
};

/**
 * What the voice says over each phase, written like a teacher talking over the keys: the idea, the
 * left hand, the right hand, both together, the send-off. Phase by phase, in the order above. Note
 * names are written as they read ("F sharp"); a capital A alone is read as the letter.
 */
const TALK: Record<string, Talk[]> = {
  'interstellar-experience': [
    {
      intro: 'This whole opening is built from one shape. The right hand plays top, middle, low, middle on every beat, and the left hand holds one octave a bar: F, G, A, then E.',
      L: 'The left hand only holds an octave: little finger on the low note, thumb an octave up, for all four beats. F, G, A, E.',
      R: 'Right hand first. E, C, A, C. Top, middle, low, middle. Later it turns into E, B, G, B, and only the top note stays put.',
      both: 'Both hands together, at full speed. Drop the octave on beat one and let the pattern roll on top.',
      outro: 'Find the top note, and your hand already knows the rest. Your turn.',
    },
    {
      intro: 'Here the melody arrives. The right hand plays little scales, up and back down, while the left hand breaks each chord into four notes, one on every beat.',
      L: 'Left hand: F, A, C, A. Then E, A, C, A. One chord a bar, broken into the same up and down shape.',
      R: 'Right hand: A, B, C, D, E, and back down. It is only a scale, so keep your fingers close to the keys.',
      both: 'Together now. On every beat both hands move at once. Then the melody comes again, an octave higher.',
      outro: 'Each run is just a scale. Play it slowly until it feels like walking.',
    },
    {
      intro: 'The opening pattern is back, but now the left hand flows. It climbs up the chord and comes back down, wider than before.',
      L: 'Left hand: F, C, F, A, C, up and down. The same shape starts on F, then on A, on G, and on E.',
      R: 'The right hand plays the first pattern again, E, C, A, C, and then opens up with a leap to the high E.',
      both: 'Both hands. Let your wrist carry the left hand, and get ready for the leap around bar 27.',
      outro: 'Let the wrist do the work. The leaps can be slower at first.',
    },
    {
      intro: 'The melody comes back, an octave higher. You already know these notes. Only the place on the keyboard is new.',
      L: 'The left hand waits, plays one chord, and from bar 41 goes back to the broken chords you learnt.',
      R: 'Right hand: the same little scales, A, B, C, D, E and down again, just higher up.',
      both: 'Together. It is the melody from phase two, moved up the keyboard.',
      outro: 'Same notes, higher. Find the first one and the rest follows.',
    },
    {
      intro: 'This is the build. The left hand drives steady eighth notes, and on top the pattern gets louder while its top note climbs: A, then B, then C.',
      L: 'Left hand: even eighth notes, like a clock ticking. Then F, G and A, still in eighths.',
      R: 'Right hand: A, E, C, A. Then B, E, D, B. Then C, E, D, C. The top note leads the way up.',
      both: 'Both hands, loud but not hard. Careful at bars 57 and 58: those two bars have only three beats.',
      outro: 'Keep the eighths even, like a clock. Loud, not hard.',
    },
    {
      intro: 'Big chords now. The right hand plays full chords on beat one, between two and three, and on four, while the left hand rolls arpeggios underneath.',
      L: 'Left hand: the arpeggios again, from F, then A, then G, then E. The same shape every time.',
      R: 'Right hand: shape each chord in the air before you land it. The top notes are the melody.',
      both: 'Together, at full power. At bar 61, hold the tied chord across the bar line.',
      outro: 'Loud, but even. Listen for the top notes, they carry the melody.',
    },
    {
      intro: 'The ending. The pattern plays one last time, softer, its top note climbing, A, B, C, D, and then a run to the very top.',
      L: 'Left hand: one held chord every two bars. One low F octave, then D, G, B, then E, A, C.',
      R: 'Right hand: A, E, C, A. Then B on top, then C, then D. And at the end, a run all the way up.',
      both: 'Both hands, softer now. Let it slow down at the end, and let the last notes ring.',
      outro: 'Slow down and let it ring. The last run is the right hand alone.',
    },
  ],
  'gymnopedie-1': [
    {
      intro: 'Two chords rock back and forth, and then a slow tune floats in on top. Count three beats in every bar.',
      L: 'Left hand: a low G, then jump up to the chord, B, D, F sharp. Then a low D, and up to A, C sharp, F sharp.',
      R: 'Right hand: rest on beat one, then F sharp and A. Then G, F sharp, C sharp. It never hurries.',
      both: 'Together. Four bars of left hand alone, and then the tune joins on beat two.',
      outro: 'Never hurry. Count one, two, three, slow and even.',
    },
    {
      intro: 'Now the bass walks down, one note a bar, while the tune holds long notes above it.',
      L: 'Left hand: low F sharp, then B, E, D and A. Find each low note before you play it.',
      R: 'Right hand: C sharp, F sharp, then one long E, held for three bars. Keep counting while it rings.',
      both: 'Together. The long notes are the music here, so give them their full length.',
      outro: 'Count the long notes. They are the music here.',
    },
    {
      intro: 'One low D holds everything together here, and the phase ends on two big chords.',
      L: 'Left hand: the low D never moves. Only the chord on beat two changes. C, E, A, then C, F sharp, A.',
      R: 'Right hand: a high D held, a low D on beat two, then it climbs, E, F, G.',
      both: 'Together. Shape your hand for the big chords at the end before you play them.',
      outro: 'Shape the hand for the big chords before you play them.',
    },
    {
      intro: 'The opening comes back. The same rocking chords, the same tune. You already know this one.',
      L: 'Left hand: low D, up to A, C sharp, F sharp. Low G, up to B, D, F sharp. Rocking, just like the start.',
      R: 'Right hand: F sharp and A, then G, F sharp, C sharp, then B, C sharp, D, and down to a long F sharp.',
      both: 'Together. Let it float, and hold the last F sharp for four bars.',
      outro: 'You know this one. Let it float.',
    },
    {
      intro: 'Phases two and three come back, with a new ending.',
      L: 'Left hand: the same walking bass, B, E, D, A, and then the low D under every bar.',
      R: 'Right hand: F sharp, one long low E, then A, B, C, climbing up.',
      both: 'Together. It is the same as before, so trust your hands, and hold the G at the end.',
      outro: 'The same as before. Trust your hands.',
    },
    {
      intro: 'The ending. Little steps down in the right hand, and then the last two chords.',
      L: 'Left hand: a low E, three times, then A, then D.',
      R: 'Right hand: B, C, F, then E, D, C, twice. It is the ending of phase three, with F instead of F sharp.',
      both: 'Together. Slow down at the end, and let the last chord ring.',
      outro: 'Slow down, and let the last chord ring.',
    },
  ],
  'fur-elise': [
    {
      intro: 'The famous turn. The right hand rocks between two neighbour keys, E and D sharp, and then the two hands take turns.',
      L: 'Left hand: only two shapes. A, E, A, rolling up. Then E, E, G sharp.',
      R: 'Right hand: E, D sharp, E, D sharp, E, then B, D, C, and land on A. The hand stays still for the turn.',
      both: 'Together. The left hand rolls up, and the right hand climbs to answer it.',
      outro: 'Keep it light. The hand stays still for the turn.',
    },
    {
      intro: 'The same tune again, and this time it closes on A.',
      L: 'Left hand: the same two shapes as before, all the way to the last A.',
      R: 'Right hand: the turn again. Watch bar 16: it ends C, B, not G sharp, B. That is what closes it.',
      both: 'Together. Soft at the end, with an A in both hands.',
      outro: 'Soft at the end. The last A in both hands.',
    },
  ],
};
for (const [id, talks] of Object.entries(TALK)) SCRIPTS[id]?.phases.forEach((p, i) => { if (talks[i]) p.talk = talks[i]; });

