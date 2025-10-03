import React, { useCallback, useState } from 'react';
import { ethers } from 'ethers';
import axios from 'axios';
import { useAuthStore } from '../state/auth';
import { apiUrl, resolveApiBase } from '../api/base';
import { useDiagnostics } from '../state/diagnostics';
import { Button } from '../components/ui/Button';
import { useToastStore } from '../state/toastHost';

// Dynamic API base selection (supports Codespaces, local, explicit env)
const API_BASE = resolveApiBase();

export const WalletSection: React.FC = () => {
  const { address, setAddress, setJwt, loading, setLoading, reset } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const diag = useDiagnostics();
  const toast = useToastStore();

  const connect = useCallback(async () => {
    try {
      setError(null);
      if (!(window as any).ethereum) {
        setError('MetaMask not detected');
        return;
      }
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      if (!accounts.length) return;
      setAddress(accounts[0]);
    } catch (e: any) {
      setError(e.message || 'Failed to connect wallet');
    }
  }, [setAddress]);

  const login = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      // 1. get nonce
  const nonceUrl = apiUrl('/auth/get_nonce');
  console.debug('[login] POST', nonceUrl, { address, API_BASE });
  const nonceResp = await axios.post(nonceUrl, { address });
  diag.push({ level:'info', message:'nonce ok', meta:{ url: nonceUrl }});
      const message = nonceResp.data.message;
      // 2. sign
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const signature = await signer.signMessage(message);
      // 3. login
  const loginUrl = apiUrl('/auth/login');
  console.debug('[login] POST', loginUrl, { address, signature: signature.slice(0, 12)+'...' });
  const loginResp = await axios.post(loginUrl, { address, signature });
  diag.push({ level:'info', message:'login ok'});
      setJwt(loginResp.data.token);
      console.debug('[login] success');
    } catch (e: any) {
      // Detect HTML (proxy miss) vs JSON error
      const data = e.response?.data;
      let msg = e.response?.data?.error || e.message || 'Login failed';
      if (typeof data === 'string' && data.toLowerCase().includes('<!doctype')) {
        msg = 'Proxy misconfigured (received HTML instead of JSON)';
      }
  setError(msg);
  diag.setLastLoginError(msg);
  diag.push({ level:'error', message:'login failed', meta:{ msg } });
      console.warn('[login] failed', msg, e.response?.status);
    } finally {
      setLoading(false);
    }
  }, [address, setJwt, setLoading]);

  return (
    <section className="space-y-5">
      {!address && (
        <div className="flex flex-col items-center gap-4">
          <Button onClick={connect} variant="primary" size="lg" className="w-full justify-center">
            <span className="inline-flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-accent-blue animate-pulse" />
              Connect Wallet
            </span>
          </Button>
          {error && <span className="text-xs text-accent-red font-medium">{error}</span>}
        </div>
      )}
      {address && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-3 py-3 rounded-lg border border-border/60 bg-background-tertiary/40 backdrop-blur-sm">
            <div className="w-2.5 h-2.5 rounded-full bg-accent-green shadow-[0_0_0_4px_rgba(0,255,128,0.15)]" title="Connected" />
            <div className="font-mono text-xs truncate flex-1" title={address}>{address}</div>
            <button
              className="text-[11px] px-2 py-1 rounded-md border border-accent-blue/40 text-accent-blue hover:bg-accent-blue/10 transition"
              onClick={() => { navigator.clipboard.writeText(address); toast.push({ type:'success', msg:'Address copied'}); }}
              aria-label="Copy address"
            >Copy</button>
            <button
              className="text-[11px] px-2 py-1 rounded-md border border-accent-red/50 text-accent-red hover:bg-accent-red/10 transition"
              onClick={() => { reset(); toast.push({ type:'info', msg:'Disconnected'}); }}
              aria-label="Disconnect"
            >Off</button>
          </div>
          <div className="flex gap-3 flex-wrap items-center">
            <Button onClick={login} variant="outline" disabled={loading} loading={loading}>
              {loading ? 'Authenticating' : 'Login'}
            </Button>
            {error && <span className="text-xs text-accent-red font-medium">{error}</span>}
          </div>
        </div>
      )}
    </section>
  );
};
