---
name: Hugo's Piano
description: A song-learning app in the Simply Piano manner; a night indigo shell with one go-green for every action and every right note, songs as white engraved sheet music under a dark tool bar of modes, and Teach me lessons on a warm light page with teal next notes and violet step progress.
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
  violet: "#8f4dff"
  teal: "#14c4cf"
  teal-ink: "#04363b"
  tool-cream: "#f4f0e8"
  key-yellow: "#ffd84d"
  mini-case: "#2a2833"
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
  level-1: "#8ff0b5"
  level-2: "#9fd8ff"
  level-3: "#ffe08a"
  level-4: "#ffb38a"
  level-5: "#ff9fb0"
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
  tool:
    fontFamily: "'Nunito Variable', Nunito, ui-rounded, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 800
    lineHeight: 1.2
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
  tag: "8px"
  pill: "10px"
  sm: "12px"
  control: "14px"
  md: "16px"
  float: "18px"
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
  song-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 8px 12px"
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
    padding: "0 12px"
    height: "44px"
  rail-item:
    backgroundColor: "transparent"
    textColor: "{colors.ink-3}"
    rounded: "{rounded.control}"
    width: "70px"
    height: "58px"
  rail-item-active:
    backgroundColor: "rgba(63, 208, 122, .12)"
    textColor: "{colors.go}"
  tool-bar:
    backgroundColor: "{colors.night}"
    padding: "6px 12px"
  tool:
    backgroundColor: "transparent"
    textColor: "{colors.sheet-white}"
    typography: "{typography.tool}"
    rounded: "{rounded.sm}"
    padding: "4px 12px"
    width: "74px"
    height: "58px"
  tool-on:
    backgroundColor: "{colors.tool-cream}"
    textColor: "{colors.violet}"
  mini-keyboard:
    backgroundColor: "{colors.mini-case}"
    rounded: "10px"
    padding: "0 6px 6px"
    height: "42px"
  mini-key-to-play:
    backgroundColor: "{colors.key-yellow}"
  sections-strip:
    backgroundColor: "{colors.violet}"
    padding: "14px 16px"
  section-card:
    backgroundColor: "{colors.sheet-white}"
    textColor: "{colors.lesson-ink}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    width: "210px"
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
  tempo-pill:
    backgroundColor: "rgba(20, 17, 43, .94)"
    textColor: "{colors.ink}"
    rounded: "{rounded.float}"
    padding: "8px 10px 8px 16px"
  corner-button:
    backgroundColor: "rgba(20, 17, 43, .9)"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    size: "46px"
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

The world has three grounds. The app shell (Home, Songs, Progress, Settings) sits on deep indigo with raised indigo surfaces, a single rounded face (Nunito, heavy weights) and chunky buttons that physically press down on a solid bottom edge. A song opens as printed sheet music: a full-screen white page engraved by abcjs, set under a dark tool bar of modes (Listen, Teach me, Play | Feedback, Magic scroll, Auto scroll, Connect, Exit) and a small instrument-like keyboard that lights the keys to play in yellow, with a teal cursor moving through the score. Teach me opens a violet strip of section cards; a section becomes a lesson on a warm light page: one engraved line, the next notes in teal under a finger bubble, the target keys in teal on a large keyboard, and an n/N counter filling with violet. Results and pauses return to indigo cards floating over a scrim, so the reward always feels like the app speaking.

Density is moderate and landscape-first: an 84px rail and 16px card gaps in the shell, and edge-to-edge working surfaces (score, lesson) with nothing between Hugo and the next note. This replaces the earlier aluminium "practice instrument" world and the canvas paper staff with lettered note heads; notation is real engraving now.

**Key Characteristics:**
- Night indigo shell with three raised surface steps; tool bar, overlays and result cards stay indigo on every screen.
- One go-green for every primary action, correct note, active nav item, next section and met goal.
- A white engraved score with a compact serif title row, violet section pills and a 6px teal cursor.
- Teal marks "now" on paper: the cursor, the next notes and the target keys; yellow marks the keys to play on the mini keyboard.
- Violet carries the teaching structure: active mode ink, the Teach me strip, section pills, the lesson counter fill.
- Nunito Variable for all interface text, weights 600 to 900, tabular figures throughout.
- Chunky rounded action controls with a solid 3-4px bottom edge that collapses on press.

