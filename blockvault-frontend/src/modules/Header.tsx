import React, { useCallback, useEffect, useState } from 'react';
import { Logo } from '../components/Logo';
import { useAuthStore } from '../state/auth';
import { Button } from '../components/ui/Button';
import { useToastStore } from '../state/toastHost';
import { ethers } from 'ethers';
import axios from 'axios';
import { apiUrl } from '../api/base';
import { usePlatformStore, platformLabel } from '../state/platform';

export const Header: React.FC = () => {
  const { address, jwt, setAddress, setJwt, loading, setLoading, reset } = useAuthStore();
  const { load, mode } = usePlatformStore();
  const toast = useToastStore();
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    try {
      setError(null);
      if (!(window as any).ethereum) {
        setError('MetaMask not detected');
        toast.push({ type: 'error', msg: 'MetaMask not detected' });
        return;
      }
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      if (!accounts.length) return;
      setAddress(accounts[0]);
      toast.push({ type: 'success', msg: 'Wallet connected' });
    } catch (e: any) {
      const msg = e.message || 'Failed to connect';
      setError(msg);
      toast.push({ type: 'error', msg });
    }
  }, [setAddress, toast]);

  const login = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const nonceResp = await axios.post(apiUrl('/auth/get_nonce'), { address });
      const message = nonceResp.data.message;
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const signature = await signer.signMessage(message);
      const loginResp = await axios.post(apiUrl('/auth/login'), { address, signature });
      setJwt(loginResp.data.token);
      toast.push({ type: 'success', msg: 'Authenticated' });
    } catch (e: any) {
      let msg = e.response?.data?.error || e.message || 'Login failed';
      const data = e.response?.data;
      if (typeof data === 'string' && data.toLowerCase().includes('<!doctype')) {
        msg = 'Proxy misconfigured (HTML received)';
      }
      setError(msg);
      toast.push({ type: 'error', msg });
    } finally {
      setLoading(false);
    }
  }, [address, setJwt, setLoading, toast]);

  useEffect(() => { load(); }, [load]);

  return (
    <header className="w-full flex items-center justify-between py-4 px-4 md:px-8 relative z-10">
      <div className="flex items-center gap-4">
        <Logo size={42} text />
        <span className="text-xs text-text-secondary/70 tracking-wide">Encrypted Vault ({platformLabel(mode)})</span>
      </div>
      <div className="flex items-center gap-2">
        {!address && (
          <Button size="sm" variant="primary" onClick={connect}>
            Connect Wallet
          </Button>
        )}
        {address && !jwt && (
          <>
            <span className="hidden md:inline text-[11px] font-mono px-2 py-1 rounded-md bg-background-tertiary/60 border border-border/50 max-w-[140px] truncate" title={address}>{address}</span>
            <Button size="sm" variant="outline" onClick={login} disabled={loading} loading={loading}>{loading ? 'Signing' : 'Login'}</Button>
            <Button size="sm" variant="ghost" onClick={()=>{ reset(); toast.push({ type:'info', msg:'Disconnected'}); }}>X</Button>
          </>
        )}
        {address && jwt && (
          <>
            <span className="text-[11px] font-mono px-2 py-1 rounded-md bg-background-tertiary/60 border border-border/50 max-w-[140px] truncate" title={address}>{address}</span>
            <Button size="sm" variant="danger" onClick={()=>{ reset(); toast.push({ type:'info', msg:'Session cleared'}); }}>Logout</Button>
          </>
        )}
        {error && !jwt && (
          <span className="text-[10px] text-accent-red font-medium max-w-[120px] truncate" title={error}>{error}</span>
        )}
      </div>
    </header>
  );
};
