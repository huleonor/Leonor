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
| The pattern | 30 to 50% | Before the first hand video of a step that brings a new figure (a beat of three notes or more that the bar repeats): that one beat alone, four times in a row, then Train with me four times. The voice names its keys, which finger on which key and where it sits from middle C: "First, just the pattern. E, C, A, C. Finger 3 on E. Finger 2 on C. Thumb on A. It sits just above middle C." |
| Left hand, one step | 50% at most | Only when the left hand plays a shape he has not met **and has something to learn**: six notes or more over three keys or more. |
| Right hand, one step | 50% at most | Same rule. A figure over a new chord (top, middle, low, middle) counts as met, and so does a bar three quarters the same (an inner note more or less). |
| Both hands, one step | 60% at most | Always, unless only the right hand plays there. A hand that only holds a note or an octave is said here ("The left hand only holds an octave: E, F."). Steps of known shapes in a row become one video up to eight bars: "Same shapes as before, now on new chords: G, D." |
| The whole phase | 75% | At most sixteen bars a video. The payoff of the phase. |

**Patterns first, slow, and always which keys** (the user, 2026-11: "the goal is to learn the patterns from the start; it goes to a part that is too hard; explain which keys"): a new figure is learnt on its own before the bars that use it; the speed is set by how many notes go by, about 2.5 a second for a hand alone, 3 for both hands, 2 for a pattern (never above 50% for a hand, 60% for both, never under 30%); and every new shape is said with its keys, the finger on each and where the hand sits on the keyboard (from middle C), not only its letters.

**Follow the piece's difficulty, and him.** The hard spot of a step (its biggest quick jump, a ninth or more) gets a jump video first ("Watch the jump. From A, up to the high E. Look at the new key before you move."), at most two a phase; a step with a jump goes slower. With his piano connected the feed adapts (`ReelFeed` in `Reels.tsx`): a clean Train with me skips the next step's hands-alone videos; a pace per song rises with clean videos and falls with poor ones; a place he misses twice gets a fix video right after ("Let's fix this spot. You missed E. Here it is again, slowly."). New fixed lines go through the recorder like any other.

**A tip for every video** (`STEP_TIPS` in `reelScripts.ts`, keyed `R5`, `B5`, `L51`, `J31`: the kind and the bar its step starts on): written by hand after the score, the trick of that moment (what moves, what stays, where to look, how to count, how loud), one or two short sentences, never the notes read out. Run the recorder after adding any.

**The picture moves with the music:** the camera follows the hand; a dashed line draws a pattern's shape through its falling notes; a jump gets an arc over the keys; the keyboard counts the beat.

A **step** is a musical phrase, never a fixed count: two bars at least, more (up to four) until it holds a dozen notes and four seconds of music. So no video is one held note (the user, 2026-11: "videos that are literally pressing one note"). When a step opens with a bar he knows, the voice starts from the new one ("You know the first bar already. Here is the new one.").

Rules: one idea per video; never the hard part first; nothing at full speed but the idea; the very same notes again get no video. Each video ends by naming the next one ("Nice. Next up, the right hand, a bit further on. Swipe up."), so the series reads as one lesson. The voice never says bar numbers: the screen shows them.

## 2. The formula of one video: Show, Train, Check, Next (about 30 to 45 s)

| Beat | Duration | Content | Words |
| --- | --- | --- | --- |
| **Name** | 3 to 6 s | The voice names the shape; each key lights, outlined and numbered, as it is named. | 10 to 19 |
| **Show** | one pass | The music, slow. The notes fall filled in the hand's colour. | none |
| **Train with me** | rounds: count-in + one pass each | "Your turn, play it with me." A count of 1, 2, 3 (a click on each beat, the number big), and only then the notes start falling, in silence (no click after the 3). The notes fall open for him. Two rounds for a step, three when it is hard (difficulty 0.6 or more), one for a pattern, a jump, a fix or the whole phase. Each round fades the help: the piano guides at 75%, then 60%, then 50% (always heard; 85% without a piano connected), while the notes stay on screen ("Once more. The piano plays softer.", "One last time. You lead."). The kicker counts the rounds ("Train with me, 2 of 3"). **With a piano connected the video waits at a note he has not played a quarter of a second after it should sound, and goes on the moment he plays it**, and after each round a card pops with his note groups on time ("Round 1: 16 of 20 on time"). | 5 to 7 a round |
| **Next** | 2 to 4 s | "Nice. Next up, the right hand. Swipe up." | 6 to 12 |