## Colors

A dark indigo field with a small, strictly assigned set of saturated signals, plus two light working grounds (white score, warm lesson page) with their own deeper ink set.

### Primary
- **Go Green** (`go`): the one action colour. Primary buttons (Continue, Start, Play again, Resume, Next: Left hand, Go on), round play dots, the active rail item, `Next` tags, a met daily goal, focus rings, switches when on, the ring around the next section card, the "heard" note in the input test, and every correctly played key. `go-hi` is its hover; `go-edge` is the solid bottom edge under green buttons; `go-ink` is the near-black green text that sits on it.

### Secondary
- **Teaching Violet** (`violet`): the teaching structure. The ink of an active mode on the tool bar, the Teach me strip behind the section cards, section icons, the outlined section pills printed on the score, the fill that grows through the lesson counter, the count-in number on the lesson page.
- **Now Teal** (`teal`): where Hugo is on paper. The 6px score cursor and the target keys on the lesson keyboard (with `teal-ink` names on them). On the engraved line, the next notes are painted the deeper **Score Teal** (`score-next`) so they read as ink.
- **Star Gold** (`star`): stars won, the star count beside meters, the song progress meter fill. Unwon stars use **Star Shadow** (`star-off`).
- **Streak Flame** (`flame`): the streak pill when lit, the flame on Progress and the lesson result card, done days in the week row; at 16% alpha for the "Tricky" tag; and the small attention dot on the Connect tool when no piano is linked.

### Tertiary
- **Miss Red** (`miss`): a wrong key, error toasts, the danger button, destructive links, error status dots. Nothing else.
- **Key Yellow** (`key-yellow`): the keys to play on the mini keyboard under the tool bar, and only there.
- **Hand colours.** On the lesson's finger bubble, **Plum Right** (`finger-right`) marks the right hand and **Umber Left** (`finger-left`) the left hand. In the falling-notes view, **Sky Right Hand** (`right-hand`) and **Amber Left Hand** (`left-hand`) colour the bars. They are hand identities, not states.
- **Level Ramp** (`level-1` to `level-5`): pastel mint, sky, butter, apricot and rose for the Level 1-5 badge on covers and song facts.

### Neutral
- **Night** (`night`): the app background, page heads, the song tool bar and its collapse handle.
- **Night Deep** (`night-deep`): the rail, segmented-control wells, text fields, the input-test readout.
- **Surface** (`surface`): cards, song cards, side sheets, stat pills, and the result and pause cards over the sheet and the lesson.
- **Surface 2** (`surface-2`): items inside cards (today rows, chips, choice tiles).
- **Raised** (`raised`): secondary buttons, icon buttons, the selected segment; `raised-hover` on hover; `raised-edge` is the solid bottom edge under every raised control.
- **Line** (`line`, `line-2`): empty meter tracks, field strokes, scrollbars, the tool bar separator, idle dots.
- **Ink** (`ink`, `ink-2`, `ink-3`): primary, secondary and tertiary text on indigo. `ink-3` holds 5:1 or better on `surface` and `surface-2`.
- **Mini Case** (`mini-case`): the dark case the mini keyboard hangs in, under the tool bar.

### Paper set (score and lesson)
- **Sheet White** (`sheet-white`): the score page and the section cards. **Paper** (`paper`) is the slightly lavender white of the keyboard's white keys.
- **Lesson Ground** (`lesson-bg`): the warm light lesson page.
- **Score Ink** (`lesson-ink`): engraved notation, the score title, section card titles, the lesson instruction line. **Lesson Ink 2** (`lesson-ink-2`) is secondary text on the lesson page and section cards.
- **Lesson Chip** (`lesson-chip`, edge `lesson-chip-edge`) and **Lesson Counter** (`lesson-count`): the muted lilac pause tile and arrow tiles, and the darker track of the n/N counter.
- **Paper signals:** **Paper Green** (`hit-paper`) for correctly played notes and a learnt section's check; **Paper Red** (`miss-paper`) for missed notes and the "You played …" correction; **Score Teal** (`score-next`) for the next notes; **Ghost Lilac** (`score-other`) for the hand Hugo is not playing in this step.
- **Notes Display** (`notes-display`, `notes-lane`): the dark glass behind the falling-notes alternative in a lesson.

