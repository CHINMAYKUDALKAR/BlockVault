import { create } from 'zustand';
import axios from 'axios';
import { apiUrl } from '../api/base';

interface PlatformState {
  mode: 'off-chain' | 'anchored' | 'ipfs' | 'hybrid';
  ipfsEnabled: boolean;
  anchoringEnabled: boolean;
  loaded: boolean;
  error?: string;
  load: () => Promise<void>;
}

export const usePlatformStore = create<PlatformState>((set, get) => ({
  mode: 'off-chain',
  ipfsEnabled: false,
  anchoringEnabled: false,
  loaded: false,
  async load() {
    if (get().loaded) return;
    try {
      const resp = await axios.get(apiUrl('/status'));
      const { mode, ipfs_enabled, anchoring_enabled } = resp.data;
      set({
        mode: mode as PlatformState['mode'],
        ipfsEnabled: !!ipfs_enabled,
        anchoringEnabled: !!anchoring_enabled,
        loaded: true,
        error: undefined,
      });
    } catch (e: any) {
      set({ loaded: true, error: e.message || 'status failed' });
    }
  }
}));

export function platformLabel(mode: PlatformState['mode']): string {
  switch (mode) {
    case 'hybrid': return 'Hybrid';
    case 'anchored': return 'Anchored';
    case 'ipfs': return 'IPFS';
    default: return 'Off‑Chain';
  }
}