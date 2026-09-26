---
name: Hugo's Piano
description: A practice instrument on the music stand; a light aluminium panel with printed legends, round keycaps with LEDs and one black display where the notes fall.
colors:
  aluminium: "#dcdbd6"
  aluminium-hi: "#e8e7e2"
  aluminium-lo: "#cdccc6"
  groove: "#bdbcb5"
  label-white: "#f6f5f1"
  label-white-2: "#eceae4"
  legend-ink: "#1a1a1a"
  legend-ink-2: "#4d4c47"
  legend-ink-3: "#62615b"
  display-black: "#111214"
  display-lane: "#16171a"
  lcd-black: "#121314"
  lcd-green: "#86f0a8"
  lcd-green-dim: "#5a9b70"
  lcd-off: "#9a9b96"
  lcd-neutral: "#ecebe6"
  lcd-fault: "#ff9b8c"
  signal-orange: "#ff6a13"
  signal-orange-deep: "#f25c08"
  signal-orange-ink: "#b8430a"
  signal-orange-soft: "#ffd9c2"
  signal-orange-lit: "#ffb07a"
  cobalt: "#2f5bff"
  cobalt-ink: "#1d3bb3"
  cobalt-soft: "#cdd8ff"
  cobalt-lit: "#8aa2ff"
  led-green: "#3dbe6b"
  fault-red: "#e0301e"
  fault-red-ink: "#b3200f"
  key-top: "#fbfaf7"
  key-bottom: "#eeede8"
  key-seam: "#c3c2bb"
  key-black: "#1b1c1f"
  score-paper: "#f4f3ee"
typography:
  display:
    fontFamily: "Martian Mono, ui-monospace, monospace"
    fontSize: "clamp(88px, 34vh, 150px)"
    fontWeight: 700
    lineHeight: 0.9
    fontFeature: "'tnum'"
  headline:
    fontFamily: "Supreme, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(20px, 4vw, 26px)"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.015em"
  wordmark:
    fontFamily: "Supreme, Helvetica Neue, Arial, sans-serif"
    fontSize: "27px"
    fontWeight: 800
    lineHeight: 0.94
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Supreme, Helvetica Neue, Arial, sans-serif"
    fontSize: "19px"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.01em"
  title-bar:
    fontFamily: "Supreme, Helvetica Neue, Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.005em"
  body:
    fontFamily: "Supreme, Helvetica Neue, Arial, sans-serif"
    fontSize: "13.5px"
    fontWeight: 500
    lineHeight: 1.45
  body-long:
    fontFamily: "Supreme, Helvetica Neue, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.5
  control:
    fontFamily: "Supreme, Helvetica Neue, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.12em"
  legend:
    fontFamily: "Supreme, Helvetica Neue, Arial, sans-serif"
    fontSize: "10px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.14em"
  readout:
    fontFamily: "Martian Mono, ui-monospace, monospace"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.1
    fontFeature: "'tnum'"
  readout-small:
    fontFamily: "Martian Mono, ui-monospace, monospace"
    fontSize: "11.5px"
    fontWeight: 400
    fontFeature: "'tnum'"
  numeral:
    fontFamily: "Martian Mono, ui-monospace, monospace"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "'tnum'"
rounded:
  stamp: "4px"
  key: "6px"
  sm: "8px"
  label: "9px"
  r: "12px"
  lg: "18px"
  pill: "23px"
  cap: "50%"
spacing:
  xs: "6px"
  sm: "10px"
  md: "16px"
  lg: "18px"
  gutter: "22px"
  bar: "64px"
  keys: "96px"
