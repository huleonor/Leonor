---
name: piano-lesson-video
description: "Leonor's lesson videos: short vertical piano-teaching clips the learner scrolls through and plays along with, where parts of the video are his turn and the video waits until he plays them on time. Script formulas, voice lines, pacing, scene beats, interactive parts and how they are built in the app (no generated footage: every video is drawn live from the song's notes). Use for: writing or changing a song's phase videos, their voice lines, their timing, Train with me, the practise stops, or rendering a social clip of a public-domain piece with HyperFrames. Triggers: lesson video, phase video, reel, train with me, play along, voice line, teaching script, piano tutorial video"
---

# Piano lesson videos (Leonor)

Adapted from the explainer-video guide (scripts, pacing, voiceover, assembly) for one job: teaching a song on the piano, a few bars at a time, in a feed he scrolls and plays along with. The difference from an explainer: **parts of the video are his turn, and the video waits for him.** Nothing is filmed or generated: every frame is drawn from the song's own notes (`src/components/Reels.tsx`), so the video works for any MIDI he brings and never leaves his device.

## 1. The series

A song is cut into phases (where the music changes). Each phase is a run of videos, in this order (`clipsOf` in `src/lib/reels.ts`):

| Video | Speed | What it does |
| --- | --- | --- |
| The idea | 100% | The phase heard once while the voice says what it is made of. Only heard, never played. |
| Left hand, two bars | 50% | Only when the left hand has a shape he has not met yet. |
| Right hand, two bars | 50% | Same rule. A figure over a new chord (top, middle, low, middle) counts as met. |
| Both hands, two bars | 60% | Always. A known shape: "Same shapes as before, now starting on G." |
| The whole phase | 75% | At most sixteen bars a video. The payoff of the phase. |

Rules: one idea per video; never the hard part first; nothing at full speed but the idea; the very same notes again get no video. Each video ends by naming the next one, so the series reads as one lesson.

## 2. The formula of one video: Show, Train, Check, Next (about 30 to 45 s)

| Beat | Duration | Content | Words |
| --- | --- | --- | --- |
| **Name** | 3 to 6 s | The voice names the shape; each key lights, outlined and numbered, as it is named. | 10 to 19 |
| **Show** | one pass | The music, slow. The notes fall filled in the hand's colour. | none |
| **Train with me** | count-in + one pass | "Your turn, play it with me." A bar of count-in (a click on each beat, the number big). The notes fall open for him; the piano only guides at 40%. **With a piano connected the video waits at a note he has not played a quarter of a second after it should sound, and goes on the moment he plays it.** | 5 to 7 |
| **Practise** | his time | The video stops by itself: "Now pause, and play it two more times." A card counts his clean runs (every note group in order, at most two slips) or he taps Done. After two it goes on by itself. | 6 to 10 |
| **Next** | 2 to 4 s | "Nice. Next up, the right hand, bars 1 and 2. Swipe up." | 8 to 12 |

Then it loops Train with me, without the voice and without stopping, until he scrolls on.

## 3. Writing the voice

The voice is the clock (HyperFrames): each piece appears when it is named.

- Short sentences, at most 15 words. Active voice, spoken English, second person. Read it aloud; rewrite what sounds stiff.
- One idea per sentence, one sentence per visual beat. Never read the screen word for word.
- Name notes as letters with commas ("E, C, A, C") so each key lights on its word; write sharps and flats as they read ("F sharp", "B flat"). A lone capital A is read as the letter.
- Say the shape before the notes ("Top, middle, low, middle, on every beat"), and what moves ("Only the top note moves").
- Pacing: 120 to 150 words a minute for teaching (the timeline estimates 2.4 words a second, `estimate` in `src/lib/voice.ts`). A scene line stays under about 19 words.
- Punctuation is pacing: a full stop is a medium pause, a comma a short one, an ellipsis a long one. No exclamation marks on every line; one at a real payoff.
- Standard words for standard actions: "Your turn", "Pause", "Next up". No hype, no filler, no emoji, no em or en dashes.

Where the words live: hand-written per phase in `src/lib/reelScripts.ts` (`talk`: intro, L, R, both, outro), checked by `reelShape.ts`; the lines after a phase's first stretch are written by the rules from the notes (`rightWords`, `leftWords` in `reels.ts`). To read a song before writing: `await window.__reelFacts('song-id')` in the dev console.

## 4. The voice itself

- Natural: Kokoro-82M on the device (`src/lib/kokoroWorker.ts`, voice `af_heart`), fetched once (about 90 MB) and cached; every line is made ahead while the video before it plays (`prepareVoice`), kept in IndexedDB.
- Fallback: the device's speech engine, its most natural English voice, until Kokoro is ready or where it cannot run.
- Under the voice the piano steps back (70%); in Train with me the piano guides at 40%.
- Captions: three to five words at a time, the word being said in blue, said words ink, words to come muted. Always on: most viewers watch muted.

## 5. Picture and motion

The look is DESIGN.md (Cartaz): paper, ink, the right hand blue, the left red. One keyboard for both hands; the step's kicker small and its notes huge at the top; the caption under the keyboard; air below. Motion follows HyperFrames' craft: everything drawn from the clock (scrub works), the camera pushes in on the video's keys in the first second, expo arrivals, short exits, titles and captions blurring in word by word, no bounce, no loops for decoration.

## 6. Sound

Few and exact, each with a cause on screen (`public/sfx`, Pixabay licence): a whoosh as a title arrives, a click on each count-in beat, a pop for each run counted, a riser into an impact as the whole phase starts. No chimes, no music bed: the piano is the music.

## 7. Common mistakes

| Mistake | Problem | Fix |
| --- | --- | --- |
| Hard part first | He gives up | The hand alone, half speed, two bars |
| Line too long | The voice runs over the music | Cut to the shape and the letters |
| Keys shown before they are named | The explanation is a wall | Light each key on its word |
| Train with me that does not wait | He falls behind and stops | Wait at an unplayed note (with a piano) |
| A practise stop with no exit | He is stuck | Done, Train with me again, or two clean runs |
| Same words in every video | Robotic | Rotate the turn and practise lines; say what moves |

## 8. A social clip of a public-domain piece

For a TikTok of a piece in the public domain (never one under copyright, never his own MIDI of one), render the same beats with HyperFrames (`npx hyperframes`, 1080x1920, Kokoro voice via `npx hyperframes tts`, piano rendered offline from the notes, the sfx above): the hook in the first second (the music already playing and the one-line promise on screen), the turn named key by key, both hands slow, a riser into the full-speed payoff, "Save this. Part 2 tomorrow." Loudness about -16 LUFS; hits 3 to 6 dB over the bed.
