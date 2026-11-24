import { useEffect } from 'react';
import { useProgress } from '../store/progress';

/** Acumula tiempo de estudio mientras la página está visible (cada 15 s). */
export function useStudyTimer(active = true) {
  const add = useProgress((s) => s.addStudyTime);
  useEffect(() => {
    if (!active) return;
    const STEP = 15;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') add(STEP);
    }, STEP * 1000);
    return () => window.clearInterval(id);
  }, [active, add]);
}
