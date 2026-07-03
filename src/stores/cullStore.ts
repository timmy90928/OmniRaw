import { create } from 'zustand';

interface CullState {
  currentIndex: number;
  /** Which file inside the current group is being previewed. */
  previewIndex: number;
  /** groupId → file paths marked for deletion (file-level granularity). */
  marked: Map<string, Set<string>>;
  setIndex: (index: number) => void;
  step: (delta: number, total: number) => void;
  setPreviewIndex: (index: number) => void;
  cyclePreview: (fileCount: number, delta?: number) => void;
  /** Replaces the group's marked set; empty array unmarks. */
  markFiles: (groupId: string, paths: string[]) => void;
  toggleFile: (groupId: string, path: string) => void;
  unmark: (groupId: string) => void;
  clearMarks: () => void;
}

function withGroupSet(
  marked: Map<string, Set<string>>,
  groupId: string,
  paths: Set<string>,
): Map<string, Set<string>> {
  const next = new Map(marked);
  if (paths.size === 0) next.delete(groupId);
  else next.set(groupId, paths);
  return next;
}

export const useCullStore = create<CullState>((set) => ({
  currentIndex: 0,
  previewIndex: 0,
  marked: new Map(),
  setIndex: (index) => set({ currentIndex: index, previewIndex: 0 }),
  step: (delta, total) =>
    set((s) => ({
      currentIndex: total === 0 ? 0 : Math.min(Math.max(s.currentIndex + delta, 0), total - 1),
      previewIndex: 0,
    })),
  setPreviewIndex: (index) => set({ previewIndex: index }),
  cyclePreview: (fileCount, delta = 1) =>
    set((s) => ({
      previewIndex: fileCount === 0 ? 0 : (s.previewIndex + delta + fileCount) % fileCount,
    })),
  markFiles: (groupId, paths) =>
    set((s) => ({ marked: withGroupSet(s.marked, groupId, new Set(paths)) })),
  toggleFile: (groupId, path) =>
    set((s) => {
      const current = new Set(s.marked.get(groupId) ?? []);
      if (current.has(path)) current.delete(path);
      else current.add(path);
      return { marked: withGroupSet(s.marked, groupId, current) };
    }),
  unmark: (groupId) =>
    set((s) => {
      const next = new Map(s.marked);
      next.delete(groupId);
      return { marked: next };
    }),
  clearMarks: () => set({ marked: new Map() }),
}));
