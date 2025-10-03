import React, { useState } from 'react';
import { useAuthStore } from '../state/auth';
import { Logo } from '../components/Logo';
import { useDiagnostics } from '../state/diagnostics';

function truncate(addr?: string, head = 6, tail = 4) {
  if (!addr) return '';
  if (addr.length <= head + tail + 2) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export const Header: React.FC = () => {
  const { address } = useAuthStore();
  const diag = useDiagnostics();
  const [copied, setCopied] = useState(false);
  const health = diag.health?.status || 'unknown';

  const healthColor = health === 'ok' ? 'bg-accent-green/20 text-accent-green border-accent-green/40' :
    health.startsWith('http-') || health === 'error' ? 'bg-accent-red/20 text-accent-red border-accent-red/40' : 'bg-accent-blue/20 text-accent-blue border-accent-blue/40';

  const copy = () => {
    if (!address) return;
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }).catch(() => {});
  };

  return (
    <header className="w-full flex items-center justify-between py-4 px-4 md:px-8 relative z-10">
      <div className="flex items-center gap-3">
        <Logo size={42} text />
      </div>
      <div className="flex items-center gap-4">
        <div className={`hidden md:flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full border ${healthColor} transition-colors`}
             title={`API health: ${health}`}>{health === 'ok' ? 'API Healthy' : health}</div>
        <button
          onClick={copy}
          disabled={!address}
          className={`relative group text-xs font-mono tracking-tight px-3 py-1 rounded-full border transition-all select-text ${address ? 'cursor-pointer border-accent-blue/40 bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20 hover:shadow-[0_0_0_1px_#00C0FF]' : 'border-gray-600 bg-gray-700/40 text-gray-500 cursor-not-allowed'}`}
          title={address ? 'Click to copy full address' : 'Wallet not connected'}
        >
          {address ? truncate(address) : 'Not Connected'}
          <span className={`absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-normal px-2 py-0.5 rounded-md bg-accent-blue/90 text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`}>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
    </header>
  );
};
