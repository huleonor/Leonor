/**
 * Piano note detection from a microphone, chords included.
 *
 * 1. Onsets: spectral flux on a short (~21 ms) window catches each hammer strike, even while
 *    earlier notes are still ringing.
 * 2. Pitches: a long window before and after the strike gives the spectrum of what is *new*;
 *    candidate notes are scored by the energy at their harmonics, the best one is taken and its
 *    harmonics are removed, and the search repeats for the other notes of a chord.
 * 3. The notes the song expects next get a second, targeted check, so a correct chord is not
 *    missed just because one of its notes was quiet.
 */

class FFT {
  readonly n: number;
  private cos: Float32Array;
  private sin: Float32Array;
  private rev: Uint32Array;
  private re: Float32Array;
  private im: Float32Array;

  constructor(n: number) {
    this.n = n;
    this.cos = new Float32Array(n / 2);
    this.sin = new Float32Array(n / 2);
    for (let i = 0; i < n / 2; i++) { this.cos[i] = Math.cos((2 * Math.PI * i) / n); this.sin[i] = -Math.sin((2 * Math.PI * i) / n); }
    this.rev = new Uint32Array(n);
    const bits = Math.log2(n);
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r = (r << 1) | ((i >> b) & 1);
      this.rev[i] = r;
    }
    this.re = new Float32Array(n);
    this.im = new Float32Array(n);
  }

  /** Magnitude spectrum of `frame` (length n) multiplied by `win`, bins 0..out.length-1. */
  magnitudes(frame: ArrayLike<number>, win: Float32Array, out: Float32Array) {
    const { n, re, im, rev, cos, sin } = this;
    for (let i = 0; i < n; i++) { re[rev[i]] = frame[i] * win[i]; im[rev[i]] = 0; }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size;
      for (let start = 0; start < n; start += size) {
        for (let j = 0, k = 0; j < half; j++, k += step) {
          const a = start + j, b = a + half;
          const tr = re[b] * cos[k] - im[b] * sin[k];
          const ti = re[b] * sin[k] + im[b] * cos[k];
          re[b] = re[a] - tr; im[b] = im[a] - ti;
          re[a] += tr; im[a] += ti;
        }
      }
    }
    for (let k = 0; k < out.length; k++) out[k] = Math.hypot(re[k], im[k]);
  }
}

const hann = (n: number) => {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  return w;
};

export const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export interface Strike {
  /** Notes heard at this strike, lowest first. */
  notes: number[];
  /** When the strike happened (same clock as `process`'s `now`), before the analysis delay. */
  at: number;
}

export interface ListenerTuning {
  /** Onset threshold over the running median of the flux. */
  fluxRatio: number;
  fluxFloor: number;
  /** How long after the strike the pitch spectrum is read, in ms. */
  analysisDelay: number;
  /** Other chord notes must reach this share of the strongest note's score. */
  chordShare: number;
  /** Expected notes are accepted at this share of the strongest note's score. */
  expectedShare: number;
  /** Strongest note must stand out this much from the average candidate. */
  contrast: number;
  maxNotes: number;
  /** How far above its neighbourhood a bin must rise to count as a partial. */
  whiten: number;
}

export const DEFAULT_TUNING: ListenerTuning = {
  fluxRatio: 1.5, fluxFloor: 7, analysisDelay: 75, chordShare: 0.3, expectedShare: 0.14, contrast: 3.5, maxNotes: 5, whiten: 1.4,
};

const HARMONICS = 8;
const INHARMONICITY = 0.0003;
const MAX_HZ = 5200;
/** Semitones from a note to its 2nd..10th partials. */
const OVERTONES = [12, 19, 24, 28, 31, 34, 36, 38, 40];

export class NoteListener {
  readonly sampleRate: number;
  readonly size: number;
  tuning: ListenerTuning;
  /** Lowest and highest note considered (the song's range, with a margin). */
  range: [number, number] = [36, 96];
  /** Dev hook: sees the spectrum of each strike's new energy. */
  inspect?: (spec: Float32Array, at: number) => void;

  private long: FFT;
  private short = new FFT(1024);
  private winLong: Float32Array;
  private winShort = hann(1024);
  private binHz: number;
  private bins: number;
  private shortMag = new Float32Array(512);
  private curShort = new Float32Array(512);
  private prevShort = new Float32Array(512);
  private prev2Short = new Float32Array(512);
  private peakRef = 0;
  private flux: number[] = [];
  private noise = 1e-4;
  private lastOnset = -1e9;
  private pending: { at: number; pre: Float32Array } | null = null;
  private weights = Float32Array.from({ length: HARMONICS }, (_, i) => 1 / Math.pow(i + 1, 0.55));

