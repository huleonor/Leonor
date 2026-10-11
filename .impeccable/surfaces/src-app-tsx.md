---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: []
---

# Surface brief: Hugo's Piano app shell (home, songs, song course, practice)

Scope: the whole app. Visitor mode: Operate.
Audience/job: Hugo, iPhone landscape on the piano's music stand, both hands on the keys; opens the app, continues the next step of a song, practises it part by part (right hand, left hand, together, in tempo), earns stars, keeps a daily streak, adds his own MIDI songs and learns them the same way.
Constraints: the user then asked for the teaching to follow Simply Piano's sheet-music songs exactly (screens supplied: mode tool bar, sections strip, lesson line with fingering and n/N counter). iPhone app (Capacitor, CoreMIDI cable + Bluetooth, mic) and web (Chrome). English UI. Replaces the aluminium "practice instrument" world; the user asked for the Simply Piano way of learning and, in the direction round, chose the category standard (Simply Piano look) played straight. Bar: Simply Piano and Duolingo craft level.

## Direction contract

THESIS: A song-learning app that works exactly like Simply Piano: every song is a course of short parts, each learnt hand by hand on a scrolling staff that waits for you, scored in stars, with a daily streak. Refuses the instrument-panel costume it replaces and any decoration that slows the next step.

OWN-WORLD: night indigo ground (#14112b) with raised indigo surfaces, one saturated go-green for every primary action and every correct note, gold stars, orange streak flame, red only for a wrong note, sky blue right hand and amber left hand on keys. Nunito (rounded, self-hosted) for everything, tabular figures for numbers. Chunky rounded buttons with a solid bottom edge that presses down; 16px radius cards; a light paper stage where the staff scrolls.

STORY: He opens the app and the Continue card names the exact next step. A song opens as Simply Piano sheet music: a dark tool bar of modes (Listen, Teach me, Play | Feedback, Magic scroll, Auto scroll, Exit) over the white engraved score, a mini keyboard lighting the keys to play in yellow and a teal cursor. In Play he just starts playing and the notes turn green as the score follows him. Teach me opens a violet strip of sections; a section opens as a lesson on a light warm page: one engraved line with fingering, the next notes in teal under a finger bubble, an n/N counter with arrows between steps (right hand, left hand, together, in tempo), the key to press in teal on the keyboard; stars rise at the end and Next step is the green button.

FIRST VIEWPORT: Landscape. Left rail (Home, Songs, Progress, Settings). Home: greeting with the streak flame and today's minutes against the goal; the Continue card (cover, song, next step, stars, big green Continue) leads; Today's practice list to its right; recent songs below. Song sheet: 64px tool bar (icon over label; active modes on a cream pill with violet ink), mini keyboard under it, the score below in lines of 2-5 bars with title and composer, a 6px teal cursor. Lesson: pause tile top left, the instruction line ('Play E5 with finger 5'), arrows around an n/N counter top right; one engraved line centred, the next notes a third of the way in; the keyboard along the bottom.

FORM: the category standard (Simply Piano), taken by the user from the standing exit of a degraded roll; seed key 1ae9d785.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
