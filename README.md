# Hugo's Piano

A piano-learning app in the manner of Simply Piano, built around your own songs: each song becomes a course you learn part by part, hand by hand, on a scrolling staff that waits for you, with stars and a daily streak. It listens to your piano over USB MIDI, Bluetooth MIDI or the microphone.

Live: https://hugos-piano.vercel.app

## Using it

The app works like Simply Piano, with your own songs.

- **Home**: the Continue card names the exact next step of the song you are learning; Today's practice suggests steps to polish (one or two stars) and a new song. The flame is your daily streak, the bar your minutes today against the daily goal.
- **Songs**: every song, bundled or added by you, shows its level (1 to 5, worked out from the notes) and the stars earned. Tap a song waiting for a file to add its MIDI.
- **A song is a course**: it is split into parts of a few bars. Each part is learnt **right hand**, **left hand**, **hands together** (the music waits for you) and **in tempo**; then parts are joined, then the **whole song** and a **final performance**. Each step gives 1 star from 70% right, 2 from 85%, 3 from 95%, and opens the next step.
- **Practice**: the staff scrolls to a green line; notes turn green when you play them, a wrong note shows in red where you played it, and after a stall the app tells you which keys to press. The keyboard below lights the next keys (blue right hand, amber left hand). In tempo you get Perfect / Good / Early / Late. Top bar: Wait on/off, speed (tap to change), staff or falling notes, and your piano input. Tap the music to pause.
- **Progress**: streak, the last seven days, minutes per day and the daily goal.
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
