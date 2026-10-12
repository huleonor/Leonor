import { useState } from 'react';
import { annualSaving, price, PLANS, purchase, REASON, restore, type PaywallReason, type PlanId } from '../lib/billing';
import { IconCheck, IconClose } from './Icons';
import { Penguin } from './Penguin';

const FEATURES: [string, string | boolean, string | boolean][] = [
  ['The whole course, every section', true, true],
  ['Songs, and your own MIDI files', true, true],
  ['Lessons that adapt to how you play', true, true],
  ['Energy', '25, refills over time', 'Unlimited'],
  ['Keep going without waiting or gems', false, true],
];

const Cell = ({ v }: { v: string | boolean }) => (typeof v === 'string' ? <span className="cell-text">{v}</span> : v ? <IconCheck size={18} className="yes" /> : <span className="no" aria-label="No">–</span>);

interface Props { reason: PaywallReason; onClose: () => void; onDone: (text: string) => void; }

/** Premium: what it adds, three plans priced for the region, a free week on the yearly one. */
export function Paywall({ reason, onClose, onDone }: Props) {
  const [plan, setPlan] = useState<PlanId>('annual');
  const [busy, setBusy] = useState(false);
  const buy = async () => {
    setBusy(true);
    const e = await purchase(plan);
    setBusy(false);
    onDone(e.trial ? 'Premium is on: your free week has started.' : 'Premium is on. Enjoy the whole course.');
  };
  return (
    <div className="paywall" role="dialog" aria-modal="true" aria-labelledby="paywall-title">
      <button className="icon-btn ghost paywall-close" onClick={onClose} aria-label="Not now"><IconClose /></button>
      <div className="paywall-body">
        <p className="paywall-badge">Premium</p>
        <Penguin pose="cheer" size={120} />
        <h1 id="paywall-title">Unlimited energy with Premium</h1>
        <p className="sub">{REASON[reason]}</p>

        <table className="paywall-compare">
          <thead><tr><th scope="col"><span className="sr-only">Feature</span></th><th scope="col">Free</th><th scope="col">Premium</th></tr></thead>
          <tbody>
            {FEATURES.map(([f, free, premium]) => (
              <tr key={f}>
                <th scope="row">{f}</th>
                <td><Cell v={free} /></td>
                <td><Cell v={premium} /></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="plans" role="radiogroup" aria-label="Plan">
          {PLANS.map(p => (
            <button key={p.id} role="radio" aria-checked={plan === p.id} className={`plan ${plan === p.id ? 'on' : ''}`} onClick={() => setPlan(p.id)}>
              {p.id === 'annual' && <span className="plan-flag">Best value · save {annualSaving()}%</span>}
              <b>{p.name}</b>
              <span className="plan-price">{price(p.id)}{p.id !== 'monthly' && <small> · {price(p.id, true)}/month</small>}</span>
              <small>{p.note}</small>
            </button>
          ))}
        </div>

        <button className="btn go big paywall-cta" onClick={buy} disabled={busy}>
          {plan === 'annual' ? 'Start my free week' : 'Continue'}
        </button>
        <p className="fine paywall-fine">
          Test mode: no store is connected yet, so no payment is taken and Premium unlocks on this device only.
          Prices shown for your region; you can cancel any time.
        </p>
        <div className="actions">
          <button className="btn quiet" onClick={async () => { const ok = await restore(); onDone(ok ? 'Premium restored.' : 'No purchase to restore on this device.'); }}>Restore purchases</button>
          <button className="btn quiet" onClick={onClose}>Not now</button>
        </div>
      </div>
    </div>
  );
}
