---
name: Leonor
description: "Cartaz (2026-11): Leonor set like a Swiss poster. White poster stock, blue-black ink, one ultramarine field the music is printed on (the videos, the lessons, the song being learnt), one red mark for the left hand and a wrong note. Radio Canada Big for heads and big numbers, Radio Canada for words. Square corners, hairline rules, no shadows, no gradients. The structure comes from type, rules and numbers set big, not from cards."
source: "The user chose direction C, Cartaz, out of four mockups. It follows the Grid theme of Hallmark (Nutlope/hallmark, an anti AI-slop design skill) and the Swiss style; the brand DESIGN.md files of VoltAgent/awesome-design-md were the other references. Nothing is copied from a brand."
colors:
  paper: "oklch(97.5% .005 90)   #f8f7f3  the ground"
  paper-2: "oklch(94.2% .006 90)  wells, the default control"
  paper-3: "oklch(90.5% .008 90)  pressed, tracks"
  white: "oklch(99.6% .002 90)  staff bands, keys, inputs"
  ink: "oklch(19% .022 266)    #0f141e  type, the primary control"
  ink-2: "oklch(31% .02 266)    secondary text"
  muted: "oklch(47% .016 266)   #575b64  hints and labels only"
  rule: "oklch(87.5% .008 90)   hairlines"
  rule-2: "oklch(72% .01 266)   control edges, fresh numbers"
  field: "oklch(44% .2 266)     #1f40be  the ultramarine"
  field-2: "oklch(38% .19 266)   pressed on the field"
  field-ink: "= paper"
  field-muted: "oklch(85% .06 266)  #bbcef6  small text on the field"
  field-rule: "oklch(55% .17 266)  hairlines on the field"
  mark: "oklch(54% .215 29)    the red: left hand, wrong note"
  ok: "oklch(51% .15 150)     the green: a right note, a good run"
typography:
  display: { fontFamily: "Radio Canada Big", weight: 700, tracking: "-0.035em", lineHeight: 0.95, use: "page titles, phase names on the reels, every big number" }
  body: { fontFamily: "Radio Canada", weight: "400 text, 500 labels and buttons", size: "16px" }
  scale: "13 / 14 / 16 / 18 / 22 / 28 / 34 / 48 / 56 / 64-128 (the bar number)"
rounded: { all: 0, dots: "50% (status and rep dots only)" }
spacing: "10px unit: 10 / 20 / 30 / 40"
edges: { rule: "1px solid --rule", control: "1px solid --rule or --rule-2", dialog: "1px solid --ink" }
---

# Design System: Leonor (Cartaz)

## The idea

A poster for one song. The paper is quiet; the music is printed on one ultramarine field: the phase videos fill it, the lessons put their white staff bands across it, and the song being learnt sits on it at the top of the Library. Everything around it is set in type: titles big and tight, numbers bigger (the bar playing in a video, the phase number in a row, the percent learnt), words small and plain. Lines are hairlines. Nothing floats, glows or bounces for decoration.

## Colour, by job

- **Paper** is the ground of every page. **Ink** is text and the primary control. **Muted** is only for hints and labels.
- **Field** (ultramarine): the falling-notes view, the next phase on the Song page, the song learnt now in the Library, a chosen option. On the field, text is paper, small text `--field-muted`, rules `--field-rule`.
- **Mark** (red) is the left hand and a wrong note. **Ok** (green) is a right note, a played key, a good run. Neither is decoration.
- Hands: on paper the right hand is the field blue, the left the red; on the field the right hand prints in paper (its lit keys `--right-key`), the left stays red.
- Song covers are flat poster tiles (field, ink, red) with the song's own opening notes on a staff in paper. The Library and the Song page show the opening across a wide staff instead (`<OpeningStaff />`).
- Colours only through the tokens in `src/styles.css`; a canvas reads them with `getComputedStyle` on its own element, so a context (the reel frame) can redefine them.

## Type

- Radio Canada Big 700 for heads and numbers: page titles 44 to 76px, the bar number on a reel 64 to 128px, phase numbers 48px, percents 32 to 80px. Tracking -0.035em, line-height about 0.95, sentence case.
- Radio Canada 400 for text (16px), 500 for labels and buttons. Never tracked, never uppercase.
- Figures are tabular. Hierarchy comes from size and weight, never from colour alone.

## Shape and structure

- Square corners everywhere. Circles only for small status and rep dots.
- Rows, not cards: a list is hairline rules between rows (phases, songs, settings, sections). The one thing that is current is a field-coloured row or block; the whole song is an ink row.
- One primary button style: ink fill, paper text (on the field: paper fill, field text). The default button is a paper-2 cell with a hairline; quiet buttons are underlined text.
- Tabs are words (Watch, Song, Library, Settings), a 3px ink bar marks the current one: on the left edge in the side rail, on the top edge along the bottom on phones.
- Dialogs and sheets are paper with a 1px ink edge, set flush left.

