---
name: Hugo's Piano
description: A piano-learning app in Simply Piano's look (2026-11 redesign): a deep navy app, one vivid blue for every action, the piano screens on Simply's blue-to-teal gradient with the staff on white strips, and each song taught by short vertical reels drawn from its notes. The older Duolingo notes below describe the components' shapes; the colours are now the dark tokens in src/styles.css. White pages, one bright owl green for every action and every right note, macaw blue for choices, gold stars, an orange streak flame; chunky uppercase buttons on a 4px edge that press down; a coloured unit banner over a winding path of round lesson nodes. The piano screens (song sheet and Teach me lesson) keep their Simply Piano look.
source: Duolingo-inspired, after the open "Lingo" DESIGN.md (bergside/awesome-design-md-skills, MIT) and Duolingo's public visual language; no Duolingo assets, mascot, logo or proprietary fonts are used.
colors:
  white: "#ffffff"
  polar: "#f7f7f7"
  swan: "#e5e5e5"
  hare: "#cecece"
  heading: "#3c3c3c"
  eel: "#4b4b4b"
  wolf: "#777777"
  ink-3: "#8f8f8f"
  owl: "#58cc02"
  owl-hi: "#61e002"
  owl-edge: "#58a700"
  owl-soft: "#d7ffb8"
  macaw: "#1cb0f6"
  macaw-edge: "#1899d6"
  macaw-soft: "#ddf4ff"
  macaw-line: "#84d8ff"
  beetle: "#ce82ff"
  beetle-edge: "#a568cc"
  bee: "#ffc800"
  bee-edge: "#e5a800"
  fox: "#ff9600"
  fox-edge: "#e58700"
  cardinal: "#ff4b4b"
  cardinal-edge: "#ea2b2b"
  unit-pink: "#ff86d0"
  unit-teal: "#00cd9c"
  hint: "#ffd25e"
  lesson-grey-band: "#ecebe7"
  lesson-count: "#4a3f61"
typography:
  display: { fontFamily: "Nunito", weight: 700, use: "page titles, card titles, unit names, plan names, celebration titles" }
  body: { fontFamily: "Nunito", weight: "600 body, 800 labels, 900 numbers" }
  button: { fontFamily: "Nunito", weight: 800, size: 14.5px, transform: uppercase, letterSpacing: 0.06em }
  scale: "12 / 13 / 14.5 / 16 / 19 / 21 / 28 / 30"
rounded: { sm: 12px, md: 16px, lg: 20px, pill: 999px, node: 50% }
spacing: "4 / 8 / 12 / 16 / 22 / 26"
edges: { button: "0 4px 0 <edge>", node: "0 8px 0 <edge>", card: "2px solid swan" }
---

# Design System: Hugo's Piano

## Tokens

2026-11: Simply Piano's dark look replaces the white Duolingo ground. Navy ground #121b3e with a soft gradient, cards #1b2752 with a 1px #2c3a6b border, primary blue #1d8cf8 (edge #1466c2) with white bold uppercase text, green #58cc02 only for right notes, white text, muted #9aa5d4 for hints. Piano screens and reels on the gradient #1f3a7d, #2b6f9c, #43a7a7 and back; staff on white strips; glowing now line #2a8cff; right hand #3ec1ff, left hand #ff9f43. Everything else below (shape, type, spacing, motion) still holds.

Before:

White ground like the Duolingo app, in the logo's blue: cards and dialogs white with a 2px #e5e5e5 border, wells #f7f7f7; primary brand blue #2b93ba (edge #1f7395) with white bold uppercase text on 3D buttons, also the interactive accent; green #58cc02 only for right answers, red #ff4b4b only for wrong ones; text #3c3c3c, muted #777777 for hints. One family, Nunito bold: body 700, headings 900 with 0.8px tracking. Radius 12px for every control, card and dialog. Spacing unit 10px. State-driven motion with springs (see CLAUDE.md); CSS transitions 300ms ease. Focus ring 2px accent, 2px offset. Icons are Phosphor, bold. The logo is the penguin with round glasses; no characters in the UI for now. No em or en dashes in visible text. See CLAUDE.md for the full rule list.

## Overview

Around the piano the app is Duolingo: white, friendly, bold, gamified, every screen one obvious green action. At the piano it is Simply Piano: the score, the keys and nothing else. The two meet in the lesson's result card, which is pure Duolingo (stars, confetti, XP counting up) floating over the Simply Piano lesson.

