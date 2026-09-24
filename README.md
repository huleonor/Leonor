# Hugo's Piano

A piano trainer for the phone: notes fall toward the keyboard (or follow the score with a cursor), and the app listens to your piano over Bluetooth MIDI, USB MIDI or the microphone.

Live: https://hugos-piano.vercel.app

## Using it

- **Input** (library, left panel)
  - **Microphone**: works everywhere, including iPhone Chrome and Safari. It hears one note at a time; in a chord, one note counts.
  - **Bluetooth MIDI**: Android/desktop Chrome. On iPhone only inside the free **Bluefy** browser (Apple blocks Bluetooth and MIDI in Chrome/Safari on iOS).
  - **USB / MIDI keyboard**: desktop or Android Chrome with a cable, or a keyboard paired in the OS.
- **Speed**: 0.6× / 0.8× / 1× / 1.2× in the top bar.
- **Wait** (Espera): the song stops at each note until you play it.
- **Notes / Sheet** (Notas / Pauta): falling notes, or the score with a cursor; played notes turn amber (right hand) or cyan (left hand), missed ones rust.
- Tap the notes or the score to pause: restart, go back 5 s, pick hands, or "Just listen".
- **Add to Home Screen** (Chrome/Safari share menu) to open it full screen, like an app.

## Adding songs

- **On the phone**: "Import .mid" in the library. The file stays on that phone only.
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