components:
  keycap:
    backgroundColor: "{colors.label-white}"
    textColor: "{colors.legend-ink}"
    rounded: "{rounded.cap}"
    size: "44px"
  keycap-lit:
    backgroundColor: "{colors.signal-orange-deep}"
    textColor: "{colors.legend-ink}"
  keycap-dark:
    backgroundColor: "{colors.key-black}"
    textColor: "{colors.label-white}"
  pill:
    backgroundColor: "{colors.label-white}"
    textColor: "{colors.legend-ink}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "46px"
  pill-go:
    backgroundColor: "{colors.signal-orange-deep}"
    textColor: "{colors.legend-ink}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "46px"
  pill-danger:
    backgroundColor: "{colors.fault-red}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    height: "46px"
  slider:
    backgroundColor: "{colors.groove}"
    textColor: "{colors.legend-ink-2}"
    rounded: "22px"
    padding: "3px"
  slider-on:
    backgroundColor: "{colors.label-white}"
    textColor: "{colors.legend-ink}"
    rounded: "17px"
    height: "34px"
  switch:
    backgroundColor: "{colors.groove}"
    rounded: "14px"
    width: "50px"
    height: "28px"
  switch-on:
    backgroundColor: "{colors.signal-orange-deep}"
  lcd:
    backgroundColor: "{colors.lcd-black}"
    textColor: "{colors.lcd-green}"
    typography: "{typography.readout}"
    rounded: "{rounded.sm}"
  lcd-readout:
    backgroundColor: "{colors.lcd-black}"
    textColor: "{colors.lcd-neutral}"
    typography: "{typography.readout}"
    rounded: "{rounded.sm}"
    padding: "3px 9px 4px"
  cartridge:
    backgroundColor: "{colors.aluminium-lo}"
    rounded: "{rounded.lg}"
    padding: "10px 10px 11px"
    width: "190px"
  cartridge-label:
    backgroundColor: "{colors.label-white}"
    textColor: "{colors.legend-ink}"
    rounded: "{rounded.label}"
    padding: "10px 11px 11px"
  speed-stamp:
    textColor: "{colors.legend-ink-2}"
    typography: "{typography.readout-small}"
    rounded: "{rounded.stamp}"
    height: "24px"
  speed-stamp-done:
    textColor: "{colors.signal-orange-ink}"
  display-window:
    backgroundColor: "{colors.display-black}"
    rounded: "{rounded.lg}"
  module-plate:
    backgroundColor: "{colors.aluminium}"
    textColor: "{colors.legend-ink}"
    rounded: "{rounded.lg}"
    padding: "20px 22px 18px"
    width: "min(600px, 100%)"
  wait-hint:
    backgroundColor: "{colors.label-white}"
    textColor: "{colors.legend-ink-2}"
    rounded: "{rounded.r}"
    padding: "8px 12px 8px 16px"
  side-sheet:
    backgroundColor: "{colors.aluminium}"
    padding: "22px 24px"
    width: "min(400px, 100%)"
  toast:
    backgroundColor: "{colors.lcd-black}"
    textColor: "{colors.lcd-green}"
    rounded: "{rounded.sm}"
    padding: "12px 18px"
  toast-error:
    textColor: "#ffb4a8"
  keyboard:
    backgroundColor: "{colors.key-top}"
    height: "{spacing.keys}"
  top-bar:
    height: "{spacing.bar}"
---

# Design System: Hugo's Piano

## Overview

**Creative North Star: "The Practice Instrument"**

The app is a piece of hardware standing on the music stand, in the line of Braun and Teenage Engineering panels: a light, bead-blasted aluminium panel with printed legends, round keycaps with small LEDs, recessed LCD windows, a two-position slider, and one black display window where the notes fall onto an orange gate. The library is a rack of song cartridges, each with a photo, a white paper label and the speeds already passed stamped in orange ink. Setup, pause and end are module plates that sit over the display. The world rejects the neon-bars-on-navy piano trainer and the dark cinema costume of the 35mm film world it replaced.

The panel is lit, never dark. Black lives only inside the display window, the LCDs and the black keys. Colour is signal and each colour owns one job: orange is the right hand, the primary control and the active state; cobalt is the left hand; green is live input; red is a fault. Two families split the work cleanly: Supreme speaks every title, legend and sentence; Martian Mono is the machine voice of readouts, numerals, note names and stamps.

Density follows a phone in landscape on a music stand: a 64px legend strip on top, the display filling the middle, keys along the bottom, 44px keycaps throughout. Surfaces are matte; depth is physical (key travel, recessed windows, a plate lifted over the display) rather than decorative.

