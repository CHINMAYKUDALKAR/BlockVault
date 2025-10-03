import { create } from 'zustand';

interface AuthState {
  address: string | null;
  jwt: string | null;
  loading: boolean;
  setAddress: (addr: string | null) => void;
  setJwt: (token: string | null) => void;
  setLoading: (v: boolean) => void;
  reset: () => void;
}

const persisted = (() => {
  try { return JSON.parse(sessionStorage.getItem('blockvault_auth') || 'null') } catch { return null }
})();

export const useAuthStore = create<AuthState>((set, get) => ({
  address: persisted?.address || null,
  jwt: persisted?.jwt || null,
  loading: false,
  setAddress: (address) => { set({ address }); persist(); },
  setJwt: (jwt) => { set({ jwt }); persist(); },
  setLoading: (loading) => set({ loading }),
  reset: () => { set({ address: null, jwt: null, loading: false }); persist(); },
}));

function persist() {
  const { address, jwt } = useAuthStore.getState();
  try { sessionStorage.setItem('blockvault_auth', JSON.stringify({ address, jwt })); } catch {}
}
