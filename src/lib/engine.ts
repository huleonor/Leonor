import { barGrid } from './bars';
import { playNote, stopAll } from './audio';
import { markAppPlayed, setExpected, type NoteEvent } from './input';
import { AUTO, HIT, MISS, PENDING, type HandsChoice, type Song } from './types';

export interface EngineOptions {
  /** When the keys to press light up while he waits: after this many wrong notes, or this long stuck. */
  hintAfter?: { wrongs: number; ms: number };
  speed: number;
  wait: boolean;
  hands: HandsChoice;
  /** Listen mode: the app plays every note, nothing is scored. */
  listen: boolean;
  accompaniment: boolean;
  /** Microphone: match by pitch class (octave slips are forgiven), half of a chord counts. */
  lenient: boolean;
  /** Score following: no clock, the cursor sits on the next notes until he plays them. */
  follow?: boolean;
  /** In tempo, a slip (a wrong or missed note) takes him back to beat 1 of the bar before it. */
  fixSlips?: boolean;
  /**
   * In tempo, while he is new to the beat: the music waits this long (real seconds) at a note he
   * has not played yet, instead of marking it missed, then goes on. 0 or unset: no waiting.
   */
  grace?: number;
}

interface Group { time: number; ids: number[]; midis: number[]; }
interface Press { midi: number; t: number; used: boolean; }

export type EngineEvent =
  | { type: 'status'; ids: number[] | 'all' }
  | { type: 'state' }
  | { type: 'end' }
  | { type: 'wrong'; midi: number }
  /** A key went down while playing: right or wrong, and the written note it matched, if known. */
  | { type: 'press'; midi: number; ok: boolean; id?: number }
  /** A note hit in tempo: how early (negative) or late it was, in real seconds. */
  | { type: 'judge'; offset: number }
  /** A slip in tempo sent him back: `bar` is where it happened, `from` where he starts again (1-based). */
  | { type: 'rewind'; bar: number; from: number }
  /** A key touched by accident (a brush, a bounce, a ghost touch): not counted. */
  | { type: 'stray'; midi: number };

const CHORD_WINDOW = 0.045; // seconds: notes closer than this form one chord
const LEAD_IN = 2.2; // seconds of song time before the first note
/** With the beat: how early a note may come (real seconds), and how late (while the line passes it). */
const EARLY_S = 0.3;
const LATE_MIN_S = 0.3;
const LATE_MAX_S = 0.6;
/** The right key this close outside the window is not a wrong note (real seconds). */
const NEAR_S = 0.5;
/** Slips a tempo run takes before it stops: past this the passage is too fast for now. */
const MAX_REWINDS = 4;
/**
 * Accidental touches on a keyboard are not mistakes. A wrong key waits this long (ms) before it
 * counts, so the touches around it can show what it was.
 */
const SETTLE_MS = 90;
/** Softer than this (MIDI velocity) is a ghost touch: a finger resting on a key. */
const GHOST = 12;
/** A wrong key this close (semitones, ms) to a right one played with it is a brushed neighbour. */
const NEIGHBOUR = 2, TOGETHER_MS = 60;
/** The same key again this soon (ms) is the key bouncing. */
const BOUNCE_MS = 120;
/** Let go this soon (ms), and softly, is a key grazed in passing. */
const GRAZE_MS = 80, GRAZE_VELOCITY = 50;
/** Wrong keys this close together (ms) are one slip of the hand, counted once. */
const CLUSTER_MS = 40;

