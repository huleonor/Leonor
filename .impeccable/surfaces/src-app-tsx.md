---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: []
---

# Surface brief: Hugo's Piano app shell (home, songs, song course, practice)

Scope: the whole app. Visitor mode: Operate.
Audience/job: Hugo, iPhone landscape on the piano's music stand, both hands on the keys; opens the app, continues the next step of a song, practises it part by part (right hand, left hand, together, in tempo), earns stars, keeps a daily streak, adds his own MIDI songs and learns them the same way.
Constraints: iPhone app (Capacitor, CoreMIDI cable + Bluetooth, mic) and web (Chrome). English UI. Replaces the aluminium "practice instrument" world; the user asked for the Simply Piano way of learning and, in the direction round, chose the category standard (Simply Piano look) played straight. Bar: Simply Piano and Duolingo craft level.

## Direction contract

THESIS: A song-learning app that works exactly like Simply Piano: every song is a course of short parts, each learnt hand by hand on a scrolling staff that waits for you, scored in stars, with a daily streak. Refuses the instrument-panel costume it replaces and any decoration that slows the next step.

OWN-WORLD: night indigo ground (#14112b) with raised indigo surfaces, one saturated go-green for every primary action and every correct note, gold stars, orange streak flame, red only for a wrong note, sky blue right hand and amber left hand on keys. Nunito (rounded, self-hosted) for everything, tabular figures for numbers. Chunky rounded buttons with a solid bottom edge that presses down; 16px radius cards; a light paper stage where the staff scrolls.

STORY: He opens the app and the Continue card names the exact next step; one tap and the step card says what to do; the staff scrolls to a green now-line, notes turn green as he plays and the music waits when he stalls; stars rise on the result card, the streak counts the day, Next step is the green button.

FIRST VIEWPORT: Landscape. Left rail (Home, Songs, Progress, Settings). Home: greeting with the streak flame and today's minutes against the goal; the Continue card (cover, song, next step, stars, big green Continue) leads; Today's practice list to its right; recent songs below. Practice: 52px top bar (pause, step title, progress, Wait, speed, view), the paper stage with one staff per hand in play and the green now-line at a fifth of the width, the keyboard along the bottom lighting the next keys.

FORM: the category standard (Simply Piano), taken by the user from the standing exit of a degraded roll; seed key 1ae9d785.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