### Named Rules
**The Green Light Rule.** Green means "go" or "right": the next action, a correct note, the next section, a met goal. It is never decoration, never a heading colour, never a mode state.

**The Teal Now Rule.** On paper, teal is the present: the cursor, the next notes, the keys to press. It never marks an action or a result.

**The Violet Teacher Rule.** Violet belongs to the teaching structure (modes, sections, step progress). It is never "go" and never a note state.

**The One Red Rule.** Miss red is spent only on a wrong note or a real error. Locked, idle and unavailable states are indigo or lilac, never red.

**The Paper Variant Rule.** Ink on a light ground (notes, finger numbers, text) uses the paper set (`hit-paper`, `miss-paper`, `score-next`, `lesson-ink`); ink on indigo uses the bright set. Key fills may use the bright signals because the whole key is the signal.

## Typography

**Interface Font:** Nunito Variable (self-hosted `/fonts/nunito-latin.woff2`, weight axis 200-1000), falling back to Nunito, ui-rounded, system-ui, sans-serif.
**Score Font:** Georgia, 'Times New Roman', serif, for the title row of the printed score only; the notation, bar numbers and finger numbers are abcjs's own engraving.

**Character:** one rounded, friendly face carried by weight alone for everything Hugo operates: 600 for reading, 800 for controls and labels, 900 for every heading and number that matters. Figures are tabular everywhere (`font-variant-numeric: tabular-nums` on the body). The score is the one printed object, and it looks printed.

### Hierarchy
- **Display** (900, 26px, 1.06): page titles (Good afternoon, Songs, Progress); 22px on short landscape screens.
- **Headline** (900, 24px, 1.08): the Continue card's song name (25px), result and pause cards (24px, 22px on the sheet, 20px on short screens), the streak count, sheet titles (22px).
- **Title** (900, 17-19px, 1.2): section heads such as Today's practice and card headings; section card titles at 16px.
- **Instruction** (900, 20px, 1.2): the lesson's one line ("Play E5 with finger 5"), single line with ellipsis; 17px under 760px wide.
- **Body** (600, 15px, 1.4): default text; secondary copy at 14px in `ink-2`; the result line at 14.5px weight 700; prose capped at 56-70ch.
- **Button** (800, 15px; 17px on big buttons): every button, chip, segment and rail label (rail at 11.5px).
- **Tool** (800, 13px): labels under the tool bar icons.
- **Label** (800, 12-13px): meta under titles, facts, tags, stat captions, section card meta, the step name in the lesson counter.
- **Caption** (600, 13px, 1.45, `ink-3`): fine print, credits, helper text.
- **Stat** (900, 18-28px, tabular): totals, add-song facts, the detected note readout, the lesson's n/N count (19px); the countdown number is the one large outlier at 64px.
- **Score title** (Georgia 700, 20px) with the composer in Georgia italic 15px, baseline-aligned on one compact row above the first system. Section pills on the score are Nunito 800 15px in violet.

### Named Rules
**The Weight Not Face Rule.** Interface hierarchy comes from Nunito's weight and size alone: no second interface family, no italics, no uppercase tracking, no kicker lines above headings. The serif and its italic composer line live only in the score's title row, because that row is part of the printed page.

## Layout

Landscape-first. The shell is a two-column grid: an 84px rail (plus the left safe-area inset) on `night-deep`, and a scrolling content column with a 22px gutter (plus right and bottom safe-area insets). Pages cap at 1180px and open with a sticky page head on `night` holding the title and, on Home, the streak pill and the daily-minutes pill with a small green meter.

Home is a two-column grid (1.35fr / 1fr, 16px gap): the Continue card (cover beside song, next step, star meter and the big green button) leads, Today's practice list to its right, and a horizontal snap-scrolling shelf of 172px song cards below once songs have stars. Songs is an auto-fill grid of 150px-minimum cards with a segmented filter and an Add song button in the head. Progress is two cards side by side with a full-width totals row. Settings, Add song and Edit song are right-hand side sheets (430px; 640px wide variant).

