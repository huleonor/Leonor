/**
 * His profile: the penguin he dressed on a coloured header, his name and how long he has been
 * learning, and his songs with how far each one has come. No points, streaks or medals: only the
 * music and his progress in it.
 */
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import type { SongInfo } from '../lib/catalog';
import { myLibrary } from '../lib/library';
import { meterOf, onMastery, pctOf } from '../lib/mastery';
import { AV_BG, AV_BODY, AV_EXTRA, saveProfile, useProfile, type Look } from '../lib/profile';
import type { SongEntry } from '../lib/types';
import { CountUp } from './Confetti';
import { IconEdit, IconMusic } from './Icons';
import { SOFT, SPRING } from './Motion';
import { Penguin } from './Penguin';
import { SongCover } from './SongCover';

const EXTRA_NAME: Record<string, string> = { none: 'None', glasses: 'Glasses', headphones: 'Headphones', beanie: 'Beanie', bowtie: 'Bow tie', crown: 'Crown' };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface Props { infos: Record<string, SongInfo>; entries: SongEntry[]; onOpenSong: (info: SongInfo) => void; }

export function Profile({ infos, entries, onOpenSong }: Props) {
  const profile = useProfile();
  const [editing, setEditing] = useState(false);
  const [, bump] = useState(0);
  useEffect(() => onMastery(() => bump(x => x + 1)), []);

  const lib = myLibrary();
  const songs = entries.filter(e => !e.missing && (!e.builtIn || lib.includes(e.id) || (e.slot && lib.includes(e.slot)))).map(e => infos[e.id]).filter((i): i is SongInfo => !!i?.song);
  const rows = songs.map(info => ({ info, v: meterOf(info.song!).value })).sort((a, b) => b.v - a.v);
  const parts = songs.reduce((n, i) => n + (i.course?.parts.filter(p => !p.sameAs && i.course!.steps.filter(st => st.part === p.n).every(st => (i.prog[st.id]?.stars ?? 0) > 0)).length ?? 0), 0);
  const since = new Date(profile.since);

  return (
    <div className="profile-page">
      <header className="profile-hero" style={{ background: `var(--av-bg-${profile.look.bg})` }}>
        <motion.div className="profile-av" initial={{ y: 40, scale: 0.8, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} transition={SPRING}>
          <Penguin look={profile.look} size={210} />
        </motion.div>
        <motion.button className="icon-btn profile-edit" onClick={() => setEditing(true)} aria-label="Change your penguin" whileTap={{ scale: 0.9 }}><IconEdit size={22} /></motion.button>
      </header>

      <section className="profile-id">
        <h1>{profile.name}</h1>
        <p className="sub">Learning piano since {MONTHS[since.getMonth()]} {since.getFullYear()}</p>
        <dl className="profile-counts">
          <div><dt>Songs</dt><dd><CountUp to={songs.length} /></dd></div>
          <div><dt>Parts learnt</dt><dd><CountUp to={parts} /></dd></div>
        </dl>
      </section>

      <section className="profile-block">
        <h2>Your songs</h2>
        {rows.length ? (
          <ol className="progress-list">
            {rows.map(({ info, v }, i) => (
              <motion.li key={info.entry.id} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ...SOFT, delay: i * 0.05 }}>
                <button className="progress-row" onClick={() => onOpenSong(info)} aria-label={`${info.entry.title}, ${pctOf(v)}%`}>
                  <span className="cover"><SongCover entry={info.entry} song={info.song} /></span>
                  <span className="progress-text">
                    <b>{info.entry.title}</b>
                    <small>{info.entry.composer}</small>
                    <span className="song-meter"><i><motion.b initial={{ width: 0 }} animate={{ width: `${Math.max(2, v * 100)}%` }} transition={SOFT} /></i>{pctOf(v)}%</span>
                  </span>
                </button>
              </motion.li>
            ))}
          </ol>
        ) : (
          <p className="fine"><IconMusic size={16} /> Add a song in Library: it shows up here with its progress.</p>
        )}
      </section>

      <AnimatePresence>{editing && <EditLook onClose={() => setEditing(false)} />}</AnimatePresence>
    </div>
  );
}

function EditLook({ onClose }: { onClose: () => void }) {
  const profile = useProfile();
  const [look, setLook] = useState<Look>(profile.look);
  const [name, setName] = useState(profile.name);
  const save = () => { saveProfile({ ...profile, look, name: name.trim() || profile.name }); onClose(); };
  return (
    <motion.div className="veil sheet-veil" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.section className="card look-sheet" role="dialog" aria-modal="true" aria-labelledby="look-title" onClick={e => e.stopPropagation()} initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} transition={SOFT}>
        <h2 id="look-title">Your penguin</h2>
        <motion.div className="look-preview" style={{ background: `var(--av-bg-${look.bg})` }} key={`${look.body}-${look.extra}`} initial={{ scale: 0.92 }} animate={{ scale: 1 }} transition={SPRING}>
          <Penguin look={look} size={150} />
        </motion.div>
        <label className="look-row">
          <span>Name</span>
          <input className="look-name" value={name} maxLength={24} onChange={e => setName(e.target.value)} />
        </label>
        <div className="look-row"><span>Background</span>
          <div className="swatches">{AV_BG.map(b => <button key={b} className={`swatch ${look.bg === b ? 'on' : ''}`} style={{ background: `var(--av-bg-${b})` }} onClick={() => setLook({ ...look, bg: b })} aria-label={`Background ${b}`} aria-pressed={look.bg === b} />)}</div>
        </div>
        <div className="look-row"><span>Feathers</span>
          <div className="swatches">{AV_BODY.map(b => <button key={b} className={`swatch ${look.body === b ? 'on' : ''}`} style={{ background: `var(--av-body-${b})` }} onClick={() => setLook({ ...look, body: b })} aria-label={`Feathers ${b}`} aria-pressed={look.body === b} />)}</div>
        </div>
        <div className="look-row"><span>Wears</span>
          <div className="extras">{AV_EXTRA.map(x => (
            <button key={x} className={`extra ${look.extra === x ? 'on' : ''}`} onClick={() => setLook({ ...look, extra: x })} aria-pressed={look.extra === x}>
              <Penguin look={{ ...look, extra: x }} size={44} /><small>{EXTRA_NAME[x]}</small>
            </button>
          ))}</div>
        </div>
        <button className="btn go big" onClick={save}>Save</button>
      </motion.section>
    </motion.div>
  );
}
