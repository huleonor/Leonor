import { naturalState, naturalVoiceWanted, onVoice, setNaturalVoice } from '../lib/voice';
import { useEffect, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { handsShown, L, showHands, showStaff, staffShown } from '../lib/lang';
import { isNative, nativeMidiStatus, support, type LinkState, type Source } from '../lib/input';
import type { FingerMode, Lang, Settings } from '../lib/types';
import { IconBluetooth, IconClose, IconKeys, IconMic } from './Icons';
import { Segmented } from './ui';

const INPUTS: [Source, () => string, (p: { size?: number }) => React.ReactElement][] = [
  ['midi', () => L('USB cable', 'Cabo USB'), IconKeys],
  ['ble', () => 'Bluetooth', IconBluetooth],
  ['mic', () => L('Microphone', 'Microfone'), IconMic],
];

export function statusText(kind: Source, link: LinkState, t: (k: string) => string) {
  if (link.status === 'on') return link.label ? L(`Connected, ${link.label}`, `Ligado, ${link.label}`) : kind === 'mic' ? L('Listening', 'A ouvir') : L('Connected', 'Ligado');
  if (link.status === 'connecting') return L('Connecting', 'A ligar');
  if (link.status === 'error') return link.error ? t(link.error) : L('Not connected', 'Desligado');
  return L('Tap to connect', 'Toca para ligar');
}

interface Props {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  links: Record<Source, LinkState>;
  connectInput: (kind: Source) => void;
  disconnectInput: (kind: Source) => void;
  onCheck: () => void;
  onClose: () => void;
}

type PianoProps = Pick<Props, 'settings' | 'update' | 'links' | 'connectInput' | 'disconnectInput' | 'onCheck'>;

/** The ways in for his piano (cable, Bluetooth, microphone) and the test: Settings and the first-time step. */
export function PianoChoices({ settings, update, links, connectInput, disconnectInput, onCheck }: PianoProps) {
  const { t } = useI18n();
  const selected = settings.input !== 'none' ? (settings.input as Source) : null;
  const supported: Record<Source, boolean> = { mic: support.mic, ble: support.bluetooth, midi: support.webMidi };
  return (
    <>
      <div className="input-choices">
        {INPUTS.map(([kind, label, Icon]) => {
          const link = links[kind];
          const on = selected === kind && link.status === 'on';
          return (
            <button
              key={kind}
              className={`choice ${selected === kind ? 'selected' : ''} ${link.status}`}
              // The one that is on turns off with a tap; another turns on.
              onClick={() => { if (on) { disconnectInput(kind); return; } update({ input: kind, setupDone: true }); connectInput(kind); }}
              disabled={!supported[kind]}
              aria-pressed={on}
            >
              <Icon size={20} />
              <b>{label()}</b>
              <small>{supported[kind] ? (on ? `${statusText(kind, link, t)}. ${L('Tap to turn off', 'Toca para desligar')}` : selected === kind || link.status !== 'off' ? statusText(kind, link, t) : L('Tap to use', 'Toca para usar')) : L('Not in this browser', 'Não neste browser')}</small>
            </button>
          );
        })}
      </div>
      <button className="btn" onClick={onCheck}>{L('Test your piano', 'Testar o piano')}</button>
      {!isNative && support.isIOS && <p className="fine">{L('iPhone browsers only have the microphone. Cable and Bluetooth work in the Leonor iPhone app.', 'No iPhone o browser só tem o microfone. O cabo e o Bluetooth funcionam na app Leonor para iPhone.')}</p>}
    </>
  );
}

export function SettingsSheet({ settings, update, links, connectInput, disconnectInput, onCheck, onClose }: Props) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const [hands, setHands] = useState(handsShown);
  const [staff, setStaff] = useState(staffShown);
  // Only the iPhone app's update notice is left of the old About card (when it is out of date).
  const [nativeBuild, setNativeBuild] = useState<number | null>(null);
  useEffect(() => { nativeMidiStatus().then(st => st && setNativeBuild(st.appBuild ?? 1)); }, []);
  const appOutdated = isNative && nativeBuild !== null && nativeBuild < __NATIVE_BUILD__;

  return (
    <div className="scrim" onClick={onClose}>
      <div className="side-sheet" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={e => e.stopPropagation()}>
        <header className="sheet-head">
          <h2 id="settings-title">{L('Settings', 'Definições')}</h2>
          <button className="icon-btn ghost" onClick={onClose} aria-label={L('Close', 'Fechar')}><IconClose /></button>
        </header>

        {appOutdated && <p className="warn">{L('A newer iPhone app is out. Update it in SideStore.', 'Há uma app nova para iPhone. Atualiza-a no SideStore.')}</p>}
        <section className="set-group" aria-labelledby="piano-title">
          <h3 id="piano-title"><span className="tab">1</span>{L('Your piano', 'O teu piano')}<span className="keys" aria-hidden="true"><i className="b" /><i className="b" /><i /><i className="b" /><i className="b" /><i className="b" /><i /></span></h3>
          <PianoChoices settings={settings} update={update} links={links} connectInput={connectInput} disconnectInput={disconnectInput} onCheck={onCheck} />
        </section>

        <section className="set-group" aria-labelledby="words-title">
          <h3 id="words-title"><span className="tab">2</span>{L('Language and notes', 'Língua e notas')}</h3>
          <Segmented<Lang> label={L('Language', 'Língua')} value={settings.lang}
            onChange={v => update({ lang: v, naming: v === 'pt' ? 'solfege' : 'letters' })}
            options={[['en', 'English'], ['pt', 'Português']]} />
          <p className="fine">{L('The screens, the videos and their voice.', 'Os ecrãs, os vídeos e a voz.')}</p>
          <Segmented label={L('Note names', 'Nomes das notas')} value={settings.naming} onChange={v => update({ naming: v })} options={[['letters', 'C D E'], ['solfege', 'Dó Ré Mi']]} />
          <Segmented<FingerMode> label={L('Finger numbers', 'Dedilhação')} value={settings.fingers} onChange={v => update({ fingers: v })} options={[['off', L('Off', 'Não')], ['some', L('Some', 'Alguns')], ['all', L('All', 'Todos')]]} />
          <p className="fine">{L('1 is the thumb, 5 the little finger. Some shows them only where the hand moves.', '1 é o polegar, 5 o mindinho. Alguns mostra-os só onde a mão muda de sítio.')}</p>
        </section>

        <section className="set-group" aria-labelledby="videos-title">
          <h3 id="videos-title"><span className="tab">3</span>{L('Videos', 'Vídeos')}</h3>
          <Segmented<number> label={L('Speed', 'Velocidade')} value={settings.videoPace ?? 1} onChange={v => update({ videoPace: v })}
            options={[[0.8, L('Slower', 'Mais lento')], [1, 'Normal'], [1.2, L('Faster', 'Mais rápido')]]} />
          <label className="toggle-row">
            <span><b>{L('Wait for me', 'Esperar por mim')}</b><small>{L('With your piano connected, the video stops at a note you have not played.', 'Com o piano ligado, o vídeo para numa nota que ainda não tocaste.')}</small></span>
            <input className="switch" type="checkbox" checked={settings.videoWait ?? true} onChange={e => update({ videoWait: e.target.checked })} />
          </label>
          <label className="toggle-row">
            <span><b>{L('Read on the staff', 'Ler na pauta')}</b><small>{L('The videos show the staff instead of the falling notes, with the keys and the hands below.', 'Os vídeos mostram a pauta em vez das notas a cair, com as teclas e as mãos em baixo.')}</small></span>
            <input className="switch" type="checkbox" checked={staff} onChange={e => { showStaff(e.target.checked); setStaff(e.target.checked); }} />
          </label>
          <label className="toggle-row">
            <span><b>{L('Hands on the keys', 'Mãos nas teclas')}</b><small>{L('Hands that show how to play. Based on "Rigged hand" by Elena FF (Sketchfab), CC BY-SA 4.0.', 'Mãos que mostram como tocar. Baseadas em "Rigged hand" de Elena FF (Sketchfab), CC BY-SA 4.0.')}</small></span>
            <input className="switch" type="checkbox" checked={hands} onChange={e => { showHands(e.target.checked); setHands(e.target.checked); }} />
          </label>
          <NaturalVoiceRow />
        </section>

        <section className="set-group" aria-labelledby="sound-title">
          <h3 id="sound-title"><span className="tab">4</span>{L('Sound', 'Som')}</h3>
          <label className="toggle-row">
            <span><b>{L('Hear the keys I play', 'Ouvir as teclas que toco')}</b><small>{L('Hear the app’s grand piano when you play a MIDI or Bluetooth keyboard.', 'Ouve o piano de cauda da app quando tocas num teclado MIDI ou Bluetooth.')}</small></span>
            <input className="switch" type="checkbox" checked={settings.localSound} onChange={e => update({ localSound: e.target.checked })} />
          </label>
          <label className="toggle-row">
            <span><b>{L('App plays the other hand', 'A app toca a outra mão')}</b><small>{L("The app plays the hand you're not playing.", 'A app toca a mão que não estás a tocar.')}</small></span>
            <input className="switch" type="checkbox" checked={settings.accompaniment} onChange={e => update({ accompaniment: e.target.checked })} />
          </label>
        </section>
      </div>
    </div>
  );
}

/** The natural voice of the videos: recorded with the app; a line it lacks is made on the device. */
function NaturalVoiceRow() {
  const [, bump] = useState(0);
  useEffect(() => onVoice(() => bump(x => x + 1)), []);
  const st = naturalState();
  const hint = !naturalVoiceWanted() ? L('Off: the system voice speaks instead.', 'Desligada: fala a voz do sistema.') : st === 'loading' ? L('Making a new line on this device, a moment.', 'A fazer uma frase nova neste aparelho, um momento.') : L('A recorded human voice. Lines it has not recorded yet are made on this device.', 'Uma voz humana gravada. As frases que ainda não gravou são feitas neste aparelho.');
  return (
    <label className="toggle-row">
      <span><b>{L('Natural voice', 'Voz natural')}</b><small>{hint}</small></span>
      <input className="switch" type="checkbox" checked={naturalVoiceWanted()} onChange={e => setNaturalVoice(e.target.checked)} />
    </label>
  );
}
