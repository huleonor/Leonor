---
name: Leonor
description: "Lo-Fi (2026-11): Leonor as a practice notebook. Paper-yellow page, three system faces colliding (Times for titles, Helvetica for words and the big note letters, Courier for labels and numbers), index cards taped on a little off the grid, riso pink for the right hand and riso teal for the left, halftone dots on the song cards, titles printed slightly off register. A bottom tab bar like an app's. No logo."
source: "The user chose anchor C, Lo-Fi, out of three mockups made with the frontend-design skill (Ilm-Alan/frontend-design) and its anti-slop rules; it replaces Cartaz. Nothing is copied from a brand."
colors:
  paper: "#EDE4CF  the notebook page (paper-yellow, never cream)"
  paper-2: "#E2D7BB  wells"
  paper-3: "#D6C9A8  pressed, tracks"
  white: "#F5EDD8  index cards, keys, inputs, the lesson page"
  desk: "#D9CCAA  the desk around the page on a wide screen, with a fine dot"
  ink: "#1B1A17  type, edges, the primary control"
  ink-2: "#3C3931  secondary text"
  muted: "#625A49  hints and labels only"
  rule: "#C4B796 / rule-2 #8C8068  dashed rules"
  pink: "#FF006E  riso pink: the right hand, what is next (text in pink-text #C2004F, tint pink-soft #FFD6E6)"
  teal: "#00A99D  riso teal: the left hand (text teal-text #006A62, tint teal-soft #CDEDE7)"
  marker: "#FFE45C  the yellow highlighter: the tab he is on, the word being said, the next key, hover"
  tape: "translucent yellow strip holding the current card down"
  mark: "#E0301E  a wrong note"
  ok: "#1E8A44  a right note, a good run"
typography:
  display: { fontFamily: "Times New Roman, Times", weight: 700, use: "page titles, song and phase names, captions (italic on the videos)" }
  body: { fontFamily: "Helvetica Neue, Helvetica, Arial", weight: "400 text, 700 buttons, 900 the huge note letters and count-in", size: "16px" }
  mono: { fontFamily: "Courier New, Courier", weight: 700, use: "labels, meta lines, tab labels, numbers, percents" }
rounded: { all: 0, dots: "50% (status dots only)" }
spacing: "10px unit: 10 / 20 / 30 / 40"
edges: { card: "2px solid ink", rule: "1px dashed rule-2", control: "2px solid ink" }
---

# Design System: Leonor (Lo-Fi)

## The idea

A practice notebook on a music stand. The page is paper-yellow; what he works on is an index card taped onto it, a little crooked; the notes are printed in two riso inks, pink for the right hand and teal for the left, the other ink's plate a few pixels off register under each falling note. Three system faces collide on purpose: Times for names, Helvetica for words and the huge note letters, Courier for labels and numbers. Type is printed clean in plain ink: the riso offset stays only on the falling notes (the user found misregistered titles hard to read). It is an app: one page column, the tabs along the bottom; on Watch the video takes the whole screen and the tabs hide behind a menu button.

## Colour, by job

- **Paper** is the page, **white** the cards on it, **ink** the type and every edge.
- **Pink** is the right hand and what comes next (the next phase card is pink-soft and taped, the now line and the video's time bar are pink). **Teal** is the left hand. Body text in either ink uses the darker `-text` shades; the bright inks are for notes, keys, fills and large letters.
- **Marker** yellow is the highlighter: the tab he is on, the word the voice is saying, the next key, the percent, hover.
- **Mark** red is a wrong note; **ok** green a right note, a played key, a good run, a switch that is on is teal.
- `--field` now means the highlighted card (pink-soft with ink on it); the reels remap it to the paper.
- Colours only through the tokens in `src/styles.css`; a canvas reads them with `getComputedStyle` on its own element.

## Shape and structure

- Cards, not hairline rows: phases, songs, settings groups and dialogs are index cards with a 2px ink edge, each turned 0.5 to 2 degrees (by `nth-child`), never all square to the grid.
- Tape (`--tape`) holds down the one card that is current (the next phase, the song learnt now, the practise card on a video). Nothing else is taped.
- Halftone dots (a radial-gradient tile) print the Library cards and song covers, in pink or teal.
- Square corners. Circles only for small status dots.
- One primary style: ink fill, paper text, a 3px pink offset block behind it. The default button is a white card with an ink edge, turned a little; quiet buttons are Courier words with a wavy pink underline.
- Dashed rules inside cards (a list in a dialog, the line between a phase and its Practise).

## Navigation

- A bottom tab bar on every screen size, like an app's: Watch, Song, Library, Settings, each a Phosphor bold glyph over a Courier label; the current tab's glyph is filled and its label sits on the marker.
- On a wide screen the app is one page column (560px) with an ink edge, on the dotted desk. A phone on its side takes the full width.
- On Watch the bar hides: a three-line menu button at the top left slides the tabs in from the left as a sheet of paper.
- No logo anywhere in the shell.

## The screens

- **Watch**: the videos on the page: the kicker in Courier on a marker strip, the notes huge in Helvetica 900, plain ink (teal for a left-hand step), the meta in Courier, one keyboard with the notes falling onto it in their ink, the caption in italic Times, the word being said on the marker. A head in words (both hands) is Times, smaller. Side actions are white squares turned a few degrees, Next inked with a pink offset; they show only while the video is paused, sliding in from the right edge. Wider than tall, the video is horizontal: words on the left, the keyboard wide on the right, the whole screen. The practise stop is an index card taped over the top with two dashed squares that fill green. The teaching hands over the keys are drawn like a comic: flat skin in three tones (`--hand-skin`, `--hand-shade`, `--hand-deep`) with a dark ink line (`--hand-line`), no gloss, no texture, no soft shadow.
- **Song**: a quiet head ("Learning now" in Courier with Change song as a quiet link on the same line, the title in Times sized to fit two lines at most, composer and size in Courier), his progress as a bar of sections (a segment per section as long as its bars, ink for watched, teal for learnt, the next edged pink) with the percent on the marker, the one taped card (Continue, the video he was on), then the sections as one index card of rows with dashed rules (number in Courier, name in Times, what it is in italic Times, where he is in Courier, Hear and Practise as square icon buttons). The next row is pink-soft; Full song closes the card in ink.
- **Library**: every song as a plain white index card (no halftone: the user found the dots uncomfortable), its main part falling onto a strip of keys in a `--paper-2` well, then its title in Times, its composer in Courier and its percent; the song learnt now is the big taped card on top, the others a two-column grid turned a little off the grid. A card being previewed takes a pink edge and its title on the marker. Add songs (the pieces that need his MIDI file) behind a dashed card.
- **Lessons**: Simply Piano's page (the user's choice), on the white card stock: the staff big across it, a pink now line, square pause, arrows and a Courier step counter filled with marker as he goes. The result: the headline big, the numbers in Courier.