## The screens

- **Watch**: short videos on paper (the field tokens are remapped to paper inside `.reel-slide`), ink text, the right hand in blue, the left in red; each loops until he scrolls on. The reel fills the screen. Top left the bar being played, huge; top right the phase (n of N), its name and the segment tag (paper, or red for the left hand). The hook under it in display type; the bass of each bar as square cells; the falling notes onto square keys; the caption at the foot in display type. Cards (the idea, your turn) are the field itself with the words set flush left. A voice explains every phase; its caption sits at the foot in display type, a few words at a time, the word being said in `--key-next` yellow, the words said in paper, the ones to come in `--field-muted`. Between passes there is only a breath while the notes fall in, never a full-screen card.
- **Song**: the title huge, the composer with the number of phases and bars, the percent as a big number, one primary action, then the phases as numbered rows (number, name, where it is; Practise with its stars on the right). The next phase is the field row; the whole song closes the list as an ink row headed by its number of bars.
- **Library**: the song learnt now as a field block with its opening on a staff and its percent huge; the rest as rows with the percent on the right; the marketplace below.
- **Lessons**: Simply Piano's page (the user's choice): white, the grand staff big across it (about half the stage's height), a blue now line, square pause, arrows and step counter, and the help keys as a white strip along the bottom edge. The result is a paper poster: the headline big, the accuracy as a big number, the stars in field blue.

## Motion

State-driven only (`src/components/Motion.tsx`): a bar number that changes slides in, a percent that changes bumps, a verdict pops, sheets rise. CSS transitions 300ms ease on colours. No confetti, no bobbing bubbles, no glows. Everything sits inside `<MotionConfig reducedMotion="user">`.

## Anti-slop rules (fixed)

1. No gradient, glow, blur or glass used as decoration. The only colour fields are flat.
2. Two families: Radio Canada Big for display, Radio Canada for text. No rounded fonts.
3. One primary action per screen, in the one primary style. No 3D buttons that press into an edge.
4. Structure from type, hairlines and numbers set big. No grid of identical cards with an icon, a title and a line.
5. No icons in tinted circles, no mascots, no bouncing bubbles, no confetti. Icons are Phosphor bold, only inside controls.
6. Labels in sentence case at the body size or a step smaller, untracked. No eyebrows in capitals, no chips for decoration.
7. No middle dots or arrows joining meta text; use a comma or a full stop. No em or en dashes, no emoji.
8. Square corners; circles only for dots.
9. About 80 words on a screen at most; one idea per screen.
10. No invented numbers, quotes or logos. Every number shown is the user's own (bars, phases, percent, stars).
11. Body text passes WCAG AA on its ground (paper text on red and green is used only at 15px and up, or bold display sizes).
12. No purple, no blue-to-purple, no AI sparkle.

## Video craft (after HyperFrames)

The phase videos follow the production craft of HyperFrames (heygen-com/hyperframes, Apache-2.0), the user's choice (2026-11): its rules, not its renderer. The videos stay live (drawn from his own MIDI, which never leaves his device, and lit by the keys he plays), so nothing is rendered to MP4.

1. **Everything is a function of the clock.** Notes, keys, the camera, the captions and the named keys are drawn from the video's time, never from timers, so any moment is the same picture: the video can be scrubbed (drag along its bottom edge) and loops exactly.
2. **The voice is the clock.** Each piece appears when the voice names it: as it says "E, C, A, C", each key lights in turn, numbered 1, 2, 3, 4, before the music plays them. Nothing waits on screen before it is named.
3. **One move with a cause.** The camera opens wide on the keyboard and pushes in on the video's own keys over the first second (ease both ways, power2.inOut); then it holds still while the music plays.
4. **Eases by role.** Arrivals land on a long tail (expo.out), exits are 40 to 50% shorter (0.12 to 0.2 s), nothing on the UI bounces, a landed title is dead still.
5. **Titles and captions word by word.** The idea blurs in word by word (6 px to 0, 0.13 s, 67 ms apart). Captions come in groups of three to five words, broken at a comma or a full stop, each word blurring in 70 ms after the last; the word being said is blue, said words ink, words to come muted; a group leaves in 0.12 s before the next. The title card leaves with a blur swap (8 px, 0.18 s), never a slide.
6. **Pacing.** A line holds about 0.5 s plus 0.3 s a word; the speech estimate is 2.4 words a second; a video's line stays short (about 19 words at most) so the music is never padded with idle drift.
7. **Vertical frame.** Frame 0 is the hook (the idea or the notes, already on screen, never blank); text stays out of the right-hand action rail; one subject, stacked.

