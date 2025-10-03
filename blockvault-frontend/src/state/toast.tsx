// Consolidated toast store/component (renamed to avoid circular re-exports issues).
import React from 'react';
import { create } from 'zustand';

interface Toast { id: string; msg: string; type: 'info'|'error'|'success'; }
interface ToastState { toasts: Toast[]; push: (t: Omit<Toast,'id'>) => void; remove: (id: string)=>void; }

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => set(s => ({ toasts: [...s.toasts, { ...t, id: (crypto as any).randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) }] })),
  remove: (id) => set(s => ({ toasts: s.toasts.filter(x => x.id !== id) })),
}));

export const ToastHost: React.FC = () => {
  const { toasts, remove } = useToastStore();
  return (
    <div className="fixed top-2 right-2 space-y-2 z-50 max-w-xs">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`text-sm px-3 py-2 rounded shadow bg-gray-800 border cursor-pointer transition ${t.type==='error'?'border-red-500':'border-gray-600'} ${t.type==='success'?'border-green-500':''}`}
          onClick={() => remove(t.id)}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
};
