import abcjs from 'abcjs';
import { useEffect, useRef, useState } from 'react';
import { buildScore } from '../lib/abc';
import type { Song } from '../lib/types';

// Engraved first pages, kept for the session: the song list re-renders often.
const cache = new Map<string, string>();

/** The first page of a song's sheet music, engraved small, as its cover. */
export function SheetThumb({ song, title, composer, bars = 8 }: { song?: Song; title: string; composer?: string; bars?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const key = song ? `${song.entry.id}:${bars}:${title}:${composer ?? ''}` : '';

  // Engrave only once the card scrolls into view.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { setVisible(true); io.disconnect(); } }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !song || !visible) return;
    const hit = cache.get(key);
    if (hit) { el.innerHTML = hit; return; }
    try {
      const to = Math.min(bars, Math.max(1, Math.ceil(song.duration / Math.max(0.1, song.ticksToSeconds(song.ppq * 4 * song.timeSig[0] / song.timeSig[1])))));
      const score = buildScore(song, 2, 'off', { from: 1, to, title, composer });
      abcjs.renderAbc(el, score.abc, { responsive: 'resize', staffwidth: 520, paddingtop: 14, paddingbottom: 6, paddingleft: 10, paddingright: 14, foregroundColor: '#1b1640' });
      cache.set(key, el.innerHTML);
    } catch { el.innerHTML = ''; }
  }, [key, visible]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div className="sheet-thumb" ref={ref} aria-hidden="true" />;
}

/** Difficulty as dots, the way sheet-music sites mark it: green easy, amber medium, red hard. */
export function Difficulty({ level }: { level?: number }) {
  if (!level) return null;
  const tone = level <= 2 ? 'easy' : level === 3 ? 'medium' : 'hard';
  const word = tone === 'easy' ? 'Easy' : tone === 'medium' ? 'Medium' : 'Hard';
  return (
    <span className={`difficulty ${tone}`} aria-label={`Difficulty: ${word}, level ${level} of 5`}>
      {Array.from({ length: 5 }, (_, i) => <i key={i} className={i < level ? 'on' : ''} />)}
      <span>{word}</span>
    </span>
  );
}
