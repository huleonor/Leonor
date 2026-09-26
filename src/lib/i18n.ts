import { createContext, useContext } from 'react';
import type { Lang, SongEntry } from './types';

// The app is English-only; this is its one dictionary.
const en = {
  brandSub: 'HP-1 · practice instrument',
  input: 'Input',
  inMic: 'Microphone',
  inBle: 'Bluetooth MIDI',
  inMidi: 'USB / MIDI keyboard',
  import: 'Import .mid',
  settings: 'Settings',
  reel: 'Reel',
  imported: 'Imported',
  length: 'Length',
  hands: 'Hands',
  handsR: 'Right',
  handsL: 'Left',
  best: 'Best',
  accuracy: 'Accuracy',
  delete: 'Delete',
  confirmDelete: 'Delete it?',
  cancel: 'Cancel',
  imported_ok: '“{title}” imported.',
  loading: 'Loading…',
  on: 'On',
  connecting: 'Connecting…',
  language: 'Language',
  naming: 'Note names',
  accompaniment: 'Accompaniment',
  accompanimentHint: "The app plays the hand you're not playing.",
  localSound: 'Key sound in the app',
  localSoundHint: 'Hear the app’s grand piano when you play a MIDI or Bluetooth keyboard.',
  close: 'Close',
  back: 'Back',
  viewNotes: 'Notes',
  viewSheet: 'Sheet',
  wait: 'Wait',
  waitingFor: 'Waiting: play {notes}',
  start: 'Start',
  continue: 'Continue',
  restart: 'From the start',
  back5: 'Back 5 s',
  handsLabel: 'Hands',
  right: 'Right',
  left: 'Left',
  both: 'Both',
  play: 'Play',
  listen: 'Just listen',
  mode: 'Mode',
  speed: 'Speed',
  loadingPiano: 'Loading piano sound… {pct}%',
  loadingPianoPlain: 'Loading piano sound…',
  noInput: 'No input. Connect the mic or a keyboard in the library.',
  tapToPause: 'Tap the notes to pause',
  theEnd: 'The end',
  notesHit: 'Notes hit',
  wrongNotes: 'Wrong notes',
  again: 'Again',
  faster: 'Faster',
  library: 'Library',
  rotate: 'Turn your phone sideways to see more keys.',
  pause: 'Pause',
  emptyImports: 'Add a song from a .mid file',
  sheetLoading: 'Setting the score…',
  missingSong: 'No file yet. Tap to add the .mid.',
  tapToConnect: 'Press to connect',
  noInputShort: 'No input',
  photoCredits: 'Cover photos from Unsplash by',
  midiConnected: 'Keyboard connected: {name}',
  midiConnectedPlain: 'Keyboard connected',
  'in.nativeFailed': "The app couldn't start its MIDI connection. Close the app fully and open it again.",
  'in.micSilent': 'The microphone is sending silence. Close other apps using it, then tap Microphone again.',
  micHint: 'Play clearly, one hand or both. Chords count. Keep the phone near the piano.',
  'err.badFile': "Couldn't read this file. Make sure it's a valid .mid.",
  'err.noNotes': 'This MIDI file has no piano notes.',
  'err.loadFailed': "Couldn't load the song. Check your internet connection.",
  'err.missing': 'This song is no longer stored on this phone.',
  'in.noMidiDevice': 'No MIDI keyboard connected.',
  'in.iosMidi': "iPhone browsers don't support MIDI. Use the mic, or Bluetooth in the Bluefy browser.",
  'in.noMidiSupport': "This browser doesn't support MIDI. Use Chrome.",
  'in.midiDenied': 'MIDI access was denied.',
  'in.iosBle': 'On iPhone, Bluetooth only works in the free Bluefy browser.',
  'in.noBle': "This browser doesn't support Bluetooth. Use Chrome.",
  'in.bleNotChosen': "No keyboard picked. Turn on your piano's Bluetooth MIDI and try again.",
  'in.bleFailed': "Couldn't connect to the keyboard over Bluetooth.",
  'in.bleDropped': 'The keyboard disconnected.',
  'in.noMic': "This browser can't use the microphone.",
  'in.micBlocked': 'Microphone blocked. Allow it in your browser settings.',
};

export type TKey = keyof typeof en;

export type T = (key: TKey | string, vars?: Record<string, string | number>) => string;

export function makeT(_lang: Lang): T {
  return (key, vars) => {
    let s = (en as Record<string, string>)[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
    return s;
  };
}

export const I18nContext = createContext<{ lang: Lang; t: T }>({ lang: 'en', t: makeT('en') });
export const useI18n = () => useContext(I18nContext);

export function filmName(entry: SongEntry, lang: Lang): string | undefined {
  return lang === 'pt' ? entry.filmPt ?? entry.film : entry.film;
}
