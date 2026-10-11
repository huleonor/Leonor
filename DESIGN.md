---
name: Hugo's Piano
description: A song-learning app in the Simply Piano manner with a sheet-music site's layout; a night indigo shell with one go-green for every action and every right note, every song shown as its own white engraved page, the score on a white card over a full keyboard under a compact bar of violet modes, and Teach me lessons on a warm light page with teal next notes and violet step progress.
colors:
  night: "#14112b"
  night-deep: "#0f0c22"
  surface: "#1d1940"
  surface-2: "#262150"
  raised: "#302a63"
  raised-hover: "#38317a"
  raised-edge: "#1f1a45"
  line: "#3a3470"
  line-2: "#4c4590"
  ink: "#f5f3ff"
  ink-2: "#c0b9ec"
  ink-3: "#9790cc"
  go: "#3fd07a"
  go-hi: "#5fe093"
  go-edge: "#1f9a52"
  go-ink: "#082414"
  star: "#ffcf3f"
  star-off: "#3d3775"
  flame: "#ff8a3d"
  miss: "#ff5d73"
  violet: "#8644f7"
  violet-mist: "#d9c8ff"
  teal: "#14c4cf"
  teal-ink: "#04363b"
  right-hand: "#4fb6ff"
  left-hand: "#ffb547"
  finger-right: "#5b2a86"
  finger-left: "#7a4b12"
  sheet-white: "#ffffff"
  paper: "#fbfaff"
  lesson-bg: "#f0eee9"
  lesson-ink: "#1b1640"
  lesson-ink-2: "#6b6585"
  lesson-chip: "#a9a1bb"
  lesson-chip-edge: "#8d85a3"
  lesson-count: "#6b6182"
  hit-paper: "#178a48"
  miss-paper: "#d92d45"
  score-next: "#0e9fb0"
  score-other: "#b9b4d8"
  notes-display: "#100d24"
  notes-lane: "#151231"
  difficulty-medium: "#ffc94a"
typography:
  display:
    fontFamily: "'Nunito Variable', Nunito, ui-rounded, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 900
    lineHeight: 1.06
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "'Nunito Variable', Nunito, ui-rounded, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 900
    lineHeight: 1.08
    letterSpacing: "-0.01em"
  title:
    fontFamily: "'Nunito Variable', Nunito, ui-rounded, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 900
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  instruction:
    fontFamily: "'Nunito Variable', Nunito, ui-rounded, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 900
    lineHeight: 1.2
  body:
    fontFamily: "'Nunito Variable', Nunito, ui-rounded, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.4
    fontFeature: "tnum"
  button:
    fontFamily: "'Nunito Variable', Nunito, ui-rounded, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 800
    lineHeight: 1
  mode:
    fontFamily: "'Nunito Variable', Nunito, ui-rounded, system-ui, sans-serif"
    fontSize: "14.5px"
    fontWeight: 800
    lineHeight: 1
  label:
    fontFamily: "'Nunito Variable', Nunito, ui-rounded, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 800
    lineHeight: 1.3
  caption:
    fontFamily: "'Nunito Variable', Nunito, ui-rounded, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.45
  stat:
    fontFamily: "'Nunito Variable', Nunito, ui-rounded, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 900
    lineHeight: 1.1
    fontFeature: "tnum"
  score-title:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "20px"
    fontWeight: 700
    letterSpacing: "0"
  score-composer:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "15px"
    fontWeight: 400
rounded:
  page: "6px"
  tag: "8px"
  pill: "10px"
  sm: "12px"
  control: "14px"
  md: "16px"
  lg: "22px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "22px"
