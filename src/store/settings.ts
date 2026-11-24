import { create } from 'zustand';
import { storage } from '../services/storage';
import type { Level } from '../core/types';

export type Theme = 'dark' | 'light' | 'system';

interface SettingsState {
  theme: Theme;
  speciesId: string;
  level: Level | 'todos';
  reducedMotion: boolean;
  setTheme: (t: Theme) => void;
  setLevel: (l: Level | 'todos') => void;
  setSpecies: (id: string) => void;
  setReducedMotion: (v: boolean) => void;
}

const saved = storage.get<Partial<SettingsState>>('settings', {});

export const useSettings = create<SettingsState>((set, get) => {
  const persist = () => {
    const { theme, speciesId, level, reducedMotion } = get();
    storage.set('settings', { theme, speciesId, level, reducedMotion });
  };
  return {
    theme: saved.theme ?? 'dark',
    speciesId: saved.speciesId ?? 'dog',
    level: saved.level ?? 'todos',
    reducedMotion: saved.reducedMotion ?? false,
    setTheme: (theme) => { set({ theme }); persist(); applyTheme(theme); },
    setLevel: (level) => { set({ level }); persist(); },
    setSpecies: (speciesId) => { set({ speciesId }); persist(); },
    setReducedMotion: (reducedMotion) => { set({ reducedMotion }); persist(); },
  };
});

export function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}
