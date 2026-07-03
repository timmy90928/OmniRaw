import { create } from 'zustand';
import type { DeleteMode } from '../types';

export type PreviewSource = 'nonRaw' | 'raw';

interface CullState {
  currentIndex: number;
  /** groupId → how to delete it; maps 1:1 onto backend DeletionRequest. */
  marked: Map<string, DeleteMode>;
  previewSource: PreviewSource;
  setIndex: (index: number) => void;
  step: (delta: number, total: number) => void;
  mark: (groupId: string, mode: DeleteMode) => void;
  unmark: (groupId: string) => void;
  clearMarks: () => void;
  toggleSource: () => void;
}

export const useCullStore = create<CullState>((set) => ({
  currentIndex: 0,
  marked: new Map(),
  previewSource: 'nonRaw',
  setIndex: (index) => set({ currentIndex: index }),
  step: (delta, total) =>
    set((s) => ({
      currentIndex: total === 0 ? 0 : Math.min(Math.max(s.currentIndex + delta, 0), total - 1),
    })),
  mark: (groupId, mode) =>
    set((s) => {
      const marked = new Map(s.marked);
      marked.set(groupId, mode);
      return { marked };
    }),
  unmark: (groupId) =>
    set((s) => {
      const marked = new Map(s.marked);
      marked.delete(groupId);
      return { marked };
    }),
  clearMarks: () => set({ marked: new Map() }),
  toggleSource: () =>
    set((s) => ({ previewSource: s.previewSource === 'nonRaw' ? 'raw' : 'nonRaw' })),
}));
