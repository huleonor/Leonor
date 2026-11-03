# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: Vite + React + TypeScript, installable PWA, static deploy on Vercel (project `hugos-piano`, account hugo4s). Chosen because the app is fully client-side (audio, MIDI, mic) and needs no backend.

## Users

Hugo, one learner practising at his own digital piano. The phone sits sideways (landscape) on the piano's music stand, a hand's length from his eyes, while both hands are on the keys. He glances at it between notes; he cannot tap it often mid-song.

## Product Purpose

2026-11: one song at a time, taught by short vertical reels (TikTok style) drawn live from the song's notes, each pattern (left hand, right hand, both) followed straight away by the practice step for it. Claude writes the words on the reels (api/reels.ts). The first song is Tony Ann's Interstellar Experience, a slot that takes his own MIDI file.


Hugo's Piano teaches songs Hugo actually wants to play (Hans Zimmer film scores first) by showing the notes falling toward an on-screen keyboard and listening to what he plays. Success: he gets through a piece he chose, first slowly, then at full speed.

## Positioning

A personal Simply Piano built around Hugo's own library: any MIDI file he imports becomes a lesson, and his real keyboard (Bluetooth MIDI) or the phone's microphone is the input. No subscription, no fixed catalogue.

## Operating Context

- Phone: iPhone 13 (Lightning), mainly through the Hugo's Piano iPhone app (Capacitor, sideloaded with SideStore), which loads the live site from Vercel and reads the piano through CoreMIDI: USB cable via the Lightning to USB Camera Adapter, or Bluetooth MIDI paired in the system sheet. In iPhone browsers only the microphone works (no Web MIDI or Web Bluetooth). Android/desktop Chrome get Web MIDI and Web Bluetooth directly.
- Landscape on a music stand, room lighting of a home, often evening.
- Sessions: pick a song, loop a hard passage slowly, speed up.

## Capabilities and Constraints

- Input: CoreMIDI in the iPhone app (cable and Bluetooth, rescanned automatically), Web MIDI and Web Bluetooth in desktop/Android Chrome, and the microphone everywhere. The mic detector is polyphonic (onsets plus harmonic analysis, with a targeted check of the notes the song expects), so chords count by mic. Keys played on a MIDI keyboard sound through the app's piano by default.
- Learning loop (Simply Piano): every song, bundled or imported, becomes a course of short parts; each part is learnt right hand, left hand, hands together (the music waits), then in tempo; then the whole song and a final performance. Each step earns 1 to 3 stars and opens the next. A daily streak and a daily minutes goal count real practice time.
- Song screen (Simply Piano sheet music): the engraved score with a tool bar of modes: Play (score following, notes turn green; Magic scroll waits for him, Auto scroll runs in tempo), Listen, Teach me (sections as lessons), Feedback on/off, a mini keyboard with the keys to play. Lessons: one engraved line per section with fingering, the next notes in teal, a finger bubble, an n/N notes counter, arrows between steps; falling notes remain as an alternative lesson view. Wait-mode hints show the keys after a wrong note or a stall; song tips come from an analysis of the notes (repeats, hand positions, tricky bars).
- No beginner curriculum: the user chose songs only.
- Song library: bundled songs plus MIDI (.mid) import, stored on the device. Each reel shows a cover photo that evokes the song (free Unsplash photos; film posters are not used).
- Playback speed presets: 0.6x, 0.8x, 1x, 1.2x.
- Wait mode: the song only advances when the correct note(s) are played.
- Falling-notes view (Synthesia-style) above a piano keyboard, as the alternative to the staff.
- Bundled songs are fan MIDI transcriptions (no official MIDI exists): Cornfield Chase (midisfree.com) and He's a Pirate (bitmidi.com, Badelt/Zimmer). Time, Interstellar Main Theme, Now We Are Free, A Way of Life and Maestro are reels waiting for a file: tapping one imports a .mid into that slot. Personal use; the deployed link is not to be shared publicly.

## Brand Commitments

- Name: "Hugo's Piano".
- Reference the user named: Simply Piano, for the learning loop and, by the user's choice in the 2026-10 redesign, for the look too: the category standard played straight (dark indigo app, go-green actions, gold stars, streak flame, scrolling staff). Craft bar: Simply Piano and Duolingo.
- Language: English-only UI (the user first asked for Portuguese plus English, then for English only). Note names default to C D E, with Dó Ré Mi as an option.

## Evidence on Hand

- Raw MIDI files in `_midi_raw/`.
- No logo, imagery, testimonials or other brand assets exist. Do not invent progress stats or claims about songs' official status.

## Product Principles

1. Readable at arm's length: everything he needs mid-song is legible from the music stand without tapping.
2. Hands stay on the keys: controls that matter while playing (speed, wait, restart section) are one tap, big targets.
3. His music, not a catalogue: importing a song is first-class, not buried.
4. Honest listening: show clearly what the app heard, so a wrong detection is visible, not mysterious.

## Accessibility & Inclusion

Large touch targets (min 44px), high contrast for the falling notes and keys under home lighting, respects reduced motion for non-essential UI animation.
