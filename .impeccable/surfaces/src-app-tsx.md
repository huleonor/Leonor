---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: []
---

# Surface brief: Player + Library (app shell)

Scope: the whole app (library, player in two views: falling notes and sheet). Visitor mode: Operate.
Audience/job: Hugo, phone landscape on the piano music stand, both hands on keys; picks a song, practises slowly with wait mode, speeds up.
Constraints: iPhone Chrome (WebKit: mic only; BLE-MIDI via Bluefy), Android/desktop Chrome (Web MIDI + Web Bluetooth). Portuguese UI.

## Direction contract

THESIS: Each song is a reel of 35mm film running through the projector; the keyboard is the projection gate. Refuses the Synthesia/Simply Piano default of neon glowing bars on navy with gamified stars.

OWN-WORLD: projection-booth black #0f0d0b, film-base amber #d9822b (right hand, primary action), silver-halide cyan #6fb7c4 (left hand), title-card white #f2eee6, frame edge #3a3632, leader grey #77736c for the countdown. Archivo only (one family): wdth 125 heavy tracked caps for title cards, wdth 62 for edge codes and labels. 1px frame lines; sprocket perforations run with the music; bar numbers printed as edge codes. Sheet view is the score printed as a film negative (cream ink on black) with an amber gate cursor.

STORY: He sees the reel labels (film cans) of his songs, picks one, the Academy-leader countdown rolls 3-2-1, notes fall to the gate; in wait mode the gate holds until he plays; the reel ends on a title card with his precision.

FIRST VIEWPORT: Landscape. 46px top bar: back, title in wide caps with film + reel number, NOTAS/PAUTA toggle, speed 0.6/0.8/1/1.2 segmented, ESPERA chip. Film strip lanes fill the middle with sprocket margins; keyboard 104px at the bottom under a cream gate line. Tap the strip to pause: control overlay (continue, restart, back 5s, hands, listen).

FORM: grounded candidate 6 of 7 (35mm film leader and projection), seed key 31c8a130 (printed by the first concept-seed run; a second run, key 5a077ed9, was triggered by accident while re-reading output and was not used). The user then asked for live previews of three cards (A film, B design annual, C alphabet storm) and chose A. Raises: state restyles notes in place (split-flap); one type family + 1px lines (design annual); fixed label grid on each can (sneaker boxes); monumental countdown numerals (alphabet storm).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
