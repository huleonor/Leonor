/**
 * His profile, Duolingo style: the penguin he dressed on a coloured header, his name and how long
 * he has been learning, an overview of what he has done, and his mastery collection, where each
 * song he is learning shows as a medal that turns bronze, silver, gold and finally his for good.
 */
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import type { SongInfo } from '../lib/catalog';
import { GENERIC_COVER, myLibrary } from '../lib/library';
import { CHECK_GAPS, onMastery, standingOf, TIER_NAME, type Standing, type Tier } from '../lib/mastery';
import { usePath } from '../lib/path';
import { AV_BG, AV_BODY, AV_EXTRA, saveProfile, useProfile, type Look } from '../lib/profile';
import { streak, totalXp, totals } from '../lib/stats';
import type { SongEntry } from '../lib/types';
import { CountUp } from './Confetti';
import { Flame, Gem } from './GameIcons';
import { IconBolt, IconCheck, IconEdit, IconMusic, IconTarget } from './Icons';
import { SOFT, SPRING } from './Motion';
import { Penguin } from './Penguin';
import { useDaily } from './Home';

const RANK: Record<Tier, number> = { none: 0, bronze: 1, silver: 2, gold: 3, forever: 4 };
const SEEN = 'hugos-piano:seen-tiers';
const readSeen = (): Record<string, Tier> => { try { return JSON.parse(localStorage.getItem(SEEN) ?? '{}'); } catch { return {}; } };

const EXTRA_NAME: Record<string, string> = { none: 'None', glasses: 'Glasses', headphones: 'Headphones', beanie: 'Beanie', bowtie: 'Bow tie', crown: 'Crown' };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface Props { infos: Record<string, SongInfo>; entries: SongEntry[]; onOpenSong: (info: SongInfo) => void; }

export function Profile({ infos, entries, onOpenSong }: Props) {
  const profile = useProfile();
  const daily = useDaily();
  const path = usePath();
  const [editing, setEditing] = useState(false);
  const [, bump] = useState(0);
  useEffect(() => onMastery(() => bump(x => x + 1)), []);

  const lib = myLibrary();
  const songs = entries.filter(e => !e.missing && (!e.builtIn || lib.includes(e.id) || (e.slot && lib.includes(e.slot)))).map(e => infos[e.id]).filter((i): i is SongInfo => !!i?.song);
  const standings = songs.map(info => ({ info, st: standingOf(info.song!) })).sort((a, b) => RANK[b.st.tier] - RANK[a.st.tier] || b.st.value - a.st.value);
  const mastered = standings.filter(s => RANK[s.st.tier] >= RANK.gold).length;
  const lessons = path ? Object.values(path.state).filter(s => s.done && s.passed > 0).length : 0;
  const best = totals().best;
  const s = streak();
  const since = new Date(profile.since);

  // A medal that went up a tier since he last looked shines once.
  const [seen] = useState(readSeen);
  useEffect(() => {
    const now = Object.fromEntries(standings.map(x => [x.info.entry.id, x.st.tier]));
    const t = window.setTimeout(() => { try { localStorage.setItem(SEEN, JSON.stringify({ ...readSeen(), ...now })); } catch { /* ignore */ } }, 1500);
    return () => window.clearTimeout(t);
  });

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
          <div><dt>Mastered</dt><dd><CountUp to={mastered} /></dd></div>
          <div><dt>Lessons</dt><dd><CountUp to={lessons} /></dd></div>
        </dl>
      </section>

      <section className="profile-block">
        <h2>Overview</h2>
        <div className="stat-grid">
          <Stat icon={<Flame size={28} lit={daily.streak.today} />} value={s.days} label="Day streak" />
          <Stat icon={<IconBolt size={28} className="ic-xp" />} value={totalXp()} label="Total XP" />
          <Stat icon={<Flame size={28} lit className="best" />} value={best} label="Best streak" />
          <Stat icon={<Gem size={26} />} value={mastered} label="Songs mastered" />
        </div>
      </section>

      <section className="profile-block">
        <h2>Mastery collection</h2>
        <p className="sub">Bronze at 50%, silver at 75%, gold at 100%. Keep gold through {CHECK_GAPS.length} checks and the song is yours for good.</p>
        {standings.length ? (
          <ol className="medal-grid">
            {standings.map(({ info, st }, i) => (
              <Medal key={info.entry.id} info={info} st={st} index={i} shine={RANK[st.tier] > RANK[seen[info.entry.id] ?? 'none'] && st.tier !== 'none'} onOpen={() => onOpenSong(info)} />
            ))}
            {standings.length < 3 && Array.from({ length: 3 - standings.length }, (_, k) => (
              <li key={`empty-${k}`} className="medal empty" aria-hidden="true"><span className="medal-disc"><IconMusic size={30} /></span><small>Your next song</small></li>
            ))}
          </ol>
        ) : (
          <p className="fine">Add a song in Songs and start its Mastery: it shows up here.</p>
        )}
      </section>

      <AnimatePresence>{editing && <EditLook onClose={() => setEditing(false)} />}</AnimatePresence>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="stat-card card">
      <span className="stat-ic">{icon}</span>
      <span className="stat-text"><b><CountUp to={value} /></b><small>{label}</small></span>
    </div>
  );
}

function dueText(st: Standing) {
  if (st.tier === 'forever') return 'Yours for good';
  if (st.lapsed) return 'Play it clean to win gold back';
  if (st.tier === 'gold' && st.due) {
    const days = Math.ceil((st.due - Date.now()) / 86_400_000);
    return days <= 0 ? 'Mastery check due' : `Check in ${days} ${days === 1 ? 'day' : 'days'}`;
  }
  return `${Math.floor(st.value * 100)}% mastered`;
}

function Medal({ info, st, index, shine, onOpen }: { info: SongInfo; st: Standing; index: number; shine: boolean; onOpen: () => void }) {
  const img = (info.entry.image ?? GENERIC_COVER).src;
  const ring = useMemo(() => Math.max(0.04, st.value), [st.value]);
  const [broken, setBroken] = useState(false);
  return (
    <motion.li className={`medal t-${st.tier} ${shine ? 'shine' : ''}`} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...SPRING, delay: 0.15 + index * 0.07 }}>
      <motion.button className="medal-btn" onClick={onOpen} whileTap={{ scale: 0.94 }} aria-label={`${info.entry.title}: ${TIER_NAME[st.tier]}, ${dueText(st)}`}>
        <span className="medal-disc">
          {st.tier === 'none' && (
            <svg className="medal-ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" /><circle cx="50" cy="50" r="46" className="fill" style={{ strokeDasharray: `${ring * 289} 289` }} /></svg>
          )}
          {broken ? <span className="medal-face"><IconMusic size={34} /></span> : <img src={img} alt="" loading="lazy" onError={() => setBroken(true)} />}
          {st.tier === 'forever' && <span className="medal-gem"><Gem size={20} /></span>}
          {(st.tier === 'gold') && <span className="medal-gem gold"><IconCheck size={16} /></span>}
        </span>
        <b className="medal-title">{info.entry.title}</b>
        <span className="medal-tier">{st.tier === 'none' ? <><IconTarget size={13} />{Math.floor(st.value * 100)}%</> : TIER_NAME[st.tier]}</span>
        <small className="medal-due">{dueText(st)}</small>
      </motion.button>
    </motion.li>
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
