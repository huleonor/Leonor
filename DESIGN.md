---
name: Hugo's Piano
description: A song-learning app in the Simply Piano manner; night indigo ground, one go-green for every action and every right note, gold stars, an orange streak flame, and a light paper stage where the staff scrolls.
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
  right-hand: "#4fb6ff"
  left-hand: "#ffb547"
  paper: "#fbfaff"
  staff-ink: "#1b1640"
  staff-ink-2: "#5b5590"
  staff-line: "#c9c4e6"
  clef-panel: "#f3f1fd"
  staff-go: "#178a48"
  staff-miss: "#e5384f"
  staff-right: "#1782d6"
  staff-left: "#c97800"
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
rounded:
  tag: "8px"
  sm: "12px"
  control: "14px"
  md: "16px"
  stage: "18px"
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
  step-tile:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px"
  step-tile-next:
    backgroundColor: "rgba(63, 208, 122, .14)"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
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
  stage:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.staff-ink}"
    rounded: "{rounded.stage}"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.night}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
---

# Design System: Hugo's Piano

## Overview

**Creative North Star: "The Green Light"**

Hugo's Piano is the category standard for learning songs, played straight: a night indigo app in the Simply Piano and Duolingo family, where one saturated green means "go" everywhere it appears. The next action is green, the right note is green, the now-line on the staff is green, the met goal is green. Everything else stays in quiet indigo so that green is always the answer to "what do I do now?". Gold is the reward (stars), orange is the streak, red is reserved for the wrong note.

The world has two grounds. The app itself sits on deep indigo with raised indigo surfaces, a single rounded face (Nunito, heavy weights) and chunky buttons that physically press down on a solid bottom edge. The practice stage is a light lavender-white paper where the staff scrolls and the keyboard lights the next keys, bright enough to read from the music stand under evening room light. Density is moderate and landscape-first: an 84px left rail, cards on a 16px grid gap, and nothing that slows the next step.

This replaces the earlier aluminium "practice instrument" world entirely. There are no printed legends, no hardware costume, no LCD greens; the only skeuomorphism left is the pressable button edge, which belongs to the category itself.

**Key Characteristics:**
- Night indigo ground with three raised surface steps; no pure black, no grey.
- One go-green for every primary action, correct note, active nav item and met goal.
- Gold stars, orange flame, red only for wrong notes; sky blue right hand and amber left hand on keys and step badges.
- Nunito Variable for everything, weights 600 to 900, tabular figures throughout.
- Chunky rounded controls with a solid 3-4px bottom edge that collapses on press.
- A light paper stage for the staff and keyboard inside the dark app.

## Colors

A dark indigo field with a small, strictly assigned set of saturated signal colours, plus a paper set for the practice stage.

### Primary
- **Go Green** (`go`): the one action colour. Primary buttons, the Continue/Start/Next buttons, round play dots, the active rail item, `Next` tags, the progress bar in practice, a met daily goal, focus rings, switches when on, the "heard" note in the input test, and every correctly played key. `go-hi` is its hover; `go-edge` is the solid bottom edge under green buttons; `go-ink` is the near-black green text that sits on it.

### Secondary
- **Star Gold** (`star`): stars won, the star count beside meters, the song progress meter fill. Unwon stars use **Star Shadow** (`star-off`), a quiet indigo that reads as an empty slot rather than a disabled control.
- **Streak Flame** (`flame`): the streak pill when lit, the flame on the Progress page and result card, done days in the week row. Also used, at 16% alpha, for the "Tricky" tag on course parts and as the "No piano" status dot.

### Tertiary
- **Sky Right Hand** (`right-hand`) and **Amber Left Hand** (`left-hand`): the next keys to play on the keyboard and the R/L badges on step tiles. They are hand identities, not states.
- **Miss Red** (`miss`): a wrong key, the wrong-note hint, error toasts, destructive links, error status dots. Nothing else.
- **Level Ramp** (`level-1` to `level-5`): pastel mint, sky, butter, apricot and rose for the Level 1-5 badge on covers and song facts.

