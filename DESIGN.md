---
name: Hugo's Piano
description: A personal piano trainer where every song is a reel of 35mm film running down to the keyboard's projection gate.
colors:
  booth-black: "#0f0d0b"
  strip-base: "#14110e"
  can-stock: "#17130f"
  can-stock-lit: "#1d1712"
  frame-edge: "#3a3632"
  frame-edge-soft: "#2a2520"
  title-card-white: "#f2eee6"
  ivory-key: "#ece6da"
  halide-dim: "#a39d93"
  halide-faint: "#8a847a"
  film-base-amber: "#d9822b"
  amber-lit: "#f3ab62"
  amber-deep: "#a85f1b"
  silver-halide-cyan: "#6fb7c4"
  cyan-lit: "#a4dbe4"
  cyan-deep: "#3f8391"
  splice-rust: "#c4533a"
  leader-grey: "#77736c"
  leader-grey-dark: "#5f5b55"
  signal-green: "#8fc98a"
typography:
  display:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(90px, 42vh, 180px)"
    fontWeight: 800
    lineHeight: 1
    fontVariation: "'wdth' 125"
    fontFeature: "'tnum'"
  headline:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(18px, 4.2vw, 26px)"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "0.2em"
    fontVariation: "'wdth' 125"
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: "0.14em"
    fontVariation: "'wdth' 125"
  title-bar:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "0.22em"
    fontVariation: "'wdth' 125"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 600
    lineHeight: 1.45
    fontVariation: "'wdth' 87.5"
  control:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    letterSpacing: "0.08em"
    fontVariation: "'wdth' 75"
    fontFeature: "'tnum'"
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.18em"
    fontVariation: "'wdth' 62"
  numeral:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 800
    fontVariation: "'wdth' 100"
    fontFeature: "'tnum'"
rounded:
  gate: "3px"
  sm: "4px"
  r: "6px"
  can: "8px"
  card: "10px"
  pill: "13px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "14px"
  lg: "18px"
  xl: "22px"
  gutter: "26px"
components:
  button-primary:
    backgroundColor: "{colors.film-base-amber}"
    textColor: "{colors.booth-black}"
    typography: "{typography.control}"
    rounded: "{rounded.r}"
    padding: "0 18px"
    height: "46px"
  button-primary-active:
    backgroundColor: "{colors.amber-lit}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.title-card-white}"
    rounded: "{rounded.r}"
    padding: "0 18px"
    height: "46px"
  button-ghost-active:
    backgroundColor: "{colors.can-stock-lit}"
  button-import:
    backgroundColor: "{colors.title-card-white}"
    textColor: "{colors.booth-black}"
    rounded: "{rounded.r}"
    height: "44px"
  button-import-active:
    backgroundColor: "{colors.ivory-key}"
  icon-button:
    textColor: "{colors.title-card-white}"
    rounded: "{rounded.r}"
    size: "44px"
  segmented:
    textColor: "{colors.halide-dim}"
    typography: "{typography.control}"
    rounded: "{rounded.r}"
    height: "44px"
  segmented-on:
    backgroundColor: "{colors.film-base-amber}"
    textColor: "{colors.booth-black}"
  chip:
    textColor: "{colors.halide-dim}"
    typography: "{typography.control}"
    rounded: "{rounded.r}"
    padding: "0 12px"
    height: "44px"
  chip-on:
    textColor: "{colors.film-base-amber}"
  input-tag:
    textColor: "{colors.halide-dim}"
    typography: "{typography.label}"
    rounded: "{rounded.r}"
    padding: "0 10px"
    height: "44px"
  input-tag-off:
    textColor: "{colors.splice-rust}"
  top-bar:
    height: "54px"
    padding: "0 14px 0 20px"
  reel-can:
    backgroundColor: "{colors.can-stock}"
    rounded: "{rounded.can}"
    padding: "16px 14px 14px 30px"
    width: "204px"
  reel-can-active:
    backgroundColor: "{colors.can-stock-lit}"
  reel-can-missing:
    backgroundColor: "transparent"
    textColor: "{colors.halide-dim}"
  film-frame:
    backgroundColor: "{colors.booth-black}"
    rounded: "{rounded.gate}"
  title-card:
    backgroundColor: "{colors.can-stock}"
    rounded: "{rounded.card}"
    padding: "20px 22px"
    width: "min(560px, 100%)"
  drawer:
    backgroundColor: "{colors.can-stock}"
    padding: "20px 22px"
    width: "min(380px, 100%)"
  toast:
    backgroundColor: "{colors.title-card-white}"
    textColor: "{colors.booth-black}"
    rounded: "{rounded.r}"
    padding: "12px 16px"
  toast-error:
    backgroundColor: "{colors.splice-rust}"
    textColor: "{colors.title-card-white}"
  keyboard:
    backgroundColor: "{colors.ivory-key}"
    height: "104px"
  countdown-leader:
    backgroundColor: "{colors.leader-grey}"
    textColor: "{colors.booth-black}"
    typography: "{typography.display}"
  countdown-caption:
    backgroundColor: "{colors.leader-grey}"
    textColor: "{colors.booth-black}"
    rounded: "{rounded.sm}"
    padding: "6px 10px"