  constructor(sampleRate: number, tuning: Partial<ListenerTuning> = {}) {
    this.sampleRate = sampleRate;
    this.size = sampleRate > 60000 ? 16384 : 8192;
    this.long = new FFT(this.size);
    this.winLong = hann(this.size);
    this.binHz = sampleRate / this.size;
    this.bins = Math.min(this.size / 2, Math.ceil(MAX_HZ / this.binHz) + 8);
    this.tuning = { ...DEFAULT_TUNING, ...tuning };
  }

  /**
   * Feed the latest `size` samples (oldest first) at time `now` (ms). Call every ~10–16 ms.
   * Returns a strike once its notes are known, about `analysisDelay` ms after it happened
   * (its `notes` can be empty when nothing pitched stood out, like a knock on the piano lid).
   */
  process(buf: Float32Array, now: number, expected: number[] = []): Strike | null {
    const { tuning } = this;
    const recent = buf.subarray(buf.length - 1024);
    let sum = 0;
    for (let i = 0; i < recent.length; i++) sum += recent[i] * recent[i];
    const rms = Math.sqrt(sum / recent.length);
    // Room noise: follows quiet moments quickly, creeps up only very slowly while music plays
    // (a held chord is not noise).
    this.noise = Math.max(1e-5, rms < this.noise * 1.5 ? this.noise * 0.95 + rms * 0.05 : this.noise * 1.0004);

    // SuperFlux-style onset function: log magnitudes with a floor 50 dB under the loudest recent
    // frame (so decaying tails and room noise do not flicker), compared against a max-filtered
    // frame from two hops back.
    this.short.magnitudes(recent, this.winShort, this.shortMag);
    const k0 = Math.floor(50 / (this.sampleRate / 1024)), k1 = Math.min(510, Math.ceil(6000 / (this.sampleRate / 1024)));
    let frameMax = 0;
    for (let k = k0; k <= k1; k++) if (this.shortMag[k] > frameMax) frameMax = this.shortMag[k];
    this.peakRef = Math.max(this.peakRef * 0.998, frameMax);
    const floor = Math.max(this.peakRef * 0.003, 1e-7);
    const cur = this.curShort;
    for (let k = k0; k <= k1; k++) cur[k] = Math.log(Math.max(this.shortMag[k], floor) / floor);
    const old = this.prev2Short;
    let f = 0;
    for (let k = k0; k <= k1; k++) {
      const ref = Math.max(old[k - 1], old[k], old[k + 1]);
      const d = cur[k] - ref;
      if (d > 0) f += d;
    }
    this.prev2Short.set(this.prevShort);
    this.prevShort.set(cur);
    const sorted = [...this.flux].sort((a, b) => a - b);
    const median = sorted.length ? sorted[sorted.length >> 1] : f;
    this.flux.push(f);
    if (this.flux.length > 40) this.flux.shift();

    let result: Strike | null = null;
    if (this.pending && now - this.pending.at >= tuning.analysisDelay) {
      result = this.analyse(buf, this.pending, expected);
      this.pending = null;
    }

    const loud = rms > Math.max(this.noise * 2, 0.001);
    if (loud && f > median * tuning.fluxRatio + tuning.fluxFloor && now - this.lastOnset > 55) {
      this.lastOnset = now;
      if (this.pending) { result = this.analyse(buf, this.pending, expected) ?? result; }
      const pre = new Float32Array(this.bins);
      this.long.magnitudes(buf, this.winLong, pre);
      this.pending = { at: now, pre };
    }
    return result;
  }

  private analyse(buf: Float32Array, p: { at: number; pre: Float32Array }, expected: number[]): Strike | null {
    const post = new Float32Array(this.bins);
    this.long.magnitudes(buf, this.winLong, post);
    const raw = new Float32Array(this.bins);
    for (let k = 0; k < this.bins; k++) raw[k] = Math.max(0, post[k] - p.pre[k] * 1.1);
    const d = this.whiten(raw);
    this.inspect?.(d, p.at);

    const [lo, hi] = this.range;
    const score = (m: number, spec: Float32Array) => this.salience(m, spec);
    const all: number[] = [];
    for (let m = lo; m <= hi; m++) all.push(score(m, d));
    all.sort((a, b) => a - b);
    const mean = all[all.length >> 1] || 1e-9;

    const residual = d.slice();
    const notes: number[] = [];
    let first = 0;
    for (let n = 0; n < this.tuning.maxNotes; n++) {
      let best = -1, bestS = 0;
      for (let m = lo; m <= hi; m++) {
        if (notes.includes(m) || !this.anchored(m, residual)) continue;
        let s = score(m, residual);
        // A partial of a note already found (octave, twelfth, ...) needs more evidence to count.
        if (notes.some(f => OVERTONES.includes(m - f))) s *= 0.55;
        if (s > bestS) { bestS = s; best = m; }
      }
      if (best < 0) break;
      if (n === 0) {
        if (bestS < mean * this.tuning.contrast) break;
        first = bestS;
      } else if (bestS < first * this.tuning.chordShare) break;
      best = this.preferFundamental(best, residual);
      notes.push(best);
      this.cancel(best, residual);
    }

    // The song's next notes: accept them on weaker evidence, as long as they beat their neighbours.
    if (first > 0) {
      for (const e of expected) {
        if (notes.includes(e) || e < lo - 12 || e > hi + 12) continue;
        const s = score(e, d);
        const side = Math.max(score(e - 1, d), score(e + 1, d));
        if (s >= first * this.tuning.expectedShare && s > side * 1.25 && this.partial(d, midiToHz(e), 1) + this.partial(d, midiToHz(e), 2) > 0) {
          notes.push(e);
        }
      }
    }
    notes.sort((a, b) => a - b);
    return { notes: [...new Set(notes)], at: p.at };
  }

