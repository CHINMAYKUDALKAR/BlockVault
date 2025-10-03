import React, { useCallback, useState } from 'react';
import clsx from 'clsx';

interface DragDropProps {
  onFile: (file: File) => void;
  accept?: string;
  disabled?: boolean;
}

export const DragDrop: React.FC<DragDropProps> = ({ onFile, accept, disabled }) => {
  const [drag, setDrag] = useState(false);
  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); if (!disabled) setDrag(true); }, [disabled]);
  const onDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setDrag(false); }, []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    if (disabled) return;
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  }, [onFile, disabled]);
  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
      className={clsx('relative border-2 border-dashed rounded-xl px-6 py-10 flex flex-col items-center justify-center gap-3 transition cursor-pointer',
        drag ? 'border-accent-blue bg-accent-blue/5' : 'border-border/60 hover:border-accent-blue/70 hover:bg-accent-blue/5',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      onClick={() => {
        if (disabled) return;
        const input = document.createElement('input');
        input.type = 'file';
        if (accept) input.accept = accept;
        input.onchange = () => { const f = input.files?.[0]; if (f) onFile(f); };
        input.click();
      }}
    >
      <div className="w-14 h-14 rounded-full bg-accent-blue/10 flex items-center justify-center text-accent-blue text-xl font-bold shadow-inner">
        +
      </div>
      <div className="text-center text-sm text-text-secondary">
        <strong className="text-text-primary font-medium">Drag & Drop</strong> or click to select a file
      </div>
      <div className="text-[11px] text-text-secondary/60">Client-side encryption before upload</div>
    </div>
  );
};
