/**
 * Every section of the course on one page, Duolingo style: a card per section with its picture,
 * what it teaches, how far he is through it, and a way back to it on the path. Sections ahead are
 * shown too, locked, so he can see where the course goes.
 */
import { MusicNote } from '@phosphor-icons/react';
import { motion } from 'motion/react';
import { nodesOf, SECTIONS } from '../lib/curriculum';
import type { PathState } from '../lib/path';
import { IconClose, IconLock } from './Icons';
import { SOFT } from './Motion';
import { colorOf } from './PathHome';
import { SECTION_ART, Spot } from './PathArt';

interface Props {
  state: PathState;
  /** The section he is in now (its id). */
  current?: string;
  onClose: () => void;
  /** Scroll the path to a section, or to the current lesson. */
  onGo: (sectionId: string, toCurrent: boolean) => void;
}

export function SectionsView({ state, current, onClose, onGo }: Props) {
  return (
    <motion.div className="sections-page" role="dialog" aria-modal="true" aria-labelledby="sections-page-title" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={SOFT}>
      <header className="sections-head">
        <button className="icon-btn ghost" onClick={onClose} aria-label="Close"><IconClose size={24} /></button>
        <h1 id="sections-page-title">Sections</h1>
        <span />
      </header>
      <ol className="sections-cards">
        {SECTIONS.map((s, i) => {
          const units = s.units;
          const done = units.filter(u => state[nodesOf(u).find(n => n.kind === 'trophy')!.id]?.done).length;
          const open = !!state[nodesOf(units[0])[0].id]?.open;
          const here = s.id === current;
          const [c, edge, ink] = colorOf(units[0]);
          return (
            <motion.li key={s.id} className={`section-card card ${open ? '' : 'locked'} ${here ? 'here' : ''}`} style={{ '--unit': c, '--unit-edge': edge, '--unit-ink': ink } as React.CSSProperties}
              initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ...SOFT, delay: i * 0.05 }}>
              <div className="section-art" aria-hidden="true">
                <span className="mini-staff"><i /><i /><i /><i /><i /></span>
                <MusicNote weight="fill" className="staff-note n1" />
                <MusicNote weight="fill" className="staff-note n2" />
                <MusicNote weight="fill" className="staff-note n3" />
                <Spot Icon={SECTION_ART[i % SECTION_ART.length]} lit={open} size={104} />
              </div>
              <div className="section-body">
                <h2>Section {i + 1}: {s.title}</h2>
                <p className="sub">{s.sub}</p>
                <div className="section-progress" role="progressbar" aria-label={`${done} of ${units.length} units done`} aria-valuemin={0} aria-valuemax={units.length} aria-valuenow={done}>
                  <span className="meter"><motion.i initial={{ width: 0 }} animate={{ width: `${(done / units.length) * 100}%` }} transition={{ ...SOFT, delay: 0.2 + i * 0.05 }} /></span>
                  <b>{done}/{units.length}</b>
                </div>
                {open ? (
                  <button className={`btn ${here ? 'go' : ''}`} onClick={() => onGo(s.id, here)}>{here ? 'Continue' : done === units.length ? 'Review' : 'Continue'}</button>
                ) : (
                  <p className="section-locked"><IconLock size={16} />Finish section {i} to open it</p>
                )}
              </div>
            </motion.li>
          );
        })}
      </ol>
    </motion.div>
  );
}
