import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { nodesOf, SECTIONS, type NodeKind, type PathNode, type Unit } from '../lib/curriculum';
import { openChest, useEconomy, type ChestReward } from '../lib/energy';
import type { CourseProgress } from '../lib/course';
import type { LinkState, Source } from '../lib/input';
import { currentNode, placementTaken, placementTest, unitLabel, unitTest, UNITS, usePath, type NodeState, type Playable } from '../lib/path';
import type { Settings } from '../lib/types';
import { ChestOpened, GameBar } from './Economy';
import { Chest, GlyphBook, GlyphCrown, GlyphDumbbell, GlyphHand, GlyphHeadphones, GlyphLock, GlyphNote, GlyphStar, GlyphTrophy, Energy } from './GameIcons';
import { useDaily } from './Home';
import { IconArrowLeft, IconCheck, IconClose } from './Icons';
import { Logo } from './Brand';

/** Each unit has its own colour, as on Duolingo's path. */
export const UNIT_COLORS: [string, string, string][] = [
  // [colour, edge, text on it]: the brand blue first, then Duolingo's unit colours, white text (dark on gold).
  ['#2b93ba', '#1f7395', '#ffffff'], ['#ce82ff', '#a568cc', '#ffffff'], ['#00cd9c', '#00a57d', '#ffffff'], ['#58cc02', '#58a700', '#ffffff'],
  ['#ff9600', '#e08300', '#ffffff'], ['#ff86d0', '#e070b4', '#ffffff'], ['#ff4b4b', '#ea2b2b', '#ffffff'], ['#2b70c9', '#18599e', '#ffffff'],
  ['#cc348d', '#a6206f', '#ffffff'], ['#ffc800', '#e0ad00', '#4a3200'],
];
export const colorOf = (u: Unit) => UNIT_COLORS[UNITS.indexOf(u) % UNIT_COLORS.length];

const GLYPH: Record<Exclude<NodeKind, 'chest'>, () => React.ReactElement> = {
  theory: GlyphBook, lesson: GlyphStar, listen: GlyphHeadphones, technique: GlyphHand, practice: GlyphDumbbell, song: GlyphNote, trophy: GlyphTrophy,
};
const KIND_NAME: Record<NodeKind, string> = {
  theory: 'Theory', lesson: 'Lesson', listen: 'Listening', technique: 'Technique', practice: 'Practice', song: 'Song', chest: 'Chest', trophy: 'Unit test',
};
const XP_HINT: Partial<Record<NodeKind, number>> = { theory: 10, lesson: 25, listen: 25, technique: 25, practice: 25, song: 40, trophy: 30 };

/** Zig-zag offsets, in px, Duolingo's winding path. */
const SWAY = [0, 44, 70, 44, 0, -44, -70, -44];


interface Props {
  settings: Settings;
  links: Record<Source, LinkState>;
  onPiano: () => void;
  onNode: (node: PathNode, unit: Unit, prog?: CourseProgress) => void;
  onTest: (items: Playable[], unit?: Unit) => void;
  onEnergy: () => void;
  onShop: () => void;
  onPremium: () => void;
}