## Motion

State-driven only (`src/components/Motion.tsx`), as before. CSS transitions step like stop-motion (`steps(3)`, 240ms) instead of gliding. No loops, no confetti. Everything sits inside `<MotionConfig reducedMotion="user">`.

## Anti-slop rules (fixed)

1. No gradient, glow, blur or glass for decoration. The only radial gradients are the halftone dot tiles; the only shadow is the hard pink block behind the primary button. No shadow on type.
2. Three system faces, each with its job; no web font, no rounded font.
3. One primary action per screen, in the one primary style.
4. No grid of identical icon-title-line cards: cards carry their own content (notes on a staff, numbers, his progress) and sit crooked.
5. No icons in tinted circles, no mascots, no confetti. Icons are Phosphor bold, only inside controls and the tab bar.
6. Labels in sentence case, never uppercase, never tracked. No eyebrows in capitals.
7. No middle dots or arrows joining meta text; a comma or a full stop. No em or en dashes, no emoji.
8. Square corners; circles only for dots.
9. About 80 words on a screen at most; one idea per screen.
10. No invented numbers, quotes or logos. Every number shown is his own.
11. Body text passes WCAG AA on its ground; the bright pink and teal are never body text.
12. No purple, no cream: the page is paper-yellow.

## Video craft (after HyperFrames)

The phase videos follow the production craft of HyperFrames (heygen-com/hyperframes, Apache-2.0), the user's choice (2026-11): its rules, not its renderer. The videos stay live (drawn from his own MIDI, which never leaves his device, and lit by the keys he plays), so nothing is rendered to MP4.

1. **Everything is a function of the clock.** Notes, keys, the camera, the captions and the named keys are drawn from the video's time, never from timers, so any moment is the same picture: the video can be scrubbed (drag along its bottom edge) and loops exactly.
2. **The voice is the clock.** Each piece appears when the voice names it: as it says "E, C, A, C", each key lights in turn, numbered 1, 2, 3, 4, before the music plays them. Nothing waits on screen before it is named.
3. **One move with a cause.** The camera opens wide on the keyboard and pushes in on the video's own keys over the first second (ease both ways, power2.inOut); then it holds still while the music plays.
4. **Eases by role.** Arrivals land on a long tail (expo.out), exits are 40 to 50% shorter (0.12 to 0.2 s), nothing on the UI bounces, a landed title is dead still.
5. **Titles and captions word by word.** The idea blurs in word by word (6 px to 0, 0.13 s, 67 ms apart). Captions come in groups of three to five words, broken at a comma or a full stop, each word blurring in 70 ms after the last; the word being said is marked in yellow, said words ink, words to come muted; a group leaves in 0.12 s before the next. The title card leaves with a blur swap (8 px, 0.18 s), never a slide.
6. **Pacing.** A line holds about 0.5 s plus 0.3 s a word; the speech estimate is 2.4 words a second; a video's line stays short (about 19 words at most) so the music is never padded with idle drift.
7. **Vertical frame.** Frame 0 is the hook (the idea or the notes, already on screen, never blank); text stays out of the right-hand action rail; one subject, stacked.
8. **Teach, then train with him.** Each video: explain (keys lit as named), show (slow), "Train with me" (a bar of count-in, the count huge in plain ink, the notes drawn open for him to fill, the piano at 40% as a guide), then it stops by itself on an index card taped over the top of the frame: "Pause and practise", "Play it 2 more times", two dashed squares that turn green as his clean runs count, Done and Train with me again. The end line names the next video. The header is the step set like a TikTok title: the kicker (phase, the hand, the speed or Train with me) small, the notes huge, the bar small on the right.
9. **Sound on visible actions only** (HyperFrames' sound rules): a whoosh when a title arrives, a click on a count-in beat, a pop when a run is counted, a riser into an impact when the whole phase starts. The piano under the voice steps back; nothing chimes.
10. **The app's videos are the TikToks.** Same layout as the Für Elise videos rendered with HyperFrames: kicker and huge notes on top, one keyboard for both hands in the middle, the caption under it, air below; only the side actions are added.