components:
  button-primary:
    backgroundColor: "{colors.go}"
    textColor: "{colors.go-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "46px"
  button-primary-hover:
    backgroundColor: "{colors.go-hi}"
    textColor: "{colors.go-ink}"
  button-primary-big:
    backgroundColor: "{colors.go}"
    textColor: "{colors.go-ink}"
    rounded: "{rounded.md}"
    padding: "0 26px"
    height: "54px"
  button-secondary:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "46px"
  button-secondary-hover:
    backgroundColor: "{colors.raised-hover}"
    textColor: "{colors.ink}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "0 26px"
    height: "54px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "40px"
  button-danger:
    backgroundColor: "{colors.miss}"
    textColor: "#2a0610"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "46px"
  icon-button:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    size: "42px"
  icon-button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sm}"
    size: "42px"
  chip:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-2}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
    padding: "0 13px"
    height: "38px"
  segmented:
    backgroundColor: "{colors.night-deep}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.control}"
    padding: "4px"
  segmented-on:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    rounded: "10px"
    height: "36px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "18px"
  song-page:
    backgroundColor: "{colors.sheet-white}"
    textColor: "{colors.lesson-ink}"
    rounded: "{rounded.page}"
    width: "168px"
  difficulty-dot:
    backgroundColor: "{colors.line}"
    rounded: "{rounded.full}"
    size: "7px"
  upload-slot:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.control}"
    padding: "18px"
    width: "360px"
  tag:
    backgroundColor: "rgba(255, 138, 61, .16)"
    textColor: "{colors.flame}"
    typography: "{typography.label}"
    rounded: "{rounded.tag}"
    padding: "2px 8px"
  text-field:
    backgroundColor: "{colors.night-deep}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "48px"
  field-static:
    backgroundColor: "{colors.night-deep}"
    textColor: "{colors.ink-3}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "48px"
  rail-item:
    backgroundColor: "transparent"
    textColor: "{colors.ink-3}"
    rounded: "{rounded.control}"
    width: "70px"
    height: "58px"
  rail-item-active:
    backgroundColor: "rgba(63, 208, 122, .12)"
    textColor: "{colors.go}"
  sheet-bar:
    backgroundColor: "{colors.night}"
    padding: "8px 0 0"
  hands:
    backgroundColor: "{colors.violet}"
    textColor: "#e9ddff"
    rounded: "{rounded.sm}"
    padding: "3px"
  hands-on:
    backgroundColor: "{colors.sheet-white}"
    textColor: "{colors.violet}"
    rounded: "9px"
  mode:
    backgroundColor: "rgba(143, 77, 255, .18)"
    textColor: "{colors.violet-mist}"
    typography: "{typography.mode}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
  mode-on:
    backgroundColor: "{colors.violet}"
    textColor: "{colors.sheet-white}"
  connect:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
  sections-strip:
    backgroundColor: "{colors.violet}"
    padding: "14px 16px"
  section-card:
    backgroundColor: "{colors.sheet-white}"
    textColor: "{colors.lesson-ink}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    width: "210px"
  score-card:
    backgroundColor: "{colors.sheet-white}"
    textColor: "{colors.lesson-ink}"
    rounded: "{rounded.sm}"
  score:
    backgroundColor: "{colors.sheet-white}"
    textColor: "{colors.lesson-ink}"
    typography: "{typography.score-title}"
    padding: "12px 12px 120px"
  part-pill:
    backgroundColor: "{colors.sheet-white}"
    textColor: "{colors.violet}"
    rounded: "{rounded.pill}"
    padding: "3px 12px"
  score-cursor:
    backgroundColor: "{colors.teal}"
    rounded: "3px"
    width: "6px"
  float-button:
    backgroundColor: "{colors.violet}"
    textColor: "{colors.sheet-white}"
    typography: "{typography.mode}"
    rounded: "11px"
    padding: "0 14px"
  float-button-on:
    backgroundColor: "{colors.sheet-white}"
    textColor: "{colors.violet}"
  sheet-keyboard:
    backgroundColor: "{colors.paper}"
    rounded: "10px"
    height: "clamp(80px, 24vh, 190px)"
  lesson-page:
    backgroundColor: "{colors.lesson-bg}"
    textColor: "{colors.lesson-ink}"
    typography: "{typography.instruction}"
  lesson-pause:
    backgroundColor: "{colors.lesson-chip}"
    textColor: "{colors.sheet-white}"
    rounded: "{rounded.md}"
    size: "56px"
  lesson-arrow:
    backgroundColor: "{colors.lesson-chip}"
    textColor: "{colors.sheet-white}"
    rounded: "{rounded.sm}"
    size: "46px"
  lesson-counter:
    backgroundColor: "{colors.lesson-count}"
    textColor: "{colors.sheet-white}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    width: "250px"
    height: "46px"
  lesson-counter-fill:
    backgroundColor: "{colors.violet}"
  finger-bubble-right:
    backgroundColor: "{colors.finger-right}"
    textColor: "{colors.sheet-white}"
    rounded: "{rounded.pill}"
    width: "46px"
    height: "54px"
  finger-bubble-left:
    backgroundColor: "{colors.finger-left}"
    textColor: "{colors.sheet-white}"
  key-target:
    backgroundColor: "{colors.teal}"
    textColor: "{colors.teal-ink}"
  key-hit:
    backgroundColor: "{colors.go}"
    textColor: "{colors.go-ink}"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.night}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
---

# Design System: Hugo's Piano

## Overview

**Creative North Star: "The Green Light"**

Hugo's Piano is the category standard for learning songs, played straight: a night indigo app in the Simply Piano and Duolingo family, where one saturated green means "go" everywhere it appears. The next action is green, a correctly played note is green, the next section to open wears a green ring, the met goal is green. Everything else stays quiet so that green is always the answer to "what do I do now?". Gold is the reward (stars), orange is the streak, red is reserved for the wrong note.

