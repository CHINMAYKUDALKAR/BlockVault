import React, { useState } from 'react';
import { useDiagnostics, dumpDiagnostics } from '../state/diagnostics';

export const DiagnosticsPanel: React.FC = () => {
  const { apiBase, health, logs, lastLoginError, clear } = useDiagnostics();
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed bottom-2 right-2 text-xs font-mono z-50 w-72">
      <button onClick={()=>setOpen(o=>!o)} className="px-2 py-1 rounded bg-gray-800 border border-gray-600 hover:bg-gray-700">Diag {open?'−':'+'}</button>
      {open && (
        <div className="mt-1 p-2 bg-gray-900 border border-gray-700 rounded max-h-80 overflow-auto space-y-1">
          <div><strong>API Base:</strong> {apiBase || '(relative)'}</div>
          <div><strong>Health:</strong> {health.status} <span className="text-gray-500">{health.detail}</span></div>
          {lastLoginError && <div className="text-red-400">Login Error: {lastLoginError}</div>}
          <div className="flex gap-2 mt-1">
            <button className="px-1 py-0.5 bg-gray-700 rounded" onClick={()=>{navigator.clipboard.writeText(dumpDiagnostics());}}>Copy JSON</button>
            <button className="px-1 py-0.5 bg-gray-700 rounded" onClick={clear}>Clear</button>
          </div>
          <ul className="space-y-0.5">
            {logs.slice().reverse().map(l => (
              <li key={l.ts+''+Math.random()} className={l.level==='error'?'text-red-400': l.level==='warn'?'text-yellow-400':'text-gray-300'}>
                {new Date(l.ts).toLocaleTimeString()} {l.level.toUpperCase()} {l.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
