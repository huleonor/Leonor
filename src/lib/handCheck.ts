/**
 * The hands' quality check (dev only): measures how the 3D hands of the videos really move, frame
 * by frame, so a change to their motion is judged by numbers and not by eye. The measures are our
 * own, chosen after what research on hand motion for piano looks at (does the hand reach the key in
 * time, does the fingertip land on it, is the motion smooth), computed on Leonor's own hands; no
 * code or data of any other project.
 *
 * In the dev console, on a video with the hands on: `await window.__handCheck(20)` records twenty
 * seconds and prints the report; `window.__handFrames()` gives the raw frames of the last check.
 *
 * Every distance is in white keys (the key's step on screen), every time in seconds.
 */
import type { Hand } from './types';

/** One finger in one frame. */
export interface ProbeFinger {
  /** The tip on screen (x right, y down) and its height above the white keys' top. */
  x: number; y: number; z: number;
  /** Its note now or next: its key's centre, onset, end, and how far into its press it is. */
  midi?: number; kx?: number; on?: number; off?: number; press: number;
  /** The height it was asked for; whether its key was out of its reach. */
  wz: number; far?: boolean;
}
export interface ProbeFrame {
  /** Which hands (one per video) drew it. */
  id: string;
  t: number; ms: number; h: Hand; kw: number; fl: number; wx: number;
  /** Where a fixed key is on screen, so the hand's own motion is told from the camera's. */
  x0: number;
  fingers: ProbeFinger[];
}

/** Filled by Hands3D while it is an array. */
export const probe: { frames: ProbeFrame[] | null; last: ProbeFrame[] } = { frames: null, last: [] };

const q = (xs: number[], f: number) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * f))];
};
const r2 = (x: number) => Math.round(x * 100) / 100;
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : NaN);

export interface HandReport {
  hand: Hand; frames: number; fps: number; notes: number;
  /** At the moment the note sounds: how far the tip is from the key's centre (p50, p90) and the share within a third of a key. */
  landP50: number; landP90: number; landHit: number;
  /** The share of notes the tip was over its key at least 80 ms before they sounded; the median lead. */
  early: number; leadP50: number;
  /** The share of notes whose tip was down on the key 50 ms after the onset. */
  down: number;
  /** The wrist's speed while notes sound (median, keys a second): lower is calmer. */
  wristAtOnset: number;
  /** Tremble: the wrist's wobble around its own 0.25 s average (RMS, keys); and its jerk (p90, keys/s^3). */
  tremble: number; jerk: number;
  /** Frames with two neighbouring fingers (not the thumb) closer than a third of a key or crossed. */
  crowded: number;
  /** Frames with a finger below the keys' top while it is not pressing. */
  ghost: number;
  /** Notes whose key was out of the finger's reach; misses (a third of a key or more) by finger, thumb first. */
  outOfReach: number; missBy: string;
}