### Neutral
- **Night** (`night`): the app background, page heads, practice frame.
- **Night Deep** (`night-deep`): the rail, segmented-control wells, text fields, tile badges, the input-test readout.
- **Surface** (`surface`): cards, song cards, course parts, side sheets, stat pills.
- **Surface 2** (`surface-2`): items inside cards (today rows, step tiles, chips, choice tiles, result stats).
- **Raised** (`raised`): secondary buttons, icon buttons, the selected segment; `raised-hover` on hover; `raised-edge` is the solid bottom edge under every raised control.
- **Line** (`line`, `line-2`): empty meter tracks, field strokes, scrollbars, dashed locked tiles, idle dots.
- **Ink** (`ink`, `ink-2`, `ink-3`): primary text, secondary text, tertiary labels and inactive rail items. `ink-3` holds 5:1 or better on `surface` and `surface-2`.

### Stage (paper) set
- **Paper** (`paper`): the staff stage, white keys, the input-test keys.
- **Staff Ink** (`staff-ink`, `staff-ink-2`) and **Staff Line** (`staff-line`): notation, bar numbers and staff lines drawn on the canvas. **Clef Panel** (`clef-panel`) is the pinned clef area that fades into the paper.
- **Paper signals** (`staff-go`, `staff-miss`, `staff-right`, `staff-left`): deeper versions of go, miss and the two hand colours, used only on paper where the bright versions would wash out.
- **Notes Display** (`notes-display`, `notes-lane`): the dark glass behind the falling-notes view and its black-key lanes.

### Named Rules
**The Green Light Rule.** Green means "go" or "right": the next action, a correct note, the current place, a met goal. It is never decoration, never a heading colour, never a second-tier accent.

**The One Red Rule.** Miss red is spent only on a wrong note or a real error. Locked, idle and unavailable states are indigo, never red.

**The Paper Variant Rule.** On the paper stage, signals use the `staff-*` deep set; on indigo, the bright set. Never put a bright signal colour on paper or a deep one on indigo.

## Typography

**Display Font:** Nunito Variable (self-hosted `/fonts/nunito-latin.woff2`, weight axis 200-1000), falling back to Nunito, ui-rounded, system-ui, sans-serif.
**Body Font:** the same Nunito Variable.

**Character:** one rounded, friendly face carried by weight alone: 600 for reading, 800 for controls and labels, 900 for every heading and number that matters. Figures are tabular everywhere (`font-variant-numeric: tabular-nums` on the body), so scores, minutes and counts never jitter.

### Hierarchy
- **Display** (900, 26px, 1.06, -0.01em): page titles (Good afternoon, Songs, Progress) and the song title on the song page; 22-23px on short landscape screens.
- **Headline** (900, 24px, 1.08): the Continue card's song name (25px), result and intro cards (24px, 20px on short screens), the streak count, sheet titles (22px).
- **Title** (900, 17-19px, 1.2): section heads such as Today's practice, Your songs, Part 1, setup and card headings.
- **Body** (600, 15px, 1.4): default text; secondary copy at 14px in `ink-2`; prose blocks capped at 56-70ch.
- **Button** (800, 15px; 17px on big buttons): every button, chip, segment and rail label (rail at 11.5px).
- **Label** (800, 12-13px): meta under titles, facts, tags, stat captions, week-day letters.
- **Caption** (600, 13px, 1.45, `ink-3`): fine print, credits, helper text.
- **Stat** (900, 21-28px, tabular): result stats, totals, add-song facts, the detected note readout; the countdown number is the one large outlier at 64px.

### Named Rules
**The Weight Not Face Rule.** Hierarchy comes from Nunito's weight and size alone. No second family, no italics, no uppercase tracking, no kicker lines above headings.

## Layout

Landscape-first. The app is a two-column grid: an 84px rail (plus the left safe-area inset) on `night-deep`, and a scrolling content column with a 22px gutter (plus right and bottom safe-area insets). Pages cap at 1180px and open with a sticky page head on `night` holding the title and, on Home, the streak pill and the daily-minutes pill with a small green meter.

Home is a two-column grid (1.35fr / 1fr, 16px gap): the Continue card (cover beside song, next step, star meter and the big green button) leads, Today's practice list to its right, and a horizontal snap-scrolling shelf of 172px song cards below once songs have stars. Songs is an auto-fill grid of 150px-minimum cards. The song page is a sticky side column (230-300px) beside the course of parts, each part a card holding an auto-fill grid of 128px-minimum step tiles. Progress is two cards side by side with a full-width totals row.

