import React, { useEffect, useState } from 'react';
import { WalletSection } from './WalletSection';
import { UploadSection } from './UploadSection';
import { FilesSection } from './FilesSection';
import { useAuthStore } from '../state/auth';
import { ToastHost } from '../state/toastHost';
import { resolveApiBase, apiUrl } from '../api/base';
import { useDiagnostics } from '../state/diagnostics';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { Header } from './Header';

export const App: React.FC = () => {
  const { address, jwt } = useAuthStore();
  const [apiStatus, setApiStatus] = useState<string>('checking...');
  const [apiDetail, setApiDetail] = useState<string>('');
  const API_BASE = resolveApiBase();
  const diag = useDiagnostics();
  if (diag.apiBase !== API_BASE) diag.setApiBase(API_BASE);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const start = performance.now();
        diag.push({ level:'info', message:`health -> ${apiUrl('/health')}`});
	const r = await fetch(apiUrl('/health'), { cache: 'no-store' });
        const ct = r.headers.get('content-type') || '';
        if (!r.ok) {
          if (!cancelled) {
            const ms = Math.round(performance.now()-start);
            setApiStatus(`health ${r.status}`);
            setApiDetail(`status=${r.status} ${ms}ms`);
            diag.setHealth(`http-${r.status}`, `${ms}ms`);
          }
          return;
        }
        if (ct.includes('application/json')) {
          const j = await r.json();
          if (!cancelled) {
            if (j.status === 'ok') {
              setApiStatus('ok');
              setApiDetail('');
              const ms = Math.round(performance.now()-start);
              diag.setHealth('ok', `${ms}ms`);
            } else if (j.endpoints && j.message) {
              // We hit the index instead of /health somehow
              setApiStatus('misdirected');
              setApiDetail('Received index JSON at /health (proxy/path issue)');
              diag.setHealth('misdirected', 'index payload');
              console.warn('[health] Expected /health JSON but got index payload. Proxy may be rewriting or backend code not updated.');
            } else {
              setApiStatus('unexpected-json');
              setApiDetail(JSON.stringify(j));
              diag.setHealth('unexpected-json', '');
            }
          }
        } else {
          // Likely proxy miss returning HTML from CRA
            const text = await r.text();
            if (!cancelled) {
              const miss = text.toLowerCase().includes('<!doctype');
              setApiStatus(miss ? 'proxy-miss (HTML)' : 'unexpected response');
              setApiDetail(miss ? 'Got HTML instead of JSON for /health' : text.slice(0,120));
              diag.setHealth(miss ? 'proxy-miss' : 'unexpected', '');
            }
        }
      } catch (e:any) {
        if (!cancelled) {
          setApiStatus('error');
          setApiDetail(e.message || String(e));
          diag.setHealth('error', e.message || String(e));
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return (
    <div className="min-h-screen w-full relative backdrop-grid flex flex-col">
      <Header />
      <main className="flex-1 w-full px-4 md:px-8 pb-16 flex justify-center">
        <div className="w-full max-w-7xl">
          <div className="mb-10 max-w-4xl mx-auto text-center">
            <p className="text-sm text-text-secondary max-w-2xl leading-relaxed">
              End‑to‑end encrypted file vault leveraging Web3 authentication & on-chain style security metaphors. Your files are encrypted client-side before leaving your browser.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-mono text-text-secondary/70">
              <span className="px-2 py-1 rounded-md bg-background-tertiary/40 border border-border/40">API: {apiStatus}</span>
              {apiDetail && <span className="px-2 py-1 rounded-md bg-background-tertiary/40 border border-border/40" title={apiDetail}>{apiDetail.slice(0,60)}</span>}
            </div>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 auto-rows-fr justify-center">
            <section className="card flex flex-col">
              <h2 className="text-lg font-semibold mb-4 tracking-tight text-accent-blue">Wallet</h2>
              <div className="flex-1">
                <WalletSection />
              </div>
            </section>
            {jwt && (
              <section className="card flex flex-col md:col-span-1 lg:col-span-1">
                <h2 className="text-lg font-semibold mb-4 tracking-tight text-accent-blue">Upload File</h2>
                <div className="flex-1">
                  <UploadSection />
                </div>
              </section>
            )}
            {jwt && (
              <section className="card flex flex-col md:col-span-2 lg:col-span-1 lg:row-span-2">
                <h2 className="text-lg font-semibold mb-4 tracking-tight text-accent-blue">Your Files</h2>
                <div className="flex-1 overflow-hidden">
                  <FilesSection />
                </div>
              </section>
            )}
            {!jwt && (
              <section className="card flex flex-col md:col-span-1 lg:col-span-2 justify-center items-center text-center">
                <h2 className="text-lg font-semibold mb-2 tracking-tight text-accent-blue">Authenticate to Continue</h2>
                <p className="text-sm text-text-secondary max-w-sm">Connect your wallet and sign the auth message to unlock secure encrypted uploads and file management.</p>
              </section>
            )}
          </div>
        </div>
      </main>
      <ToastHost />
      <DiagnosticsPanel />
    </div>
  );
};
