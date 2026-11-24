import { create } from 'zustand';
import { storage, uid } from '../services/storage';
import type { QuizAttempt, QuizConfig } from '../quiz/engine';

export interface Bookmark {
  id: string;
  structureId: string;
  note: string;
  createdAt: number;
}

export interface SavedQuiz {
  id: string;
  config: QuizConfig;
  createdAt: number;
}

export interface ProgressData {
  viewed: Record<string, { count: number; last: number }>;
  studySeconds: number;
  studyByDay: Record<string, number>;
  guidedDone: string[];
  attempts: QuizAttempt[];
  favorites: string[];
  bookmarks: Bookmark[];
  savedQuizzes: SavedQuiz[];
}

const empty = (): ProgressData => ({
  viewed: {}, studySeconds: 0, studyByDay: {}, guidedDone: [], attempts: [], favorites: [], bookmarks: [], savedQuizzes: [],
});

interface ProgressState {
  userId: string | null;
  data: ProgressData;
  load: (userId: string | null) => void;
  markViewed: (structureId: string) => void;
  addStudyTime: (seconds: number) => void;
  toggleGuided: (stepId: string) => void;
  addAttempt: (a: Omit<QuizAttempt, 'id'>) => QuizAttempt;
  toggleFavorite: (structureId: string) => void;
  addBookmark: (structureId: string, note: string) => void;
  removeBookmark: (id: string) => void;
  saveQuiz: (config: QuizConfig) => void;
  removeSavedQuiz: (id: string) => void;
  reset: () => void;
}

export const today = () => new Date().toISOString().slice(0, 10);

export const useProgress = create<ProgressState>((set, get) => {
  const update = (fn: (d: ProgressData) => ProgressData) => {
    const { userId, data } = get();
    const next = fn(data);
    set({ data: next });
    if (userId) storage.set(`progress:${userId}`, next);
  };
  return {
    userId: null,
    data: empty(),
    load: (userId) => set({ userId, data: userId ? { ...empty(), ...storage.get<Partial<ProgressData>>(`progress:${userId}`, {}) } : empty() }),
    markViewed: (id) =>
      update((d) => ({ ...d, viewed: { ...d.viewed, [id]: { count: (d.viewed[id]?.count ?? 0) + 1, last: Date.now() } } })),
    addStudyTime: (s) =>
      update((d) => ({ ...d, studySeconds: d.studySeconds + s, studyByDay: { ...d.studyByDay, [today()]: (d.studyByDay[today()] ?? 0) + s } })),
    toggleGuided: (stepId) =>
      update((d) => ({ ...d, guidedDone: d.guidedDone.includes(stepId) ? d.guidedDone.filter((x) => x !== stepId) : [...d.guidedDone, stepId] })),
    addAttempt: (a) => {
      const attempt = { ...a, id: uid('a_') };
      update((d) => ({ ...d, attempts: [attempt, ...d.attempts].slice(0, 200) }));
      return attempt;
    },
    toggleFavorite: (id) =>
      update((d) => ({ ...d, favorites: d.favorites.includes(id) ? d.favorites.filter((x) => x !== id) : [...d.favorites, id] })),
    addBookmark: (structureId, note) =>
      update((d) => ({ ...d, bookmarks: [{ id: uid('b_'), structureId, note, createdAt: Date.now() }, ...d.bookmarks] })),
    removeBookmark: (id) => update((d) => ({ ...d, bookmarks: d.bookmarks.filter((b) => b.id !== id) })),
    saveQuiz: (config) => update((d) => ({ ...d, savedQuizzes: [{ id: uid('q_'), config, createdAt: Date.now() }, ...d.savedQuizzes] })),
    removeSavedQuiz: (id) => update((d) => ({ ...d, savedQuizzes: d.savedQuizzes.filter((q) => q.id !== id) })),
    reset: () => update(() => empty()),
  };
});