**Key Characteristics:**
- Matte aluminium field with a soft top light; no stripes, no brushed texture, no gloss.
- Every control is a physical key: round keycaps, pills and a slider that travel 1.5px when pressed.
- One black display window per screen; LCDs are small recessed black readouts.
- Signal colours with one job each: orange right hand and action, cobalt left hand, green live input, red fault.
- Supreme for words, Martian Mono for machine readouts.
- Cartridges with photo, paper label and orange speed stamps.

## Colors

A warm light-grey aluminium panel with near-black ink, one black display, and four signal colours that never swap jobs.

### Primary
- **Signal Orange** (signal-orange): the right hand's falling notes and struck white keys, the gate line, the progress fill, count-in numerals and beat LEDs, the orange LED. **Deep** (signal-orange-deep) is the flat fill of the primary control: the lit keycap, the go pill, the switch when on, the focus ring, the sheet cursor and struck black keys. **Ink** (signal-orange-ink) is orange as text: passed speed stamps, the missing-file line, list markers. **Soft** (signal-orange-soft) tints the next right-hand key, the loop key and text selection. **Lit** (signal-orange-lit) marks a right-hand note sounding under a correct hit on the canvas.

### Secondary
- **Cobalt** (cobalt): the left hand only; falling notes, struck keys and hint keys. **Ink** (cobalt-ink) names the next left-hand key; **Soft** (cobalt-soft) tints it; **Lit** (cobalt-lit) marks a sounding left-hand hit on the canvas.

### Tertiary
- **LED Green** (led-green): the live-input LED. **LCD Green** (lcd-green) is text on an LCD that reports live input (input LCD, input status, the input check readout, toasts); **LCD Green Dim** (lcd-green-dim) is the small caption inside those LCDs.
- **Fault Red** (fault-red): wrong keys, missed notes (dashed outline), the wrong-note block at the gate, the destructive pill, the red LED. **Fault Red Ink** (fault-red-ink) is red as text on the panel ("You played A#2", warnings, confirm prompts). **LCD Fault** (lcd-fault) is red as text on an LCD.

### Neutral
- **Aluminium** (aluminium) with **Hi** (aluminium-hi) and **Lo** (aluminium-lo): the panel field, graded top to bottom; plates and side sheets reuse the same field.
- **Groove** (groove): recessed tracks (slider, switch), dashed empty stamps, the add-cartridge outline, scrollbars.
- **Label White** (label-white) and **Label White 2** (label-white-2): paper labels on cartridges, the wait-hint panel, the active slider cell, confirm cards.
- **Legend Ink** (legend-ink): titles and primary text, text on orange fills. **Ink 2** (legend-ink-2): printed legends, subtitles, notes. **Ink 3** (legend-ink-3): tertiary text in sheets and credits.
- **Display Black** (display-black) and **Display Lane** (display-lane): the display window and the faint lane over every black key.
- **LCD Black** (lcd-black): every LCD window. **LCD Neutral** (lcd-neutral): readouts that are not live input (bar and time). **LCD Off** (lcd-off): an LCD with nothing connected.
- **Key Top / Key Bottom** (key-top, key-bottom), **Key Seam** (key-seam), **Key Black** (key-black): the keyboard and miniature keyboards.
- **Score Paper** (score-paper): the e-paper page the display becomes in sheet view.

### Named Rules
**The One Job Rule.** Each signal colour owns one meaning. Orange is right hand, primary action and active state; cobalt is left hand and never chrome; green is live input; red is a fault. A readout that is not reporting live input is never green.

**The Lit Panel Rule.** The panel is light aluminium. Black appears only inside the display window, LCDs, dark keycaps and black keys.

**The Two Hands Rule.** Orange belongs to the right hand and cobalt to the left in every view: falling notes, keys, hint keys, sheet noteheads. A note the app plays for the other hand keeps its hue at 28% opacity.

## Typography