---

# Design System: Hugo's Piano

## Overview

**Creative North Star: "The Projection Booth"**

Every song is a reel of 35mm film, and the keyboard is the projection gate. The library is a shelf of film cans with edge codes printed down their spine; the player is the strip itself, perforations travelling with the music, frame lines at every bar, notes falling onto a cream gate line where they meet the keys. The countdown is an Academy leader; a finished reel ends on a title card. The world rejects the neon-bars-on-navy, gamified-stars look of mainstream piano trainers.

The room is dark and warm: projection-booth black carries everything, and colour is reserved for meaning. Film-base amber is the right hand and the primary action; silver-halide cyan is the left hand; splice rust is a wrong or missing note. One family, Archivo, speaks in three widths: wide heavy tracked caps for titles, a narrow condensed voice for edge codes and labels, and a mid width for the sentences Hugo must read from the music stand.

Density follows the phone on a music stand in landscape: a thin top bar, a strip that owns the middle, a keyboard at the bottom, 44px targets throughout.

**Key Characteristics:**
- Warm near-black film base with 1px frame lines, never cool navy.
- Two hand colours (amber right, cyan left) that also colour the keys they strike.
- One type family, width as the voice: wdth 125 titles, 87.5 sentences, 75 controls, 62 edge codes.
- Film furniture as real UI: sprocket perforations, edge codes, gate brackets, Academy leader.
- Photography graded toward the print and held inside a film frame.

## Colors

A warm black film base with two hand hues, a rust for errors, and projector greys for the countdown.

### Primary
- **Film-Base Amber** (film-base-amber): the right hand's notes and struck keys, the primary action, the active segment, the "on" chip, the progress fill, the sheet gate cursor, the focus ring, and edge codes. Lit (amber-lit) marks a note sounding under a correct hit and warning text; deep (amber-deep) is a struck black key.

### Secondary
- **Silver-Halide Cyan** (silver-halide-cyan): the left hand only. Lit (cyan-lit) for a sounding hit, deep (cyan-deep) for a struck black key. Never used for chrome or actions.

### Tertiary
- **Splice Rust** (splice-rust): wrong notes, missed notes (dashed outline), the destructive confirm, the disconnected input tag, error toasts.
- **Signal Green** (signal-green): one job only, the "connected" dot on an input.

### Neutral
- **Booth Black** (booth-black): page and stage ground; text on amber and white fills.
- **Strip Base** (strip-base): the lane area of the strip and the sheet paper, one step above the ground.
- **Can Stock** (can-stock) / **Can Stock Lit** (can-stock-lit): reel cans, cards and the drawer at rest / pressed.
- **Frame Edge** (frame-edge): every 1px line and control border. **Frame Edge Soft** (frame-edge-soft): bar lines inside the strip and the progress track.
- **Title-Card White** (title-card-white): primary text, the gate line, the import button and toasts.
- **Ivory Key** (ivory-key): white piano keys.
- **Halide Dim** (halide-dim) / **Halide Faint** (halide-faint): secondary text and resting control labels / tertiary text, credits, table headings.
- **Leader Grey** (leader-grey) / **Leader Grey Dark** (leader-grey-dark): the countdown field and its sweep.

### Named Rules
**The Two Hands Rule.** Amber belongs to the right hand and cyan to the left, everywhere: falling notes, struck keys, sheet noteheads. A note the app plays for the other hand keeps its hue at 28% opacity rather than switching colour.

**The Amber Carries Action Rule.** Amber is the only fill on an interactive control. Secondary actions are outlined in frame edge; the exceptions are the white import button, the library's first-class action, and the rust fill on a destructive confirm.

## Typography

**Display Font:** Archivo (variable, wdth 62 to 125, wght 400 to 900), with system-ui fallback
**Body Font:** Archivo
**Label/Mono Font:** Archivo at wdth 62; numerals use tabular figures