The song sheet takes the whole screen, without the rail. From the top: the tool bar (6px 12px padding, 58px tools, centred and horizontally scrollable), the mini keyboard hanging under it (42px tall, min(760px, 72%) wide, centred), the violet Teach me strip when open (14px 16px padding, 12px gap, horizontal snap scroll), then the white score filling the rest. The score page caps at 1120px with 12px padding and 120px of run-out at the bottom; each line holds one to five bars depending on note density, and Magic scroll keeps the cursor's line about 70px from the top. Floating controls sit 14px from the bottom-right corner (restart tile, or the tempo pill in Auto scroll). Collapsing the tool bar leaves a 64x30 handle hanging from the top centre.

The lesson is a three-row grid: the header (12px 18px 4px padding, 16px gap: pause tile, instruction line, then arrows around the counter at the right), the stage, and the keyboard at clamp(70px, 23vh, 112px) inset 10px. The engraved line scales between 0.8 and 1.7 to fill the stage height, centres vertically (no more than 80px below the header), and slides so the next notes sit 30% of the way in.

Spacing runs on 4 / 8 / 12 / 16 / 22px, with 10px and 14px as in-component steps. Under 430px tall the heads, cards, tools (50px) and lesson pause (48px) tighten; under 760px wide two-column grids stack, tool labels hide (52px icon-only tools) and the lesson counter narrows to 120px; in portrait under 640px the rail becomes a 64px bottom tab bar.

## Elevation & Depth

Depth is tonal first: night, surface, surface-2 and raised are steps of the same indigo, and a card is distinguished by its lighter fill, never by a border. The paper grounds are flat. Shadows do two specific jobs. Action controls carry a solid, unblurred bottom edge (the "press edge") that makes them look pushable and collapses when pressed. Floating things (side sheets, result and pause cards, the tempo pill, the toast, the count-in disc) sit on soft dark ambient shadows, over a dimming scrim where they are modal.

