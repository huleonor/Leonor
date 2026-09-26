import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { songLevel } from '../lib/analysis';
import { buildCourse, courseStars, getCourseProgress, lastPractised, nextStep, partLearnt, type Course, type CourseStep } from '../lib/course';
import { filmName, useI18n } from '../lib/i18n';
import { isNative, nativeMidiStatus, support, type LinkState, type Source } from '../lib/input';
import { GENERIC_COVER, importMidi, listSongs, loadSong, removeSong } from '../lib/library';
import type { Settings, Song, SongEntry } from '../lib/types';
import { stepLabel } from './CourseView';
import { IconBluetooth, IconClose, IconGear, IconImport, IconKeys, IconMic, IconPlay, IconTrash } from './Icons';
import { InputCheck } from './InputCheck';

interface Props {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  links: Record<Source, LinkState>;
  connectInput: (kind: Source) => void;
  onOpen: (song: Song) => void;
  /** Jump straight into the next step of a song's course. */
  onContinue: (song: Song, step: CourseStep, course: Course) => void;
  /** Called synchronously on tap, inside the user gesture. */
  onPick: () => void;
}

type Shelf = 'film' | 'modern' | 'classical' | 'mine';
const SHELVES: { id: Shelf; title: string }[] = [
  { id: 'film', title: 'Film scores' },
  { id: 'modern', title: 'Modern piano' },
  { id: 'classical', title: 'Classical' },
  { id: 'mine', title: 'My songs' },
];
const shelfOf = (e: SongEntry): Shelf => (e.builtIn || e.slot ? e.collection ?? 'mine' : 'mine');
const LEVEL = ['', 'First pieces', 'Intermediate', 'Advanced'];
const SOURCE_URL = 'https://hugos-piano.vercel.app/sidestore.json';

function CopySource() {
  const [done, setDone] = useState(false);
  return (
    <button className="pill" onClick={() => navigator.clipboard?.writeText(SOURCE_URL).then(() => setDone(true)).catch(() => {})}>
      {done ? 'Link copied' : 'Copy SideStore link'}
    </button>
  );
}

interface Info { song: Song; level: 1 | 2 | 3; course: Course; learnt: number; stars: number; next?: CourseStep; }
const SHORT: Record<Source, string> = { mic: 'Mic', ble: 'Bluetooth', midi: 'USB' };