**Character:** One family doing every job by changing width, like the title cards, edge codes and printed credits of a single film print.

### Hierarchy
- **Display** (800, wdth 125, clamp(90px, 42vh, 180px), 1): countdown numerals only.
- **Headline** (800, wdth 125, clamp(18px, 4.2vw, 26px), 1.1, 0.2em, uppercase): title cards (setup, pause, end). The library wordmark uses the same voice at 22px.
- **Title** (800, wdth 125, 19px, 1.12, 0.14em, uppercase, balanced): song names on reel cans. In the top bar, 15px at 0.22em, single line with ellipsis.
- **Body** (600, wdth 87.5, 13.5px, 1.45, sentence case): notes, hints, the missing-file line, toasts.
- **Control** (700, wdth 75, 13px, 0.08em to 0.14em, uppercase, tabular): segmented controls, chips, card buttons (primary and ghost step up to 800 at 14px).
- **Label** (600, wdth 62, 10 to 11px, 0.18em to 0.24em, uppercase): section labels, edge codes, subtitles, table headings, input state.
- **Numeral** (800, wdth 100, 28px, tabular): end-card stats; the first stat is amber.

### Named Rules
**The Width Is the Voice Rule.** Hierarchy comes from width and tracking, not from new families or sizes: wide caps title, narrow caps label, mid-width sentence case for anything read as a sentence.

**The Sentences Stay Sentences Rule.** Anything longer than a label (hints, warnings, the missing-file line, toasts) is sentence case at wdth 87.5 so it reads at a glance from the music stand.

## Layout

The library is a two-column grid: a side panel (minmax(230px, 270px)) with the wordmark, inputs and import button, divided by a 1px frame edge from a horizontally scrolling reel of cans (204px each, 14px apart; 230px and up to 520px tall on large screens). In portrait the panel stacks above the reel and cans become min(72vw, 240px).

The player is a four-row grid: top bar (54px; 50px under 360px tall), a 4px progress track (3px in portrait), the stage, and the keyboard (104px; 64px in sheet view; 88px under 360px tall; 96px in portrait). Safe-area insets pad left, right and bottom. Below 940px wide in landscape the view toggle drops its words and the input tag drops its source name; below 760px spacing tightens and the bar subtitle hides. In portrait the bar wraps and the speed control takes its own full-width row.

Spacing runs on a small, even rhythm (6, 8, 14, 18, 22, 26px); 26px is the outer gutter of the library and the sprocket margin of the sheet.

## Elevation & Depth

Flat by default. Depth comes from tonal steps (booth black, strip base, can stock, can stock lit) and 1px frame edges, not from shadows. Two things float and carry soft ambient shadows: title cards over the strip, and toasts. Pressed cans rise 2px. Scrims are booth black at 72 to 80%.

### Shadow Vocabulary
- **Title card** (`box-shadow: 0 18px 40px rgba(0, 0, 0, .5)`): setup, pause and end cards over the stage.
- **Toast** (`box-shadow: 0 8px 24px rgba(0, 0, 0, .45)`): transient confirmations.
- **Film gate vignette** (`box-shadow: inset 0 0 0 1px rgba(242, 238, 230, .08), inset 0 -40px 40px -24px rgba(15, 13, 11, .75)`): inside the photo frame on a can only.

### Named Rules
**The Tonal Step Rule.** A surface that sits above another is one tonal step lighter and edged in 1px frame edge; shadows are reserved for things that genuinely float over the strip.

## Shapes

Softly squared film furniture. Controls use a 6px radius; cans 8px; title cards 10px; the photo frame 3px, like a camera gate; small inner buttons and the countdown caption 4px. Falling notes are 4px-rounded bars; key bottoms round 5px (white) and 4px (black). Circles appear only as status dots (8px) and the leader rings. Every border is 1px (1.5px in the countdown cross and dots). Dashed borders mean "not there yet": a missing reel, an input that is selected but not connected, a missed note.

## Components

### Buttons
Tactile, wide-tracked, one tap from the music stand.
- **Shape:** gently squared (6px), 46px tall in cards, 44px in the bar.
- **Primary:** amber fill, booth-black text, 800 wdth 87.5 14px caps at 0.14em, 18px side padding. Pressed: amber lit.
- **Ghost:** 1px frame edge outline, title-card white text. Pressed: can stock lit.
- **Import:** title-card white fill with booth-black text, 44px, pinned to the bottom of the library panel.
- **Icon button:** 40px square (44px in the bar), 1px frame edge, pressed to can stock lit with a halide-dim border.
- **Focus:** 2px amber outline, 2px offset. Disabled: 45% opacity.