export function handReport(all: ProbeFrame[]): HandReport[] {
  const out: HandReport[] = [];
  // The video that played: the hands whose clock moved the most.
  const moved = new Map<string, number>();
  for (const f of all) { const m = moved.get(f.id); moved.set(f.id, m === undefined ? f.t : Math.max(m, f.t)); }
  const top = [...moved.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const frames = all.filter(f => f.id === top);
  for (const h of ['L', 'R'] as Hand[]) {
    const fr = frames.filter(f => f.h === h).sort((a, b) => a.ms - b.ms);
    if (fr.length < 10) continue;
    const dir = h === 'R' ? 1 : -1;
    const fps = (fr.length - 1) / ((fr[fr.length - 1].ms - fr[0].ms) / 1000);
    // The wrist in keys from a fixed key, so the camera's glide is not counted as the hand's motion.
    const kx = (p: ProbeFrame) => (p.wx - p.x0) / p.kw;
    // Stretches of steady clock: a new round, a seek or the start of a video begins a new one.
    const seg: number[] = [];
    fr.forEach((p, i) => {
      const prev = fr[i - 1];
      const jump = prev && Math.abs((p.t - prev.t) - (p.ms - prev.ms) / 1000) > 0.25 && p.t - prev.t !== 0;
      seg.push(i === 0 ? 0 : seg[i - 1] + (jump ? 1 : 0));
    });
    // Each (finger, note): the frames that carry it.
    const notes = new Map<string, { f: number; on: number; far: boolean; frames: { t: number; x: number; z: number; kx: number; kw: number; fl: number; press: number }[] }>();
    for (const F of fr) F.fingers.forEach((g, i) => {
      if (g.on === undefined || g.kx === undefined) return;
      const id = `${i}:${g.midi}:${g.on.toFixed(3)}`;
      let n = notes.get(id);
      if (!n) notes.set(id, n = { f: i + 1, on: g.on, far: false, frames: [] });
      if (g.far && Math.abs(F.t - g.on) < 0.1) n.far = true;
      n.frames.push({ t: F.t, x: g.x, z: g.z, kx: g.kx, kw: F.kw, fl: F.fl, press: g.press });
    });
    const land: number[] = [], lead: number[] = [], missBy = [0, 0, 0, 0, 0, 0];
    let far = 0;
    let early = 0, down = 0, counted = 0;
    for (const n of notes.values()) {
      const at = n.frames.find(p => p.t >= n.on && p.t < n.on + 0.1);
      if (!at || !n.frames.some(p => p.t < n.on - 0.15)) continue;
      counted++;
      const miss = Math.abs(at.x - at.kx) / at.kw;
      land.push(miss);
      if (miss >= 1 / 3) missBy[n.f]++;
      if (n.far) far++;
      // The lead: from the last frame before the onset where the tip was off its key.
      const before = n.frames.filter(p => p.t < n.on);
      let off = -Infinity;
      for (const p of before) if (Math.abs(p.x - p.kx) / p.kw > 0.33) off = p.t;
      const ld = n.on - off;
      lead.push(Math.min(ld, 1.5));
      if (ld >= 0.08) early++;
      const after = n.frames.find(p => p.t >= n.on + 0.05);
      if (after && after.z < after.fl * 0.02) down++;
    }
    // The wrist: speed at onsets, wobble, jerk.
    const onsets = [...new Set([...notes.values()].map(n => n.on))];
    const atOn: number[] = [];
    for (let i = 1; i < fr.length; i++) {
      const a = fr[i - 1], b = fr[i];
      const dt = (b.ms - a.ms) / 1000;
      if (dt <= 0 || seg[i] !== seg[i - 1]) continue;
      if (onsets.some(o => o >= a.t && o < b.t)) atOn.push(Math.abs(kx(b) - kx(a)) / dt);
    }
    let wob = 0, nw = 0;
    const jerks: number[] = [];
    for (let i = 0; i < fr.length; i++) {
      const win = fr.filter(p => Math.abs(p.ms - fr[i].ms) <= 125 && seg[fr.indexOf(p)] === seg[i]);
      const avg = win.reduce((s, p) => s + kx(p), 0) / win.length;
      wob += (kx(fr[i]) - avg) ** 2; nw++;
      if (i >= 3 && seg[i - 3] === seg[i]) {
        const [p0, p1, p2, p3] = [fr[i - 3], fr[i - 2], fr[i - 1], fr[i]];
        const d = (p3.ms - p0.ms) / 3000;
        if (d > 0) jerks.push(Math.abs(kx(p3) - 3 * kx(p2) + 3 * kx(p1) - kx(p0)) / d ** 3);
      }
    }
    let crowded = 0, ghost = 0;
    for (const F of fr) {
      let c = false;
      for (let i = 1; i < 4; i++) if (dir * (F.fingers[i + 1].x - F.fingers[i].x) < F.kw / 3) c = true;
      if (c) crowded++;
      if (F.fingers.some(g => g.press < 0.05 && g.z < -F.fl * 0.01)) ghost++;
    }
    out.push({
      hand: h, frames: fr.length, fps: r2(fps), notes: counted,
      landP50: r2(q(land, 0.5)), landP90: r2(q(land, 0.9)), landHit: pct(land.filter(x => x < 1 / 3).length, land.length),
      early: pct(early, counted), leadP50: r2(q(lead, 0.5)), down: pct(down, counted),
      wristAtOnset: r2(q(atOn, 0.5)), tremble: r2(Math.sqrt(wob / Math.max(1, nw))), jerk: Math.round(q(jerks, 0.9)),
      crowded: pct(crowded, fr.length), ghost: pct(ghost, fr.length),
      outOfReach: far, missBy: missBy.slice(1).join(' '),
    });
  }
  return out;
}

/** Records `seconds` of the hands on screen and gives back the report. */
export async function handCheck(seconds = 20): Promise<HandReport[]> {
  probe.frames = [];
  await new Promise(r => window.setTimeout(r, seconds * 1000));
  const frames = probe.frames;
  probe.frames = null;
  probe.last = frames;
  const rep = handReport(frames);
  console.table(rep);
  return rep;
}

if (import.meta.env.DEV) (window as unknown as { __probe: typeof probe }).__probe = probe;
