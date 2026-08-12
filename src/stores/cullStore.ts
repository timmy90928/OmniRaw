import { create } from 'zustand';
import type { ScanResult } from '../types';

interface CullState {
  sessionRoot: string | null;
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
  /**
   * Reconciles marks against a fresh scan (used by refresh): keeps marks for
   * files that still exist, drops marks for deleted files / vanished groups,
   * and clamps the cursor to the new group count.
   */
  reconcileMarks: (result: ScanResult) => void;
  restoreForScan: (result: ScanResult) => void;
}

interface PersistedCullState {
  sessionRoot: string | null;
  currentIndex: number;
  previewIndex: number;
  marked: Array<[string, string[]]>;
}

function loadPersisted(): PersistedCullState | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem('omniraw.cull-session.v1') ?? 'null');
  } catch {
    return null;
  }
}

const persisted = loadPersisted();

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
  sessionRoot: persisted?.sessionRoot ?? null,
  currentIndex: persisted?.currentIndex ?? 0,
  previewIndex: persisted?.previewIndex ?? 0,
  marked: new Map((persisted?.marked ?? []).map(([id, paths]) => [id, new Set(paths)])),
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
  reconcileMarks: (result) =>
    set((s) => {
      const currentIndex = Math.min(s.currentIndex, Math.max(result.groups.length - 1, 0));
      if (s.marked.size === 0) return { currentIndex };
      const present = new Map(
        result.groups.map((g) => [
          g.id,
          new Set([...g.raws, ...g.others].map((f) => f.path)),
        ]),
      );
      const next = new Map<string, Set<string>>();
      for (const [groupId, paths] of s.marked) {
        const groupPaths = present.get(groupId);
        if (!groupPaths) continue;
        const kept = new Set([...paths].filter((p) => groupPaths.has(p)));
        if (kept.size > 0) next.set(groupId, kept);
      }
      return { marked: next, currentIndex };
    }),
  restoreForScan: (result) =>
    set((state) => {
      if (state.sessionRoot !== result.root) {
        return {
          sessionRoot: result.root,
          currentIndex: 0,
          previewIndex: 0,
          marked: new Map(),
        };
      }
      const currentIndex = Math.min(state.currentIndex, Math.max(result.groups.length - 1, 0));
      const present = new Map(
        result.groups.map((group) => [
          group.id,
          new Set([...group.raws, ...group.others].map((file) => file.path)),
        ]),
      );
      const marked = new Map<string, Set<string>>();
      for (const [groupId, paths] of state.marked) {
        const available = present.get(groupId);
        if (!available) continue;
        const kept = new Set([...paths].filter((path) => available.has(path)));
        if (kept.size > 0) marked.set(groupId, kept);
      }
      const group = result.groups[currentIndex];
      const fileCount = group ? group.raws.length + group.others.length : 0;
      return {
        sessionRoot: result.root,
        currentIndex,
        previewIndex: Math.min(state.previewIndex, Math.max(fileCount - 1, 0)),
        marked,
      };
    }),
}));

if (typeof localStorage !== 'undefined') {
  useCullStore.subscribe((state) => {
    const value: PersistedCullState = {
      sessionRoot: state.sessionRoot,
      currentIndex: state.currentIndex,
      previewIndex: state.previewIndex,
      marked: [...state.marked].map(([id, paths]) => [id, [...paths]]),
    };
    localStorage.setItem('omniraw.cull-session.v1', JSON.stringify(value));
  });
}
