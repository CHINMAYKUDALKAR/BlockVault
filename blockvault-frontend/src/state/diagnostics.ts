import create from 'zustand';

interface DiagnosticEntry {
  ts: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  meta?: any;
}

interface DiagnosticsState {
  apiBase: string;
  health: { status: string; detail: string };
  logs: DiagnosticEntry[];
  lastLoginError?: string;
  push: (entry: Omit<DiagnosticEntry,'ts'>) => void;
  setApiBase: (base: string) => void;
  setHealth: (status: string, detail: string) => void;
  setLastLoginError: (msg?: string) => void;
  clear: () => void;
}

export const useDiagnostics = create<DiagnosticsState>((set) => ({
  apiBase: '',
  health: { status: 'init', detail: '' },
  logs: [],
  push: (entry) => set(s => ({ logs: [...s.logs.slice(-199), { ...entry, ts: Date.now() }] })),
  setApiBase: (base) => set({ apiBase: base }),
  setHealth: (status, detail) => set({ health: { status, detail } }),
  setLastLoginError: (msg) => set({ lastLoginError: msg }),
  clear: () => set({ logs: [] })
}));

export function dumpDiagnostics(): string {
  const { apiBase, health, logs, lastLoginError } = useDiagnostics.getState();
  return JSON.stringify({ apiBase, health, lastLoginError, logs }, null, 2);
}