export function Library({ settings, update, links, connectInput, onOpen, onContinue, onPick }: Props) {
  const { t, lang } = useI18n();
  const [entries, setEntries] = useState<SongEntry[]>([]);
  const [info, setInfo] = useState<Record<string, Info>>({});
  const [shelf, setShelf] = useState<Shelf | 'all'>(() => {
    try { return (localStorage.getItem('hugos-piano:shelf') as Shelf | 'all') ?? 'all'; } catch { return 'all'; }
  });
  useEffect(() => { try { localStorage.setItem('hugos-piano:shelf', shelf); } catch { /* ignore */ } }, [shelf]);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showCheck, setShowCheck] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [nativeApp, setNativeApp] = useState<{ version: string; build: number } | null>(null);
  useEffect(() => {
    nativeMidiStatus().then(st => st && setNativeApp({ version: st.appVersion ?? '1.0', build: st.appBuild ?? 1 }));
  }, []);
  // The site updates itself; the app around it only when a new .ipa is installed.
  const appOutdated = isNative && !!nativeApp && nativeApp.build < __NATIVE_BUILD__;
  const fileRef = useRef<HTMLInputElement>(null);
  const slotRef = useRef<SongEntry | undefined>(undefined);
  const pickFile = (slot?: SongEntry) => { slotRef.current = slot; fileRef.current?.click(); };

  const refresh = async () => {
    const list = await listSongs();
    setEntries(list);
    list.filter(e => !e.missing).forEach(async e => {
      try {
        const song = await loadSong(e);
        const course = buildCourse(song);
        const prog = await getCourseProgress(e.id);
        const next = nextStep(course, prog);
        setInfo(prev => ({ ...prev, [e.id]: {
          song, course, next, level: songLevel(song),
          learnt: course.parts.filter(p => partLearnt(course, prog, p.n)).length,
          stars: courseStars(course, prog).got,
        } }));
      } catch { /* unreadable file: the cartridge still shows */ }
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
    try { onOpen(info[e.id]?.song ?? (await loadSong(e))); }
    catch (err) { setToast({ text: t(err instanceof Error ? err.message : 'err.loadFailed'), error: true }); }
    finally { setOpening(null); }
  };

  // Easiest first on every shelf, songs waiting for a file at the end.
  const sorted = useMemo(() => [...entries].sort((a, b) =>
    Number(!!a.missing) - Number(!!b.missing)
    || (info[a.id]?.level ?? 2) - (info[b.id]?.level ?? 2)
    || a.title.localeCompare(b.title)), [entries, info]);
  const cont = useMemo(() => {
    const last = lastPractised();
    const entry = last && entries.find(e => e.id === last.songId);
    const inf = entry && info[entry.id];
    return entry && inf?.next ? { entry, info: inf } : null;
  }, [entries, info]);

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
          <p className={`lcd input-status ${active?.status === 'on' ? '' : active?.status === 'error' ? 'off fault' : 'off'}`} role="status">{status}</p>
          {active?.status === 'error' && active.error && <p className="note warn" style={{ marginTop: 10 }}>{t(active.error)}</p>}
          {settings.input === 'mic' && active?.status === 'on' && <p className="note" style={{ marginTop: 10 }}>{t('micHint')}</p>}
        </section>

        <button className="check-open" onClick={() => setShowCheck(true)}>Check input</button>
        <button className="pill go" onClick={() => pickFile()}><IconImport size={16} />{t('import')}</button>
        <input ref={fileRef} type="file" accept=".mid,.midi,audio/midi,audio/x-midi" hidden onChange={e => onFile(e.target.files?.[0])} />
      </aside>

      <main className="shelves" aria-label={t('library')}>
        {appOutdated && (
          <section className="update-banner" role="status">
            <i className="led orange" />
            <div>
              <h2>New iPhone app: version {__NATIVE_VERSION__}</h2>
              <p>This screen is already up to date. The app around it needs the new version for the cable and Bluetooth fixes. In SideStore, open <b>Sources</b>, add the Hugo’s Piano link once, then <b>Update</b>. Your songs and stars stay.</p>
            </div>
            <CopySource />
          </section>
        )}
        {cont && (
          <button className="continue-card" onClick={() => { onPick(); onContinue(cont.info.song, cont.info.next!, cont.info.course); }}>
            <img src={(cont.entry.image ?? GENERIC_COVER).src} alt="" draggable={false} />
            <span className="cc-text">
              <span className="cc-title">Continue {cont.entry.title}</span>
              <span className="cc-step">{stepLabel(cont.info.course, cont.info.next!)}</span>
            </span>
            <span className="lcd cc-meter">{cont.info.learnt}/{cont.info.course.parts.length} parts</span>
            <span className="keycap lit" aria-hidden="true"><IconPlay size={16} /></span>
          </button>
        )}

        <div className="slider shelf-filter" role="group" aria-label="Show">
          <button className={shelf === 'all' ? 'on' : ''} onClick={() => setShelf('all')}>All</button>
          {SHELVES.filter(sh => entries.some(e => shelfOf(e) === sh.id)).map(sh => (
            <button key={sh.id} className={shelf === sh.id ? 'on' : ''} onClick={() => setShelf(sh.id)}>{sh.title}</button>
          ))}
        </div>

        {SHELVES.filter(sh => shelf === 'all' || shelf === sh.id).map(sh => {
          const list = sorted.filter(e => shelfOf(e) === sh.id);
          if (!list.length && sh.id !== 'mine') return null;
          if (!list.length && shelf === 'all') return null;
          return (
            <section key={sh.id} className="shelf" aria-label={sh.title}>
              <h2>{sh.title}<span>{list.filter(e => !e.missing).length} to play{list.some(e => e.missing) ? ` · ${list.filter(e => e.missing).length} waiting for a file` : ''}</span></h2>
              <div className="shelf-grid">
                {list.map(e => {
                  const inf = info[e.id];
                  const film = filmName(e, lang);
                  const img = e.image ?? GENERIC_COVER;
                  return (
                    <article key={e.id} className={`cart ${opening === e.id ? 'opening' : ''} ${e.missing ? 'missing' : ''}`}>
                      <button className="cart-hit" onClick={() => open(e)} aria-label={e.missing ? `${e.title}: ${t('missingSong')}` : e.title} />
                      <figure className="photo"><img src={img.src} alt={img.alt} loading="lazy" decoding="async" draggable={false} /></figure>
                      <div className="label">
                        <h3>{e.title}</h3>
                        <p className="cart-sub">{[e.composer, film].filter(Boolean).join(' · ') || t('imported')}</p>
                        {e.missing ? (
                          <p className="missing-note"><IconImport size={15} />{t('missingSong')}</p>
                        ) : (
                          <div className="cart-foot">
                            <span className="level" title={inf ? LEVEL[inf.level] : ''} aria-label={inf ? `Level: ${LEVEL[inf.level]}` : ''}>
                              {[1, 2, 3].map(i => <i key={i} className={`led ${inf && i <= inf.level ? 'lvl' : ''}`} />)}
                            </span>
                            {inf && (
                              <span className="parts-meter" aria-label={`${inf.learnt} of ${inf.course.parts.length} parts learnt`}>
                                <i style={{ transform: `scaleX(${inf.course.parts.length ? inf.learnt / inf.course.parts.length : 0})` }} />
                              </span>
                            )}
                            <span className="cart-count">{inf ? `${inf.learnt}/${inf.course.parts.length}` : ''}</span>
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
                          <button className="cart-del" onClick={() => setConfirmId(e.id)} aria-label={t('delete')}><IconTrash size={15} /></button>
                        )
                      )}
                    </article>
                  );
                })}
                {sh.id === 'mine' && (
                  <button className="cart-add" onClick={() => pickFile()}>
                    <span className="keycap"><IconImport /></span>
                    <span>{t('emptyImports')}</span>
                  </button>
                )}
              </div>
            </section>
          );
        })}
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
            <div className="rule" />
            <div className="row">
              <span>
                <strong className="row-title">Version</strong>
                <small>Screens {__APP_VERSION__}{isNative ? ` · iPhone app ${nativeApp ? `${nativeApp.version} (${nativeApp.build})` : '…'}` : ''}</small>
                <small>Screens update by themselves: close the app and open it again. A new iPhone app comes through SideStore → Update.</small>
              </span>
            </div>
            {isNative && <CopySource />}
            <p className="credits">{t('photoCredits')} {entries.filter(e => e.image).map(e => e.image!.by).filter((v, i, a) => a.indexOf(v) === i).join(', ')}, {GENERIC_COVER.by}. Type: Supreme by Indian Type Foundry (Fontshare), Martian Mono by Evil Martians.</p>
          </div>
        </div>
      )}

      {showCheck && <InputCheck links={links} naming={settings.naming} onClose={() => setShowCheck(false)} />}

      {toast && <div className={`toast lcd ${toast.error ? 'error' : ''}`} role="status">{toast.text}</div>}
    </div>
  );
}
