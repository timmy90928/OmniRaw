import { create } from 'zustand';

export type ThumbStatus = 'ready' | 'error';

interface ThumbState {
  status: Map<string, ThumbStatus>;
  setStatus: (path: string, status: ThumbStatus) => void;
  reset: () => void;
}

export const useThumbStore = create<ThumbState>((set) => ({
  status: new Map(),
  setStatus: (path, status) =>
    set((state) => {
      const next = new Map(state.status);
      next.set(path, status);
      return { status: next };
    }),
  reset: () => set({ status: new Map() }),
}));
