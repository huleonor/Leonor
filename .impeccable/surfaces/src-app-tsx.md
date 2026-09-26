---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: []
---

# Surface brief: Player + Library (app shell)

Scope: the whole app (library, player in falling-notes and sheet views, wait hint, study panel, input check, settings). Visitor mode: Operate.
Audience/job: Hugo, phone landscape on a digital piano's music stand, both hands on the keys; picks a song, practises slowly with Wait, loops hard bars, speeds up.
Constraints: iPhone app (Capacitor, CoreMIDI cable + Bluetooth, mic) and web (Chrome). English UI. Replaces the 35mm film world; the user found it generic, too dark and hard to read, and the library unappealing.

## Direction contract

THESIS: The app is a practice instrument, a piece of hardware on the music stand: a light bead-blasted aluminium panel with printed legends, round keycaps with LEDs and one black display where the notes fall. Refuses the neon-bars-on-navy piano trainer and the dark cinema costume it replaces.

OWN-WORLD: aluminium #d9d8d3 panel (lit, never dark), display black #111214 only inside the display window, signal orange #ff6a13 (right hand, primary keycap, active state), cobalt #2f5bff (left hand), LED green #3dbe6b (live input), fault red #e0301e (wrong), legend ink #1a1a1a. Supreme (Fontshare) for legends and titles, Geist Mono for readouts, numerals and note names on LCDs. Round keycaps with a 2px travel shadow, recessed LCD windows, a two-position slider, cartridges with photo labels and speed stamps.

STORY: He sees a rack of song cartridges, each with its photo and the speeds he has passed stamped in orange, presses one; the display counts in, notes fall to an orange gate; when he stalls in Wait, a panel under the display shows the keys to press; the cartridge earns a new stamp at the end.

FIRST VIEWPORT: Landscape. Library: left panel with the wordmark and model legend, three input keycaps (Mic, BT, USB) with LEDs, the Check input line, an orange Import keycap at the bottom; a rack of 186px cartridges to the right. Player: 64px legend strip (back keycap, title + bar readout, Notes/Sheet slider, four speed keycaps with the active one orange, Wait keycap with LED, input LCD), the black display filling the middle, keys below in the panel.

FORM: grounded candidate 6 of 7 (Braun / Teenage Engineering instrument panel), seed key 7500be31, chosen by the user from HTML previews. Raises: one truth per readout with damped mic needle (six-pack); distinct treatment for every note state (tensegrity); speed stamps on each song (ticket wallet); every module one press away (HyperCard).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
