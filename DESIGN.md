---
name: Hugo's Piano
description: A piano-learning app that looks and moves like Duolingo around the piano and like Simply Piano at the piano. White pages, one bright owl green for every action and every right note, macaw blue for choices, gold stars, an orange streak flame; chunky uppercase buttons on a 4px edge that press down; a coloured unit banner over a winding path of round lesson nodes. The piano screens (song sheet and Teach me lesson) keep their Simply Piano look.
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
  display: { fontFamily: "Fredoka", weight: 700, use: "page titles, card titles, unit names, plan names, celebration titles" }
  body: { fontFamily: "Nunito", weight: "600 body, 800 labels, 900 numbers" }
  button: { fontFamily: "Nunito", weight: 800, size: 14.5px, transform: uppercase, letterSpacing: 0.06em }
  scale: "12 / 13 / 14.5 / 16 / 19 / 21 / 28 / 30"
rounded: { sm: 12px, md: 16px, lg: 20px, pill: 999px, node: 50% }
spacing: "4 / 8 / 12 / 16 / 22 / 26"
edges: { button: "0 4px 0 <edge>", node: "0 8px 0 <edge>", card: "2px solid swan" }
---

# Design System: Hugo's Piano

## Overview

Around the piano the app is Duolingo: white, friendly, bold, gamified, every screen one obvious green action. At the piano it is Simply Piano: the score, the keys and nothing else. The two meet in the lesson's result card, which is pure Duolingo (stars, confetti, XP counting up) floating over the Simply Piano lesson.

The feel comes from three things more than colour: chunky buttons that sit on a darker 4px edge and press down into it; grey 2px borders instead of shadows; and motion that bounces (the "Start" bubble bobbing over the next lesson, celebrations popping in, confetti on a good result).

## Colors

- **Owl green** is the action and the right note: primary buttons, the next lesson node of unit 1, the daily session's current item, progress bars, the right-first-time key.
- **Macaw blue** is choice and navigation: secondary button text, the selected rail item (pale blue fill with a blue line), the selected segment, the chosen plan, song-screen modes and floating buttons.
- **Bee gold** is reward: stars, XP, the "best value" flag, finished lesson nodes.
- **Fox orange** is the streak flame and the daily-goal celebration.
- **Cardinal red** is a wrong note and a failed step.
- **Beetle purple** marks Premium (with blue in the badge's gradient) and is unit 2's colour.
- Each unit has its own colour for its banner and its open nodes: green, purple, blue, orange, pink, teal, red, in course order.
- Neutrals: white pages, polar for wells and the song screen's ground, swan for every border and edge, eel for text, wolf for secondary text, heading grey for titles.

White text on owl green is Duolingo's choice and is kept on large bold uppercase buttons only; small text is never set on green.

## Typography

- **Fredoka** (self-hosted, `/fonts/fredoka-latin.woff2`) stands in for Duolingo's Feather Bold: rounded, chunky, for titles only.
- **Nunito** (self-hosted) stands in for DIN Round: rounded body text at 600, labels at 800, numbers at 900 with tabular figures.
- Buttons and links are uppercase with 0.06em tracking. Section labels (WARM-UP, UNIT 3) are uppercase 12–13px.

## Components

### Buttons
50px tall (54 big, 38 small), 16px radius, 2px border, a 4px edge below in the darker shade. Press: down 4px, edge gone, in 60ms. Variants: **go** (green, white text), **blue**, **gold**, default (white, swan border, blue text), **quiet** (blue text, no box). Disabled: swan fill, hare text.

### Cards
White, 2px swan border, 16px radius (20 for dialogs, which also get a 6px swan edge). No drop shadows except the celebration toast.

### Navigation rail
White with a 2px swan line on its right. The current page: pale blue fill, 2px blue line, blue icon and label.

### Header stats
No boxes: a bolt and today's XP in gold, the flame and streak (grey until today counts, then orange; a blue snowflake chip shows streak freezes), and the daily-goal pill with a green bar.

### Progress bars
12px, swan track, green fill with a light 3px highlight along its top; song and unit meters fill gold or white on a banner.

### Learn path (signature)
A unit is a coloured banner (16px radius, 4px darker edge, white text) with its number, name, one line, a white meter, and Test out; Premium units carry a purple-blue PREMIUM tag. Lessons are round nodes, 72×66 with an 8px edge, swaying left and right down the page. Open nodes take the unit colour; the next one also gets a white and swan ring and a white "START" (or "CONTINUE") bubble that bobs above it; done nodes are gold with a star; locked nodes are swan with a grey lock. Names sit under the nodes in Fredoka.

### Today's session
A card with a green Start and three tiles (Warm-up, Lesson, Review); the current tile is pale green with a green border, done tiles go quiet with a green check.

### Paywall
A full white page: PREMIUM badge, a Fredoka title, the reason it opened, a Free/Premium comparison table (Premium column tinted purple), three plan cards (12 months chosen by default with a gold "best value" flag, 1 month, family), one full-width green button ("Start my free week"), plain test-mode fine print, Restore and Not now.

### Result card
White dialog with three stars that pop in, a Fredoka headline, a gold XP badge that counts up, the coach's one-line reason, confetti from the top on two stars or more, the green next button, Try again, and a quiet way out.

### Celebrations
A white card that bounces in at the top: a coloured round icon (flame for the goal, gold star for the session, blue snowflake for freezes), a Fredoka title and one line.

### Piano screens (kept)
The song sheet keeps Misolla's layout (score card over a full keyboard) with blue modes; the Teach me lesson keeps Simply Piano's grey page, big single-line staff, now-line and light beam, plain n/N bar and cream keyboard.

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
- Say why the coach changed something, in one line.
- Keep the piano screens free of chrome: the score and the keys.

Don't:
- Use Duolingo's mascot, logo, name or proprietary fonts.
- Put small text on green or white text on gold below 14px bold.
- Animate anything without a reason: motion rewards, guides or confirms.
- Hide what Premium costs or what the free plan includes.
