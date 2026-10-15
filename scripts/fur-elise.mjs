/**
 * Writes public/songs/fur-elise.mid: the opening of Beethoven's Für Elise (WoO 59, public
 * domain), bars 1-8 with the repeat and its last bar, right and left hands on their own tracks.
 * Run with: node scripts/fur-elise.mjs
 */
import fs from 'node:fs';
import pkg from '@tonejs/midi';
const { Midi } = pkg;

const PPQ = 480, S = PPQ / 4, BAR = 6 * S; // 3/8: six sixteenths a bar
const N = { E2: 40, A2: 45, E3: 52, 'G#3': 56, A3: 57, C4: 60, E4: 64, 'G#4': 68, A4: 69, B4: 71, C5: 72, D5: 74, 'D#5': 75, E5: 76 };
const midi = new Midi();
midi.header.setTempo(66);
midi.header.timeSignatures.push({ ticks: 0, timeSignature: [3, 8], measures: 0 });
midi.header.update();
const rh = midi.addTrack(); rh.name = 'Piano RH';
const lh = midi.addTrack(); lh.name = 'Piano LH';
const note = (t, bar, at, name, len = 1) => t.addNote({ midi: N[name], ticks: bar * BAR + at * S, durationTicks: len * S - 10, velocity: 0.7 });

const turn = bar => ['E5', 'D#5', 'E5', 'B4', 'D5', 'C5'].forEach((n, i) => note(rh, bar, i, n));
const am = bar => ['A2', 'E3', 'A3'].forEach((n, i) => note(lh, bar, i, n));
const e7 = bar => ['E2', 'E3', 'G#3'].forEach((n, i) => note(lh, bar, i, n));
// The phrase (bars 2-8 of the score, here starting at `b`), then the bar that ends it.
function phrase(b) {
  turn(b);
  note(rh, b + 1, 0, 'A4', 2); am(b + 1); ['C4', 'E4', 'A4'].forEach((n, i) => note(rh, b + 1, 3 + i, n));
  note(rh, b + 2, 0, 'B4', 2); e7(b + 2); ['E4', 'G#4', 'B4'].forEach((n, i) => note(rh, b + 2, 3 + i, n));
  note(rh, b + 3, 0, 'C5', 2); am(b + 3); ['E4', 'E5', 'D#5'].forEach((n, i) => note(rh, b + 3, 3 + i, n));
  turn(b + 4);
  note(rh, b + 5, 0, 'A4', 2); am(b + 5); ['C4', 'E4', 'A4'].forEach((n, i) => note(rh, b + 5, 3 + i, n));
  note(rh, b + 6, 0, 'B4', 2); e7(b + 6); ['E4', 'C5', 'B4'].forEach((n, i) => note(rh, b + 6, 3 + i, n));
}
// Bar 1: the pickup, written as a full bar with rests first.
note(rh, 0, 4, 'E5'); note(rh, 0, 5, 'D#5');
phrase(1);
// First ending: A, and the pickup back into the repeat.
note(rh, 8, 0, 'A4', 2); am(8); note(rh, 8, 4, 'E5'); note(rh, 8, 5, 'D#5');
phrase(9);
// Second time: it comes to rest on A.
note(rh, 16, 0, 'A4', 6); ['A2', 'E3'].forEach((n, i) => note(lh, 16, i, n)); note(lh, 16, 2, 'A3', 4);

fs.writeFileSync(new URL('../public/songs/fur-elise.mid', import.meta.url), Buffer.from(midi.toArray()));
console.log('wrote public/songs/fur-elise.mid', rh.notes.length, 'right-hand notes,', lh.notes.length, 'left-hand notes');
