import React from 'react';

// A futuristic vault/block style logo with gradient stroke/fill.
// Lightweight inline SVG so no external assets needed.
export const Logo: React.FC<{ size?: number; text?: boolean }>=({ size = 40, text = false }) => {
  const id = 'bvGradient';
  return (
    <div className="flex items-center gap-2 select-none">
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-[0_0_6px_#00C0FF55]"
      >
        <defs>
          <linearGradient id={id} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00E6FF" />
            <stop offset="60%" stopColor="#00C0FF" />
            <stop offset="100%" stopColor="#00FF80" />
          </linearGradient>
          <linearGradient id={id+'b'} x1="16" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0d2b3a" />
            <stop offset="100%" stopColor="#18384a" />
          </linearGradient>
        </defs>
        <rect x="6" y="6" width="52" height="52" rx="14" ry="14" stroke={`url(#${id})`} strokeWidth="2.5" fill="#1A1A2E" />
        <path
          d="M32 18L46 26V38L32 46L18 38V26L32 18Z"
          stroke={`url(#${id})`}
          strokeWidth="2.5"
          fill={`url(#${id+'b'})`}
          shapeRendering="geometricPrecision"
        />
        <circle cx="32" cy="32" r="6.5" stroke="#00C0FF" strokeWidth="2" fill="#0b2230" />
        <circle cx="32" cy="32" r="2.2" fill="#00FF80" />
      </svg>
      {text && (
        <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-accent-blue via-accent-teal to-accent-green">
          BlockVault
        </span>
      )}
    </div>
  );
};