### Shadow Vocabulary
- **Press edge** (`box-shadow: 0 4px 0 var(--raised-edge)`; `0 4px 0 var(--go-edge)` on green; `0 4px 0 #a8273a` on danger): buttons at rest. Icon buttons and choice tiles use a 3px edge; the selected segment a 2px edge.
- **Paper press edge** (`0 3px 0 rgba(40, 10, 90, .35)` under section cards; `0 3px 0 #8d85a3` under the lesson pause tile): the same idea on light grounds.
- **Pressed** (`transform: translateY(2-3px); box-shadow: 0 1px 0 <edge>`): the active state, 80ms on the house ease.
- **Next ring** (`box-shadow: 0 0 0 3px #fff, 0 0 0 6px var(--go)`): the next section card in the Teach me strip.
- **Key edge** (`inset 0 -5px 0 #e3dff4` on white keys, `inset 0 -4px 0 #0f0c22` on black keys): the large keyboard's bottom lip; the mini keyboard is flat.
- **Sheet** (`-18px 0 40px rgba(0, 0, 0, .35)`): right-hand side sheets.
- **Floating card** (`0 20px 50px rgba(0, 0, 0, .45)` on the lesson's veil cards; `0 20px 50px rgba(20, 17, 43, .45)` on the sheet result card).
- **Tempo pill** (`0 10px 30px rgba(20, 17, 43, .3)`) and **Toast** (`0 10px 30px rgba(0, 0, 0, .4)`).
- **Count-in disc** (`0 12px 30px rgba(20, 17, 43, .35)`).

### Named Rules
**The Press Edge Rule.** A control that commits an action (buttons, icon buttons, choice tiles, section cards, the lesson pause tile) gets a solid bottom edge in its own darker tone, and pressing moves it down onto that edge. Mode toggles on the tool bar show state by fill instead, and non-interactive cards never carry an edge.

## Shapes

Everything Hugo touches is rounded and soft. Tags and badges use 7-9px corners; section pills on the score and the finger bubble 10px; chips, fields, icon buttons, tools, lesson arrows and the counter 12px; buttons, section cards, segment wells and the restart tile 14px; big buttons, song cards and the lesson pause tile 16px; the tempo pill 18px; cards 22px. The mini keyboard's case has 10px bottom corners and the collapse handle 14px bottom corners, both hanging from the bar above. The score cursor is a 6px rounded bar. Dots, play buttons, the switch knob, week days, finger numbers on keys and the count-in are full circles. Meters are 8px pills. Borders are rare: a 2px `line-2` outline on the setup card, the 2px violet outline of a section pill, and the 7px pointer under the finger bubble.

## Components

### Buttons
Chunky, confident and pushable.
- **Shape:** gently rounded (14px; 16px on big).
- **Primary (go):** go green with go-ink text, 46px tall (54px big, 48px on short screens), 20px side padding (26px big), weight 800, icon then label with an 8px gap. Every screen has at most one, and it names the next step.
- **Secondary:** raised indigo with ink text and the raised edge (Try again, Teach me, Restart, Listen).
- **Quiet:** transparent, `ink-2` text, 40px, no edge, a 5% white wash on hover (Back to the song, Keep it).
- **Danger:** miss red with a near-black red ink and a deeper red edge, only for confirmed deletion.
- **Hover / Focus / Active:** hover lightens the fill (`go-hi`, `raised-hover`); focus is a 3px go outline at 3px offset; active drops onto the edge. Disabled is 45% opacity.
- **Icon button:** 42px square, 12px corners, raised with a 3px edge; the ghost variant is transparent with `ink-2` icons.
- **Link:** go text, weight 800, a 2px underline at 40% green, 4px offset; muted (`ink-2`) and danger (`miss`) variants.

### Chips and segmented controls
- **Chip:** surface-2 fill, `ink-2` text, 38px, 12px corners, an optional 9px status dot that turns green when on.
- **Segmented:** a night-deep well with 4px padding; the selected segment is raised with ink text and a 2px edge; a small variant (32px, 13px text) sits in the tempo pill.
- **Tag:** 7px corners, 12-12.5px weight 900, tinted fill at 16% of its colour: green for Next, flame for Tricky.
- **Level badge:** a dark translucent pill on the cover's top-left corner, its text in the level ramp colour.

### Cards / Containers
- **Corner Style:** 22px (cards, empty states, floating result and pause cards); 16px for song cards and covers.
- **Background:** surface; nested items on surface-2.
- **Shadow Strategy:** none at rest (see Elevation); floating cards take the ambient card shadow.
- **Border:** none.
- **Internal Padding:** 18px (14px on short screens).

### Inputs / Fields
- **Style:** night-deep fill, 2px `line` stroke, 12px corners, 44px tall, 16px weight-700 text, `ink-3` placeholder.
- **Focus:** the stroke turns go green; no glow.
- **Switch:** a 52x30 pill on `line` that turns go green when on, with an ink knob sliding 22px.

### Navigation
- **Rail:** 84px wide on night-deep, the app icon at the top, 70x58 items (icon above an 11.5px weight-800 label) in `ink-3`; hover to ink; the active item is go text on a 12% green wash with 14px corners. Settings sits at the bottom.
- **Mobile:** in portrait the rail becomes a 64px bottom tab bar with the same items.

### Mode tool bar (signature)
The song's controls, Simply Piano's way: a night bar of tools, each a 24px line icon over a 13px weight-800 label in white, at least 74x58 with 12px corners. Order: collapse chevron, Listen (becomes Stop while playing to him), Teach me, Play, a 2px `line` separator, Feedback, Magic scroll, Auto scroll, Connect (only when no piano is linked, with a flame dot on its icon), Exit. Hover is an 8% white wash. An active mode sits on a **cream pill** (`tool-cream`) with violet icon and label; several can be on at once (Play, Feedback and one of the two scroll modes). Under 760px the labels drop and the tools shrink to 52px icons.

### Mini keyboard
An instrument-like strip hanging under the tool bar: paper white keys and near-black keys in a dark `mini-case` with 10px bottom corners, no labels, no lips. The keys to play next fill **key yellow**; keys played right fill go green; a wrong key flashes miss red.

### Teach me strip and section cards
A full-width violet band that opens under the mini keyboard. Each section of the song (Part 1, Part 2 … Whole song) is a white card, at least 210px wide, 14px corners, a violet mortarboard icon beside a 16px weight-900 title and a 12.5px meta line in `lesson-ink-2` ("Bars 1–4 · 0/4 steps"), on a translucent violet press edge. A learnt section swaps the icon for a check in paper green; the next section to learn wears a white-then-green double ring.

### Score (signature)
White engraved sheet music, edge to edge. A compact title row (Georgia 700 20px title left, Georgia italic 15px composer right) sits close above the first system. Notation is abcjs in score ink; finger numbers are printed above the notes when the Fingers setting asks for them. Where each section begins, its name is set in a padded violet-outlined pill (10px corners, Nunito 800 15px). A 6px teal cursor, rounded and slightly translucent, spans the current system and glides from note to note. With Feedback on, played notes turn paper green and missed notes paper red. Tapping a note while stopped starts from there. A dark 46px restart tile floats bottom-right once he has moved off the start; in Auto scroll it is replaced by the **tempo pill**: a dark rounded float holding the green Start / Go on / Stop button and a small 0.6x / 0.8x / 1x segmented speed control.

### Lesson (signature)
A warm light page (`lesson-bg`). Top left, a 56px lilac pause tile with a white pause glyph and a paper press edge. Beside it, the instruction line in score ink at 20px weight 900, saying exactly what to play ("Play E5 with finger 5"); a wrong note prefixes it in paper red ("You played F5."). If no piano is linked, a 13.5px line under it offers Connect. Top right, two 46px lilac arrow tiles around the **counter**: a 250px `lesson-count` bar whose violet fill grows with notes played, the step name (Right hand, Left hand, Hands together, In tempo with its speed, Whole song, Final performance) at left in 13px and the n/N count at right in 19px weight 900. The stage holds one engraved line: the step's hand in score ink, the other hand ghosted in `score-other`, played notes paper green, the next notes score teal. Over the next notes floats the **finger bubble**: a 46x54 tile with a hand glyph and the finger number, plum for the right hand and umber for the left, with a pointer underneath. Along the bottom, the large keyboard: paper keys with a 5px lip and octave labels, target keys in teal with their names in `teal-ink` and a dark finger-number disc, played keys go green, a wrong key miss red, and a held key names itself in a small bubble above. Tempo steps show Start in tempo (green) and Listen first over the keyboard before starting. The pause and result cards are indigo veil cards; the result leads with three stars (the middle one larger and raised 8px, won stars popping in gold), the headline (Almost there, Passed, Great job!, Perfect!), one line ("Part 1 · Right hand: 12 of 12 notes · 1 wrong · 92%"), the streak line in flame when it moves, then the green Next button beside Try again and a quiet Back to the song.

### Sheet result card
Over the score, a centred indigo card (max 460px): a 22px heading (Beautifully played, You played it through, Keep at it), one result line, then the green Play again and a secondary Teach me.

## Do's and Don'ts

### Do:
- **Do** give each screen at most one go-green button, and make it name the next step.
- **Do** keep green for go and right, teal for "now" on paper, violet for teaching structure, gold for stars, flame for the streak, miss red for wrong notes.
- **Do** give every action control a solid bottom edge in its own darker tone (`raised-edge`, `go-edge`, the paper edges) that collapses on press; let mode toggles show state with the cream pill instead.
- **Do** build depth in the shell by stepping indigo fills (night, surface, surface-2, raised), not with borders or blurred card shadows.
- **Do** set all interface text in Nunito Variable with tabular figures, 900 for headings and numbers, 800 for controls; keep the serif to the score's title row.
- **Do** engrave notation with abcjs and colour it through the paper set (`lesson-ink`, `hit-paper`, `miss-paper`, `score-next`, `score-other`); use the bright set on indigo.
- **Do** keep results and pauses on indigo cards over a scrim, whatever ground is underneath.
- **Do** keep touch targets at 44px or more (buttons 46px, tools 58px, lesson arrows 46px, pause tile 56px, rail items 58px).

### Don't:
- **Don't** bring back the aluminium instrument-panel world: no metal textures, printed legends, LCD greens or keycap LEDs.
- **Don't** draw the score on a canvas or letter the note heads; the score is engraved notation with finger numbers, and note names live on the keys.
- **Don't** use green as decoration, a heading colour, a mode state or a background wash beyond the 12-16% tints on the active rail item and tags.
- **Don't** use miss red for locked, idle or disabled states.
- **Don't** add a second interface typeface, uppercase tracked labels or eyebrow lines above headings.
- **Don't** put pure black or neutral grey in the indigo shell; every dark there is indigo. The mini keyboard's case is the one neutral dark, because it is an instrument.
- **Don't** give static cards a press edge or a drop shadow; shadows belong to action controls and floating overlays.