The logo, a penguin with round glasses on the brand blue, is the app's face: the sidebar, the icon, the placement card, the Premium card. There are no characters in the UI for now; big Phosphor icons on tinted discs stand in for illustrations.

The feel comes from three things more than colour: chunky buttons that sit on a darker 4px edge and press down into it; grey 2px borders instead of shadows; and motion that bounces (the "Start" bubble bobbing over the next lesson, celebrations popping in, confetti on a good result).

## Colors

- **Owl green** is the action and the right note: primary buttons, the next lesson node of unit 1, the daily session's current item, progress bars, the right-first-time key.
- **Macaw blue** is choice and navigation: secondary button text, the selected rail item (pale blue fill with a blue line), the selected segment, the chosen plan, song-screen modes and floating buttons.
- **Bee gold** is reward: stars, XP, the "best value" flag, finished lesson nodes.
- **Fox orange** is the streak flame and the daily-goal celebration.
- **Cardinal red** is a wrong note and a failed step.
- **Beetle purple** marks Premium (with blue in the badge's gradient) and is unit 2's colour.
- **Energy pink** (#ff7ad9, edge #e05bbd) is the energy battery and everything that gives or costs energy. **Gem blue** is gems.
- Each unit has its own colour for its banner, its open nodes and its node cards, in a cycle of ten: green, purple, teal, blue, orange, pink, red, navy, magenta, gold.
- Neutrals: white pages, polar for wells and the song screen's ground, swan for every border and edge, eel for text, wolf for secondary text, heading grey for titles.

White text on owl green is Duolingo's choice and is kept on large bold uppercase buttons only; small text is never set on green.

## Typography

- **Nunito** (self-hosted, `/fonts/fredoka-latin.woff2`) stands in for Duolingo's Feather Bold: rounded, chunky, for titles only.
- **Nunito** (self-hosted) stands in for DIN Round: rounded body text at 600, labels at 800, numbers at 900 with tabular figures.
- Buttons and links are uppercase with 0.06em tracking. Section labels (WARM-UP, UNIT 3) are uppercase 12–13px.

## Components

### Buttons
50px tall (54 big, 38 small), 16px radius, 2px border, a 4px edge below in the darker shade. Press: down 4px, edge gone, in 60ms. Variants: **go** (green, white text), **blue**, **gold**, default (white, swan border, blue text), **quiet** (blue text, no box). Disabled: swan fill, hare text.

### Cards
White, 2px swan border, 16px radius (20 for dialogs, which also get a 6px swan edge). No drop shadows except the celebration toast.

### Navigation rail
White with a 2px swan line on its right. The current page: pale blue fill, 2px blue line, blue icon and label.

### Game bar
No boxes, Nunito numbers beside chunky filled icons: the flame and streak (grey until today counts, then orange; a blue snowflake chip shows streak freezes), the blue gem and its count (opens the shop), the pink battery and energy (opens the energy sheet; it blinks grey at zero, shows ∞ with Premium). On phones it is sticky at the top of the path; on wide screens it heads the right-hand column over the daily goal, today's practice and the Premium card.

### Progress bars
12px, swan track, green fill with a light 3px highlight along its top; song and unit meters fill gold or white on a banner.

### The path (signature)
Home is the path. Sections are separated by a centred label (SECTION 2, a Nunito title, one line) between two swan rules. A unit is a sticky coloured banner (16px radius, 4px darker edge, white text): SECTION 1, UNIT 2 and its name, with an outlined GUIDEBOOK button. Nodes are 70×62 discs on an 8px edge with a small white glint, winding left and right (0, 44, 70, 44, 0, −44, −70, −44 px). Each kind has its glyph: book (theory), star (lesson; a crown once aced), headphones (listening), hand (technique), dumbbell (personal practice), note (song), trophy (unit test). Open and done nodes take the unit colour, songs and tests turn gold when done, locked nodes are swan grey with a grey lock. The current node gets a swan progress ring that fills in the unit colour and a white START bubble that bobs above it. Chests are gold and wiggle when they can be opened, grey when locked, faded once opened. Tapping a node opens a card in the unit colour under it (kind and number, title, one line, a white START button with the XP it earns); a locked node's card is grey. A floating white arrow button brings the current node back into view.

### Theory lesson
Duolingo's lesson frame: a close X and a thick brand-blue progress bar that springs forward; a heading (NEW IDEA, CHOOSE THE ANSWER, PLAY IT) and the idea in plain text; an engraved staff on a white card and a small tappable keyboard (marked keys gold, right ones green, a wrong one red); answers as big bordered option buttons that turn blue when chosen; a footer whose verdict sheet slides up green (✓ Nice!) or red (✗ Correct answer: …) with CONTINUE, a wrong answer shaking once. The finish screen: a gold star popping in, LESSON COMPLETE (or PERFECT LESSON) in gold, and three reward tiles (XP gold, gems blue, mistakes green).

### Energy, chests and the shop
The energy sheet rises from the bottom on phones: a battery icon on a pink disc, a title ("You need energy to do lessons" when empty), a pink battery bar with n / 25, the refill timer, three ways to earn energy, then REFILL (white, gem price in blue), UNLIMITED ENERGY (navy, PREMIUM chip) and a way to the Practice tab. A chest opens to a dialog with the open chest and loot chips that pop in (pink energy, blue gems). The shop has a navy Premium card with the logo, then rows of white cards with a big icon and a white price button.

### Today's session
On the Practice tab. A card with a blue Start and three tiles (Warm-up, Lesson, Review); the current tile is pale green with a green border, done tiles go quiet with a green check.

### Paywall
A full white page: PREMIUM badge, a Nunito title, the reason it opened, a Free/Premium comparison table (Premium column tinted purple), three plan cards (12 months chosen by default with a gold "best value" flag, 1 month, family), one full-width green button ("Start my free week"), plain test-mode fine print, Restore and Not now.

### Result card
White dialog with three stars that pop in, a Nunito headline, a gold XP badge that counts up, blue gems and pink energy chips, confetti from the top on two stars or more, the green next button, Try again, and a quiet way out.

### Celebrations
A white card that bounces in at the top: a coloured round icon (flame for the goal, gold star for the session, blue snowflake for freezes), a Nunito title and one line.

### Piano screens (kept)
The song sheet keeps Misolla's layout (score card over a full keyboard) with blue modes; the Teach me lesson keeps Simply Piano's grey page, big single-line staff, now-line and light beam, plain n/N bar and cream keyboard. Path lessons add only a pink energy chip (with a +1 that floats up) and an orange "n in a row" chip in the top bar, and a blue LISTEN FIRST pill while a listening step plays.

## Motion

- Buttons press in 60ms; nodes in 80ms.
- Pages slide up 10px and fade in (350ms, ease-out).
- Dialogs and celebrations rise with a slight overshoot (`cubic-bezier(.34, 1.56, .64, 1)`).
- The Start bubble bobs 6px every 1.6s; the stuck light breathes.
- Stars pop in one after another; XP counts up over 700ms; confetti falls for 1.6s.
- Everything decorative stops under `prefers-reduced-motion`.

## Do's and Don'ts

Do:
- Keep one green action per screen; everything else is white or quiet.
- Use borders and edges for depth, not drop shadows.
- Keep the difficulty invisible: the path just gets a little harder or easier, never a setting or a note about it.
- Give every screen a little life with Pip, but only one Pip per screen.
- Keep the piano screens free of chrome: the score and the keys.

Don't:
- Use Duolingo's mascot, logo, name or proprietary fonts.
- Put small text on green or white text on gold below 14px bold.
- Animate anything without a reason: motion rewards, guides or confirms.
- Hide what Premium costs, or make the course itself Premium: energy is the only limit.

### Lessons at the piano
Simply Piano's page in Duolingo's white: a top bar with the pause button, the step name (FREE PLAY: RIGHT HAND, WITH THE BEAT), the streak chip, the energy chip, the piano-status icon, and the n/N pill (brand-blue fill that springs forward) between two arrows. The staff fills the stage and grows with the screen; its five lines run on edge to edge, the clef and key signature are pinned at the left on a white panel, and played notes slide under a white fade beside it. A thin blue now-line marks where the next notes arrive. The keyboard is hidden while he reads; a wrong note or a stall raises a compact strip of every key the piece needs, next key gold, which sinks again once he plays right. Tempo steps tick a metronome. Praise pops over the staff at 5, 10, 15, 20 and 30 in a row; a finished step pops a green "Great!" (or a red "Let's try that again") pill.

### Songs and the marketplace
My songs: square covers (the song's photo on a collection tint: purple film, teal modern, gold classical, blue mine), title and composer, stars once started, no difficulty, three across on phones; an "Add songs" tile. The marketplace slides up from the bottom: songs by collection, each with ADD that flips to ADDED with a pop. A song opens in the lesson frame: close, progress, gear for options (hands, waits or in tempo, speed, colours, keyboard on screen, loop), the score on a card, and LISTEN plus LEARN STEP BY STEP below; the keyboard rises only when needed, and "Play the first note to start" waits on the score until he does.
