import { useEffect, useRef, useState, type ReactNode } from 'react';
import { filmName, useI18n } from '../lib/i18n';
import { support, type LinkState, type Source } from '../lib/input';
import { GENERIC_COVER, getProgress, importMidi, listSongs, loadSong, removeSong } from '../lib/library';
import { formatTime } from '../lib/names';
import type { Progress, Settings, Song, SongEntry } from '../lib/types';
import { IconBluetooth, IconClose, IconGear, IconImport, IconKeys, IconMic, IconTrash } from './Icons';
import { InputCheck } from './InputCheck';

interface Props {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  links: Record<Source, LinkState>;
  connectInput: (kind: Source) => void;
  onOpen: (song: Song) => void;
  /** Called synchronously on tap, inside the user gesture. */
  onPick: () => void;
}

const SPEEDS = [0.6, 0.8, 1, 1.2];
const SHORT: Record<Source, string> = { mic: 'Mic', ble: 'Bluetooth', midi: 'USB' };

export function Library({ settings, update, links, connectInput, onOpen, onPick }: Props) {
  const { t, lang } = useI18n();
  const [entries, setEntries] = useState<SongEntry[]>([]);
  const [songs, setSongs] = useState<Record<string, Song>>({});
  const [progress, setProgress] = useState<Record<string, Progress | undefined>>({});
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showCheck, setShowCheck] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const slotRef = useRef<SongEntry | undefined>(undefined);
  const pickFile = (slot?: SongEntry) => { slotRef.current = slot; fileRef.current?.click(); };

  const refresh = async () => {
    const list = await listSongs();
    setEntries(list);
    list.forEach(e => {
      loadSong(e).then(s => setSongs(prev => ({ ...prev, [e.id]: s }))).catch(() => {});
      getProgress(e.id).then(p => setProgress(prev => ({ ...prev, [e.id]: p })));
    });
  };
  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(id);
  }, [toast]);

  const onFile = async (file?: File) => {
    if (!file) return;
    try {
      const entry = await importMidi(file, slotRef.current);
      setToast({ text: t('imported_ok', { title: entry.title }) });
      await refresh();
    } catch (err) {
      setToast({ text: t(err instanceof Error ? err.message : 'err.badFile'), error: true });
    }
    if (fileRef.current) fileRef.current.value = '';
    slotRef.current = undefined;
  };

  const open = async (e: SongEntry) => {
    if (e.missing) { pickFile(e); return; }
    onPick();
    setOpening(e.id);
    try { onOpen(songs[e.id] ?? (await loadSong(e))); }
    catch (err) { setToast({ text: t(err instanceof Error ? err.message : 'err.loadFailed'), error: true }); }
    finally { setOpening(null); }
  };

  const inputs: { kind: Source; icon: ReactNode; supported: boolean }[] = [
    { kind: 'mic', icon: <IconMic />, supported: support.mic },
    { kind: 'ble', icon: <IconBluetooth />, supported: support.bluetooth },
    { kind: 'midi', icon: <IconKeys />, supported: support.webMidi },
  ];
  const selected = settings.input !== 'none' ? settings.input as Source : null;
  const active = selected ? links[selected] : undefined;
  const status = !selected || !active ? t('tapToConnect')
    : active.status === 'on' ? `${SHORT[selected]} · ${active.label ?? (selected === 'mic' ? 'listening' : t('on'))}`
    : active.status === 'connecting' ? `${SHORT[selected]} · ${t('connecting')}`
    : active.status === 'error' ? `${SHORT[selected]} · not connected`
    : `${SHORT[selected]} · ${t('tapToConnect').toLowerCase()}`;

  return (
    <div className="library">
      <aside className="panel-side">
        <div className="brand">
          <div className="brand-row">
            <h1>Hugo’s<br />Piano</h1>
            <button className="keycap" onClick={() => setShowSettings(true)} aria-label={t('settings')}><IconGear /></button>
          </div>
          <p>{t('brandSub')}</p>
        </div>

        <section className="input-group" aria-label={t('input')}>
          <span className="legend">{t('input')}</span>
          <div className="inputs">
            {inputs.map(({ kind, icon, supported }) => {
              const st = links[kind];
              const sel = settings.input === kind;
              const led = st.status === 'on' ? 'green' : st.status === 'connecting' ? 'blink' : st.status === 'error' && sel ? 'red' : '';
              return (
                <div className="cap" key={kind} data-unsupported={!supported || undefined}>
                  <i className={`led ${led}`} />
                  <button
                    className={`keycap ${sel ? 'dark' : ''}`}
                    aria-pressed={sel}
                    aria-label={t(kind === 'mic' ? 'inMic' : kind === 'ble' ? 'inBle' : 'inMidi')}
                    onClick={() => { update({ input: kind }); connectInput(kind); }}
                  >
                    {icon}
                  </button>
                  <span className="legend">{SHORT[kind]}</span>
                </div>
              );
            })}
          </div>
          <p className={`lcd input-status ${active?.status === 'on' ? '' : 'off'}`} role="status">{status}</p>
          {active?.status === 'error' && active.error && <p className="note warn" style={{ marginTop: 10 }}>{t(active.error)}</p>}
          {settings.input === 'mic' && active?.status === 'on' && <p className="note" style={{ marginTop: 10 }}>{t('micHint')}</p>}
        </section>

        <button className="check-open" onClick={() => setShowCheck(true)}>Check input</button>
        <button className="pill go" onClick={() => pickFile()}><IconImport size={16} />{t('import')}</button>
        <input ref={fileRef} type="file" accept=".mid,.midi,audio/midi,audio/x-midi" hidden onChange={e => onFile(e.target.files?.[0])} />
      </aside>

      <main className="rack" aria-label={t('library')}>
        {entries.map((e, i) => {
          const s = songs[e.id];
          const p = progress[e.id];
          const film = filmName(e, lang);
          const img = e.image ?? GENERIC_COVER;
          const best = p?.bestSpeed ?? 0;
          return (
            <article key={e.id} className={`cart ${opening === e.id ? 'opening' : ''} ${e.missing ? 'missing' : ''}`}>
              <button className="cart-hit" onClick={() => open(e)} aria-label={e.missing ? `${e.title}: ${t('missingSong')}` : e.title} />
              <div className="grip" />
              <figure className="photo"><img src={img.src} alt={img.alt} loading="lazy" decoding="async" draggable={false} /></figure>
              <div className="label">
                <span className="cart-id">{String(i + 1).padStart(2, '0')} · {s ? formatTime(s.duration) : e.missing ? 'no file' : '—'}</span>
                <h3>{e.title}</h3>
                <p className="cart-sub">{film ? `${film}${e.year ? ' · ' + e.year : ''}` : t('imported')}</p>
                {e.missing
                  ? <p className="missing-note"><IconImport size={16} />{t('missingSong')}</p>
                  : (
                    <div className="stamps" aria-label={best ? `Passed up to ${best}×` : 'No speeds passed yet'}>
                      {SPEEDS.map(v => <span key={v} className={best >= v ? 'done' : ''}>{v}</span>)}
                    </div>
                  )}
              </div>
              {!e.builtIn && (
                confirmId === e.id ? (
                  <div className="confirm">
                    <span>{t('confirmDelete')}</span>
                    <button className="pill danger" onClick={async () => { await removeSong(e); setConfirmId(null); refresh(); }}>{t('delete')}</button>
                    <button className="pill" onClick={() => setConfirmId(null)}>{t('cancel')}</button>
                  </div>
                ) : (
                  <button className="cart-del" onClick={() => setConfirmId(e.id)} aria-label={t('delete')}><IconTrash size={16} /></button>
                )
              )}
            </article>
          );
        })}
        <button className="cart-add" onClick={() => pickFile()}>
          <span className="keycap"><IconImport /></span>
          <span>{t('emptyImports')}</span>
        </button>
      </main>

      {showSettings && (
        <div className="scrim" onClick={() => setShowSettings(false)}>
          <div className="sheet-panel" role="dialog" aria-label={t('settings')} onClick={e => e.stopPropagation()}>
            <div className="sheet-head">
              <h2>{t('settings')}</h2>
              <button className="keycap" onClick={() => setShowSettings(false)} aria-label={t('close')}><IconClose /></button>
            </div>
            <div className="row">
              <strong className="row-title">{t('naming')}</strong>
              <div className="slider">
                <button className={settings.naming === 'letters' ? 'on' : ''} onClick={() => update({ naming: 'letters' })}>C D E</button>
                <button className={settings.naming === 'solfege' ? 'on' : ''} onClick={() => update({ naming: 'solfege' })}>Do Re Mi</button>
              </div>
            </div>
            <div className="rule" />
            <label className="row toggle">
              <span><strong className="row-title">{t('localSound')}</strong><small>{t('localSoundHint')}</small></span>
              <input className="switch" type="checkbox" checked={settings.localSound} onChange={e => update({ localSound: e.target.checked })} />
            </label>
            <div className="rule" />
            <label className="row toggle">
              <span><strong className="row-title">{t('accompaniment')}</strong><small>{t('accompanimentHint')}</small></span>
              <input className="switch" type="checkbox" checked={settings.accompaniment} onChange={e => update({ accompaniment: e.target.checked })} />
            </label>
            <p className="credits">{t('photoCredits')} {entries.filter(e => e.image).map(e => e.image!.by).filter((v, i, a) => a.indexOf(v) === i).join(', ')}, {GENERIC_COVER.by}. Type: Supreme by Indian Type Foundry (Fontshare), Martian Mono by Evil Martians.</p>
          </div>
        </div>
      )}

      {showCheck && <InputCheck links={links} naming={settings.naming} onClose={() => setShowCheck(false)} />}

      {toast && <div className={`toast lcd ${toast.error ? 'error' : ''}`} role="status">{toast.text}</div>}
    </div>
  );
}