**Display Font:** Supreme (Fontshare, Indian Type Foundry; self-hosted 400/500/700/800), with Helvetica Neue, Arial fallback
**Body Font:** Supreme
**Label/Mono Font:** Martian Mono (Evil Martians; self-hosted variable), with ui-monospace fallback; always tabular figures

**Character:** Supreme is the printed legend and the plain-spoken sentence: heavy, slightly tight titles and small tracked caps legends. Martian Mono is the instrument talking back: bar counters, speeds, note names, stamps.

### Hierarchy
- **Display** (Martian Mono 700, clamp(88px, 34vh, 150px), 0.9, tabular): count-in numerals in orange on the display only.
- **Headline** (Supreme 800, clamp(20px, 4vw, 26px), 1.02, -0.015em, balanced): module plate titles; side sheet titles at 22px. The library wordmark is the same voice at 27px, 0.94.
- **Title** (Supreme 800, 19px, 1.02, -0.01em, balanced): song names on cartridge labels (22px on large screens); in the top bar 17px, single line with ellipsis; study tips 16px.
- **Body** (Supreme 500, 13.5px, 1.45): notes, sub-lines, hints; long-form study text 14px at 1.5, max 62ch.
- **Control** (Supreme 800, 13px, 0.12em, uppercase): pill labels; the slider uses 700 11px at 0.12em.
- **Legend** (Supreme 700, 10px, 0.14em, uppercase): printed legends under keycaps (INPUT, SPEED, MIC) and the model legend under the wordmark.
- **Readout** (Martian Mono 700, 16px, tabular): the bar/time LCD, the input LCD value (15px), hint note names (18px), key bubbles (12px). Small readouts at 11.5px: cartridge year and length, speed keycaps, bar numbers on the display.
- **Numeral** (Martian Mono 700, 26px, tabular): end-of-song stats in the LCD readout; the first stat is orange.

### Named Rules
**The Machine Voice Rule.** Martian Mono is only for readouts, numerals, note names and stamps. Titles, legends, buttons and sentences are Supreme.

**The Printed Legend Rule.** Legends are 10px tracked caps printed under or beside the control they name. They label controls; they never sit above a heading as an eyebrow.

## Layout

The library is a two-column grid: a side panel (minmax(236px, 272px)) holding the wordmark and model legend, a settings keycap, the INPUT legend over three input keycaps with LEDs, the input LCD, the Check input link and the orange Import pill pinned to the bottom; a 1px seam with a shine line divides it from a horizontally scrolling rack of cartridges (190px, 16px apart; 236px wide and up to 540px tall on large screens). In portrait the side panel stacks on top and cartridges become min(66vw, 230px).

The player is a four-row grid: the 64px top bar (back keycap, title over the bar/time LCD, Notes/Sheet slider, four speed keycaps over a SPEED legend, the Wait keycap with its LED, the input LCD), the display filling the middle, the wait-hint row (empty unless waiting), and the keys (96px; 62px in sheet view; 82px under 430px tall; 74px under 360px). The side gutter is 22px (14px on phones sideways, 12px in portrait). Safe-area insets pad left, right and bottom. Below 940px wide the slider drops its words; below 760px the bar legends hide. In portrait the bar wraps and the speeds take their own row.

Spacing is a small even rhythm around 6, 10, 16, 18 and 22px; 22px is the player gutter and the default side-sheet padding.

## Elevation & Depth

Physical, not decorative. The panel is flat matte under a soft top light (a vertical gradient from aluminium-hi through aluminium to aluminium-lo). Controls stand proud with a short hard travel shadow plus a soft contact shadow, and sink 1.5px when pressed. Windows (display, LCDs, slider, switch tracks) are recessed with inset shadows and a 1px white shine on their lower edge. Only three things float with ambient shadows: cartridges in the rack, module plates over the display, and side sheets. Scrims are legend ink at 34% (sheets) or display black at 55% (plates).

