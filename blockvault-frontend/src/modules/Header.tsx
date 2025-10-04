import React, { useState, useCallback, useEffect } from 'react';
import { useAuthStore } from '../state/auth';
import { Logo } from '../components/Logo';
// Diagnostics removed from UI
import { Button } from '../components/ui/Button';
import { ethers } from 'ethers';
import axios from 'axios';
import { apiUrl } from '../api/base';
import { useNetworkStore } from '../state/network';
import { useToastStore } from '../state/toastHost';

function truncate(addr?: string, head = 6, tail = 4) {
  if (!addr) return '';
  if (addr.length <= head + tail + 2) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export const Header: React.FC = () => {
  const { address, setAddress, setJwt, loading, setLoading, reset } = useAuthStore();
  const net = useNetworkStore();
  const [copied, setCopied] = useState(false);
  const [devAddr, setDevAddr] = useState('');
  const [iframe, setIframe] = useState(false);
  const [chainId, setChainId] = useState<string | null>(null);
  const [diagOpen, setDiagOpen] = useState(false);
  const [accountsSnap, setAccountsSnap] = useState<string[]>([]);
  // API health removed from display
  const toast = useToastStore();

  // healthColor removed

  const copy = () => {
    if (!address) return;
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }).catch(() => {});
  };

  useEffect(() => {
    try { setIframe(window.top !== window.self); } catch { setIframe(true); }
    const eth = (window as any).ethereum;
    if (eth?.request) {
      eth.request({ method: 'eth_chainId' }).then((cid:string) => setChainId(cid)).catch(()=>{});
      eth.request({ method: 'eth_accounts' }).then((accs:string[]) => setAccountsSnap(accs||[])).catch(()=>{});
    }
    if (eth?.on) {
      const handleAccounts = (accs: string[]) => {
        if (accs && accs.length) {
          try { setAddress(ethers.getAddress(accs[0])); } catch { /* ignore */ }
        }
      };
      const handleChain = (cid: string) => setChainId(cid);
      eth.on('accountsChanged', handleAccounts);
      eth.on('chainChanged', handleChain);
      // Periodic refresh of accounts snapshot for diagnostics (dev only)
      const poll = setInterval(()=>{
        eth.request({ method:'eth_accounts'}).then((a:string[])=> setAccountsSnap(a||[])).catch(()=>{});
      }, 6000);
      return () => {
        try {
          eth.removeListener?.('accountsChanged', handleAccounts);
          eth.removeListener?.('chainChanged', handleChain);
          clearInterval(poll);
        } catch { /* noop */ }
      };
    }
  }, []);

  const connect = useCallback(async () => {
    const eth = (window as any).ethereum;
    if (!eth) { toast.push({ type:'error', msg:'MetaMask not detected'}); return; }
    try {
      // Handle already pending request error (-32002) gracefully
      const req = eth.request ? eth.request({ method: 'eth_requestAccounts' }) : null;
      const accounts: string[] = req ? await req : await new ethers.BrowserProvider(eth).send('eth_requestAccounts', []);
      if (!accounts || !accounts.length) {
        toast.push({ type:'error', msg:'No accounts returned'});
        return;
      }
      const acc = ethers.getAddress(accounts[0]);
      setAddress(acc);
      // Optional chain enforcement
      const targetChain = (process.env.REACT_APP_CHAIN_ID || '').trim(); // hex like 0x1
      if (targetChain) {
        try {
          const current = await eth.request({ method: 'eth_chainId' });
          if (current && targetChain && current.toLowerCase() !== targetChain.toLowerCase()) {
            toast.push({ type:'info', msg:`Switching chain to ${targetChain}` });
            try {
              await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: targetChain }] });
            } catch (switchErr: any) {
              if (switchErr?.code === 4902) {
                toast.push({ type:'error', msg:'Chain not added to MetaMask'});
              } else {
                toast.push({ type:'error', msg: switchErr?.message || 'Chain switch failed' });
              }
            }
          }
        } catch { /* ignore chain query errors */ }
      }
      toast.push({ type:'success', msg:'Wallet connected'});
    } catch (e:any) {
      // MetaMask specific error codes
      if (e?.code === 4001) {
        toast.push({ type:'error', msg:'Connection request rejected' });
      } else if (e?.code === -32002) {
        toast.push({ type:'info', msg:'Connection request already pending in MetaMask'});
      } else if (/already processing/i.test(e?.message || '')) {
        toast.push({ type:'info', msg:'MetaMask already processing a request'});
      } else if (/locked/i.test(e?.message || '')) {
        toast.push({ type:'error', msg:'Unlock MetaMask then retry'});
      } else {
        toast.push({ type:'error', msg: e?.message || 'Connect failed'});
      }
      console.error('[auth] connect error', e);
    }
  }, [setAddress, toast]);

  const login = useCallback(async () => {
    if (!address) {
      // Attempt a silent fetch of accounts (may trigger prompt if not previously granted)
      const eth = (window as any).ethereum;
      if (eth?.request) {
        try {
          const accs: string[] = await eth.request({ method: 'eth_requestAccounts' });
          if (accs && accs.length) {
            try { setAddress(ethers.getAddress(accs[0])); } catch {}
          } else {
            toast.push({ type:'error', msg:'No accounts returned'});
            return;
          }
        } catch (e:any) {
          if (e?.code === 4001) {
            toast.push({ type:'error', msg:'User rejected account access'});
          } else if (e?.code === -32002) {
            toast.push({ type:'info', msg:'Connection request already pending'});
          } else {
            toast.push({ type:'error', msg: e?.message || 'Account request failed'});
          }
          return;
        }
      } else {
        toast.push({ type:'error', msg:'Connect wallet first'});
        return;
      }
    }
    // If no ethereum provider present, attempt dev token fallback.
    if (!(window as any).ethereum) {
      console.warn('[auth] No ethereum provider; attempting /auth/dev_token fallback (dev only)');
      setLoading(true);
      try {
        net.inc();
        const r = await axios.get(apiUrl(`/auth/dev_token?address=${address}`)).finally(net.dec);
        if (r.data?.token) {
          setJwt(r.data.token);
          toast.push({ type:'success', msg:'Dev token issued'});
          return;
        }
        toast.push({ type:'error', msg:'Dev token not available'});
      } catch(e:any){
        toast.push({ type:'error', msg: e.response?.data?.error || e.message || 'Dev token failed'});
      } finally { setLoading(false); }
      return;
    }
    setLoading(true);
    try {
      console.debug('[auth] request nonce for', address);
      toast.push({ type:'info', msg:'Requesting nonce…'});
      net.inc();
      const nonceResp = await axios.post(apiUrl('/auth/get_nonce'), { address }).finally(net.dec);
      const message = nonceResp.data.message;
      console.debug('[auth] nonce received, signing');
      toast.push({ type:'info', msg:'Signing message…'});
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      let signer;
      try {
        signer = await provider.getSigner();
      } catch (e:any) {
        toast.push({ type:'error', msg: e?.message || 'Failed to get signer' });
        setLoading(false); return;
      }
      let signature: string;
      try {
        signature = await signer.signMessage(message);
      } catch (e:any) {
        if (e?.code === 4001) {
          toast.push({ type:'error', msg:'User rejected signature'});
        } else if (/already processing/i.test(e?.message || '')) {
          toast.push({ type:'info', msg:'Signature request already pending in MetaMask'});
        } else {
          toast.push({ type:'error', msg: e?.message || 'Signature failed'});
        }
        setLoading(false); return;
      }
      console.debug('[auth] signature obtained, logging in');
      toast.push({ type:'info', msg:'Submitting signature…'});
      net.inc();
      const loginResp = await axios.post(apiUrl('/auth/login'), { address, signature }).finally(net.dec);
      setJwt(loginResp.data.token);
      toast.push({ type:'success', msg:'Logged in'});
    } catch (e:any) {
      console.error('[auth] login error', e);
      toast.push({ type:'error', msg: e.response?.data?.error || e.message || 'Login failed'});
    } finally { setLoading(false); }
  }, [address, setAddress, setJwt, setLoading, toast, net]);

  const setDevAddress = () => {
    const v = devAddr.trim();
    if(!/^0x[a-fA-F0-9]{40}$/.test(v)) { toast.push({type:'error', msg:'Invalid address format'}); return; }
    setAddress(v);
    toast.push({ type:'success', msg:'Dev address set'});
  };

  return (
    <header className="w-full flex items-center justify-between py-4 px-4 md:px-8 relative z-10">
      <div className="flex items-center gap-4">
        <Logo size={42} text />
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {!address && (window as any).ethereum && (
          <Button size="sm" variant="primary" onClick={connect}>Connect</Button>
        )}
        {!address && !(window as any).ethereum && (
          <div className="flex items-center gap-2">
            <input
              value={devAddr}
              onChange={e=>setDevAddr(e.target.value)}
              placeholder="0xDevAddress"
              className="px-2 py-1 text-xs font-mono rounded-md bg-background-tertiary/60 border border-border/50 focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue outline-none"
              style={{width:'170px'}}
            />
            <Button size="sm" variant="secondary" onClick={setDevAddress}>Set Address</Button>
          </div>
        )}
        {address && (
          <>
            <button
              onClick={copy}
              className="relative group text-xs font-mono tracking-tight px-3 py-1 rounded-md border border-accent-blue/40 bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20 hover:shadow-[0_0_0_1px_#00C0FF] transition"
              title="Copy full address"
            >
              {truncate(address)}
              <span className={`absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-normal px-2 py-0.5 rounded-md bg-accent-blue/90 text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`}>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
            <Button size="sm" variant="outline" onClick={login} loading={loading} disabled={loading} aria-busy={loading} aria-label="Login with signed message or dev token">{(window as any).ethereum ? 'Login' : 'Dev Login'}</Button>
            <Button size="sm" variant="danger" onClick={()=>{ reset(); toast.push({ type:'info', msg:'Disconnected'}); }}>Logout</Button>
          </>
        )}
      </div>
      {(iframe || !(window as any).ethereum) && (
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-6 mt-1 text-[10px] px-2 py-1 rounded bg-accent-red/20 border border-accent-red/40 text-accent-red flex items-center gap-2">
          {iframe ? 'Running in iframe: open in external tab for MetaMask.' : 'No provider detected. Using dev token path.'}
          {chainId && <span className="text-accent-blue">chain {chainId}</span>}
        </div>
      )}
      <button
        onClick={()=>setDiagOpen(o=>!o)}
        className="absolute top-full mt-2 right-4 text-[10px] px-2 py-1 rounded bg-background-tertiary/60 border border-border/50 hover:border-accent-blue/60 hover:text-accent-blue transition"
      >{diagOpen? 'Hide Diagnostics':'Show Diagnostics'}</button>
      {diagOpen && (
        <div className="absolute top-full right-4 mt-10 w-80 p-3 rounded-md bg-background-secondary/80 backdrop-blur border border-border/60 text-[11px] space-y-2 shadow-lg max-h-96 overflow-auto">
          <div className="font-semibold text-text-primary/80">Diagnostics</div>
          <div className="grid grid-cols-3 gap-x-2 gap-y-1">
            <span className="text-text-secondary/60">iframe</span><span className="col-span-2">{String(iframe)}</span>
            <span className="text-text-secondary/60">provider</span><span className="col-span-2">{(window as any).ethereum? 'detected':'missing'}</span>
            <span className="text-text-secondary/60">chainId</span><span className="col-span-2">{chainId || '—'}</span>
            <span className="text-text-secondary/60">accounts</span><span className="col-span-2 break-all">{accountsSnap.length? accountsSnap.join(', '): '[]'}</span>
            <span className="text-text-secondary/60">addr (state)</span><span className="col-span-2 break-all">{address || '—'}</span>
          </div>
          <div className="space-y-1">
            <div className="text-text-secondary/70 leading-snug">If provider is missing, open this URL in a normal desktop browser (Chrome/Brave) with MetaMask installed. Codespaces preview iframing blocks injection.</div>
            <div className="text-text-secondary/70 leading-snug">If accounts array is empty after Connect, unlock MetaMask and retry.</div>
            <div className="text-text-secondary/70 leading-snug">If a request is already pending, open the MetaMask popup manually.</div>
          </div>
        </div>
      )}
    </header>
  );
};