export class Engine {
  readonly song: Song;
  opts: EngineOptions;
  time: number;
  readonly startTime: number;
  playing = false;
  waiting = false;
  finished = false;
  started = false;
  countdown = 0;
  /** Length of one count of the count-in, in real seconds (a beat at this speed, with the beat). */
  countBeat = 1;
  /** Counts in the count-in. */
  countTotal = 0;
  status: Uint8Array;
  user: Uint8Array; // 1 when the note belongs to Hugo's part
  groups: Group[] = [];
  gi = 0;
  held = new Set<number>();
  wrong = 0;
  /** Notes missed in tempo before a rewind replayed them (they still count against the run). */
  slipped = 0;
  rewinds = 0;
  /** The run stopped early: too many slips. */
  cutShort = false;
  /** Keys touched by accident and left out of the score. */
  strays = 0;
  /** Wrong keys waiting to be confirmed as mistakes or let off as accidents. */
  private suspects: { midi: number; at: number; velocity: number }[] = [];
  /** Recent key presses, to tell a brush or a bounce from a mistake. */
  private recent: { midi: number; at: number; ok: boolean }[] = [];
  private deferred = false;
  lastWrong = { midi: -1, at: 0 };
  measureTimes: number[] = [];
  /** Each bar's time signature (bars.ts). */
  barSigs: [number, number][] = [];
  /** When the current wait began, and wrong notes played during it (for the hint). */
  waitSince = 0;
  wrongInWait = 0;
  /** The stretch being practised (a course part), in song seconds; null plays the whole song. */
  segment: { from: number; to: number } | null = null;
  private segmentLoop = false;

  private presses: Press[] = [];
  private lastGroupAt = 0;
  /** When the music started holding at a note (the beat's grace), 0 when it is not. */
  private heldSince = 0;
  private heldGi = -1;
  private autoIdx = 0;
  private raf = 0;
  private last = 0;
  private listeners = new Set<(e: EngineEvent) => void>();

  constructor(song: Song, opts: EngineOptions) {
    this.song = song;
    this.opts = { ...opts };
    this.status = new Uint8Array(song.notes.length);
    this.user = new Uint8Array(song.notes.length);
    this.startTime = song.firstNoteTime - LEAD_IN;
    this.time = this.startTime;
    // Bar lines from the bar grid, which follows any change of time signature.
    const grid = barGrid(song);
    this.barSigs = grid.sigs;
    for (let k = 0; k < grid.starts.length; k++) {
      const t = song.ticksToSeconds(grid.starts[k]);
      this.measureTimes.push(t);
      if (t > song.duration + 1) break;
    }
    // A spare bar line past the end, in the last bar's metre, as before.
    const lastLen = grid.starts[grid.starts.length - 1] - grid.starts[grid.starts.length - 2];
    for (let k = grid.starts.length; this.measureTimes[this.measureTimes.length - 1] <= song.duration + 1 && k < 5000; k++) {
      this.measureTimes.push(song.ticksToSeconds(grid.starts[grid.starts.length - 1] + (k - grid.starts.length + 1) * lastLen));
    }
    this.configure();
  }