### Shadow Vocabulary
- **Rest** (`box-shadow: 0 2px 0 #a9a8a2, 0 3px 7px rgba(0,0,0,.16), inset 0 -1px 0 rgba(0,0,0,.06)`): keycaps and pills at rest.
- **Press** (`box-shadow: 0 1px 0 #a4a39c, 0 1px 2px rgba(0,0,0,.18), inset 0 1px 2px rgba(0,0,0,.12)`): keycaps and pills held down, with translateY(1.5px).
- **Orange travel** (`box-shadow: 0 2px 0 #b94000, 0 3px 7px rgba(0,0,0,.16)`): the go pill; the lit keycap sits at 1px of it, already pressed.
- **Recessed window** (`box-shadow: inset 0 2px 4px rgba(0,0,0,.6), 0 1px 0 rgba(255,255,255,.6)`): LCDs; the display uses a deeper inset 0 4px 14px.
- **Cartridge** (`box-shadow: inset 0 1px 0 rgba(255,255,255,.6), 0 1px 0 rgba(0,0,0,.08), 0 10px 22px rgba(0,0,0,.12)`): cartridges in the rack.
- **Plate** (`box-shadow: inset 0 1px 0 rgba(255,255,255,.7), 0 20px 44px rgba(0,0,0,.45)`): module plates over the display.
- **LED glow** (`box-shadow: 0 0 7px <led colour>`): lit LEDs only; the gate line on the display carries the same lit glow.

### Named Rules
**The Matte Finish Rule.** The aluminium is an even matte field under a soft top light; orange controls are flat signal-orange-deep with a neutral travel shadow. No gloss highlights, no stripes, no glow on controls. Light is emitted only by LEDs, the gate line and count-in LEDs.

**The Key Travel Rule.** Anything pressable has travel: a 2px hard shadow at rest, 1px when pressed, and a 1.5px drop.

## Shapes

Round where the finger goes, softly squared where the panel is cut. Keycaps are circles (40 to 48px), pills are full capsules, the slider and switch are capsule tracks. Cut-outs in the panel use generous radii: display window 18px top and 6px bottom where it meets the keys, cartridges and plates 18px, the wait-hint panel 12px, LCDs 8px, paper labels and photos 9px, speed stamps 4px. Falling notes are 6px-rounded bars; white keys round 6px at the bottom, black keys 4px. LEDs are 7px dots (12px in the count-in). Dashed borders mean "not there yet": an unpassed stamp, the add-cartridge slot, a missed note.

## Components

### Buttons
Tactile, physical, one press from the music stand.
- **Keycap:** a 44px circle (36px for speeds and Wait, 40px in bars and sheet heads, 48px for inputs) with a soft radial face from near-white to #e2e1dc, 19px line icon, rest shadow; pressed sinks 1.5px. **Lit** (the active speed, the primary state): flat signal-orange-deep with ink text, sitting 1px down. **Dark** (a selected input, the Wait key): a black face with light text; engaged Wait is shown held down with its orange LED on.
- **Pill:** 46px capsule, Supreme 800 13px caps at 0.12em, 20px side padding, radial label-white face, rest shadow. **Go:** flat signal-orange-deep, ink text, orange travel shadow. **Danger:** fault red, white text, deep red travel.
- **Focus:** 2px signal-orange-deep outline, 3px offset. Disabled: 45% opacity.
- **Text link:** Supreme 700 12.5px with a 2px groove underline (Check input).

### Slider (Notes / Sheet)
A two-position capsule track in groove, recessed; the active cell is a raised label-white capsule with ink text and a small shadow. Icons with Supreme caps words that drop on narrow screens.

### Switch
A 50 by 28px recessed groove track with a 22px radial thumb; checked fills signal-orange-deep and slides 22px on the ease-out curve.

### LEDs
7px dots above or beside a keycap. Off is a dull #a4a39c with an inset; green is live input, orange is an engaged mode (Wait, Learn it faster), red is a fault, blinking orange is connecting.

### LCD windows
Recessed lcd-black windows with Martian Mono. Green text only for live input (input LCD, input status, input check); lcd-neutral for the bar/time readout; lcd-off when nothing is connected; lcd-fault for errors. Captions inside are 9 to 10px tracked in lcd-green-dim. Toasts are LCDs too.

