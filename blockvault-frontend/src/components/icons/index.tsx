import React from 'react';

export type IconName =
  | 'download'
  | 'delete'
  | 'verify'
  | 'shield'
  | 'lock'
  | 'info'
  | 'folder'
  | 'copy'
  | 'hash'
  | 'close'
  | 'share'
  | 'user'
  | 'key'
  | 'clock'
  | 'eye';

interface IconProps { name: IconName; size?: number; className?: string; strokeWidth?: number; }

const base = 'stroke-current';

export const Icon: React.FC<IconProps & Omit<React.SVGProps<SVGSVGElement>, 'ref'>> = ({ name, size = 16, className = '', strokeWidth = 1.8, ...rest }) => {
  const p: React.SVGProps<SVGSVGElement> = { width: size, height: size, fill: 'none', strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round', className: base + ' ' + className } as const;
  switch(name){
    case 'download': return (
      <svg {...p} {...rest}><path d="M12 3v8"/><path d="m8 8 4 4 4-4"/><path d="M5 19h14"/></svg>
    );
    case 'delete': return (
      <svg {...p} {...rest}><path d="M5 6h14"/><path d="M10 6V4h4v2"/><path d="m14 10-.5 6"/><path d="m10 10 .5 6"/><path d="M8 6h8l-1 12H9L8 6Z"/></svg>
    );
    case 'verify': return (
      <svg {...p} {...rest}><path d="m5 13 4 4L19 7"/></svg>
    );
    case 'shield': return (
      <svg {...p} {...rest}><path d="M12 3 5 6v6c0 5 3.8 7.7 7 9 3.2-1.3 7-4 7-9V6l-7-3Z"/></svg>
    );
    case 'lock': return (
      <svg {...p} {...rest}><rect x="6" y="11" width="12" height="10" rx="2"/><path d="M9 11V7a3 3 0 0 1 6 0v4"/></svg>
    );
    case 'info': return (
      <svg {...p} {...rest}><circle cx="12" cy="12" r="9"/><path d="M12 8h.01"/><path d="M11 12h1v4h1"/></svg>
    );
    case 'folder': return (
      <svg {...p} {...rest}><path d="M4 6h5l2 2h9v10a2 2 0 0 1-2 2H4Z"/><path d="M4 6v12a2 2 0 0 0 2 2h12"/></svg>
    );
    case 'copy': return (
      <svg {...p} {...rest}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15V7a2 2 0 0 1 2-2h8"/></svg>
    );
    case 'hash': return (
      <svg {...p} {...rest}><path d="M10 3 8 21"/><path d="M16 3 14 21"/><path d="M4 8h18"/><path d="M2 16h18"/></svg>
    );
    case 'close': return (
      <svg {...p} {...rest}><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg>
    );
    case 'share': return (
      <svg {...p} {...rest}><path d="M16 7c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2"/><path d="M16 7 8 12"/><path d="M8 12l8 5"/><path d="M8 12a2 2 0 1 0-2 3"/><path d="M16 17c1.1 0 2 .9 2 2s-.9 2-2 2"/></svg>
    );
    case 'user': return (
      <svg {...p} {...rest}><path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
    );
    case 'key': return (
      <svg {...p} {...rest}><path d="M21 11V9l-6-6-1.5 1.5"/><path d="M3 21 12.5 11.5"/><path d="M12.5 11.5a4 4 0 1 0-5.66 5.66"/><circle cx="7.5" cy="16.5" r="1"/></svg>
    );
    case 'clock': return (
      <svg {...p} {...rest}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
    );
    case 'eye': return (
      <svg {...p} {...rest}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Z"/><circle cx="12" cy="12" r="3"/></svg>
    );
    default: return null;
  }
};
