import React from 'react';
import { UploadSection } from './UploadSection';
import { FilesSection } from './FilesSection';
import { SharingSection } from './SharingSection';
import { useAuthStore } from '../state/auth';
import { ToastHost } from '../state/toastHost';
import { Header } from './Header';
import { TopProgress } from '../components/ui/TopProgress';
// Diagnostic render tracker (dev only) to trace potential infinite re-render source
let __renderCount = 0;
function RenderProbe() {
  __renderCount++;
  if (__renderCount % 200 === 0) {
    // Log a lightweight stack to see repeating pattern
    // eslint-disable-next-line no-console
    console.warn('[diag] High render count', __renderCount, new Error().stack?.split('\n').slice(0,3).join('\n'));
  }
  return null;
}

export const App: React.FC = () => {
  const { jwt } = useAuthStore();
  return (
    <div className="min-h-screen w-full relative backdrop-grid flex flex-col">
    <TopProgress />
      <RenderProbe />
      <Header />
      <main className="flex-1 w-full px-4 md:px-8 pb-16 flex justify-center">
        <div className="w-full max-w-7xl">
          <div className="mb-10 max-w-3xl mx-auto text-center">
            <p className="text-sm text-text-secondary leading-relaxed">
              End‑to‑end encrypted file vault leveraging Web3 authentication. Your files are encrypted locally before upload—only you hold the keys.
            </p>
          </div>
          <div className={`grid gap-8 ${jwt ? 'md:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-1'} auto-rows-fr justify-center`}>            
            {jwt ? (
              <>
                <section className="card flex flex-col md:col-span-1 lg:col-span-1">
                  <h2 className="text-lg font-semibold mb-4 tracking-tight text-accent-blue">Upload File</h2>
                  <div className="flex-1">
                    <UploadSection />
                  </div>
                </section>
                <section className="card flex flex-col md:col-span-1 lg:col-span-1 lg:row-span-2">
                  <h2 className="text-lg font-semibold mb-4 tracking-tight text-accent-blue">Your Files</h2>
                  <div className="flex-1 overflow-hidden">
                    <FilesSection />
                  </div>
                </section>
                <section className="card flex flex-col md:col-span-2 lg:col-span-1">
                  <SharingSection />
                </section>
              </>
            ) : (
              <section className="card flex flex-col justify-center items-center text-center">
                <h2 className="text-lg font-semibold mb-2 tracking-tight text-accent-blue">Authenticate to Continue</h2>
                <p className="text-sm text-text-secondary max-w-sm">Use the Connect and Login buttons in the header to start uploading encrypted files.</p>
              </section>
            )}
          </div>
        </div>
      </main>
  <ToastHost />
    </div>
  );
};
