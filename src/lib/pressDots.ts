import type { Engine } from './engine';
import { cursorAt, type Engraved } from './engrave';

/**
 * Like Simply Piano: each key he presses leaves a soft dot on the staff, at the pitch he played,
 * green when it is one of the notes to play and red when not. The written note itself only turns
 * green once the whole chord is down, so he learns where each key sits on the staff.
 * Dots go into `layer`, which shares the engraving's coordinates. Returns a cleanup.
 */
export function pressDots(engine: Engine, eg: Engraved, layer: HTMLElement): () => void {
  const live = new Map<number, HTMLElement>();
  const fade = (midi: number) => {
    const d = live.get(midi);
    if (!d) return;
    live.delete(midi);
    d.classList.add('out');
    setTimeout(() => d.remove(), 320);
  };
  const off = engine.on(e => {
    if (e.type !== 'press') return;
    const stop = e.id !== undefined ? eg.stopOf(e.id) : undefined;
    const at = stop ?? cursorAt(eg.stops, engine.time);
    if (!at) return;
    // A wrong key goes on the staff of the written note nearest to it.
    const near = (engine.groups[engine.gi]?.ids ?? []).map(id => engine.song.notes[id])
      .sort((a, b) => Math.abs(a.midi - e.midi) - Math.abs(b.midi - e.midi))[0];
    const hand = e.id !== undefined ? engine.song.notes[e.id].hand : near?.hand;
    const p = eg.pitchY(at.line, e.midi, hand);
    if (!p) return;
    fade(e.midi);
    const d = document.createElement('span');
    d.className = `press-dot ${e.ok ? 'ok' : 'bad'}`;
    const size = Math.max(9, p.gap * 1.25);
    d.style.width = d.style.height = `${size}px`;
    d.style.transform = `translate(${at.x - size / 2}px, ${p.y - size / 2}px)`;
    layer.appendChild(d);
    live.set(e.midi, d);
    const born = performance.now();
    // Stay while the key is held (at least a moment), then fade.
    const watch = () => {
      if (live.get(e.midi) !== d) return;
      if (engine.held.has(e.midi) || performance.now() - born < 350) requestAnimationFrame(watch);
      else fade(e.midi);
    };
    requestAnimationFrame(watch);
  });
  return () => { off(); live.forEach(d => d.remove()); live.clear(); };
}