/** Home is the path: sections, units with their banners, and the winding trail of nodes. */
export function PathHome({ settings, links, onPiano, onNode, onTest, onEnergy, onShop, onPremium }: Props) {
  const pianoOn = settings.input !== 'none' && links[settings.input as Source]?.status === 'on';
  const path = usePath();
  const { premium } = useEconomy();
  const daily = useDaily();
  const [open, setOpen] = useState<string | null>(null);
  const [guide, setGuide] = useState<Unit | null>(null);
  const [chest, setChest] = useState<ChestReward | null>(null);
  const [away, setAway] = useState<'up' | 'down' | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const cur = path ? currentNode(path.state) : undefined;
  const fresh = path && !placementTaken() && !Object.values(path.state).some(s => s.passed > 0 || s.done);

  const curEl = () => (cur ? document.getElementById(`node-${cur.node.id}`) : null);
  const jump = (smooth = true) => curEl()?.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' });

  // Open on the current node, the way Duolingo does.
  const jumped = useRef(false);
  useLayoutEffect(() => { if (path && !jumped.current) { jumped.current = true; jump(false); } }, [path]); // eslint-disable-line react-hooks/exhaustive-deps

  // The "back to where you are" button shows when the current node scrolls out of sight.
  useEffect(() => {
    const el = curEl();
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setAway(e.isIntersecting ? null : e.boundingClientRect.top < 0 ? 'up' : 'down'));
    io.observe(el);
    return () => io.disconnect();
  }, [cur?.node.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // A tap outside the open node closes its card.
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest('.trail-node')) setOpen(null); };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  return (
    <div className="path-page" ref={scroller}>
      <div className="path-main">
        <div className="path-top"><GameBar onEnergy={onEnergy} onGems={onShop} piano={{ on: pianoOn, onClick: onPiano }} /></div>

        {fresh && (
          <section className="card placement" aria-labelledby="placement-title">
            <Logo size={64} />
            <div>
              <h2 id="placement-title">Already play a little?</h2>
              <p className="sub">One short piece per unit. Each you pass with 2 stars skips that unit.</p>
            </div>
            <button className="btn blue" onClick={() => onTest(placementTest())}>Find my level</button>
          </section>
        )}

        {SECTIONS.map((section, si) => (
          <div key={section.id} className="path-section">
            {si > 0 && (
              <div className="section-divider">
                <span className="section-line" />
                <div className="section-label">
                  <small>Section {si + 1}</small>
                  <b>{section.title}</b>
                  <span>{section.sub}</span>
                </div>
                <span className="section-line" />
              </div>
            )}
            {section.units.map(unit => {
              const [c, edge, ink] = colorOf(unit);
              const nodes = nodesOf(unit);
              const ui = UNITS.indexOf(unit);
              const locked = !!path && !path.state[nodes[0].id]?.open;
              return (
                <section key={unit.id} className={`path-unit ${locked ? 'locked' : ''}`} aria-labelledby={`${unit.id}-title`} style={{ '--unit': c, '--unit-edge': edge, '--unit-ink': ink } as React.CSSProperties}>
                  <header className="unit-banner">
                    <div>
                      <small>{unitLabel(unit)}</small>
                      <h2 id={`${unit.id}-title`}>{unit.title}</h2>
                    </div>
                    <button className="guide-btn" onClick={() => setGuide(unit)}><GlyphBook /><span>Guidebook</span></button>
                  </header>
                  <ol className="trail">
                    {nodes.map((node, k) => {
                      const st = path?.state[node.id];
                      const off = SWAY[k % SWAY.length];
                      return (
                        <TrailNode
                          key={node.id} node={node} unit={unit} st={st} off={off} isOpen={open === node.id}
                          onToggle={() => setOpen(o => (o === node.id ? null : node.id))}
                          onStart={() => { setOpen(null); onNode(node, unit, path?.progs[node.id]); }}
                          onTestOut={() => { setOpen(null); onTest([unitTest(unit)], unit); }}
                          onChest={() => { const r = openChest(node.id, k + ui); if (r) setChest(r); }}
                        />
                      );
                    })}
                  </ol>
                </section>
              );
            })}
          </div>
        ))}
        <div className="path-end">
          <Logo size={72} />
          <p className="sub">More sections are on the way.</p>
        </div>
      </div>

      <aside className="path-side">
        <GameBar onEnergy={onEnergy} onGems={onShop} piano={{ on: pianoOn, onClick: onPiano }} />
        <section className="card side-card">
          <h3>Daily goal</h3>
          <div className="side-goal">
            <span className="meter"><i style={{ width: `${Math.min(100, (daily.today.sec / 60 / settings.dailyGoal) * 100)}%` }} /></span>
            <b>{Math.floor(daily.today.sec / 60)}/{settings.dailyGoal} min</b>
          </div>
        </section>
        {!premium && (
          <section className="card side-card super">
            <Logo size={56} />
            <div>
              <h3>Unlimited energy</h3>
              <p className="sub">Never wait to play. Try Premium free for a week.</p>
              <button className="btn super-cta small" onClick={onPremium}>Try it free</button>
            </div>
          </section>
        )}
      </aside>

      {away && cur && (
        <button className="jump-current" style={{ '--unit': colorOf(cur.unit)[0], '--unit-edge': colorOf(cur.unit)[1] } as React.CSSProperties} onClick={() => jump()} aria-label="Back to your lesson">
          <IconArrowLeft size={22} style={{ transform: `rotate(${away === 'up' ? 90 : -90}deg)` }} />
        </button>
      )}

      {guide && (
        <div className="veil" onClick={() => setGuide(null)}>
          <section className="card guide-card" role="dialog" aria-modal="true" aria-labelledby="guide-title" onClick={e => e.stopPropagation()} style={{ '--unit': colorOf(guide)[0], '--unit-edge': colorOf(guide)[1], '--unit-ink': colorOf(guide)[2] } as React.CSSProperties}>
            <button className="icon-btn ghost game-sheet-close" onClick={() => setGuide(null)} aria-label="Close"><IconClose /></button>
            <header className="guide-head">
              <span className="guide-icon"><GlyphBook /></span>
              <div>
                <small>{unitLabel(guide)} · Guidebook</small>
                <h2 id="guide-title">{guide.title}</h2>
                <p className="sub">{guide.sub}</p>
              </div>
            </header>
            <h3>Key ideas</h3>
            <ul className="guide-list">{guide.guide.map(g => <li key={g}><span className="guide-dot"><IconCheck size={14} /></span>{g}</li>)}</ul>
            <h3>In this unit</h3>
            <ul className="guide-nodes">
              {nodesOf(guide).filter(n => n.kind !== 'chest').map(n => (
                <li key={n.id}><span className={`mini-disc k-${n.kind}`}>{GLYPH[n.kind as Exclude<NodeKind, 'chest'>]()}</span><b>{n.title}</b><small>{KIND_NAME[n.kind]}</small></li>
              ))}
            </ul>
          </section>
        </div>
      )}
      {chest && <ChestOpened reward={chest} onClose={() => setChest(null)} />}
    </div>
  );
}