### Segmented control
A single 1px-edged capsule of 44px cells divided by 1px frame lines; the active cell fills amber with booth-black text. Used for the notes/sheet view toggle and the 0.6x to 1.2x speeds.

### Chips
- **Style:** 1px frame edge outline, halide-dim control type, an 8px ring dot.
- **State:** on turns the border and text amber and fills the dot (the wait-mode toggle).

### Input tag
The live "edge code" of the input in the top bar: a 44px outlined tag with a status dot (green when live, rust when not), the source in narrow caps, and the last note heard in 15px white 800. Disconnected, the text turns rust and the border rust at 50%.

### Cards / Containers
- **Reel can:** can stock, 1px frame edge, 8px corners, 30px left padding reserving a vertical amber edge code (reel number, composer) that reads bottom to top. Holds the wide-caps title, a narrow-caps subtitle, the graded cover photo in a film frame, and a two-column stats grid under a 1px rule. Hover lifts the border to halide faint; press turns it amber, lights the stock, rises 2px and scales the photo to 1.04.
- **Missing reel:** dashed border, transparent stock, halide-dim title, photo desaturated and darkened, and an amber-lit sentence-case line with an SVG download icon ("File missing. Tap to import the .mid.").
- **Title card:** can stock, 1px edge, 10px corners, 20px 22px padding, ambient shadow; wide-caps headline, narrow-caps subtitle, rows, actions.
- **Drawer:** can stock sliding in from the right, 1px left edge, max 380px.

### Inputs / Fields
- **Input selector:** 46px outlined rows (icon, name, narrow-caps state, status dot). Selected but not connected: dashed amber border; connected: solid amber with a green dot; connecting: blinking amber dot; error: rust dot.
- **Toggle:** 46 by 26px pill on booth black with a halide-faint thumb; checked fills amber with a black thumb.

### Navigation
A 54px top bar with a 1px bottom edge: back icon button, song title in wide caps with a narrow-caps subtitle (film, year, length), view toggle, speed segments, wait chip, input tag. A 4px frame-edge-soft progress track under it fills amber and is draggable.

### The Strip (signature)
The falling-notes stage drawn on canvas: booth black margins with strip-base lanes, rounded perforations (9 by 13px, perforation brown #3b342c) scrolling with the music on the left margin, a 1px frame line and an amber two-digit edge code at every bar, faint white octave guides at each C. Notes are 4px-rounded bars in the hand colour with a centred condensed 800 note name in black. The gate is a 2px title-card-white line with corner brackets; a waiting note shows a white underline and an amber-outlined "Waiting for" plate above the gate; a wrong note flashes a rust block in its lane at the gate.

### Keyboard (signature)
Ivory keys with 1px black seams under the gate line; black keys at 60% height. The next note lights its key faintly (warm tint for right, cool tint for left) and shows its name; struck keys fill with the hand colour; wrong keys fill rust. Octave labels (C1, C2...) in narrow caps.

### Academy leader countdown (signature)
Leader-grey field with a darker conic sweep, a black crosshair and two rings, a monumental black numeral, and a narrow-caps caption on a leader-grey plate with a 1px dark border in the lower left.

### Sheet (signature)
The score as a film negative: cream ink on strip base between two columns of perforations, noteheads coloured by hand as they are played, and a 3px amber gate cursor that pulses while waiting.

## Do's and Don'ts

### Do:
- **Do** colour right-hand material amber and left-hand material cyan in every view, and dim the app-played hand to 28% rather than recolouring it.
- **Do** draw structure with 1px frame-edge lines and tonal steps from booth black up to can stock lit.
- **Do** set titles in Archivo wdth 125, 800, tracked caps; labels and edge codes in wdth 62 caps; sentences in wdth 87.5 sentence case.
- **Do** keep every control that matters mid-song at 44px or larger.
- **Do** grade photography toward the print (warm, slightly desaturated, deeper blacks) and hold it inside a 3px-cornered film frame.
- **Do** use dashed borders for "not yet there" states and rust for wrong or missing.

### Don't:
- **Don't** use neon glowing bars on navy, gamified stars, or cool blue-black grounds.
- **Don't** introduce a second type family; change width instead.
- **Don't** fill a control with any colour other than amber (exceptions: the white import button, and rust for a destructive confirm).
- **Don't** use cyan for chrome, links or actions; it belongs to the left hand.
- **Don't** add shadows to resting surfaces; only title cards and toasts float.
