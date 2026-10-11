import { useEffect } from 'react';
import { onNote } from './input';
import { addPractice } from './stats';

/**
 * Counts practice time honestly: a second counts while he has played a note in the last eight
 * seconds, so a screen left open on the music stand does not fill the daily goal.
 */
export function usePracticeClock() {
  useEffect(() => {
    let last = 0, pending = 0;
    const offNote = onNote(e => { if (e.type === 'on') last = performance.now(); });
    const id = window.setInterval(() => {
      if (performance.now() - last < 8000) pending += 1;
      if (pending >= 15) { addPractice(pending); pending = 0; }
    }, 1000);
    return () => { offNote(); window.clearInterval(id); addPractice(pending); };
  }, []);
}
