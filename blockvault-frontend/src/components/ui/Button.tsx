import React from 'react';
import clsx from 'clsx';

type Variant = 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
type Size = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loading?: boolean;
  shimmer?: boolean;
}

const base = 'inline-flex items-center gap-2 font-medium rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-accent-blue/60 disabled:opacity-50 disabled:cursor-not-allowed relative';

const variants: Record<Variant, string> = {
  primary: 'bg-gradient-to-r from-accent-blue to-accent-teal text-white shadow-glow hover:brightness-110 active:scale-[.97] border border-transparent',
  secondary: 'bg-background-tertiary/60 text-text-primary border border-border hover:border-accent-blue/60 hover:text-accent-blue/90 hover:shadow-[0_0_0_1px_#00C0FF] active:scale-[.97]',
  outline: 'bg-transparent border border-accent-blue/60 text-accent-blue hover:bg-accent-blue/10 active:scale-[.97]',
  danger: 'bg-accent-red/80 text-white border border-accent-red/60 hover:bg-accent-red active:scale-[.97]',
  ghost: 'bg-transparent text-text-secondary hover:text-accent-blue hover:bg-accent-blue/10 active:scale-[.97]'
};

const sizes: Record<Size, string> = {
  sm: 'text-xs px-2.5 py-1.5',
  md: 'text-sm px-3.5 py-2',
  lg: 'text-base px-5 py-2.5',
  icon: 'p-2 justify-center'
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className,
  leftIcon,
  rightIcon,
  loading,
  shimmer,
  children,
  ...rest
}) => {
  return (
    <button
      className={clsx(base, variants[variant], sizes[size], shimmer && 'animate-pulse-glow', className)}
      {...rest}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      )}
      {!loading && leftIcon}
      <span className="whitespace-nowrap">{children}</span>
      {!loading && rightIcon}
    </button>
  );
};
