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
  | { type: 'judge'; offset: number };

const CHORD_WINDOW = 0.045; // seconds: notes closer than this form one chord
const LEAD_IN = 2.2; // seconds of song time before the first note

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
  status: Uint8Array;
  user: Uint8Array; // 1 when the note belongs to Hugo's part
  groups: Group[] = [];
  gi = 0;
  held = new Set<number>();
  wrong = 0;
  lastWrong = { midi: -1, at: 0 };
  measureTimes: number[] = [];
  /** When the current wait began, and wrong notes played during it (for the hint). */
  waitSince = 0;
  wrongInWait = 0;
  /** The stretch being practised (a course part), in song seconds; null plays the whole song. */
  segment: { from: number; to: number } | null = null;
  private segmentLoop = false;

  private presses: Press[] = [];
  private lastGroupAt = 0;
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
    const [num, den] = song.timeSig;
    const measureTicks = song.ppq * 4 * (num / den);
    for (let k = 0; ; k++) {
      const t = song.ticksToSeconds(k * measureTicks);
      this.measureTimes.push(t);
      if (t > song.duration + 1 || k > 5000) break;
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

  seek(t: number, emit = true) {
    this.time = Math.max(this.startTime, Math.min(t, this.song.duration));
    const notes = this.song.notes;
    for (const n of notes) if (n.time >= this.time - 1e-3) this.status[n.id] = PENDING;
    this.gi = this.groups.findIndex(g => g.time >= this.time - 1e-3);
    if (this.gi < 0) this.gi = this.groups.length;
    this.autoIdx = notes.findIndex(n => n.time >= this.time - 1e-3);
    if (this.autoIdx < 0) this.autoIdx = notes.length;
    this.presses = [];
    this.waiting = false;
    this.finished = false;
    stopAll();
    if (emit) { this.emit({ type: 'status', ids: 'all' }); this.emit({ type: 'state' }); }
  }

  restart() {
    this.wrong = 0;
    this.seek(this.segmentStart());
  }

  /** A little run-up before the segment's first note (the app plays it). */
  private segmentStart() { return this.segment ? Math.max(this.startTime, this.segment.from - 1.6) : this.startTime; }

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
    this.wrong = 0;
    this.configure();
    this.seek(this.segmentStart());
  }


  play(countdown = 3) {
    if (this.finished) this.restart();
    this.playing = true;
    this.started = true;
    this.countdown = countdown;
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
      && (this.wrongInWait >= (this.opts.hintAfter?.wrongs ?? 2) || performance.now() - this.waitSince > (this.opts.hintAfter?.ms ?? 5000));
  }

  /** The group the player is stuck on, with the hand of each note (for the hint keyboard). */
  waitingFor(): { midi: number; hand: 'R' | 'L'; finger?: number }[] {
    const g = this.groups[this.gi];
    if (!g) return [];
    return g.ids.map(id => ({ midi: this.song.notes[id].midi, hand: this.song.notes[id].hand, finger: this.song.notes[id].finger }));
  }

  private tolerance() { return 0.2 * this.opts.speed + 0.06; }

  private tick(now: number) {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
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
      const tol = this.tolerance();
      while (this.gi < this.groups.length && next > this.groups[this.gi].time + tol) {
        for (const id of this.groups[this.gi].ids) if (this.status[id] === PENDING) { this.status[id] = MISS; changed.push(id); }
        this.gi++;
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
      if (this.segmentLoop) { this.seek(this.segmentStart()); this.countdown = 1; return; }
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

  private registerWrong(midi: number) {
    this.wrong++;
    if (this.waiting) this.wrongInWait++;
    this.lastWrong = { midi, at: performance.now() };
    this.emit({ type: 'wrong', midi });
  }

  input(e: NoteEvent) {
    if (e.type === 'off') { this.held.delete(e.midi); return; }
    this.held.add(e.midi);
    if (!this.playing || this.countdown > 0 || this.opts.listen) return;
    // The note it matches, judged before the press can move the cursor on.
    const g = this.groups[this.gi];
    const wrongBefore = this.wrong;
    const id = this.judgeInput(e);
    const ok = this.wrong === wrongBefore;
    const match = ok ? id ?? g?.ids.find(i => this.matches(e.midi, this.song.notes[i].midi)) : undefined;
    // A stray overtone the mic heard in a strike is neither right nor wrong: leave it off the staff.
    if (ok && match === undefined && e.chord) return;
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
      if (!relevantNote(e.midi)) { if (!strikeOk) this.registerWrong(e.midi); return undefined; }
      if (g && this.waiting && this.trySatisfy(g, now)) {
        this.markHit(g, changed);
        this.waiting = false;
        this.emit({ type: 'state' });
      }
    } else {
      const tol = this.tolerance();
      const t = this.time - lag * this.opts.speed;
      let best = -1, bestDt = Infinity;
      for (let i = Math.max(0, this.gi - 3); i < Math.min(this.groups.length, this.gi + 4); i++) {
        for (const id of this.groups[i].ids) {
          const n = this.song.notes[id];
          const d = Math.abs(n.time - t);
          if (this.status[id] === PENDING && d <= tol && d < bestDt && this.matches(e.midi, n.midi)) { best = id; bestDt = d; }
        }
      }
      if (best < 0) { if (!strikeOk) this.registerWrong(e.midi); return undefined; }
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
    const attempts = hit + miss + this.wrong;
    return { hit, miss, wrong: this.wrong, total, accuracy: attempts ? hit / attempts : 0 };
  }

  progress() {
    const [a, b] = this.segment ? [this.segment.from - 1.6, this.segment.to] : [this.startTime, this.song.duration];
    return Math.max(0, Math.min(1, (this.time - a) / (b - a)));
  }
}