  /**
   * Keep only what rises above its neighbourhood (about a semitone either side): the hammer's
   * thump and room noise are broadband, a string's partials are narrow peaks.
   */
  private whiten(spec: Float32Array) {
    const n = spec.length;
    const sums = new Float64Array(n + 1);
    for (let k = 0; k < n; k++) sums[k + 1] = sums[k] + spec[k];
    const out = new Float32Array(n);
    for (let k = 1; k < n; k++) {
      const w = Math.max(6, Math.round(k * 0.06));
      const a = Math.max(0, k - w), b = Math.min(n, k + w + 1);
      const avg = (sums[b] - sums[a]) / (b - a);
      out[k] = Math.max(0, spec[k] - avg * this.tuning.whiten);
    }
    return out;
  }

  /** Harmonic sum: weighted energy at the note's first partials. */
  salience(m: number, spec: Float32Array) {
    const f0 = midiToHz(m);
    let s = 0;
    for (let h = 1; h <= HARMONICS; h++) {
      const f = h * f0 * Math.sqrt(1 + INHARMONICITY * h * h);
      if (f > MAX_HZ) break;
      s += this.weights[h - 1] * this.peak(spec, f);
    }
    return s;
  }

  partial(spec: Float32Array, f0: number, h: number) {
    return this.peak(spec, h * f0 * Math.sqrt(1 + INHARMONICITY * h * h));
  }

  /** Largest bin within about a third of a semitone of `f`. */
  private peak(spec: Float32Array, f: number) {
    const c = f / this.binHz;
    const w = Math.max(1, c * 0.02);
    const a = Math.max(1, Math.floor(c - w)), b = Math.min(this.bins - 1, Math.ceil(c + w));
    let v = 0;
    for (let k = a; k <= b; k++) if (spec[k] > v) v = spec[k];
    return v;
  }

  /**
   * The strongest harmonic sum often lands an octave (or a twelfth) above a low note whose
   * fundamental is weak. If the lower note's own partials, the ones the higher note cannot
   * explain, carry real energy, the lower note is the one that was played.
   */
  private preferFundamental(m: number, spec: Float32Array) {
    const [lo] = this.range;
    const hs = this.salience(m, spec);
    for (const [down, own] of [[12, [1, 3, 5]], [19, [1, 2, 4]], [24, [1, 2, 3]]] as const) {
      const c = m - down;
      if (c < lo || !this.anchored(c, spec)) continue;
      const f0 = midiToHz(c);
      let e = 0;
      for (const h of own) e += this.weights[h - 1] * this.partial(spec, f0, h);
      if (e > hs * 0.3) return c;
    }
    return m;
  }

  /**
   * A note's own low partials must be there. Without this, the "missing fundamental" under a
   * triad (F3 under A4-C5-F5) outscores the notes actually played. Phone microphones barely
   * hear the lowest fundamentals, so bass notes may lean on their third partial instead.
   */
  anchored(m: number, spec: Float32Array) {
    const f0 = midiToHz(m);
    const own = m < 45 ? [1, 2, 3] : [1, 2];
    let low = 0, top = 0;
    for (let h = 1; h <= 6; h++) {
      const v = this.partial(spec, f0, h);
      if (own.includes(h)) low = Math.max(low, v);
      top = Math.max(top, v);
    }
    return top > 0 && low >= top * 0.2;
  }

  /** Remove a found note's partials so the next search sees what is left. */
  private cancel(m: number, spec: Float32Array) {
    const f0 = midiToHz(m);
    for (let h = 1; h <= 24; h++) {
      const f = h * f0 * Math.sqrt(1 + INHARMONICITY * h * h);
      if (f > MAX_HZ) break;
      const c = f / this.binHz;
      const w = Math.max(1.5, c * 0.025);
      for (let k = Math.max(0, Math.floor(c - w)); k <= Math.min(this.bins - 1, Math.ceil(c + w)); k++) spec[k] *= 0.1;
    }
  }
}
