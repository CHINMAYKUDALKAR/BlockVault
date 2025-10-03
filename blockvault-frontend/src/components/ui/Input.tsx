import React, { useState } from 'react';
import clsx from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  mono?: boolean;
  revealToggle?: boolean; // adds an eye icon to toggle visibility
}

export const Input: React.FC<InputProps> = ({ label, description, mono, revealToggle, type='text', className, ...rest }) => {
  const [visible, setVisible] = useState(false);
  const actualType = revealToggle ? (visible ? 'text' : 'password') : type;
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label && <span className="text-text-secondary/80 font-medium tracking-tight">{label}</span>}
      <div className="relative group">
        <input
          type={actualType}
          className={clsx(
            'w-full px-3 py-2 rounded-md bg-background-tertiary/70 border border-border/60 focus:border-accent-blue/80 focus:ring-2 focus:ring-accent-blue/40 outline-none transition text-text-primary placeholder:text-text-secondary/40',
            mono && 'font-mono text-[13px] tracking-tight',
            className
          )}
          {...rest}
        />
        {revealToggle && (
          <button
            type="button"
            onClick={() => setVisible(v => !v)}
            className="absolute top-1/2 -translate-y-1/2 right-2 text-[11px] text-text-secondary hover:text-accent-blue transition"
            tabIndex={-1}
          >
            {visible ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      {description && <span className="text-[11px] text-text-secondary/60 leading-snug">{description}</span>}
    </label>
  );
};
