import React from 'react';
import { useNetworkStore, networkProgress } from '../../state/network';

// Pure, stateless top progress bar. No timers, no setState: derives width directly
// from the network store each render. Eliminates any possibility of recursive
// update loops due to animations. Visual smoothing handled by CSS transition.
export const TopProgress: React.FC = () => {
  const { active, startedAt } = useNetworkStore();
  const base = active > 0 ? networkProgress(active, startedAt) : 0; // 0..85
  // If active drops to 0, snap to 100 once so bar completes, then fade out via opacity.
  const pct = active > 0 ? base : (base > 0 ? base : 100);
  const inactive = active === 0;
  return (
    <div className="fixed top-0 left-0 right-0 h-[3px] z-[120] pointer-events-none">
      <div
        className={
          'h-full origin-left transition-[width,opacity] duration-300 ease-out bg-gradient-to-r from-accent-blue via-accent-teal to-accent-green shadow-[0_0_6px_#00C0FFAA]' +
          (inactive ? ' opacity-0' : ' opacity-100')
        }
        style={{ width: `${pct}%` }}
        aria-hidden="true"
      />
      <span className="sr-only">{active>0 ? 'Network activity in progress' : 'Idle'}</span>
    </div>
  );
};