Then it loops Train with me, without the voice and without stopping, until he scrolls on.

**Never ask him to play alone from memory** (the user, 2026-11: "I can't repeat on my own, I don't remember the notes, those parts are useless"). Repetition always happens with the notes falling in front of him and the help fading round by round; memory comes from the rounds, not from a blank screen.

**Gentler where it is hard.** `difficulty.ts` scores every stretch from its notes (speed, reach, leaps, black keys, chords, hand independence; 0 to 1). The harder a step, the fewer notes a second (down to 60% of the target), the lower the speed cap, the smaller the step (two or three bars), each new hand on its own even with less in it, no merging of known steps, and three rounds. A hard phase runs at down to 55% in eight-bar stretches. Check a song with `await window.__reelDifficulty('song-id')`: every video's difficulty, speed, rounds and length. Keep videos under about two minutes.

## 3. Writing the voice

The voice is the clock (HyperFrames): each piece appears when it is named.

- Short sentences, at most 15 words. Active voice, spoken English, second person. Read it aloud; rewrite what sounds stiff.
- One idea per sentence, one sentence per visual beat. Never read the screen word for word.
- Name notes as letters with commas ("E, C, A, C") so each key lights on its word and the recorded voice can read the list from its pieces; in hand-written lines write sharps and flats as they read ("F sharp", "B flat"). A lone capital A is read as the letter (the voice is given "eigh": "ay" comes out as "eye").
- Say the shape before the notes ("Top, middle, low, middle, on every beat"), and what moves ("Only the top note moves").
- Say which keys: the finger on each key ("Finger 3 on E. Thumb on A.") and where the hand sits ("It sits just above middle C."), so he can find them without the screen. Write them in that form (a short sentence per key, the note last) so the recorded voice can play them from its pieces.
- Pacing: 120 to 150 words a minute for teaching (the timeline estimates 2.4 words a second, `estimate` in `src/lib/voice.ts`). A scene line stays under about 19 words.
- Punctuation is pacing: a full stop is a medium pause, a comma a short one, an ellipsis a long one. No exclamation marks on every line; one at a real payoff.
- Standard words for standard actions: "Your turn", "Pause", "Next up". No hype, no filler, no emoji, no em or en dashes.

Where the words live: hand-written per phase in `src/lib/reelScripts.ts` (`talk`: intro, L, R, both, outro), checked by `reelShape.ts`; the lines after a phase's first stretch are written by the rules from the notes (`rightWords`, `leftWords` in `reels.ts`). To read a song before writing: `await window.__reelFacts('song-id')` in the dev console.

## 4. The voice itself

- **Recorded**, the voice he hears: Kokoro-82M (`af_heart`) run in a session by `scripts/voice-bank.mjs`, every piece a small MP3 in `public/voice`, listed in `src/lib/voiceBank.json` with its length (so the timeline knows exactly how long each line lasts). A line plays whole if it was recorded whole, else sentence by sentence, else from its pieces (`voicePieces.ts`): the words around a list of notes, and each note name recorded on its own, mid-list ("E,") and at the end ("E."). The songs of the app are recorded line by line; a song he brings (a slot, like Interstellar Experience) only as sentences without note names, its hand-written `talk` lines and the pieces, so nothing of his file is in the app.
- **After changing any line** (a script, a rule template): with the songs in the library, run `copy(JSON.stringify(await window.__voiceKeys()))` in the dev console, save it to a file in the scratchpad, and run `node scripts/voice-bank.mjs that-file.json` (needs ffmpeg; a few minutes). Commit `public/voice` and `voiceBank.json`.
- A line not recorded yet is made on the device by the same model in a worker (`kokoroWorker.ts`): slow on a phone (seconds a line), so it is made ahead. The device's speech engine speaks only with the natural voice switched off (the user found it robotic).
- Under the voice the piano steps back (70%); in Train with me the piano guides at 40%.
- Captions: three to five words at a time, the word being said on the yellow marker, said words ink, words to come muted. Always on: most viewers watch muted.

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
