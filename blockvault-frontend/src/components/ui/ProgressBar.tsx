import React from 'react';
import clsx from 'clsx';

export const ProgressBar: React.FC<{ value: number; className?: string; }> = ({ value, className }) => {
  return (
    <div className={clsx('w-full h-2 bg-background-tertiary/50 rounded-md overflow-hidden border border-border/40', className)}>
      <div
        className="h-full bg-gradient-to-r from-accent-blue via-accent-teal to-accent-green transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
};
