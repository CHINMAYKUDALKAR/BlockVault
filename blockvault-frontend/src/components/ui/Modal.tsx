import React, { useEffect, useRef } from 'react';
import { Icon } from '../icons';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, footer }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    const first = ref.current?.querySelector<HTMLElement>('[data-autofocus]');
    first?.focus();
    return () => window.removeEventListener('keydown', esc);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div ref={ref} role="dialog" aria-modal="true" className="relative w-full max-w-sm rounded-xl border border-border/50 bg-background-secondary/90 p-5 shadow-xl animate-scale-in">
        <button onClick={onClose} aria-label="Close" className="absolute top-2 right-2 p-1 rounded-md hover:bg-background-tertiary/60">
          <Icon name="close" size={16} />
        </button>
        {title && <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">{title}</h3>}
        <div className="space-y-4 text-xs text-text-secondary">
          {children}
        </div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
};
