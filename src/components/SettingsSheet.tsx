import { useEffect, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { isNative, nativeMidiStatus, support, type LinkState, type Source } from '../lib/input';
import type { FingerMode, Settings } from '../lib/types';
import { IconBluetooth, IconClose, IconKeys, IconMic } from './Icons';
import { Segmented } from './ui';
import { allowWebReminders } from '../lib/reminders';

const SOURCE_URL = 'https://hugos-piano.vercel.app/sidestore.json';
const INPUTS: [Source, string, (p: { size?: number }) => React.ReactElement][] = [
  ['midi', 'USB cable', IconKeys],
  ['ble', 'Bluetooth', IconBluetooth],
  ['mic', 'Microphone', IconMic],
];

export function statusText(kind: Source, link: LinkState, t: (k: string) => string) {
  if (link.status === 'on') return link.label ? `Connected · ${link.label}` : kind === 'mic' ? 'Listening' : 'Connected';
  if (link.status === 'connecting') return 'Connecting…';
  if (link.status === 'error') return link.error ? t(link.error) : 'Not connected';
  return 'Tap to connect';
}

interface Props {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  links: Record<Source, LinkState>;
  connectInput: (kind: Source) => void;
  onCheck: () => void;
  onClose: () => void;
}

export function SettingsSheet({ settings, update, links, connectInput, onCheck, onClose }: Props) {
  const { t } = useI18n();
  const [nativeApp, setNativeApp] = useState<{ version: string; build: number } | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    nativeMidiStatus().then(st => st && setNativeApp({ version: st.appVersion ?? '1.0', build: st.appBuild ?? 1 }));
  }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const appOutdated = isNative && !!nativeApp && nativeApp.build < __NATIVE_BUILD__;
  const selected = settings.input !== 'none' ? (settings.input as Source) : null;
  const supported: Record<Source, boolean> = { mic: support.mic, ble: support.bluetooth, midi: support.webMidi };

  return (
    <div className="scrim" onClick={onClose}>
      <div className="side-sheet" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={e => e.stopPropagation()}>
        <header className="sheet-head">
          <h2 id="settings-title">Settings</h2>
          <button className="icon-btn ghost" onClick={onClose} aria-label="Close"><IconClose /></button>
        </header>

        <section className="set-group" aria-labelledby="piano-title">
          <h3 id="piano-title">Your piano</h3>
          <div className="input-choices">
            {INPUTS.map(([kind, label, Icon]) => {
              const link = links[kind];
              return (
                <button
                  key={kind}
                  className={`choice ${selected === kind ? 'selected' : ''} ${link.status}`}
                  onClick={() => { update({ input: kind, setupDone: true }); connectInput(kind); }}
                  disabled={!supported[kind]}
                  aria-pressed={selected === kind}
                >
                  <Icon size={20} />
                  <b>{label}</b>
                  <small>{supported[kind] ? (selected === kind || link.status !== 'off' ? statusText(kind, link, t) : 'Tap to use') : 'Not in this browser'}</small>
                </button>
              );
            })}
          </div>
          <button className="btn" onClick={onCheck}>Test your piano</button>
          {!isNative && support.isIOS && <p className="fine">iPhone browsers only have the microphone. Cable and Bluetooth work in the Leonor iPhone app.</p>}
        </section>

        <section className="set-group">
          <Segmented label="Note names" value={settings.naming} onChange={v => update({ naming: v })} options={[['letters', 'C D E'], ['solfege', 'Dó Ré Mi']]} />
          <Segmented<FingerMode> label="Finger numbers" value={settings.fingers} onChange={v => update({ fingers: v })} options={[['off', 'Off'], ['some', 'Some'], ['all', 'All']]} />
          <p className="fine">1 is the thumb, 5 the little finger. Some shows them only where the hand moves.</p>
          <Segmented label="Practice reminder" value={settings.reminder ?? 'off'}
            onChange={async v => { if (v !== 'off') await allowWebReminders(); update({ reminder: v === 'off' ? null : v }); }}
            options={[['off', 'Off'], ['08:00', '8:00'], ['13:00', '13:00'], ['19:00', '19:00'], ['21:00', '21:00']]} />
          {settings.reminder && !isNative && <p className="fine">On the web, the reminder shows only while the app is open. The iPhone app reminds you even when it is closed.</p>}
        </section>

        <section className="set-group">
          <label className="toggle-row">
            <span><b>Hear the keys I play</b><small>{t('localSoundHint')}</small></span>
            <input className="switch" type="checkbox" checked={settings.localSound} onChange={e => update({ localSound: e.target.checked })} />
          </label>
          <label className="toggle-row">
            <span><b>App plays the other hand</b><small>{t('accompanimentHint')}</small></span>
            <input className="switch" type="checkbox" checked={settings.accompaniment} onChange={e => update({ accompaniment: e.target.checked })} />
          </label>
        </section>

        <section className="set-group about">
          <p className="fine">Screens {__APP_VERSION__}{isNative ? ` · iPhone app ${nativeApp ? `${nativeApp.version} (${nativeApp.build})` : '…'}` : ''}</p>
          {appOutdated && <p className="warn">A newer iPhone app is out. Update it in SideStore.</p>}
          {isNative && (
            <button className="link" onClick={() => navigator.clipboard?.writeText(SOURCE_URL).then(() => setCopied(true)).catch(() => {})}>
              {copied ? 'Link copied' : 'Copy the SideStore link'}
            </button>
          )}
          <p className="fine credits">Sheet music engraved with abcjs. Type: Nunito by Vernon Adams and the Nunito Project.</p>
        </section>
      </div>
    </div>
  );
}