Practice fills the viewport: a 54px top bar (pause, step title, progress bar, Wait chip, speed chip, view toggle, input pill), the paper stage inset 10px with an 18px top radius, and the keyboard along the bottom at clamp(68px, 24vh, 112px). The now-line sits at about a quarter of the stage width, after the pinned clef panel.

Spacing runs on 4 / 8 / 12 / 16 / 22px, with 10px and 14px as in-component steps. Breakpoints respond to the phone on the stand: under 430px tall the heads, cards and practice rows tighten and the song hero image hides; under 760px wide two-column grids stack and the practice progress bar hides; in portrait under 640px the rail becomes a bottom tab bar.

## Elevation & Depth

Depth is tonal first: night, surface, surface-2 and raised are steps of the same indigo, and a card is distinguished by its lighter fill, never by a border. Shadows do two specific jobs. Interactive controls carry a solid, unblurred bottom edge (the "press edge") that makes them look pushable and collapses when pressed. Overlays (side sheets, the practice veil card, the toast, the stage hint) float on soft dark ambient shadows over a dimming scrim.

### Shadow Vocabulary
- **Press edge** (`box-shadow: 0 4px 0 var(--raised-edge)`; `0 4px 0 var(--go-edge)` on green): buttons at rest. Icon buttons, choice tiles and step tiles use a 3px edge; the selected segment a 2px edge.
- **Pressed** (`transform: translateY(3px); box-shadow: 0 1px 0 <edge>`): the active state, 80ms on the house ease.
- **Key edge** (`box-shadow: inset 0 -5px 0 #e3dff4` on white keys, `inset 0 -4px 0 #0f0c22` on black keys): the keyboard's bottom lip.
- **Sheet** (`box-shadow: -18px 0 40px rgba(0, 0, 0, .35)`): the right-hand side sheet.
- **Veil card** (`box-shadow: 0 20px 50px rgba(0, 0, 0, .45)`): intro, pause and result cards over the practice stage.
- **Toast** (`box-shadow: 0 10px 30px rgba(0, 0, 0, .4)`).
- **Stage hint** (`box-shadow: 0 6px 18px rgba(20, 17, 43, .3)`): the dark hint pill and count-in disc over paper.

### Named Rules
**The Press Edge Rule.** Anything tappable that matters gets a solid bottom edge in its own darker tone, and pressing moves it down onto that edge. Non-interactive cards never carry one.

## Shapes

Everything is rounded and soft. Tags and badges use 7-9px corners; chips, fields, icon buttons and inner tiles 12px; buttons, step tiles and segment wells 14px; big buttons and song cards 16px; the practice stage 18px on top (6px at the bottom where it meets the keyboard); cards and sheets' content blocks 22px. Dots, play buttons, the switch knob, week days and the count-in are full circles. Meters and progress bars are 8-10px tall pills. Covers clip to their container's radius. Borders are rare: a 2px `line-2` outline on the setup card, a 2px dashed `line` outline on locked tiles, and a 2px inset `go` ring on the next step's badge.

## Components

### Buttons
Chunky, confident and pushable.
- **Shape:** gently rounded (14px; 16px on big).
- **Primary (go):** go green with go-ink text, 46px tall (54px big, 48px on short screens), 20px side padding (26px big), weight 800, icon then label with an 8px gap. Every screen has at most one, and it names the next step (Continue, Start, Next: Part 1 · Left hand, Save and learn it).
- **Secondary:** raised indigo with ink text and the raised edge (Play freely, Try again, Listen first, Restart).
- **Quiet:** transparent, `ink-2` text, 40px, no edge, a 5% white wash on hover (Back to song, Cancel).
- **Hover / Focus / Active:** hover lightens the fill (`go-hi`, `raised-hover`); focus is a 3px go outline at 3px offset; active drops 3px onto the edge. Disabled is 45% opacity.
- **Icon button:** 42px square, 12px corners, raised with a 3px edge; the ghost variant is transparent with `ink-2` icons.
- **Link:** go text, weight 800, a 2px underline at 40% green, 4px offset; muted (`ink-2`) and danger (`miss`) variants.

