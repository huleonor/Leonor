# Hugo's Piano

A piano-learning app in the manner of Simply Piano, built around your own songs: each song becomes a course you learn part by part, hand by hand, on a scrolling staff that waits for you, with stars and a daily streak. It listens to your piano over USB MIDI, Bluetooth MIDI or the microphone.

Live: https://leonor-three.vercel.app

## Using it

The app works like Simply Piano, with your own songs.

- **Learn (Home) is the path**, Duolingo style: the streak flame, gems and the pink energy battery on top; then four sections of real piano teaching (Foundations; Reading and rhythm; Keys and harmony; Styles), 20 units, each with a coloured banner and a **Guidebook** (the unit's key ideas), and a winding trail of nodes: **theory** (book), **lessons** (star), **listening** (headphones: hear it, then play it back), **technique** (hand: five-finger patterns, scales with thumb under, Alberti and boogie left hands, arpeggios), **personal practice** (dumbbell), **songs** (note), **chests** and a **unit test** (trophy). The current node has a progress ring and a START bubble; tap any node for its card.
- **Songs**: only your library, as small square covers (no difficulty shown). **Add songs** opens the marketplace, where one tap brings a song in (or adds your MIDI for the ones waiting for a file); **Upload MIDI** adds your own.
- **A song opens Duolingo style**: close and a progress bar on top, the score on a card, Listen and Learn step by step below, everything else under the gear (hands, waits for you or in tempo, speed, right/wrong colours, keyboard on screen, loop). The keyboard stays hidden and rises only when you are stuck or play a wrong note, with the keys to play lit.
  - **Play**: start whenever you like; the score follows you note by note (or runs in tempo at 0.6×, 0.8× or 1×) and the notes turn green or red.
  - **Listen**: the app plays the song while the cursor moves.
  - **Learn step by step**: the song split into parts (Part 1, Part 2, …, Whole song), each a lesson: right hand, left hand, together, in tempo. 1 star from 70% right, 2 from 85%, 3 from 95%.
  - Tap a note while stopped to start from there.
- **What the course teaches**: the keyboard and finger numbers, treble and bass clef, note values, hands together; rests, eighth notes, intervals, ledger lines, 3/4 and dotted notes; sharps and flats, key signatures (G and F major), major scales, triads, I–IV–V; and styles: classical (Alberti bass, waltz), pop (four chords), blues (12 bars, blues scale, boogie), film (arpeggios) and jazz (seventh chords, ii–V–I). Songs include Mary Had a Little Lamb, Ode to Joy, Lightly Row, Twinkle, When the Saints, Jingle Bells, Happy Birthday, Greensleeves, Minuet in G, Joy to the World, Mozart's Sonata in C, Für Elise, Canon in C, House of the Rising Sun and pieces written for the course.
- **Theory lessons**: one idea at a time, with the staff and a little keyboard, then asks: multiple choice ("Which note is this?", "C up to E is a…") and "play it" questions you answer on your piano or by tapping the keys.
- **The path adapts without telling you**: lessons, listening and technique nodes are written fresh each time from your skill profile, a level up when that skill is strong (or you aced the node), a level down when it is slipping; personal-practice nodes go after whatever you have been getting wrong. Inside every lesson the difficulty is tuned quietly too: speed, how soon the keys light up when you are stuck, how many finger numbers show.
- **Placement test**: on a new path, *Find my level* plays one short piece per unit; each passed with 2 stars skips that unit. A locked unit test (trophy) can be taken to skip ahead.
- **Coming back every day**: XP for every step (more for more stars, a bonus for a perfect one, 20 for finishing today's session), shown top right; the daily streak with **streak freezes** (seven days in a row earn one, two at most; a missed day is covered automatically); a celebration when the daily goal is reached, the session is done or a freeze is earned or used; the session's review is **spaced** (a skill comes due again after 1, 2, 4 or 7 days, by its level); an optional **practice reminder** in Settings (real notifications in the iPhone app, scheduled a week ahead and skipped once the goal is met; on the web only while the app is open).
- **Energy and gems** (Duolingo's freemium model): every lesson step uses 1 energy (25 at most, +1 every 12 minutes); 10 notes right in a row give +1 back, chests give up to +10. Out of energy: wait, refill for 350 gems, or go Premium. Gems come from lessons (2, 4 or 6 by stars), theory and chests; the **Shop** sells refills and streak freezes.
- **Premium**: unlimited energy (9.99 a month, 59.99 a year with a free first week, 89.99 a year for a family of up to 6; priced per region). The whole course is free. No store is connected yet: buying runs in test mode and unlocks Premium on this device only.
- **Look**: Duolingo-style around the piano (white pages, green 3D buttons, unit banners and a winding path, Fredoka and Nunito, confetti and bouncing celebrations); Simply Piano at the piano. See DESIGN.md.
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

Mastery asks a model to read each song and plan how to teach it (`api/plan.ts`). In the Vercel project's environment variables set `ANTHROPIC_API_KEY` (Claude), or `GROQ_API_KEY` to test with Groq (`GROQ_MODEL` picks the model, default `openai/gpt-oss-120b`; `PLAN_PROVIDER=groq` or `claude` chooses when both are set). Without a key the app plans from rules measured on the notes. The plan is kept in the browser under `hugos-piano:strategy:<song id>`, and its `by` field names the model that wrote it.

The app ships public-domain pieces (Satie, Beethoven, Handel, Debussy); film and modern pieces are marketplace slots that take your own MIDI file.

# Leonor