  on(fn: (e: EngineEvent) => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit(e: EngineEvent) { this.listeners.forEach(fn => fn(e)); }

  /** Rebuild Hugo's part after hands / listen change, keeping the playhead. */
  configure() {
    const { hands, listen } = this.opts;
    const notes = this.song.notes;
    for (const n of notes) this.user[n.id] = !listen && (hands === 'both' || hands === n.hand) && this.inSegment(n.time) ? 1 : 0;
    this.groups = [];
    // Notes written as one chord on the score (same sixteenth) are played as one chord.
    const q = (ticks: number) => Math.round(ticks / (this.song.ppq / 4));
    let lastQ = -1;
    for (const n of notes) {
      if (!this.user[n.id]) continue;
      const g = this.groups[this.groups.length - 1];
      if (g && (n.time - g.time < CHORD_WINDOW || q(n.ticks) === lastQ)) { g.ids.push(n.id); g.midis.push(n.midi); lastQ = q(n.ticks); }
      else { this.groups.push({ time: n.time, ids: [n.id], midis: [n.midi] }); lastQ = q(n.ticks); }
    }
    this.seek(this.time, false);
  }

  setOptions(patch: Partial<EngineOptions>) {
    const needsReconfigure = patch.hands !== undefined && patch.hands !== this.opts.hands
      || patch.listen !== undefined && patch.listen !== this.opts.listen;
    this.opts = { ...this.opts, ...patch };
    if (needsReconfigure) this.configure();
    this.emit({ type: 'state' });
  }

  /** Puts the cursor just before the first note to play, so nothing moves until he plays it. */
  toFirstNote() {
    const from = this.segment?.from ?? this.startTime;
    const g = this.groups.find(x => x.time >= from - 1e-3);
    if (g) this.seek(Math.max(this.startTime, g.time - 0.04));
  }

  seek(t: number, emit = true) {
    this.time = Math.max(this.startTime, Math.min(t, this.song.duration));
    const notes = this.song.notes;
    for (const n of notes) if (n.time >= this.time - 1e-3) this.status[n.id] = PENDING;
    this.gi = this.groups.findIndex(g => g.time >= this.time - 1e-3);
    if (this.gi < 0) this.gi = this.groups.length;
    this.autoIdx = notes.findIndex(n => n.time >= this.time - 1e-3);
    if (this.autoIdx < 0) this.autoIdx = notes.length;
    this.presses = [];
    this.heldSince = 0;
    this.waiting = false;
    this.finished = false;
    stopAll();
    if (emit) { this.emit({ type: 'status', ids: 'all' }); this.emit({ type: 'state' }); }
  }

  restart() {
    this.resetCounts();
    this.seek(this.segmentStart());
  }

  private resetCounts() { this.wrong = 0; this.slipped = 0; this.rewinds = 0; this.cutShort = false; this.strays = 0; this.suspects = []; }

  /** The bar (0-based) that holds a moment of the song. */
  barAt(t: number) {
    let bar = 0;
    while (bar + 1 < this.measureTimes.length && this.measureTimes[bar + 1] <= t + 1e-3) bar++;
    return bar;
  }

  /**
   * A slip in tempo: stop and start again from beat 1 of the bar before it, after a short count-in,
   * so the mistake is never practised. Too many slips end the run: it is too fast for now.
   */
  private rewind(at: number, missed = 0) {
    this.slipped += missed;
    this.rewinds++;
    if (this.rewinds > MAX_REWINDS) { this.cutShort = true; this.finish(); return; }
    const bar = this.barAt(at);
    const first = this.segment ? this.barAt(this.segment.from) : 0;
    const back = Math.max(first, bar - 1);
    this.seek(this.measureTimes[back] - 1e-3);
    this.countIn();
    this.emit({ type: 'rewind', bar: bar + 1, from: back + 1 });
  }

  /**
   * Where a segment starts: with the beat, on its first bar's beat 1, and the count-in (a bar in
   * tempo) leads him in; otherwise a little run-up before its first note (the app plays it).
   */
  private segmentStart() {
    if (!this.segment) return this.startTime;
    return this.inTempo() ? this.segment.from - 1e-3 : Math.max(this.startTime, this.segment.from - 1.6);
  }

  /** Playing with the beat: the music runs on and he has to keep up. */
  private inTempo() { return !this.opts.wait && !this.opts.follow && !this.opts.listen; }

  /** The time signature of the bar the cursor is in. */
  sigNow(): [number, number] {
    let bar = 0;
    while (bar + 1 < this.measureTimes.length && this.measureTimes[bar + 1] <= this.time + 1e-3) bar++;
    return this.barSigs[Math.min(bar, this.barSigs.length - 1)] ?? this.song.timeSig;
  }

  /** One beat in real seconds (dotted quarters in compound time). */
  private beatSeconds() {
    const [num, den] = this.sigNow();
    const step = den === 8 && num % 3 === 0 && num > 3 ? 3 : 1;
    return this.song.ticksToSeconds(this.song.ppq * 4 / den * step) / Math.max(0.1, this.opts.speed);
  }

  /**
   * A count-in in tempo: 1, 2, 3 on the beat (the user's choice, the same as the videos), then the
   * music, so he feels the beat and comes in with it, instead of seconds that have nothing to do
   * with the music.
   */
  private countIn() {
    this.countBeat = this.beatSeconds();
    this.countTotal = 3;
    this.countdown = this.countTotal * this.countBeat;
  }

  /** The count now showing, 1 to the bar's beats (0 when not counting in). */
  countNumber() {
    if (!this.playing || this.countdown <= 0) return 0;
    return Math.max(1, this.countTotal - Math.ceil(this.countdown / this.countBeat - 1e-6) + 1);
  }

  /** Notes inside the segment (or all of them). */
  inSegment(time: number) {
    return !this.segment || (time >= this.segment.from - 1e-3 && time < this.segment.to - 1e-3);
  }

  /**
   * Practise one stretch. It ends at its last bar (or starts over, with `loop`), only its notes
   * are Hugo's and count; the run-up before it is played by the app.
   */
  setSegment(segment: { from: number; to: number } | null, loop = false) {
    this.segment = segment;
    this.segmentLoop = loop;
    this.resetCounts();
    this.configure();
    this.seek(this.segmentStart());
  }


  play(countdown = 3) {
    if (this.finished) this.restart();
    this.playing = true;
    this.started = true;
    // With the beat any count-in is a bar in tempo; elsewhere it is plain seconds.
    if (countdown > 0 && this.inTempo()) this.countIn();
    else { this.countBeat = 1; this.countTotal = Math.ceil(countdown); this.countdown = countdown; }
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    const loop = (now: number) => {
      this.tick(now);
      if (this.playing) this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    this.emit({ type: 'state' });
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    this.waiting = false;
    this.countdown = 0;
    cancelAnimationFrame(this.raf);
    stopAll();
    this.emit({ type: 'state' });
  }

  toggle() { if (this.playing) this.pause(); else this.play(this.started ? 1 : 3); }

  destroy() {
    this.playing = false;
    cancelAnimationFrame(this.raf);
    stopAll();
    setExpected([]);
    this.listeners.clear();
  }

  /** Notes Hugo is expected to play next (for the keyboard guide and the mic filter). */
  expected(): number[] {
    const g = this.groups[this.gi];
    if (!g || g.time - this.time > 1.2) return [];
    return g.midis;
  }

  /** Wait mode: stuck for a while, or after a wrong note, the app shows which keys to press. */
  hintVisible() {
    return this.playing && this.waiting && this.countdown === 0 && (this.opts.wait || !!this.opts.follow) && !this.opts.listen
      // Like Simply Piano: help only after a few wrong notes, or a long stall (the coach sets how many).
      // A stall counts only once he has started: before his first note he is still reading.
      && (this.wrongInWait >= (this.opts.hintAfter?.wrongs ?? 2) || (this.lastGroupAt > 0 && performance.now() - this.waitSince > (this.opts.hintAfter?.ms ?? 5000)));
  }

  /** The group the player is stuck on, with the hand of each note (for the hint keyboard). */
  waitingFor(): { midi: number; hand: 'R' | 'L'; finger?: number }[] {
    const g = this.groups[this.gi];
    if (!g) return [];
    return g.ids.map(id => ({ midi: this.song.notes[id].midi, hand: this.song.notes[id].hand, finger: this.song.notes[id].finger }));
  }

  /**
   * How early and how late a note may be played with the beat, in song seconds. Early: 0.3 s.
   * Late: while the now line is still passing the note, half its length, 0.3 to 0.6 s. Wider than a
   * strict judge on purpose: a note played as the line crosses it is a right note.
   */
  private early() { return EARLY_S * this.opts.speed; }
  private late(g: { ids: number[] }) {
    const len = Math.min(...g.ids.map(id => this.song.notes[id].duration)) / Math.max(0.1, this.opts.speed);
    return Math.max(LATE_MIN_S, Math.min(LATE_MAX_S, len / 2)) * this.opts.speed;
  }

  private tick(now: number) {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (!this.playing) return;
    this.settleSuspects(now);
    if (!this.playing) return;
    if (this.countdown > 0) {
      this.countdown -= dt;
      if (this.countdown <= 0) { this.countdown = 0; this.emit({ type: 'state' }); }
      return;
    }
    let next = this.time + dt * this.opts.speed;
    const changed: number[] = [];

    if (this.opts.follow && !this.opts.listen) {
      // The cursor jumps to the next notes and stays there until they are played.
      const g = this.groups[this.gi];
      if (!g || (this.segment && g.time >= this.segment.to)) {
        // End of the song, or of the looped section: go round again.
        if (this.segmentLoop) { this.seek(this.segment!.from - 0.01); this.emit({ type: 'status', ids: 'all' }); return; }
        this.finish();
        return;
      }
      this.time = g.time;
      if (!this.waiting) { this.waiting = true; this.waitSince = now; this.wrongInWait = 0; this.emit({ type: 'state' }); }
      setExpected(this.expected());
      return;
    }

    if (this.opts.wait && !this.opts.listen) {
      let blocked = false;
      while (this.gi < this.groups.length && next >= this.groups[this.gi].time) {
        const g = this.groups[this.gi];
        if (this.trySatisfy(g, now)) { this.markHit(g, changed); continue; }
        next = g.time;
        blocked = true;
        break;
      }
      if (blocked !== this.waiting) {
        this.waiting = blocked;
        if (blocked) { this.waitSince = now; this.wrongInWait = 0; }
        this.emit({ type: 'state' });
      }
    } else {
      let slipAt = -1;
      // Notes already played that the music has passed: step over them first.
      while (this.gi < this.groups.length && next > this.groups[this.gi].time + this.late(this.groups[this.gi]) && !this.groups[this.gi].ids.some(id => this.status[id] === PENDING)) this.gi++;
      // New to the beat: the music holds at a note he has not played yet, for a moment, before it goes on.
      const g0 = this.groups[this.gi];
      const holdAt = g0 && this.opts.grace ? g0.time + this.late(g0) : Infinity;
      if (next > holdAt && g0.ids.some(id => this.status[id] === PENDING)) {
        if (this.heldSince === 0 || this.heldGi !== this.gi) { this.heldSince = now; this.heldGi = this.gi; }
        if (now - this.heldSince < (this.opts.grace ?? 0) * 1000) {
          next = holdAt;
          if (!this.waiting) { this.waiting = true; this.waitSince = now; this.wrongInWait = 0; this.emit({ type: 'state' }); }
        }
      } else if (this.heldSince) { this.heldSince = 0; if (this.waiting) { this.waiting = false; this.emit({ type: 'state' }); } }
      while (this.gi < this.groups.length && next > this.groups[this.gi].time + this.late(this.groups[this.gi])) {
        for (const id of this.groups[this.gi].ids) if (this.status[id] === PENDING) { this.status[id] = MISS; changed.push(id); if (slipAt < 0) slipAt = this.groups[this.gi].time; }
        this.gi++;
      }
      if (slipAt >= 0 && this.opts.fixSlips && !this.opts.listen) {
        // Let listeners see the miss before it is replayed.
        this.emit({ type: 'status', ids: changed });
        this.rewind(slipAt, changed.length);
        return;
      }
    }
    setExpected(this.expected());

    // Notes the app plays: the other hand, or everything in listen mode.
    const notes = this.song.notes;
    while (this.autoIdx < notes.length && notes[this.autoIdx].time <= next) {
      const n = notes[this.autoIdx++];
      if (this.user[n.id]) continue;
      this.status[n.id] = AUTO;
      changed.push(n.id);
      if (this.opts.listen || this.opts.accompaniment) {
        playNote(n.midi, n.velocity * 127 * (this.opts.listen ? 1 : 0.7), n.duration / this.opts.speed);
        markAppPlayed(n.midi);
      }
    }

    this.time = next;
    if (changed.length) this.emit({ type: 'status', ids: changed });
    if (this.segment && this.time >= this.segment.to) {
      if (this.segmentLoop) { this.seek(this.segmentStart()); this.countIn(); return; }
      this.finish();
      return;
    }
    if (this.time >= this.song.duration + 0.8) this.finish();
  }

  private finish() {
    this.playing = false;
    this.finished = true;
    this.waiting = false;
    stopAll();
    this.emit({ type: 'state' });
    this.emit({ type: 'end' });
  }

  private matches(a: number, b: number) {
    return this.opts.lenient ? a % 12 === b % 12 : a === b;
  }

  private trySatisfy(g: Group, now: number): boolean {
    const fresh = this.presses.filter(p => !p.used && p.t >= this.lastGroupAt - 150 && p.t > now - 2500);
    if (this.opts.lenient) {
      const want = [...new Set(g.midis.map(m => m % 12))];
      const got = fresh.filter(p => want.includes(p.midi % 12));
      const heard = new Set(got.map(p => p.midi % 12));
      if (heard.size < Math.ceil(want.length / 2)) return false;
      got.forEach(p => (p.used = true));
      return true;
    }
    const picked: Press[] = [];
    for (const m of g.midis) {
      const p = fresh.find(p => p.midi === m && !picked.includes(p));
      if (!p) return false;
      picked.push(p);
    }
    picked.forEach(p => (p.used = true));
    return true;
  }

  private markHit(g: Group, changed: number[]) {
    for (const id of g.ids) { this.status[id] = HIT; changed.push(id); }
    this.gi++;
    this.lastGroupAt = performance.now();
  }

  /** A key not touched by accident, counted. */
  private stray(midi: number) {
    this.strays++;
    this.emit({ type: 'stray', midi });
  }

  /**
   * A wrong key. From the microphone it counts at once (it has its own filters). From a keyboard
   * it is let off straight away when it is plainly an accident (a ghost touch, the key bouncing,
   * a neighbour brushed with the right key) and otherwise waits a moment: let go at once and
   * softly, or followed by the right key next to it, it was an accident too.
   */
  private wrongKey(e: NoteEvent, now: number) {
    if (e.source === 'mic') { this.confirmWrong(e.midi); return; }
    this.deferred = true;
    if (e.velocity > 0 && e.velocity < GHOST) { this.stray(e.midi); return; }
    if (this.recent.some(p => p.midi === e.midi && now - p.at < BOUNCE_MS)) { this.stray(e.midi); return; }
    if (this.recent.some(p => p.ok && Math.abs(p.midi - e.midi) <= NEIGHBOUR && now - p.at < TOGETHER_MS)) { this.stray(e.midi); return; }
    this.suspects.push({ midi: e.midi, at: now, velocity: e.velocity });
  }

  /** Suspects old enough count as mistakes; several at once are one slip of the hand. */
  private settleSuspects(now: number) {
    if (!this.suspects.length) return;
    const due = this.suspects.filter(x => now - x.at >= SETTLE_MS);
    if (!due.length) return;
    this.suspects = this.suspects.filter(x => now - x.at < SETTLE_MS);
    let lastAt = -Infinity;
    for (const x of due) {
      if (x.at - lastAt < CLUSTER_MS) { this.stray(x.midi); continue; }
      lastAt = x.at;
      this.confirmWrong(x.midi);
      if (!this.playing) return;
    }
  }

  /** A real mistake: counted, shown, and with the beat it sends him back a bar. */
  private confirmWrong(midi: number) {
    this.registerWrong(midi);
    this.emit({ type: 'press', midi, ok: false });
    // The mic can mishear a key: only a keyboard's wrong note sends him back.
    if (this.opts.fixSlips && !this.opts.lenient && !this.opts.wait && !this.opts.follow && !this.opts.listen) this.rewind(this.time);
  }

  private registerWrong(midi: number) {
    this.wrong++;
    if (this.waiting) this.wrongInWait++;
    this.lastWrong = { midi, at: performance.now() };
    this.emit({ type: 'wrong', midi });
  }

  input(e: NoteEvent) {
    const now = performance.now();
    if (e.type === 'off') {
      this.held.delete(e.midi);
      // Grazed: let go at once and softly.
      const i = this.suspects.findIndex(x => x.midi === e.midi && now - x.at < GRAZE_MS && x.velocity < GRAZE_VELOCITY);
      if (i >= 0) { this.suspects.splice(i, 1); this.stray(e.midi); }
      return;
    }
    this.held.add(e.midi);
    // The end of the count-in counts: a note played just before the music starts is on time.
    if (!this.playing || this.opts.listen || (this.countdown > 0 && (!this.inTempo() || this.countdown > EARLY_S))) return;
    this.settleSuspects(now);
    // The note it matches, judged before the press can move the cursor on.
    const g = this.groups[this.gi];
    const wrongBefore = this.wrong;
    this.deferred = false;
    const id = this.judgeInput(e);
    const deferred = this.deferred;
    const ok = !deferred && this.wrong === wrongBefore;
    this.recent.push({ midi: e.midi, at: now, ok });
    if (this.recent.length > 16) this.recent.splice(0, this.recent.length - 16);
    if (deferred) return;
    if (ok) {
      // The right key: a wrong neighbour pressed with it a moment ago was a brush.
      this.suspects = this.suspects.filter(x => {
        const brush = Math.abs(x.midi - e.midi) <= NEIGHBOUR && now - x.at < TOGETHER_MS;
        if (brush) this.stray(x.midi);
        return !brush;
      });
    }
    const match = ok ? id ?? g?.ids.find(i => this.matches(e.midi, this.song.notes[i].midi)) : undefined;
    // A stray overtone the mic heard in a strike is neither right nor wrong: leave it off the staff.
    if (ok && match === undefined && e.chord) return;
    if (!ok) return; // a mistake is shown when it is confirmed
    this.emit({ type: 'press', midi: e.midi, ok, id: match });
  }

  /** Scores one key press; returns the note id it hit in tempo mode. */
  private judgeInput(e: NoteEvent): number | undefined {
    const now = performance.now();
    // The mic reports a strike ~0.1 s after it happened: judge it at the moment it was played.
    const lag = e.at !== undefined && !this.waiting ? Math.max(0, now - e.at) / 1000 : 0;
    const at = e.at ?? now;
    this.presses.push({ midi: e.midi, t: at, used: false });
    if (this.presses.length > 40) this.presses.splice(0, this.presses.length - 40);

    const changed: number[] = [];
    const g = this.groups[this.gi];
    const nextG = this.groups[this.gi + 1];
    const relevantNote = (midi: number) =>
      (g && g.midis.some(m => this.matches(midi, m))) || (nextG && nextG.midis.some(m => this.matches(midi, m)));
    // In a strike the mic heard several notes: a stray overtone next to a right note is not a mistake.
    const strikeOk = e.chord ? e.chord.some(relevantNote) : false;
    if (this.opts.wait || this.opts.follow) {
      if (!relevantNote(e.midi)) { if (!strikeOk) this.wrongKey(e, now); return undefined; }
      if (g && this.waiting && this.trySatisfy(g, now)) {
        this.markHit(g, changed);
        this.waiting = false;
        this.emit({ type: 'state' });
      }
    } else {
      // Still counting in: the press is that much before the music starts.
      const t = this.time - (lag + this.countdown) * this.opts.speed;
      let best = -1, bestDt = Infinity, near = false;
      for (let i = Math.max(0, this.gi - 3); i < Math.min(this.groups.length, this.gi + 4); i++) {
        const late = this.late(this.groups[i]);
        for (const id of this.groups[i].ids) {
          const n = this.song.notes[id];
          if (this.status[id] !== PENDING || !this.matches(e.midi, n.midi)) continue;
          const d = t - n.time;
          // (+1 ms: the music holding at the window's edge must still be inside it.)
          if (d >= -this.early() && d <= late + 1e-3 && Math.abs(d) < bestDt) { best = id; bestDt = Math.abs(d); }
          // The right key a little too early or late is not a wrong note: the note itself says if he made it.
          else if (d >= -NEAR_S * this.opts.speed && d <= late + NEAR_S * this.opts.speed) near = true;
        }
      }
      if (best < 0) { if (!strikeOk && !near) this.wrongKey(e, now); return undefined; }
      this.status[best] = HIT;
      changed.push(best);
      this.emit({ type: 'judge', offset: (t - this.song.notes[best].time) / this.opts.speed });
    }
    if (changed.length) this.emit({ type: 'status', ids: changed });
    return this.opts.wait || this.opts.follow ? undefined : changed[0];
  }

  stats() {
    let hit = 0, miss = 0, total = 0;
    for (let i = 0; i < this.user.length; i++) {
      if (!this.user[i]) continue;
      total++;
      if (this.status[i] === HIT) hit++;
      else if (this.status[i] === MISS) miss++;
    }
    const attempts = hit + miss + this.wrong + this.slipped;
    return { hit, miss, wrong: this.wrong, total, strays: this.strays, accuracy: attempts ? hit / attempts : 0 };
  }

  progress() {
    const [a, b] = this.segment ? [this.segment.from - 1.6, this.segment.to] : [this.startTime, this.song.duration];
    return Math.max(0, Math.min(1, (this.time - a) / (b - a)));
  }
}
