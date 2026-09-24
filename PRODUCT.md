# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: Vite + React + TypeScript, installable PWA, static deploy on Vercel (project `hugos-piano`, account hugo4s). Chosen because the app is fully client-side (audio, MIDI, mic) and needs no backend.

## Users

Hugo, one learner practising at his own digital piano. The phone sits sideways (landscape) on the piano's music stand, a hand's length from his eyes, while both hands are on the keys. He glances at it between notes; he cannot tap it often mid-song.

## Product Purpose

Hugo's Piano teaches songs Hugo actually wants to play (Hans Zimmer film scores first) by showing the notes falling toward an on-screen keyboard and listening to what he plays. Success: he gets through a piece he chose, first slowly, then at full speed.

## Positioning

A personal Simply Piano built around Hugo's own library: any MIDI file he imports becomes a lesson, and his real keyboard (Bluetooth MIDI) or the phone's microphone is the input. No subscription, no fixed catalogue.

## Operating Context

- Phone: iPhone, usually Google Chrome (WebKit). iOS browsers have no Web MIDI or Web Bluetooth, so on iPhone the microphone is the default input; Bluetooth MIDI works through the Bluefy browser (Web Bluetooth). Android/desktop Chrome get Web MIDI and Web Bluetooth directly.
- Landscape on a music stand, room lighting of a home, often evening.
- Sessions: pick a song, loop a hard passage slowly, speed up.

## Capabilities and Constraints

- Input: Bluetooth LE MIDI (Web Bluetooth, BLE-MIDI service), Web MIDI (USB or OS-paired), microphone pitch detection (monophonic; chords are unreliable by mic).
- Song library: bundled songs plus MIDI (.mid) import, stored on the device.
- Playback speed presets: 0.6x, 0.8x, 1x, 1.2x.
- Wait mode: the song only advances when the correct note(s) are played.
- Falling-notes view (Synthesia-style) above a piano keyboard.
- Bundled Hans Zimmer songs are fan MIDI transcriptions downloaded from bitmidi.com / midisfree.com (no official MIDI exists): Time (Inception), Now We Are Free (Gladiator), He's a Pirate (Pirates of the Caribbean, Badelt/Zimmer), Cornfield Chase and Interstellar Main Theme (Interstellar). Personal use; the deployed link is not to be shared publicly.

## Brand Commitments

- Name: "Hugo's Piano".
- Reference the user named: Simply Piano (as a functional reference for the learning loop, not a look to copy).
- Language: Portuguese (Portugal) UI copy.

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
