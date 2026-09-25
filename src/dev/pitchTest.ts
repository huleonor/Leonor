/**
 * Dev-only bench for the microphone note detector: renders a real piano (the same samples the
 * app plays) offline, optionally degrades it like a phone mic in a room, runs the detector over it
 * frame by frame and scores what it heard against what was played. Open /?pitchtest in dev.
 */
import { get, set } from 'idb-keyval';
import { SplendidGrandPiano } from 'smplr';
import { NoteListener, type ListenerTuning } from '../lib/pitch';

interface Ev { t: number; notes: number[]; vel: number; dur: number; }

function rng(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
}

export function makeScore(seed = 7): Ev[] {
  const r = rng(seed);
  const pick = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const evs: Ev[] = [];
  let t = 0.5;
  // Single notes across the range.
  for (let i = 0; i < 50; i++) { evs.push({ t, notes: [pick(36, 93)], vel: pick(45, 110), dur: 0.5 }); t += 0.55; }
  // Triads and dyads in the middle of the keyboard.
  const shapes = [[0, 4, 7], [0, 3, 7], [0, 5, 9], [0, 4, 9], [0, 7], [0, 12], [0, 3, 8], [0, 4, 7, 12]];
  for (let i = 0; i < 35; i++) {
    const root = pick(48, 72), s = shapes[pick(0, shapes.length - 1)];
    evs.push({ t, notes: s.map(x => root + x), vel: pick(55, 105), dur: 0.7 }); t += 0.8;
  }
  // A melody in eighths over a held left-hand chord (the usual film-score texture).
  for (let bar = 0; bar < 8; bar++) {
    const bass = pick(40, 52);
    evs.push({ t, notes: [bass, bass + 7], vel: 70, dur: 1.6 });
    for (let k = 0; k < 8; k++) {
      evs.push({ t: t + 0.02 + k * 0.21, notes: [pick(64, 84)], vel: pick(60, 95), dur: 0.2 });
    }
    t += 1.7;
  }
  evs.sort((a, b) => a.t - b.t);
  // Notes struck within 40 ms of each other are one strike, as a player hears (and plays) them.
  const merged: Ev[] = [];
  for (const e of evs) {
    const last = merged[merged.length - 1];
    if (last && e.t - last.t < 0.04) last.notes = [...new Set([...last.notes, ...e.notes])].sort((a, b) => a - b);
    else merged.push({ ...e, notes: [...e.notes] });
  }
  return merged;
}

function phoneMic(x: Float32Array, sr: number, noise: number, seed = 3) {
  // Two one-pole high-passes (~140 Hz): small phone microphones barely hear the bass fundamentals.
  const a = Math.exp((-2 * Math.PI * 140) / sr);
  for (let pass = 0; pass < 2; pass++) {
    let px = 0, py = 0;
    for (let i = 0; i < x.length; i++) { const y = a * (py + x[i] - px); px = x[i]; py = y; x[i] = y; }
  }
  // A small room: a few early reflections.
  const taps = [[0.011, 0.35], [0.023, 0.22], [0.041, 0.15], [0.067, 0.08]];
  const out = x.slice();
  for (const [d, g] of taps) { const n = Math.round(d * sr); for (let i = n; i < x.length; i++) out[i] += x[i - n] * g; }
  const r = rng(seed);
  for (let i = 0; i < out.length; i++) out[i] = out[i] * 0.25 + (r() * 2 - 1) * noise;
  return out;
}

export async function renderScore(evs: Ev[], sr = 48000) {
  const dur = evs[evs.length - 1].t + 2;
  const ctx = new OfflineAudioContext(1, Math.ceil(sr * dur), sr);
  const piano = new SplendidGrandPiano(ctx, { volume: 100, decayTime: 0.6 });
  await piano.load;
  // smplr only schedules notes close to currentTime, so stop the render at each note and start it then.
  for (const e of evs) {
    ctx.suspend(e.t).then(() => {
      for (const n of e.notes) piano.start({ note: n, velocity: e.vel, duration: e.dur });
      ctx.resume();
    });
  }
  return (await ctx.startRendering()).getChannelData(0).slice();
}

export function score(evs: Ev[], audio: Float32Array, sr: number, opts: { expected: boolean; tuning?: Partial<ListenerTuning> }) {
  const L = new NoteListener(sr, opts.tuning);
  L.range = [33, 96];
  const hop = Math.round(sr * 0.012);
  const strikes: { at: number; notes: number[] }[] = [];
  for (let end = L.size; end <= audio.length; end += hop) {
    const now = (end / sr) * 1000;
    // Wait mode: the engine expects the next group the player has not reached yet.
    const exp = opts.expected ? evs.find(e => e.t * 1000 > now - 250)?.notes ?? [] : [];
    const s = L.process(audio.subarray(end - L.size, end), now, exp);
    if (s) strikes.push(s);
  }
  let found = 0, exact = 0, pc = 0, total = 0, extra = 0, extraPc = 0, latency = 0;
  const used = new Set<number>();
  const misses: string[] = [];
  for (const e of evs) {
    total += e.notes.length;
    const i = strikes.findIndex((s, j) => !used.has(j) && Math.abs(s.at - e.t * 1000) < 90);
    if (i < 0) { misses.push(`@${e.t.toFixed(2)} ${e.notes} (no onset)`); continue; }
    used.add(i);
    found++;
    latency += strikes[i].at - e.t * 1000;
    const got = strikes[i].notes;
    const hitExact = e.notes.filter(n => got.includes(n)).length;
    const hitPc = e.notes.filter(n => got.some(g => g % 12 === n % 12)).length;
    exact += hitExact; pc += hitPc;
    extra += got.filter(g => !e.notes.includes(g)).length;
    extraPc += got.filter(g => !e.notes.some(n => n % 12 === g % 12)).length;
    if (hitExact < e.notes.length || got.length > e.notes.length) misses.push(`@${e.t.toFixed(2)} want ${e.notes} got ${got}`);
  }
  const falseOnsets = strikes.length - used.size;
  const pct = (a: number, b: number) => Math.round((a / b) * 1000) / 10;
  return {
    onsets: pct(found, evs.length), falseOnsets, exact: pct(exact, total), pitchClass: pct(pc, total),
    extraNotes: extra, extraPitchClasses: extraPc, latency: Math.round(latency / Math.max(1, found)), misses,
  };
}

export async function runPitchTest(tuning?: Partial<ListenerTuning>) {
  const sr = 48000;
  const evs = makeScore();
  // Rendering takes a while; keep the result across reloads.
  let clean = await get<Float32Array>('pitch-bench-v1').catch(() => undefined);
  if (!clean) { clean = await renderScore(evs, sr); await set('pitch-bench-v1', clean).catch(() => {}); }
  const mic = phoneMic(clean.slice(), sr, 0.002);
  const res = {
    clean: score(evs, clean, sr, { expected: false, tuning }),
    cleanExpected: score(evs, clean, sr, { expected: true, tuning }),
    phone: score(evs, mic, sr, { expected: false, tuning }),
    phoneExpected: score(evs, mic, sr, { expected: true, tuning }),
  };
  (window as unknown as { __pitch: unknown }).__pitch = { res, evs, clean, mic, score, sr };
  return res;
}
