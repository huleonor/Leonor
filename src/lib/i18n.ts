import { createContext, useContext } from 'react';
import type { Lang, SongEntry } from './types';

// The dictionary of the app's older screens, in English (and Portuguese below).
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


// The Portuguese side of the same dictionary (Settings, Language).
const pt: Partial<Record<keyof typeof en, string>> = {
  input: 'Entrada', inMic: 'Microfone', inBle: 'Bluetooth MIDI', inMidi: 'Teclado USB / MIDI', import: 'Importar .mid',
  settings: 'Definições', imported: 'Importada', length: 'Duração', hands: 'Mãos', handsR: 'Direita', handsL: 'Esquerda',
  best: 'Melhor', accuracy: 'Precisão', delete: 'Apagar', confirmDelete: 'Apagar?', cancel: 'Cancelar',
  imported_ok: '“{title}” importada.', loading: 'A carregar…', on: 'Ligado', connecting: 'A ligar…', language: 'Língua',
  naming: 'Nomes das notas', accompaniment: 'Acompanhamento', accompanimentHint: 'A app toca a mão que não estás a tocar.',
  localSound: 'Som das teclas na app', localSoundHint: 'Ouve o piano de cauda da app quando tocas num teclado MIDI ou Bluetooth.',
  close: 'Fechar', back: 'Voltar', viewNotes: 'Notas', viewSheet: 'Partitura', wait: 'Esperar', waitingFor: 'À espera: toca {notes}',
  start: 'Começar', continue: 'Continuar', restart: 'Do início', back5: 'Voltar 5 s', handsLabel: 'Mãos', right: 'Direita',
  left: 'Esquerda', both: 'Ambas', play: 'Tocar', listen: 'Só ouvir', mode: 'Modo', speed: 'Velocidade',
  loadingPiano: 'A carregar o som do piano… {pct}%', loadingPianoPlain: 'A carregar o som do piano…',
  noInput: 'Sem entrada. Liga o microfone ou um teclado nas Definições.', tapToPause: 'Toca nas notas para pausar',
  theEnd: 'Fim', notesHit: 'Notas certas', wrongNotes: 'Notas erradas', again: 'Outra vez', faster: 'Mais rápido',
  library: 'Biblioteca', rotate: 'Vira o telemóvel para ver mais teclas.', pause: 'Pausa', emptyImports: 'Junta uma música de um ficheiro .mid',
  sheetLoading: 'A preparar a partitura…', missingSong: 'Ainda sem ficheiro. Toca para juntar o .mid.', tapToConnect: 'Carrega para ligar',
  noInputShort: 'Sem entrada', midiConnected: 'Teclado ligado: {name}', midiConnectedPlain: 'Teclado ligado',
  'in.nativeFailed': 'A app não conseguiu iniciar a ligação MIDI. Fecha a app por completo e abre-a de novo.',
  'in.micSilent': 'O microfone está a enviar silêncio. Fecha outras apps que o estejam a usar e toca outra vez em Microfone.',
  micHint: 'Toca com clareza, uma mão ou as duas. Os acordes contam. Mantém o telemóvel perto do piano.',
  'err.badFile': 'Não foi possível ler este ficheiro. Confirma que é um .mid válido.',
  'err.noNotes': 'Este ficheiro MIDI não tem notas de piano.',
  'err.loadFailed': 'Não foi possível carregar a música. Verifica a ligação à internet.',
  'err.missing': 'Esta música já não está guardada neste telemóvel.',
  'in.noMidiDevice': 'Nenhum teclado MIDI ligado.',
  'in.iosMidi': 'Os browsers do iPhone não suportam MIDI. Usa o microfone, ou o Bluetooth no browser Bluefy.',
  'in.noMidiSupport': 'Este browser não suporta MIDI. Usa o Chrome.',
  'in.midiDenied': 'O acesso MIDI foi recusado.',
  'in.iosBle': 'No iPhone, o Bluetooth só funciona no browser gratuito Bluefy.',
  'in.noBle': 'Este browser não suporta Bluetooth. Usa o Chrome.',
  'in.bleNotChosen': 'Nenhum teclado escolhido. Liga o Bluetooth MIDI do piano e tenta outra vez.',
  'in.bleFailed': 'Não foi possível ligar ao teclado por Bluetooth.',
  'in.bleDropped': 'O teclado desligou-se.',
  'in.noMic': 'Este browser não consegue usar o microfone.',
  'in.micBlocked': 'Microfone bloqueado. Permite-o nas definições do browser.',
};

export type TKey = keyof typeof en;

export type T = (key: TKey | string, vars?: Record<string, string | number>) => string;

export function makeT(lang: Lang): T {
  return (key, vars) => {
    let s = (lang === 'pt' ? (pt as Record<string, string>)[key] : undefined) ?? (en as Record<string, string>)[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
    return s;
  };
}

export const I18nContext = createContext<{ lang: Lang; t: T }>({ lang: 'en', t: makeT('en') });
export const useI18n = () => useContext(I18nContext);

export function filmName(entry: SongEntry, lang: Lang): string | undefined {
  return lang === 'pt' ? entry.filmPt ?? entry.film : entry.film;
}