interface NodeProps {
  node: PathNode; unit: Unit; st?: NodeState; off: number; isOpen: boolean;
  onToggle: () => void; onStart: () => void; onTestOut: () => void; onChest: () => void;
}

function TrailNode({ node, unit, st, off, isOpen, onToggle, onStart, onTestOut, onChest }: NodeProps) {
  const open = !!st?.open, done = !!st?.done, current = !!st?.current;
  const n = nodesOf(unit).filter(x => x.kind === node.kind).indexOf(node) + 1;
  const of = nodesOf(unit).filter(x => x.kind === node.kind).length;
  const style = { '--off': `${off}px` } as React.CSSProperties;

  if (node.kind === 'chest') {
    const ready = open && !done;
    return (
      <li className={`trail-node chest-node ${ready ? "ready" : ""} ${done ? "opened" : ""} ${isOpen ? "popped" : ""}`} style={style} id={`node-${node.id}`}>
        <button onClick={ready ? onChest : onToggle} aria-label={done ? 'Chest, opened' : ready ? 'Open the chest' : 'Chest, locked'} disabled={done}>
          <Chest size={76} open={done} />
        </button>
        {isOpen && !ready && !done && <div className="node-pop locked"><b>Treasure chest</b><p>Finish the lessons above to open it.</p></div>}
      </li>
    );
  }

  const Glyph = done && node.kind === 'lesson' && st?.stars === 3 ? GlyphCrown : GLYPH[node.kind];
  const ring = current && st && st.steps > 1 ? st.passed / st.steps : 0;
  return (
    <li className={`trail-node k-${node.kind} ${done ? "done" : ""} ${current ? "current" : ""} ${open ? "" : "locked"} ${isOpen ? "popped" : ""}`} style={style} id={`node-${node.id}`}>
      {current && !isOpen && <span className="start-bubble" aria-hidden="true">{st && st.passed > 0 ? 'Continue' : 'Start'}</span>}
      <button className="node-btn" onClick={onToggle} aria-expanded={isOpen}
        aria-label={`${KIND_NAME[node.kind]}: ${node.title}${done ? ', done' : open ? '' : ', locked'}`}>
        {current && (
          <svg className="node-ring" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="46" />
            <circle cx="50" cy="50" r="46" className="fill" style={{ strokeDasharray: `${ring * 289} 289` }} />
          </svg>
        )}
        <span className="node-face">{open ? <Glyph /> : node.kind === 'trophy' ? <GlyphTrophy /> : <GlyphLock />}</span>
      </button>
      {isOpen && (
        <div className={`node-pop ${open ? '' : 'locked'}`} role="dialog" aria-label={node.title}>
          <small>{KIND_NAME[node.kind]}{of > 1 ? ` ${n} of ${of}` : ''}</small>
          <b>{node.title}</b>
          <p>{open ? node.sub : node.kind === 'trophy' ? 'Already know this? Take the test to skip ahead.' : 'Complete everything above to unlock this.'}</p>
          {open ? (
            <button className="btn pop-go" onClick={onStart}>
              {done ? 'Practise again' : st && st.passed > 0 ? 'Continue' : 'Start'}
              {node.kind !== 'theory' && <span className="pop-cost"><Energy size={14} /></span>}
              {XP_HINT[node.kind] && <span className="pop-xp">+{done ? 5 : XP_HINT[node.kind]} XP</span>}
            </button>
          ) : node.kind === 'trophy' ? (
            <button className="btn pop-go" onClick={onTestOut}>Take the test</button>
          ) : null}
        </div>
      )}
    </li>
  );
}
