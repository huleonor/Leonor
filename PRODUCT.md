# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: Vite + React + TypeScript, installable PWA, static deploy on GitHub Pages (https://huleonor.github.io/Leonor/, from main, `.github/workflows/pages.yml`); an iPhone app (Capacitor) wraps the same site for CoreMIDI. Vercel's git deploys are off. Everything runs on the device (audio, MIDI, microphone, the voice, the hands); no backend and no API key at runtime.

## Users

Hugo, one learner practising at his own digital piano. The phone sits sideways (landscape) on the piano's music stand, an arm away, while both hands are on the keys; sometimes upright in his hand. He glances at it between notes and cannot tap it often mid-song.

## Product Purpose

Leonor teaches one song at a time, the song he chose, in short vertical videos he plays along with, like a teacher in clips: see the pattern, play it with me, repeat. Interstellar Experience by Tony Ann first (his own MIDI file in its slot). Success: he plays a piece he chose, first slowly in pieces, then the whole song at full speed.

## How it teaches (2026-11)

- The song first: one video of its theme while the voice says what the song is, its sections in order (Intro, Verse 1, Interlude, ..., named by the song's form) and how each is learnt.
- Each section is a short series (at most twelve videos): its opening says how it will be learnt and gives two tips from its own notes; then its patterns (the shape alone, the same shape on each chord, the moves between chords), small steps (each hand, then both, slowly), and the whole section.
- Every video: the voice explains while the keys light, the music slowly, then "Train with me" in rounds; with his piano connected the video waits at a note he has not played and says how each round went, or honestly that it heard nothing.
- The videos are drawn live from the song's notes (falling notes, one keyboard, 3D comic hands), never recorded; his MIDI never leaves the device.
- Practise opens the step-by-step lessons (Simply Piano's page: the staff, free play first, then with the beat) and Mastery, which plans the next exercise from every note he plays.

## Positioning

A personal teacher in clips built around his own library: any MIDI file he brings becomes a song taught this way, and his real keyboard (cable or Bluetooth MIDI) or the phone's microphone is the input. No subscription, no fixed catalogue, no game.

## Operating Context

- Phone: iPhone 13, through the Leonor iPhone app (Capacitor, sideloaded) for cable and Bluetooth MIDI; iPhone browsers have only the microphone. Desktop and Android Chrome get Web MIDI and Web Bluetooth.
- Landscape on a music stand, a home's lighting, often evening.
- Sessions: open the song, continue where he left off, watch and play along, go to a section that needs work.

## Navigation

Three destinations: Song (the song being learnt: Continue, its sections as a list, the full song), Library (his songs, bring a MIDI file), Settings (the piano, language, the videos). The videos open from the song and keep a back arrow.

## Brand Commitments

- Name: Leonor. No logo in the app.
- Look: Lo-Fi, a practice notebook (DESIGN.md): paper, index cards, riso pink (right hand) and teal (left hand).
- Two languages, everything including the voice: English and Portuguese of Portugal.
- No game elements: no energy, gems, shop, XP, streaks, medals, daily goals or paywall.

## Evidence on Hand

- Public-domain pieces ship with the app (Gymnopédie No. 1, Für Elise, Handel's Sarabande and Passacaglia, Clair de Lune). Pieces under copyright are slots that take his own MIDI file; nothing of them ships.
- Do not invent progress stats or claims about songs' official status.

## Product Principles

1. Readable at arm's length: what he needs mid-song is legible from the music stand without tapping.
2. Hands stay on the keys: nothing covers the video while it plays; the few controls show when he pauses.
3. His music, not a catalogue: bringing a song is first-class.
4. Honest listening: show what the app heard, and say plainly when it heard nothing.
5. Simple over features: one song, its sections, short clips.

## Accessibility & Inclusion

Touch targets of 44px or more, text at WCAG AA, nothing on the videos under 14px in landscape, reduced motion respected.