### Chips and segmented controls
- **Chip:** surface-2 fill, `ink-2` text, 38px, 12px corners, an optional 9px status dot that turns green when on (the Wait chip, the speed chip).
- **Segmented:** a night-deep well with 4px padding; the selected segment is raised with ink text and a 2px edge.
- **Tag:** 7px corners, 12-12.5px weight 900, tinted fill at 16% of its colour: green for Next, flame for Tricky.
- **Level badge:** a dark translucent pill on the cover's top-left corner, its text in the level ramp colour.

### Cards / Containers
- **Corner Style:** 22px (cards, course parts, empty states); 16px for song cards and covers.
- **Background:** surface; nested items on surface-2.
- **Shadow Strategy:** none at rest (see Elevation); the fill step carries the depth.
- **Border:** none.
- **Internal Padding:** 18px (14px on short screens); course parts 14-16px.

### Step tiles (signature)
The course's unit. Surface-2 with a 3px press edge and 14px corners, a 30px badge (R in sky, L in amber, a lock or number otherwise) above the step name and a three-star row. The next step is tinted 14% green with a green edge, a green ring on its badge and a green `Next` label top-right. Locked steps drop their fill and edge for a dashed `line` outline at 50% opacity. Earned stars turn the badge gold-tinted.

### Inputs / Fields
- **Style:** night-deep fill, 2px `line` stroke, 12px corners, 44px tall, 16px weight-700 text, `ink-3` placeholder.
- **Focus:** the stroke turns go green; no glow.
- **Switch:** a 52x30 pill on `line` that turns go green when on, with an ink knob sliding 22px.

### Navigation
- **Rail:** 84px wide on night-deep, the app icon at the top, 70x58 items (icon above an 11.5px weight-800 label) in `ink-3`; hover to ink; the active item is go text on a 12% green wash with 14px corners. Settings sits at the bottom.
- **Mobile:** in portrait the rail becomes a 64px bottom tab bar with the same items.

### Practice stage (signature)
A paper canvas (18px top corners) where one staff per hand in play (a grand staff for both) scrolls left past a pinned clef panel to a green now-line with a soft green band. Note heads carry their note names; heads turn deep green when hit, deep red when missed, and show sky or amber when they are next. Below it, a keyboard of paper white keys with a 5px bottom lip and indigo black keys: next keys fill sky (right hand) or amber (left hand) with their name and finger number, played-correctly keys fill go green, a wrong key flashes miss red, and a held key shows a small name bubble above it. A dark hint pill drops in at the top of the stage after a stall or wrong note. The falling-notes alternative swaps the paper for `notes-display` glass with sky and amber bars and a green gate line.

### Result and overlay cards
Centred surface cards (max 520px) on a 55% night scrim, rising in on the house ease. The result card leads with three stars (the middle one larger and raised 8px, won stars popping in gold), a heading, a three-up stat row on surface-2 (accuracy in green), the streak line in flame, then the green Next button beside a secondary Try again, and a quiet back link.

## Do's and Don'ts

### Do:
- **Do** give each screen exactly one go-green button, and make it name the next step.
- **Do** keep green for go and right, gold for stars, flame for the streak, miss red for wrong notes, sky for the right hand and amber for the left hand.
- **Do** give every important tappable control a solid bottom edge in its own darker tone (`raised-edge`, `go-edge`) that collapses on press.
- **Do** build depth by stepping indigo fills (night, surface, surface-2, raised), not with borders or blurred card shadows.
- **Do** set everything in Nunito Variable with tabular figures, 900 for headings and numbers, 800 for controls.
- **Do** use the deep `staff-*` signals on the paper stage and the bright set on indigo.
- **Do** keep touch targets at 44px or more (buttons 46px, icon buttons 42px inside a padded bar, rail items 58px).

### Don't:
- **Don't** bring back the aluminium instrument-panel world: no metal textures, printed legends, LCD greens or keycap LEDs.
- **Don't** use green as decoration, a heading colour or a background wash beyond the 12-16% tints on the active rail item, next tile and tags.
- **Don't** use miss red for locked, idle or disabled states.
- **Don't** add a second typeface, uppercase tracked labels or eyebrow lines above headings.
- **Don't** put pure black or neutral grey anywhere; every dark is indigo.
- **Don't** give static cards a press edge or a drop shadow; shadows belong to pressable controls and floating overlays.
