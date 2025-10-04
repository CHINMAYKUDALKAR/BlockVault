import React, { useEffect } from 'react';
import { create } from 'zustand';

// Definitive toast store & host (legacy duplicates removed)
interface Toast { id: string; msg: string; type: 'info'|'error'|'success'; created?: number; }
interface ToastState { toasts: Toast[]; push: (t: Omit<Toast,'id'>) => void; remove: (id: string)=>void; clear: () => void; }

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => set(s => ({ toasts: [...s.toasts, { ...t, id: (crypto as any).randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2), created: Date.now() }] })),
  remove: (id) => set(s => ({ toasts: s.toasts.filter(x => x.id !== id) })),
  clear: () => set({ toasts: [] })
}));

export const ToastHost: React.FC = () => {
  const { toasts, remove } = useToastStore();

  // Auto dismiss after 4.5s
  useEffect(() => {
    const timers = toasts.map(t => setTimeout(() => remove(t.id), 4500));
    return () => { timers.forEach(clearTimeout); };
  }, [toasts, remove]);

  return (
    <div className="fixed top-3 right-3 space-y-3 z-50 max-w-xs">
      {toasts.map(t => {
        const color = t.type === 'success' ? 'from-accent-green/40 to-accent-blue/30 border-accent-green/50' : t.type === 'error' ? 'from-accent-red/60 to-accent-blue/10 border-accent-red/60' : 'from-accent-blue/40 to-accent-teal/30 border-accent-blue/50';
        return (
          <div
            key={t.id}
            onClick={() => remove(t.id)}
            className={`text-sm relative px-4 py-3 rounded-xl cursor-pointer select-none group overflow-hidden border backdrop-blur-md bg-gradient-to-br ${color} shadow-[0_4px_18px_-4px_rgba(0,0,0,0.5)] transition hover:shadow-[0_0_0_1px_#00C0FF]`}
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition bg-[radial-gradient(circle_at_30%_30%,#00C0FF33,transparent_60%)]" />
            <div className="relative flex items-start gap-2">
              <span className="mt-[2px] text-xs font-medium uppercase tracking-wide text-text-primary/80">{t.type}</span>
              <span className="flex-1 text-text-primary/90 leading-snug">{t.msg}</span>
              <button
                className="text-[10px] text-text-secondary/70 hover:text-accent-blue ml-1"
                onClick={(e) => { e.stopPropagation(); remove(t.id); }}
                aria-label="Dismiss"
              >×</button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

