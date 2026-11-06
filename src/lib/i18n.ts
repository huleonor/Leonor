import { createContext, useContext } from 'react';
import type { Lang, SongEntry } from './types';

// The dictionary of the app's older screens, in English (and Portuguese below).
const en = {
  settings: 'Settings',
  hands: 'Hands',
  loading: 'Loading…',
  on: 'On',
  connecting: 'Connecting…',
  wait: 'Wait',
  waitingFor: 'Waiting: play {notes}',
  start: 'Start',
  right: 'Right',
  left: 'Left',
  both: 'Both',
  play: 'Play',
  listen: 'Just listen',
  speed: 'Speed',
  again: 'Again',
  library: 'Library',
  pause: 'Pause',
  midiConnected: 'Keyboard connected: {name}',
  midiConnectedPlain: 'Keyboard connected',
  'in.nativeFailed': "The app couldn't start its MIDI connection. Close the app fully and open it again.",
  'in.micSilent': 'The microphone is sending silence. Close other apps using it, then tap Microphone again.',
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
  settings: 'Definições', hands: 'Mãos',
  start: 'Começar', right: 'Direita',
  left: 'Esquerda', both: 'Ambas', play: 'Tocar', listen: 'Só ouvir', speed: 'Velocidade',
  library: 'Biblioteca', pause: 'Pausa',
  'in.nativeFailed': 'A app não conseguiu iniciar a ligação MIDI. Fecha a app por completo e abre-a de novo.',
  'in.micSilent': 'O microfone está a enviar silêncio. Fecha outras apps que o estejam a usar e toca outra vez em Microfone.',
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
