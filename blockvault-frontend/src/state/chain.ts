import { create } from 'zustand';

interface ChainState {
  connectedChainId?: number;
  expectedChainId?: number;
  lastChecked?: number;
  setConnected: (id?: number) => void;
  setExpected: (id?: number) => void;
}

export const useChainStore = create<ChainState>((set) => ({
  connectedChainId: undefined,
  expectedChainId: undefined,
  lastChecked: undefined,
  setConnected: (id) => set({ connectedChainId: id, lastChecked: Date.now() }),
  setExpected: (id) => set({ expectedChainId: id })
}));

export function chainStatus(connected?: number, expected?: number): 'match' | 'mismatch' | 'unset' {
  if (!expected) return 'unset';
  if (!connected) return 'unset';
  return connected === expected ? 'match' : 'mismatch';
}
