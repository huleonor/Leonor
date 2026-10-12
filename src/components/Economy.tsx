import { useState } from 'react';
import { buyFreeze, buyRefill, formatWait, MAX_ENERGY, PRICES, refillIn, useEconomy, type ChestReward } from '../lib/energy';
import { freezes } from '../lib/stats';
import { useDaily } from './Home';
import { Chest, Energy, Flame, Gem } from './GameIcons';
import { IconClose, IconSnow } from './Icons';
import { Logo, Spot } from './Brand';
import { Bump } from './Motion';

/** The game bar, Duolingo style: streak flame, gems and the pink energy battery. */
export function GameBar({ onEnergy, onGems }: { onEnergy: () => void; onGems: () => void }) {
  const { energy, gems, premium } = useEconomy();
  const daily = useDaily();
  const f = freezes();
  return (
    <div className="gamebar">
      <span className={`gb-stat flame ${daily.streak.today ? 'lit' : ''}`} aria-label={`${daily.streak.days}-day streak${f ? `, ${f} streak freeze${f > 1 ? 's' : ''}` : ''}`}>
        <Flame size={26} lit={daily.streak.today} /><Bump value={daily.streak.days} />
        {f > 0 && <small className="gb-freeze"><IconSnow size={12} />{f}</small>}
      </span>
      <button className="gb-stat gem" onClick={onGems} aria-label={`${gems} gems, open the shop`}><Gem size={24} /><Bump value={gems} /></button>
      <button className={`gb-stat energy ${!premium && energy === 0 ? 'empty' : ''}`} onClick={onEnergy} aria-label={premium ? 'Unlimited energy' : `${energy} of ${MAX_ENERGY} energy`}>
        <Energy size={22} />{premium ? '∞' : <Bump value={energy} />}
      </button>
    </div>
  );
}

/** The battery as a bar, 0 to 25. */
function EnergyMeter({ energy }: { energy: number }) {
  return (
    <div className="energy-meter" role="img" aria-label={`${energy} of ${MAX_ENERGY} energy`}>
      <Energy size={30} />
      <span className="energy-track"><i style={{ width: `${(Math.min(energy, MAX_ENERGY) / MAX_ENERGY) * 100}%` }} /><b>{energy} / {MAX_ENERGY}</b></span>
    </div>
  );
}

interface SheetProps {
  /** Out of energy, trying to start a lesson; or just looking. */
  empty?: boolean;
  onClose: () => void;
  onPremium: () => void;
  onPractice?: () => void;
}

/** Energy: how much is left, when it refills, and the ways to get more. */
export function EnergySheet({ empty, onClose, onPremium, onPractice }: SheetProps) {
  const { energy, gems, premium } = useEconomy();
  const [note, setNote] = useState('');
  const wait = refillIn();
  const full = energy >= MAX_ENERGY;
  return (
    <div className="veil sheet-veil" onClick={onClose}>
      <section className="card game-sheet" role="dialog" aria-modal="true" aria-labelledby="energy-title" onClick={e => e.stopPropagation()}>
        <button className="icon-btn ghost game-sheet-close" onClick={onClose} aria-label="Close"><IconClose /></button>
        <Spot tone="energy"><Energy size={46} /></Spot>
        <h2 id="energy-title">{premium ? 'Unlimited energy' : empty ? 'You need energy to do lessons' : 'Energy'}</h2>
        {premium ? <p className="sub">Premium is on: play as much as you like.</p> : (
          <>
            <EnergyMeter energy={energy} />
            <p className="sub">
              {full ? 'Full! Every lesson step uses 1.' : `+1 in ${formatWait(wait.next)} · full in ${formatWait(wait.full)}`}
            </p>
            <ul className="energy-tips">
              <li><Energy size={16} />Play 10 notes right in a row: +1</li>
              <li><Chest size={20} />Chests on the path: up to +10</li>
              <li><Energy size={16} />Practice tab: free, and +2 each time</li>
            </ul>
            <div className="game-sheet-actions">
              <button className="btn offer" disabled={full || gems < PRICES.refill} onClick={() => { if (buyRefill()) { setNote('Energy full!'); if (empty) window.setTimeout(onClose, 700); } }}>
                <Energy size={18} /><span>Refill</span><b><Gem size={16} />{PRICES.refill}</b>
              </button>
              <button className="btn super" onClick={onPremium}><span>Unlimited energy</span><b>Premium</b></button>
              {empty && onPractice && <button className="btn" onClick={onPractice}>Practise to earn energy</button>}
            </div>
            {gems < PRICES.refill && !full && <p className="fine">You have {gems} gems. Finish lessons and open chests to earn more.</p>}
            {note && <p className="game-note" role="status">{note}</p>}
          </>
        )}
      </section>
    </div>
  );
}

