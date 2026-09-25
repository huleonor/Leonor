import { useEffect, useRef, useState, type ReactNode } from 'react';
import { filmName, useI18n } from '../lib/i18n';
import { support, type LinkState, type Source } from '../lib/input';
import { GENERIC_COVER, getProgress, importMidi, listSongs, loadSong, removeSong } from '../lib/library';
import { formatSpeed, formatTime } from '../lib/names';
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

/** The reel's picture: a still that stands for the song, framed like a film frame. */
function Cover({ entry }: { entry: SongEntry }) {
  const img = entry.image ?? GENERIC_COVER;
  return (
    <figure className="frame">
      <img src={img.src} alt={img.alt} loading="lazy" decoding="async" draggable={false} />
    </figure>
  );
}

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

  const inputs: { kind: Source; label: string; icon: ReactNode; supported: boolean }[] = [
    { kind: 'mic', label: t('inMic'), icon: <IconMic />, supported: support.mic },
    { kind: 'ble', label: t('inBle'), icon: <IconBluetooth />, supported: support.bluetooth },
    { kind: 'midi', label: t('inMidi'), icon: <IconKeys />, supported: support.webMidi },
  ];
  const active = settings.input !== 'none' ? links[settings.input as Source] : undefined;

  return (
    <div className="library">
      <aside className="lib-side">
        <div className="brand-row">
          <h1 className="brand">Hugo's<br />Piano<small>{t('brandSub')}</small></h1>
          <button className="icon-btn" onClick={() => setShowSettings(true)} aria-label={t('settings')}><IconGear /></button>
        </div>
        <section>
          <h2 className="lab">{t('input')}</h2>
          <div className="inputs">
            {inputs.map(({ kind, label, icon, supported }) => {
              const st = links[kind];
              const selected = settings.input === kind;
              return (
                <button
                  key={kind}
                  className={`input-btn ${selected ? 'sel' : ''} ${st.status}`}
                  aria-pressed={selected}
                  onClick={() => { update({ input: kind }); connectInput(kind); }}
                  data-unsupported={!supported || undefined}
                >
                  {icon}
                  <span className="input-name">{label}</span>
                  <span className="input-state">{st.status === 'on' ? (st.label ?? t('on')) : st.status === 'connecting' ? t('connecting') : selected ? t('tapToConnect') : ''}</span>
                  <i className="dot" />
                </button>
              );
            })}
          </div>
          {active?.status === 'error' && active.error && <p className="note warn">{t(active.error)}</p>}
          {settings.input === 'mic' && active?.status === 'on' && <p className="note">{t('micHint')}</p>}
          <button className="check-open" onClick={() => setShowCheck(true)}>Check input: play a key and see it here</button>
        </section>
        <button className="import" onClick={() => pickFile()}><IconImport size={16} />{t('import')}</button>
        <input ref={fileRef} type="file" accept=".mid,.midi,audio/midi,audio/x-midi" hidden onChange={e => onFile(e.target.files?.[0])} />
      </aside>

      <main className="reel" aria-label={t('library')}>
        {entries.map((e, i) => {
          const s = songs[e.id];
          const p = progress[e.id];
          const film = filmName(e, lang);
          return (
            <article key={e.id} className={`can ${opening === e.id ? 'opening' : ''} ${e.missing ? 'missing' : ''}`}>
              <button className="can-hit" onClick={() => open(e)} aria-label={e.missing ? `${e.title}: ${t('missingSong')}` : e.title} />
              <span className="edge">{t('reel')} {String(i + 1).padStart(2, '0')} ▸ {e.composer ?? t('imported')}</span>
              <h3>{e.title}</h3>
              <p className="can-sub">{film ? `${film}${e.year ? ' · ' + e.year : ''}` : t('imported')}</p>
              <Cover entry={e} />
              {e.missing && <p className="missing-note"><IconImport size={16} />{t('missingSong')}</p>}
              <dl>
                <div><dt>{t('length')}</dt><dd>{s ? formatTime(s.duration) : '—'}</dd></div>
                <div><dt>{t('hands')}</dt><dd>{s ? (s.hands.length === 2 ? '2' : t(s.hands[0] === 'R' ? 'handsR' : 'handsL')) : '—'}</dd></div>
                <div><dt>{t('best')}</dt><dd>{p?.bestSpeed ? formatSpeed(p.bestSpeed) : '—'}</dd></div>
                <div><dt>{t('accuracy')}</dt><dd>{p?.plays ? Math.round(p.bestAccuracy * 100) + '%' : '—'}</dd></div>
              </dl>
              {!e.builtIn && (
                confirmId === e.id ? (
                  <div className="confirm">
                    <span>{t('confirmDelete')}</span>
                    <button onClick={async () => { await removeSong(e); setConfirmId(null); refresh(); }}>{t('delete')}</button>
                    <button onClick={() => setConfirmId(null)}>{t('cancel')}</button>
                  </div>
                ) : (
                  <button className="can-del" onClick={() => setConfirmId(e.id)} aria-label={t('delete')}><IconTrash size={16} /></button>
                )
              )}
            </article>
          );
        })}
        <button className="can can-add" onClick={() => pickFile()}>
          <IconImport size={22} />
          <span>{t('emptyImports')}</span>
        </button>
      </main>

      {showSettings && (
        <div className="drawer-scrim" onClick={() => setShowSettings(false)}>
          <div className="drawer" role="dialog" aria-label={t('settings')} onClick={e => e.stopPropagation()}>
            <div className="drawer-head">
              <h2>{t('settings')}</h2>
              <button className="icon-btn" onClick={() => setShowSettings(false)} aria-label={t('close')}><IconClose /></button>
            </div>
            <div className="row">
              <span className="lab">{t('naming')}</span>
              <div className="seg">
                <button className={settings.naming === 'solfege' ? 'on' : ''} onClick={() => update({ naming: 'solfege' })}>Dó Ré Mi</button>
                <button className={settings.naming === 'letters' ? 'on' : ''} onClick={() => update({ naming: 'letters' })}>C D E</button>
              </div>
            </div>
            <label className="row toggle">
              <span><span className="lab">{t('accompaniment')}</span><small>{t('accompanimentHint')}</small></span>
              <input type="checkbox" checked={settings.accompaniment} onChange={e => update({ accompaniment: e.target.checked })} />
            </label>
            <label className="row toggle">
              <span><span className="lab">{t('localSound')}</span><small>{t('localSoundHint')}</small></span>
              <input type="checkbox" checked={settings.localSound} onChange={e => update({ localSound: e.target.checked })} />
            </label>
            <p className="credits">{t('photoCredits')} {entries.filter(e => e.image).map(e => e.image!.by).filter((v, i, a) => a.indexOf(v) === i).join(', ')}, {GENERIC_COVER.by}.</p>
          </div>
        </div>
      )}

      {showCheck && <InputCheck links={links} naming={settings.naming} onClose={() => setShowCheck(false)} />}

      {toast && <div className={`toast ${toast.error ? 'error' : ''}`} role="status">{toast.text}</div>}
    </div>
  );
}
