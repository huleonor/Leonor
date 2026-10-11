# Hugo's Piano

A piano-learning app in the manner of Simply Piano, built around your own songs: each song becomes a course you learn part by part, hand by hand, on a scrolling staff that waits for you, with stars and a daily streak. It listens to your piano over USB MIDI, Bluetooth MIDI or the microphone.

Live: https://hugos-piano.vercel.app

## Using it

The app works like Simply Piano, with your own songs.

- **Home**: the Continue card names the exact next step of the song you are learning; Today's practice suggests steps to polish (one or two stars) and a new song. The flame is your daily streak, the bar your minutes today against the daily goal.
- **Songs**: every song is a card showing the first page of its sheet music, with composer, title and difficulty (dots: green easy, amber medium, red hard, worked out from the notes). Collections are grouped (My songs, Film scores, Modern piano, Classical); songs still waiting for a MIDI file are listed at the end. **Upload MIDI** shows the engraved first page beside the title, composer and detected difficulty.
- **A song opens as sheet music** on a white card with the keyboard below it (Misolla's layout) and Simply Piano's modes in the bar above: hands (left / both / right), Listen, Play, Teach me, *Waits for you* or *In tempo*, Feedback, and a notes counter. **Loop** repeats the part under the cursor; **Hide keys** gives the score the whole height.
  - **Play**: start playing whenever you like; the score follows you note by note and the notes turn green (or red for a wrong one). **Magic scroll** keeps the cursor waiting for you; **Auto scroll** runs the music in tempo at 0.6×, 0.8× or 1×.
  - **Listen**: the app plays the song while the cursor moves.
  - **Teach me**: the song is split into sections (Part 1, Part 2, …, Whole song). A section opens as a lesson: one engraved line with finger numbers, the next notes in teal, a finger bubble, the keys to press lit on the keyboard and an "n/N notes" counter. The arrows move between its steps: right hand, left hand, hands together, in tempo. Each step gives 1 star from 70% right, 2 from 85%, 3 from 95%.
  - **Feedback** switches the green/red colouring on and off. The mini keyboard under the tool bar lights the keys to play in yellow. Tap a note while stopped to start from there.
- **Learn**: the main course, a path of units (Middle C right hand, Bass clef left hand, Hands together), each lesson unlocking the next and each unit ending in a song. On top, **Today's session** (also on Home): about ten minutes made fresh each day, a warm-up on your weakest skill, the next lesson on the path, and a short review.
- **The coach** keeps every lesson at the right difficulty, aiming for about 85% right first time. It learns from every chord you play (how often it is right first time, how long you hesitate, which skill it exercises) and turns three knobs one step at a time, after two runs agree: speed, how soon the keys light up when you are stuck, and how many finger numbers show. When it changes something it says why ("A little slower for now: bass clef notes were tripping you up").
- **Placement test**: on Learn, one short piece per unit; each passed with 2 stars skips that unit. Locked units also have **Test out**. The course has seven units: Middle C right hand, bass clef left hand, hands together, eighth notes, left-hand chords, G major (F sharp), dotted rhythms and 3/4.
- **Coming back every day**: XP for every step (more for more stars, a bonus for a perfect one, 20 for finishing today's session), shown top right; the daily streak with **streak freezes** (seven days in a row earn one, two at most; a missed day is covered automatically); a celebration when the daily goal is reached, the session is done or a freeze is earned or used; the session's review is **spaced** (a skill comes due again after 1, 2, 4 or 7 days, by its level); an optional **practice reminder** in Settings (real notifications in the iPhone app, scheduled a week ahead and skipped once the goal is met; on the web only while the app is open).
- **Progress**: this week against last week (minutes, XP, steps, biggest skill gains); your skill map (treble and bass clef, ledger lines, sharps and flats, beat, eighths, dotted rhythms, hands together, chords, leaps), each with its level, how it moved since about a week ago, and a Practise button that writes an exercise for that skill at your level; what the coach has set; streak, the last seven days, minutes per day and the daily goal.
- **Settings**: your piano (USB cable, Bluetooth, microphone) with a test screen, note names (C D E or Dó Ré Mi), finger numbers, hearing the keys you play, and the app playing the other hand.

Inputs:
  - **Microphone**: works everywhere, including iPhone Chrome and Safari.
  - **Bluetooth MIDI**: Android/desktop Chrome, and the Hugo's Piano iPhone app.
  - **USB / MIDI keyboard**: Android/desktop Chrome, and the iPhone app (Lightning to USB Camera Adapter).

## Adding songs

- **On the phone**: Songs → **Add song**, pick a `.mid`, name it, and it becomes a course like every other song. The file stays on that phone only.
- **For everyone (built into the app)**: put the file in `public/songs/`, add an entry to `BUILT_IN` in `src/lib/library.ts`, then deploy.

Two-track MIDI files (right hand + left hand) work best. Single-track files are split at middle C.

## Develop

```bash
npm install
npm run dev
```

## Deploy

```bash
vercel deploy --prod
```

The bundled Hans Zimmer pieces are fan transcriptions for personal practice (bitmidi.com, midisfree.com). Keep the link private.

Cover photos are from Unsplash (free license): Quaritsch Photography, Raimond Klavins, Ash Amplifies, BoliviaInteligente, Alina Chernovolova, Susann Schuster, Ian Keefe, Bogdan Arhipov.
# Leonor
