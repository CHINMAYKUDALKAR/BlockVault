import { create } from 'zustand';

interface NetState {
  active: number; // in-flight request count
  startedAt?: number;
  inc: () => void;
  dec: () => void;
  reset: () => void;
}

export const useNetworkStore = create<NetState>((set, get) => ({
  active: 0,
  inc: () => set(s => ({ active: s.active + 1, startedAt: s.active === 0 ? Date.now() : s.startedAt })),
  dec: () => set(s => ({ active: Math.max(0, s.active - 1) })),
  reset: () => set({ active: 0, startedAt: undefined })
}));

// Helper to derive a progress value (fake-linear) for top bar.
export function networkProgress(active: number, startedAt?: number): number {
  if (active <= 0 || !startedAt) return 0;
  const elapsed = Date.now() - startedAt;
  // Approach 85% asymptotically, finish snaps to 100% on zero active
  const pct = 85 * (1 - Math.exp(-elapsed / 1200));
  return Math.min(85, pct);
}