The world has three grounds. The app shell (Home, Songs, Progress, Settings) sits on deep indigo with raised indigo surfaces, a single rounded face (Nunito, heavy weights) and chunky buttons that physically press down on a solid bottom edge. Songs are shown the way a sheet-music site shows them: each is its own white first page, engraved by abcjs, lying on the indigo like paper on a desk, with the composer, the title and difficulty dots underneath. A song opens on the same indigo: a compact bar of violet modes (hands, Listen, Play, Teach me | Waits for you / In tempo, Feedback, the notes count, Connect piano), the engraved score on a white rounded card scaled so at least one whole grand-staff system fits, violet floating buttons at the card's corner, and the full keyboard below with the next keys in teal and played keys in green. Teach me opens a violet strip of section cards between the bar and the card; a section becomes a lesson on a warm light page: one engraved line, the next notes in teal under a finger bubble, the target keys in teal on a large keyboard, and an n/N counter filling with violet. Results and pauses return to indigo cards floating over a scrim, so the reward always feels like the app speaking.

Density is moderate and landscape-first: an 84px rail and 16px card gaps in the shell, and on the song screen a 12px indigo margin framing the score card and the keyboard. This replaces the earlier aluminium "practice instrument" world, the canvas paper staff with lettered note heads, the photo covers on song cards, and the tall Simply-style tool bar with its mini keyboard; notation is real engraving, and every song is shown by its own sheet music.

**Key Characteristics:**
- Night indigo shell with three raised surface steps; the song screen, overlays and result cards stay indigo on every screen.
- One go-green for every primary action, correct note, active nav item, next section and met goal.
- Every song is a white 3:4 sheet-music page engraved from its first bars; no photos, no generic covers.
- The score is a white 12px-radius card over the full keyboard, with a compact serif title row, violet section pills and a 6px teal cursor.
- Teal marks "now": the score cursor, the next notes and the keys to press.
- Violet carries the controls that shape practice: the hands control, mode buttons, floating score buttons, the Teach me strip, section pills, the lesson counter fill.
- Nunito Variable for all interface text, weights 600 to 900, tabular figures throughout.
- Chunky rounded action controls with a solid 3-4px bottom edge that collapses on press.

## Colors

A dark indigo field with a small, strictly assigned set of saturated signals, plus two light working grounds (white sheet-music paper, warm lesson page) with their own deeper ink set.

### Primary
- **Go Green** (`go`): the one action colour. Primary buttons (Continue, Start, Upload MIDI, Add to my songs, Play again, Resume, Next: Left hand, Go on), the round play dots in Today's practice, the active rail item, `Next` tags and the "New" word, a met daily goal, focus rings, switches when on, the plus on the upload slot, the ring around the next section card, the "heard" note in the input test, and every correctly played key. `go-hi` is its hover; `go-edge` is the solid bottom edge under green buttons; `go-ink` is the near-black green text that sits on it.

### Secondary
- **Practice Violet** (`violet`): the controls that shape practice and the teaching structure. The hands segmented well on the song bar, a mode button when on (solid fill, white ink) and, at 18%, when off with **Violet Mist** (`violet-mist`) ink; the floating Restart, Loop and Hide keys buttons on the score card; the Teach me strip behind the section cards, section icons, the outlined section pills printed on the score, the fill that grows through the lesson counter, the count-in number on the lesson page.
- **Now Teal** (`teal`): where Hugo is on paper. The 6px score cursor, the next keys on the song-screen keyboard and the target keys on the lesson keyboard (with `teal-ink` names on them). On the engraved line, the next notes are painted the deeper **Score Teal** (`score-next`) so they read as ink.
- **Star Gold** (`star`): stars won, the star count beside meters and under song pages, the song progress meter fill. Unwon stars use **Star Shadow** (`star-off`).
- **Streak Flame** (`flame`): the streak pill when lit, the flame on Progress and the lesson result card, done days in the week row; at 16% alpha for the "Tricky" tag; and the small attention dot on the Connect piano button when no piano is linked.

### Tertiary
- **Miss Red** (`miss`): a wrong key, error toasts, the danger button, destructive links, error status dots, and the lit dots of a Hard song. Nothing else.
- **Difficulty dots.** Five 7px dots under each song page, lit by level the way sheet-music sites mark it: go green for Easy (levels 1-2), **Medium Amber** (`difficulty-medium`) for Medium (3), miss red for Hard (4-5); unlit dots are `line`. The word (Easy, Medium, Hard) always follows in `ink-3`.
- **Hand colours.** On the lesson's finger bubble, **Plum Right** (`finger-right`) marks the right hand and **Umber Left** (`finger-left`) the left hand. In the falling-notes view, **Sky Right Hand** (`right-hand`) and **Amber Left Hand** (`left-hand`) colour the bars. They are hand identities, not states.