/** A chest just opened: what was inside. */
export function ChestOpened({ reward, onClose }: { reward: ChestReward; onClose: () => void }) {
  return (
    <div className="veil" onClick={onClose}>
      <section className="card chest-card" role="dialog" aria-modal="true" aria-labelledby="chest-title" onClick={e => e.stopPropagation()}>
        <div className="chest-scene">
          <Chest size={120} open className="chest-pop" />
        </div>
        <h2 id="chest-title">You opened a chest!</h2>
        <div className="chest-loot">
          {reward.energy > 0 && <span className="loot energy"><Energy size={24} />+{reward.energy} energy</span>}
          {reward.gems > 0 && <span className="loot gem"><Gem size={24} />+{reward.gems} gems</span>}
        </div>
        <button className="btn go big" onClick={onClose}>Continue</button>
      </section>
    </div>
  );
}

/** The shop: refills, freezes and Premium, paid in gems. */
export function Shop({ onPremium }: { onPremium: () => void }) {
  const { energy, gems, premium } = useEconomy();
  const [note, setNote] = useState('');
  const have = freezes();
  return (
    <div className="page shop">
      <header className="page-head"><h1>Shop</h1><span className="gb-stat gem"><Gem size={24} />{gems}</span></header>
      {!premium && (
        <section className="card super-card" aria-labelledby="super-title">
          <div>
            <p className="paywall-badge">Premium</p>
            <h2 id="super-title">Unlimited energy</h2>
            <p className="sub">Learn as long as you like: no waiting, no gems. The first week is free.</p>
            <button className="btn super-cta" onClick={onPremium}>Try 1 week free</button>
          </div>
          <Logo size={110} className="super-logo" />
        </section>
      )}
      <h2 className="shop-h">Energy</h2>
      <ul className="shop-list">
        <li className="card">
          <Energy size={44} />
          <div><b>Refill energy</b><p className="sub">{premium ? 'Premium: you never run out.' : `Back to ${MAX_ENERGY}. You have ${energy}.`}</p></div>
          <button className="btn offer" disabled={premium || energy >= MAX_ENERGY || gems < PRICES.refill} onClick={() => setNote(buyRefill() ? 'Energy full!' : '')}>
            <Gem size={16} />{PRICES.refill}
          </button>
        </li>
      </ul>
      <h2 className="shop-h">Power-ups</h2>
      <ul className="shop-list">
        <li className="card">
          <span className="shop-ice"><IconSnow size={30} /></span>
          <div><b>Streak freeze</b><p className="sub">Covers a day you miss. You have {have} of 2.</p></div>
          <button className="btn offer" disabled={have >= 2 || gems < PRICES.freeze} onClick={() => setNote(buyFreeze() ? 'Streak freeze ready.' : '')}>
            <Gem size={16} />{PRICES.freeze}
          </button>
        </li>
      </ul>
      <p className="fine shop-fine">Gems come from lessons (more for more stars) and chests on the path.</p>
      {note && <div className="toast" role="status">{note}</div>}
    </div>
  );
}