### Cards / Containers
- **Cartridge (signature):** an aluminium-lo cartridge (18px corners, cartridge shadow) with a ribbed grip at the top, a photo window (slightly desaturated, raised contrast, 9px corners) and a label-white paper label: Supreme 800 title, 500 subtitle, Martian Mono year and length, and a row of four speed stamps. Pressing sinks it 2px and scales the photo to 1.04. **Missing:** grayscale photo, label with diagonal label-white-2 hatching, an orange-ink sentence with a download icon.
- **Speed stamp (signature):** empty is a 24px dashed groove box with the speed in Martian Mono; passed is a 2px solid orange-ink box, bold, rotated -5deg on a 10% orange wash, like a rubber stamp.
- **Module plate:** the aluminium field lifted over the display at 55% black scrim, 18px corners, plate shadow; headline, sub-line, legend rows, pill actions; the end plate holds an LCD stat readout.
- **Side sheet:** settings, input check and study slide in from the right (400px; 620px wide variant) on the aluminium field with a 1px seam; rows are Supreme 700 14.5px titles with 500 12.5px descriptions, divided by seam-and-shine rules.

### Navigation
The 64px top bar is a legend strip on the panel, not a separate surface: back keycap, title over the neutral bar/time LCD, slider, speed keycaps over the SPEED legend, Wait keycap with LED, input LCD. The progress track sits inside the top of the display: 4px, white at 10%, orange fill, draggable.

### Display (signature)
The only dark surface: display black with a faint lane over every black key, bar lines at white 10% with Martian Mono bar numbers, octave guides at each C. Notes are 6px-rounded bars in the hand colour with the note name in Supreme 800 (ink on orange, white on cobalt). Hit notes dim to 35%; a sounding hit turns lit with a white underline; a miss is a dashed red outline. The gate is a 2px orange line with a lit glow; a wrong note flashes a red block at the gate. Count-in: display black at 92%, a huge orange Martian Mono numeral over a row of beat LEDs. In sheet view the window becomes score-paper e-paper with ink notation, hand-coloured noteheads and a 3px orange cursor that pulses while waiting.

### Keyboard (signature)
White keys graded key-top to key-bottom with key-seam dividers; black keys at 60% height. The next note tints its key soft orange or soft cobalt and shows its name; struck keys fill with the hand colour; wrong keys fill red; auto-played keys grey slightly. Octave labels in Martian Mono. A held key shows a small ink bubble with its name, hidden while the wait hint is on screen.

### Wait hint (signature)
A label-white panel (12px corners) in its own grid row between the display and the keys, rising in on the ease-out curve: "Play" plus the target in Martian Mono 18px, a red-ink "You played" line after a wrong note, and a miniature keyboard at 48px tall with target keys filled in hand colour and the wrong key in red. It is the single waiting message; the on-display waiting plate steps aside when it shows.

## Do's and Don'ts

### Do:
- **Do** keep the panel light aluminium with a soft top light, and put black only inside the display, LCDs, dark keycaps and black keys.
- **Do** make every control a physical key with travel: 2px rest shadow, 1px pressed, 1.5px drop.
- **Do** fill primary controls with flat signal-orange-deep and ink text.
- **Do** colour right-hand material orange and left-hand material cobalt in every view, and dim the app-played hand to 28%.
- **Do** use green only for live input, neutral lcd-neutral for other readouts, and red for faults.
- **Do** set readouts, numerals, note names and stamps in Martian Mono with tabular figures; everything else in Supreme.
- **Do** print legends as 10px tracked caps next to the control they name.
- **Do** keep controls that matter mid-song at 36px or larger, 44px where space allows.

### Don't:
- **Don't** add gloss, stripes or brushed texture to the aluminium, or gloss and glow to orange controls; only LEDs and the gate emit light.
- **Don't** make the panel dark or use neon bars on navy.
- **Don't** use green on an LCD for anything but live input.
- **Don't** use cobalt for chrome, links or actions; it belongs to the left hand.
- **Don't** set titles, legends or sentences in Martian Mono.
- **Don't** put eyebrow labels above headings.
- **Don't** float the wait hint over the display; it is a panel in its own row between display and keys.