### Neutral
- **Night** (`night`): the app background, page heads, the song screen around the score card, the full-screen upload page.
- **Night Deep** (`night-deep`): the rail, segmented-control wells, text fields and the read-only difficulty field, the input-test readout.
- **Surface** (`surface`): cards, side sheets, stat pills, and the result and pause cards over the score and the lesson.
- **Surface 2** (`surface-2`): items inside cards (today rows, chips, choice tiles), the Connect piano button, the hairline under each song waiting for a file.
- **Raised** (`raised`): secondary buttons, icon buttons, the selected segment; `raised-hover` on hover; `raised-edge` is the solid bottom edge under every raised control.
- **Line** (`line`, `line-2`): empty meter tracks, field strokes, unlit difficulty dots, the song-bar separator, scrollbars, idle dots; `line-2` is the dashed upload slot and the ring of the outline button.
- **Ink** (`ink`, `ink-2`, `ink-3`): primary, secondary and tertiary text on indigo. `ink-3` holds 5:1 or better on `surface` and `surface-2`.

### Paper set (sheet music and lesson)
- **Sheet White** (`sheet-white`): every song page (song cards, the Continue card's cover, the upload preview), the score card, the section cards, and the "on" state of the hands control and the Loop button. **Paper** (`paper`) is the slightly lavender white of the keyboard's white keys.
- **Lesson Ground** (`lesson-bg`): the warm light lesson page.
- **Score Ink** (`lesson-ink`): engraved notation on song pages and the score, the score title, section card titles, the lesson instruction line. **Lesson Ink 2** (`lesson-ink-2`) is secondary text on the lesson page and section cards.
- **Lesson Chip** (`lesson-chip`, edge `lesson-chip-edge`) and **Lesson Counter** (`lesson-count`): the muted lilac pause tile and arrow tiles, and the darker track of the n/N counter.
- **Paper signals:** **Paper Green** (`hit-paper`) for correctly played notes and a learnt section's check; **Paper Red** (`miss-paper`) for missed notes and the "You played …" correction; **Score Teal** (`score-next`) for the next notes; **Ghost Lilac** (`score-other`) for the hand Hugo is not playing in this step.
- **Notes Display** (`notes-display`, `notes-lane`): the dark glass behind the falling-notes alternative in a lesson.

### Named Rules
**The Green Light Rule.** Green means "go" or "right": the next action, a correct note, the next section, a met goal. It is never decoration, never a heading colour, never a mode state. Its one borrowed use is the Easy difficulty dot, which always travels with its word.

**The Teal Now Rule.** Teal is the present: the cursor, the next notes, the keys to press. It never marks an action or a result.

**The Violet Practice Rule.** Violet belongs to the controls that shape practice and to the teaching structure (hands, modes, loop, sections, step progress). It is never "go" and never a note state.

**The One Red Rule.** Miss red is spent only on a wrong note, a real error, and the Hard difficulty dot beside its word. Locked, idle and unavailable states are indigo or lilac, never red.

**The Paper Variant Rule.** Ink on a light ground (notes, finger numbers, text) uses the paper set (`hit-paper`, `miss-paper`, `score-next`, `lesson-ink`); ink on indigo uses the bright set. Key fills may use the bright signals because the whole key is the signal.

## Typography

**Interface Font:** Nunito Variable (self-hosted `/fonts/nunito-latin.woff2`, weight axis 200-1000), falling back to Nunito, ui-rounded, system-ui, sans-serif.
**Score Font:** Georgia, 'Times New Roman', serif, for the title row of the score card only; the notation, bar numbers, finger numbers, and the title and composer printed on song pages are abcjs's own engraving.

**Character:** one rounded, friendly face carried by weight alone for everything Hugo operates: 600 for reading, 800 for controls and labels, 900 for every heading and number that matters. Figures are tabular everywhere (`font-variant-numeric: tabular-nums` on the body). Sheet music is the one printed object, and it looks printed.

### Hierarchy
- **Display** (900, 26px, 1.06): page titles (Good afternoon, Choose a song, Progress); 22px on short landscape screens.
- **Headline** (900, 24px, 1.08): the Continue card's song name (25px), result and pause cards (24px, 22px over the score, 20px on short screens), the streak count, sheet and upload page titles (22px).
- **Title** (900, 17-21px, 1.2): collection headings on Songs (21px), section heads such as Today's practice (18px) and card headings; section card titles at 16px.
- **Instruction** (900, 20px, 1.2): the lesson's one line ("Play E5 with finger 5"), single line with ellipsis; 17px under 760px wide.
- **Body** (600, 15px, 1.4): default text; secondary copy at 14px in `ink-2`; the result line at 14.5px weight 700; prose capped at 56-70ch.
- **Button** (800, 15px; 17px on big buttons): every button, chip, segment and rail label (rail at 11.5px).
- **Mode** (800, 14.5px): mode buttons on the song bar; 14px on the floating score buttons, 13.5px on Connect piano.
- **Label** (800, 12-13px): meta under titles, facts, tags, stat captions, field labels (13px `ink-2`), the difficulty word, section card meta, the step name in the lesson counter.
- **Song lines** under a page: the composer in 800 15px `ink`, the title in 700 14px `ink-3`, each on one line with ellipsis.
- **Caption** (600, 13px, 1.45, `ink-3`): fine print, credits, helper text, the upload facts line.
- **Stat** (900, 18-28px, tabular): totals, the detected note readout, the lesson's n/N count (19px); the countdown number is the one large outlier at 64px. On the song bar the notes count is 14px with the hit count in 900 `ink`.
- **Score title** (Georgia 700, 20px) with the composer in Georgia italic 15px, baseline-aligned on one compact row above the first system. Section pills on the score are Nunito 800 15px in violet.

### Named Rules
**The Weight Not Face Rule.** Interface hierarchy comes from Nunito's weight and size alone: no second interface family, no italics, no uppercase tracking, no kicker lines above headings. The serif and its italic composer line live only on printed sheet music, because that row is part of the page.

## Layout

Landscape-first. The shell is a two-column grid: an 84px rail (plus the left safe-area inset) on `night-deep`, and a scrolling content column with a 22px gutter (plus right and bottom safe-area insets). Pages cap at 1180px and open with a sticky page head on `night` holding the title and, on Home, the streak pill and the daily-minutes pill with a small green meter.

Home is a two-column grid (1.35fr / 1fr, 16px gap): the Continue card (a 3:4 song page up to 170px wide beside the song name, next step, star meter and the big green button) leads, Today's practice list to its right (text rows ending in stars, or a green play dot for a new song), and a horizontal snap-scrolling shelf of 172px song cards below once songs have stars. Songs ("Choose a song", with a green Upload MIDI button in the head) is a stack of collection sections (My songs, Film scores, Modern piano, Classical), each a 21px heading over an auto-fill grid of song pages at 168px minimum with 22px row and 18px column gaps, 28px between sections. When My songs is empty it holds a dashed "Upload a MIDI file" slot instead of a grid; songs still waiting for a MIDI file close the page as a two-column list. Progress is two cards side by side with a full-width totals row. Settings, Edit song and the input check are right-hand side sheets (430px; 640px wide variant).

Uploading a song takes a full-screen page on `night` (12px 20px padding, content capped at 1040px): a head with the title and a close button, then the engraved first page on the left (200-400px column, sticky) and the form on the right, 32px apart.

The song screen takes the whole screen, without the rail, on `night` with 12px side and 8px bottom margins (plus safe areas) and 10px between rows. From the top: the song bar (8px top padding, 10px gaps; the mode group scrolls horizontally when it does not fit), the violet Teach me strip when open (14px 16px padding, 12px gap, horizontal snap scroll), the score card filling the rest, and the keyboard at clamp(80px, 24vh, 190px). While the Teach me strip is open, or when Hugo hides it, the keyboard steps aside and the card grows. Inside the card the score page caps at 1120px with 12px padding and 120px of run-out; the engraving scales between 0.62 and 1.05 so at least one whole grand-staff system fits the card's height, and Waits for you keeps the cursor's line about 36px from the top. Floating buttons sit 10px from the card's bottom corners: the tempo controls at bottom-left in In tempo, Restart / Loop / Hide keys at bottom-right.

The lesson is a three-row grid: the header (12px 18px 4px padding, 16px gap: pause tile, instruction line, then arrows around the counter at the right), the stage, and the keyboard at clamp(70px, 23vh, 112px) inset 10px. The engraved line scales between 0.8 and 1.7 to fill the stage height, centres vertically (no more than 80px below the header), and slides so the next notes sit 30% of the way in.

Spacing runs on 4 / 8 / 12 / 16 / 22px, with 10px and 14px as in-component steps. Under 430px tall the heads, cards, song bar and lesson pause (48px) tighten and the floating score buttons drop their labels; under 960px wide the scroll-mode, Feedback and "piano" labels drop to icons; under 760px wide two-column grids stack (the upload preview narrows to 260px above the form), the elapsed time leaves the song bar and the lesson counter narrows to 120px; in portrait under 640px the rail becomes a 64px bottom tab bar.

## Elevation & Depth

Depth is tonal first: night, surface, surface-2 and raised are steps of the same indigo, and an indigo card is distinguished by its lighter fill, never by a border or a shadow. The lesson ground is flat. Shadows do three specific jobs. Action controls carry a solid, unblurred bottom edge (the "press edge") that makes them look pushable and collapses when pressed. White paper lying on indigo (song pages, the score card) sits on a soft dark shadow, like a page on a desk. Floating things (side sheets, result and pause cards, the floating score buttons, the toast, the count-in disc) sit on soft ambient shadows, over a dimming scrim where they are modal.

### Shadow Vocabulary
- **Press edge** (`box-shadow: 0 4px 0 var(--raised-edge)`; `0 4px 0 var(--go-edge)` on green; `0 4px 0 #a8273a` on danger): buttons at rest. Icon buttons and choice tiles use a 3px edge; the selected segment a 2px edge.
- **Paper press edge** (`0 3px 0 rgba(40, 10, 90, .35)` under section cards; `0 3px 0 #8d85a3` under the lesson pause tile): the same idea on light grounds.
- **Pressed** (`transform: translateY(2-3px); box-shadow: 0 1px 0 <edge>`): the active state, 80ms on the house ease.
- **Next ring** (`box-shadow: 0 0 0 3px #fff, 0 0 0 6px var(--go)`): the next section card in the Teach me strip.
- **Paper page** (`0 1px 0 rgba(255, 255, 255, .06), 0 10px 24px rgba(0, 0, 0, .35)`): song pages and the Continue cover; on hover a song page lifts 3px onto `0 16px 30px rgba(0, 0, 0, .45)`.
- **Score card** (`0 10px 30px rgba(0, 0, 0, .25)`): the white card holding the score.
- **Violet float** (`0 4px 14px rgba(60, 20, 140, .3)`): floating score buttons; Loop when on swaps to `inset 0 0 0 2px var(--violet), 0 4px 14px rgba(60, 20, 140, .2)`.
- **Key edge** (`inset 0 -5px 0 #e3dff4` on white keys, `inset 0 -4px 0 #0f0c22` on black keys): the bottom lip of every keyboard.
- **Sheet** (`-18px 0 40px rgba(0, 0, 0, .35)`): right-hand side sheets.
- **Floating card** (`0 20px 50px rgba(0, 0, 0, .45)` on the lesson's veil cards; `0 20px 50px rgba(20, 17, 43, .45)` on the score's result card).
- **Toast** (`0 10px 30px rgba(0, 0, 0, .4)`) and **Count-in disc** (`0 12px 30px rgba(20, 17, 43, .35)`).

### Named Rules
**The Press Edge Rule.** A control that commits an action in the shell (buttons, icon buttons, choice tiles, section cards, the lesson pause tile) gets a solid bottom edge in its own darker tone, and pressing moves it down onto that edge. Mode buttons on the song bar show state by fill instead; floating score buttons float on a soft violet shadow; quiet and outline buttons stay flat; non-interactive cards never carry an edge.

**The Paper On The Desk Rule.** White sheet music lying on indigo (song pages, the Continue cover, the upload preview, the score card) is the one resting surface that carries a soft dark drop shadow. Indigo cards stay flat.

## Shapes

Everything Hugo touches is rounded and soft. Song pages keep a nearly square 6px corner, because they are paper. Tags and badges use 7-9px corners; the hands control's segments 9px; section pills on the score, the finger bubble and the keyboard's frame on the song screen 10px; floating score buttons 11px; chips, fields, icon buttons, the hands well, mode buttons, Connect piano, lesson arrows, the counter and the score card 12px; buttons, section cards, segment wells and the upload slot 14px; big buttons and the lesson pause tile 16px; cards 22px. The score cursor is a 6px rounded bar. Dots, play buttons, difficulty dots, the switch knob, week days, finger numbers on keys and the count-in are full circles. Meters are 8px pills. Borders are rare: a 2px `line-2` outline on the setup card, the 2px dashed `line-2` border of the upload slot, the 2px inner ring of the outline button, the 2px violet outline of a section pill, the 1px `surface-2` hairline under each waiting song, and the 7px pointer under the finger bubble.

## Components

### Buttons
Chunky, confident and pushable.
- **Shape:** gently rounded (14px; 16px on big).
- **Primary (go):** go green with go-ink text, 46px tall (54px big, 48px on short screens), 20px side padding (26px big), weight 800, icon then label with an 8px gap. Every screen has at most one, and it names the next step.
- **Secondary:** raised indigo with ink text and the raised edge (Try again, Teach me on the result card).
- **Quiet:** transparent, `ink-2` text, 40px, no edge, a 5% white wash on hover (Back to the song, Keep it, Add file).
- **Outline:** transparent with a 2px `line-2` inner ring and ink text, no edge, a 5% white wash on hover; Cancel beside the green button on the upload page, big size.
- **Danger:** miss red with a near-black red ink and a deeper red edge, only for confirmed deletion.
- **Hover / Focus / Active:** hover lightens the fill (`go-hi`, `raised-hover`); focus is a 3px go outline at 3px offset; active drops onto the edge. Disabled is 45% opacity.
- **Icon button:** 42px square, 12px corners, raised with a 3px edge; the ghost variant is transparent with `ink-2` icons (back on the song bar, close on the upload page).
- **Link:** go text, weight 800, a 2px underline at 40% green, 4px offset; muted (`ink-2`) and danger (`miss`) variants.

### Chips and segmented controls
- **Chip:** surface-2 fill, `ink-2` text, 38px, 12px corners, an optional 9px status dot that turns green when on (Feedback on the song bar).
- **Segmented:** a night-deep well with 4px padding; the selected segment is raised with ink text and a 2px edge; a small variant (32px, 13px text) carries Waits for you / In tempo on the song bar and the 0.6x / 0.8x / 1x speed control.
- **Tag:** 7px corners, 12-12.5px weight 900, tinted fill at 16% of its colour: green for Next, flame for Tricky.
- **Difficulty:** five 7px dots 3px apart, then the word 6px after in 12.5px weight 800 `ink-3`; colours as in Colors. On the upload page it sits in a read-only field.

### Cards / Containers
- **Corner Style:** 22px (cards, empty states, floating result and pause cards); 12px for the score card; 6px for song pages.
- **Background:** surface; nested items on surface-2; sheet music on sheet white.
- **Shadow Strategy:** none at rest on indigo cards; paper pages take the paper shadow and floating cards the ambient card shadow (see Elevation).
- **Border:** none.
- **Internal Padding:** 18px (14px on short screens).

### Inputs / Fields
- **Style:** a 13px weight-800 `ink-2` label 6px above a night-deep field with a 2px `line` stroke, 12px corners, 48px tall, 14px side padding, 16px weight-700 text, `ink-3` placeholder.
- **Focus:** the stroke turns go green; no glow.
- **Read-only field:** the same shape holding a value and a 12.5px `ink-3` note at the right (Difficulty, "Worked out from the notes").
- **Switch:** a 52x30 pill on `line` that turns go green when on, with an ink knob sliding 22px.

### Navigation
- **Rail:** 84px wide on night-deep, the app icon at the top, 70x58 items (icon above an 11.5px weight-800 label) in `ink-3`; hover to ink; the active item is go text on a 12% green wash with 14px corners. Settings sits at the bottom.
- **Mobile:** in portrait the rail becomes a 64px bottom tab bar with the same items.

### Song cards (signature)
Songs as a sheet-music site shows them. Each card is a white 3:4 page, 6px corners, on the paper shadow, holding the song's first 8 bars engraved small by abcjs with its title and composer printed at the top (engraved only once the card scrolls near view). Under it, 10px down: the composer in 800 15px ink, the title in 700 14px `ink-3`, then a foot row with the difficulty dots at left and, once won, a gold star and count at right. The whole card is one button; hovering lifts the page 3px onto a deeper shadow, pressing scales it to 98%. Imported songs carry a 44px dark translucent edit button at the page's top-right. The empty My songs section is a dashed 2px `line-2` slot (14px corners, 18px padding, up to 360px) with a green plus, "Upload a MIDI file" in 900 16px and one helper line; its border turns green on hover. Songs waiting for a MIDI file are a two-column list of two-line rows (title over by-line) with a quiet "Add file" button, separated by `surface-2` hairlines.

### Song bar (signature)
The song's controls in one compact row on night, no background of its own. From the left: a ghost back button; the **hands** control (two-hand songs only), a violet well with 3px padding and three icon segments (left hand, both, right hand), the selected one white with violet ink; the **mode buttons** Listen (Stop while it plays), Play and Teach me, each an icon and label at 12px corners, violet-tinted (18%) with `violet-mist` ink when off and solid violet with white ink when on; a 2px `line` separator; the small segmented Waits for you / In tempo; and the Feedback chip. At the right: "Notes: n / N" in 14px `ink-2` with the elapsed time in `ink-3`, and, only when no piano is linked, a surface-2 "Connect piano" button with a 9px flame dot. Mode buttons show state by fill and carry no edge.

### Score card (signature)
White engraved sheet music on a 12px-radius white card with the score-card shadow. A compact title row (Georgia 700 20px title left, Georgia italic 15px composer right) sits close above the first system. Notation is abcjs in score ink, scaled so at least one whole grand-staff system fits the card; finger numbers are printed above the notes when the Fingers setting asks for them. Where each section begins, its name is set in a padded violet-outlined pill (10px corners, Nunito 800 15px). A 6px teal cursor, rounded and slightly translucent, spans the current system and glides from note to note. With Feedback on, played notes turn paper green and missed notes paper red. Tapping a note while stopped starts from there. At the card's bottom-right float the **violet buttons**: Restart (once he has moved off the start), Loop (white with a 2px violet ring and "Looping Part n" while the part under the cursor repeats) and Hide keys / Show keys; each is an icon and label, 11px corners, on the violet float shadow, icon-only on short screens. In In tempo, the bottom-left holds the green Start / Go on / Stop button and the small speed segmented control.

### Song-screen keyboard
The full keyboard under the score card in a 10px-radius frame: paper white keys with a 5px lip and indigo black keys. The next keys fill teal with their names in `teal-ink`; keys played right fill go green; a wrong key flashes miss red.

### Teach me strip and section cards
A full-width violet band that opens between the song bar and the score card, while the keyboard steps aside. Each section of the song (Part 1, Part 2 … Whole song) is a white card, at least 210px wide, 14px corners, a violet mortarboard icon beside a 16px weight-900 title and a 12.5px meta line in `lesson-ink-2` ("Bars 1–4 · 0/4 steps"), on a translucent violet press edge. A learnt section swaps the icon for a check in paper green; the next section to learn wears a white-then-green double ring.

### Upload page
A full-screen page on night that fades in. Left, the song's engraved first page (12 bars) as a 3:4 paper page, with the file name in caption type under it. Right, the form 16px apart: Title and Composer fields, the read-only Difficulty field with its dots, a facts line in caption type (length, hands, sections to learn), then a column of two big buttons 12px apart: the green "Add to my songs" and the outline Cancel. A file that cannot be read shows a miss-red line, one helper line and a Close button instead.

### Lesson (signature)
A warm light page (`lesson-bg`). Top left, a 56px lilac pause tile with a white pause glyph and a paper press edge. Beside it, the instruction line in score ink at 20px weight 900, saying exactly what to play ("Play E5 with finger 5"); a wrong note prefixes it in paper red ("You played F5."). If no piano is linked, a 13.5px line under it offers Connect. Top right, two 46px lilac arrow tiles around the **counter**: a 250px `lesson-count` bar whose violet fill grows with notes played, the step name (Right hand, Left hand, Hands together, In tempo with its speed, Whole song, Final performance) at left in 13px and the n/N count at right in 19px weight 900. The stage holds one engraved line: the step's hand in score ink, the other hand ghosted in `score-other`, played notes paper green, the next notes score teal. Over the next notes floats the **finger bubble**: a 46x54 tile with a hand glyph and the finger number, plum for the right hand and umber for the left, with a pointer underneath. Along the bottom, the large keyboard: paper keys with a 5px lip and octave labels, target keys in teal with their names in `teal-ink` and a dark finger-number disc, played keys go green, a wrong key miss red, and a held key names itself in a small bubble above. Tempo steps show Start in tempo (green) and Listen first over the keyboard before starting. The pause and result cards are indigo veil cards; the result leads with three stars (the middle one larger and raised 8px, won stars popping in gold), the headline (Almost there, Passed, Great job!, Perfect!), one line ("Part 1 · Right hand: 12 of 12 notes · 1 wrong · 92%"), the streak line in flame when it moves, then the green Next button beside Try again and a quiet Back to the song.

### Score result card
Over the score card, a centred indigo card (max 460px): a 22px heading (Beautifully played, You played it through, Keep at it), one result line, then the green Play again and a secondary Teach me.

## Do's and Don'ts

### Do:
- **Do** give each screen at most one go-green button, and make it name the next step.
- **Do** keep green for go and right, teal for "now", violet for the controls that shape practice and the teaching structure, gold for stars, flame for the streak, miss red for wrong notes; difficulty dots are the one rating that borrows green and red, always beside their word.
- **Do** show every song by its own engraved first page (abcjs, white 3:4 paper, title and composer printed on it), with the composer, the title and the difficulty dots beneath.
- **Do** give every shell action control a solid bottom edge in its own darker tone (`raised-edge`, `go-edge`, the paper edges) that collapses on press; let mode buttons show state with a violet fill instead.
- **Do** build depth in the shell by stepping indigo fills (night, surface, surface-2, raised), not with borders or blurred card shadows; white paper on indigo is the one resting surface with a soft shadow.
- **Do** set all interface text in Nunito Variable with tabular figures, 900 for headings and numbers, 800 for controls; keep the serif to the score card's title row.
- **Do** engrave notation with abcjs and colour it through the paper set (`lesson-ink`, `hit-paper`, `miss-paper`, `score-next`, `score-other`); use the bright set on indigo.
- **Do** keep results and pauses on indigo cards over a scrim, whatever ground is underneath.
- **Do** keep touch targets at 44px or more (buttons 46px, rail items 58px, lesson arrows 46px, pause tile 56px, the song card's edit button 44px).

### Don't:
- **Don't** bring back the aluminium instrument-panel world: no metal textures, printed legends, LCD greens or keycap LEDs.
- **Don't** bring back photo covers or Level badges on song cards; a song is shown by its own sheet music.
- **Don't** draw the score on a canvas or letter the note heads; the score is engraved notation with finger numbers, and note names live on the keys.
- **Don't** use green as decoration, a heading colour, a mode state or a background wash beyond the 12-16% tints on the active rail item and tags.
- **Don't** use miss red for locked, idle or disabled states.
- **Don't** add a second interface typeface, uppercase tracked labels or eyebrow lines above headings.
- **Don't** put pure black or neutral grey in the indigo shell; every dark there is indigo.
- **Don't** give indigo cards a press edge or a drop shadow; shadows belong to action controls, floating overlays and white paper lying on indigo.
