import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { apiUrl } from '../api/base';
import { useAuthStore } from '../state/auth';
import { useToastStore } from '../state/toastHost';
import { useNetworkStore } from '../state/network';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Icon } from '../components/icons';

interface ProfileResponse {
  address: string;
  role: string;
  role_value: number | null;
  has_public_key: boolean;
  public_key_pem?: string;
}

interface BaseShare {
  share_id: string;
  file_id: string;
  owner: string;
  recipient: string;
  note?: string | null;
  created_at?: number;
  expires_at?: number | null;
  file_name?: string;
  file_size?: number;
  sha256?: string;
  cid?: string | null;
  gateway_url?: string | null;
}

interface IncomingShare extends BaseShare {
  encrypted_key?: string | null;
}

interface OutgoingShare extends BaseShare {}

const fmtDate = (value?: number | null) => {
  if (!value) return '—';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString();
  } catch {
    return '—';
  }
};

const fmtSize = (size?: number) => {
  if (!size || size <= 0) return '—';
  if (size < 1024) return `${size} B`;
  const kb = size / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

export const SharingSection: React.FC = () => {
  const { jwt } = useAuthStore();
  const toast = useToastStore();
  // Select only needed network store actions to keep stable references and
  // avoid re-creating callbacks/effects on unrelated state changes.
  const incNet = useNetworkStore(s => s.inc);
  const decNet = useNetworkStore(s => s.dec);

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [incoming, setIncoming] = useState<IncomingShare[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingShare[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  // Incoming share download modal (Option A implementation)
  const [dlModal, setDlModal] = useState<{ open: boolean; share?: IncomingShare }>(() => ({ open: false }));
  const [dlPass, setDlPass] = useState('');

  const authorizedHeaders = useMemo(() => ({ headers: { Authorization: `Bearer ${jwt}` } }), [jwt]);

  const loadAll = useCallback(async () => {
    if (!jwt) return;
    setLoading(true);
    incNet();
    try {
      const [profileRes, incomingRes, outgoingRes] = await Promise.all([
        axios.get(apiUrl('/users/profile?with_key=1'), authorizedHeaders),
        axios.get(apiUrl('/files/shared'), authorizedHeaders),
        axios.get(apiUrl('/files/shares/outgoing'), authorizedHeaders),
      ]);
      setProfile(profileRes.data);
      if (profileRes.data?.public_key_pem) {
        setKeyInput(profileRes.data.public_key_pem);
      }
      setIncoming(incomingRes.data?.shares ?? []);
      setOutgoing(outgoingRes.data?.shares ?? []);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || 'Failed to load sharing data';
      toast.push({ type: 'error', msg });
    } finally {
      decNet();
      setLoading(false);
    }
  }, [authorizedHeaders, jwt, incNet, decNet, toast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    const handler = () => loadAll();
    window.addEventListener('blockvault_share_changed', handler);
    return () => window.removeEventListener('blockvault_share_changed', handler);
  }, [loadAll]);

  if (!jwt) return null;

  const saveKey = async () => {
    const pem = keyInput.trim();
    if (!pem) {
      toast.push({ type: 'error', msg: 'Paste a PEM-formatted public key first' });
      return;
    }
    setSavingKey(true);
  incNet();
    try {
      await axios.post(apiUrl('/users/public_key'), { public_key_pem: pem }, authorizedHeaders);
      toast.push({ type: 'success', msg: 'Public key saved' });
      await loadAll();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || 'Failed to save key';
      toast.push({ type: 'error', msg });
    } finally {
  decNet();
      setSavingKey(false);
    }
  };

  const deleteKey = async () => {
    if (!profile?.has_public_key) return;
    if (!confirm('Remove your registered public key? Shares sent to you will stop working.')) return;
    setSavingKey(true);
  incNet();
    try {
      await axios.delete(apiUrl('/users/public_key'), authorizedHeaders);
      toast.push({ type: 'success', msg: 'Public key removed' });
      setKeyInput('');
      await loadAll();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || 'Failed to remove key';
      toast.push({ type: 'error', msg });
    } finally {
  decNet();
      setSavingKey(false);
    }
  };

  const revokeShare = async (share: OutgoingShare) => {
    if (!confirm(`Revoke access for ${share.recipient}?`)) return;
  incNet();
    try {
      await axios.delete(apiUrl(`/files/shares/${share.share_id}`), authorizedHeaders);
      toast.push({ type: 'info', msg: 'Share revoked' });
      window.dispatchEvent(new CustomEvent('blockvault_share_changed'));
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || 'Failed to revoke share';
      toast.push({ type: 'error', msg });
    } finally {
      decNet();
    }
  };

  const copy = (text?: string | null) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      toast.push({ type: 'success', msg: 'Copied to clipboard' });
    }).catch(() => {
      toast.push({ type: 'error', msg: 'Copy failed' });
    });
  };

  const openDownload = (share: IncomingShare) => {
    setDlPass('');
    setDlModal({ open: true, share });
  };

  const doDownload = async (share: IncomingShare, passphrase: string) => {
    const fid = share.file_id;
    const name = share.file_name || fid;
    incNet();
    try {
      const url = apiUrl(`/files/${fid}?key=${encodeURIComponent(passphrase)}`);
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` } });
      if (!resp.ok) {
        let msg = `Download failed (${resp.status})`;
        try { const j = await resp.json(); if (j?.error) msg = j.error; } catch {}
        if (resp.status === 400) msg = 'Bad / incorrect passphrase';
        if (resp.status === 404) msg = 'File not found or share invalid';
        if (resp.status === 410) msg = 'Encrypted blob missing on server';
        toast.push({ type: 'error', msg });
        return;
      }
      const blob = await resp.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.push({ type: 'success', msg: 'Downloaded' });
    } catch (e: any) {
      toast.push({ type: 'error', msg: 'Download error' });
    } finally {
      decNet();
    }
  };

  const submitDownload = async () => {
    if (!dlModal.share) return;
    const pass = dlPass.trim();
    if (!pass) { toast.push({ type: 'error', msg: 'Passphrase required' }); return; }
    await doDownload(dlModal.share, pass);
    setDlModal({ open: false });
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="share" size={18} className="text-accent-blue" />
          <h2 className="text-base font-semibold tracking-tight">Sharing Center</h2>
        </div>
        <Button size="sm" variant="secondary" onClick={loadAll} disabled={loading}>Refresh</Button>
      </div>

      <div className="p-4 rounded-xl border border-border/50 bg-background-tertiary/40 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <Icon name="user" size={18} className="text-accent-blue" />
            <div>
              <div className="font-medium text-text-primary">{profile?.address ?? '—'}</div>
              <div className="text-[11px] uppercase tracking-wider text-text-secondary/60">Role: {profile?.role ?? 'unknown'}</div>
            </div>
          </div>
          {profile?.has_public_key && (
            <span className="px-2 py-1 text-[11px] rounded-full bg-accent-blue/10 border border-accent-blue/40 text-accent-blue">Key registered</span>
          )}
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text-secondary/80 font-medium tracking-tight">RSA Public Key (PEM)</span>
          <textarea
            value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
            rows={6}
            className="font-mono text-[13px] tracking-tight w-full resize-none px-3 py-2 rounded-md bg-background-tertiary/70 border border-border/60 focus:border-accent-blue/80 focus:ring-2 focus:ring-accent-blue/40 outline-none transition text-text-primary placeholder:text-text-secondary/40"
            placeholder="-----BEGIN PUBLIC KEY-----"
          />
        </label>
        <div className="flex gap-2">
          <Button size="sm" variant="primary" onClick={saveKey} loading={savingKey} disabled={savingKey}>Save key</Button>
          <Button size="sm" variant="danger" onClick={deleteKey} disabled={!profile?.has_public_key || savingKey}>Remove</Button>
        </div>
        <p className="text-[11px] text-text-secondary/70 leading-relaxed flex items-start gap-2">
          <Icon name="info" size={14} className="text-accent-blue mt-0.5" />
          Paste the recipient-facing RSA public key. The backend encrypts shared passphrases with this key so only you can decrypt them.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <Icon name="lock" size={16} className="text-accent-blue" />
          Shares received
        </div>
        <div className="space-y-3 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
          {incoming.length === 0 && (
            <div className="text-[12px] text-text-secondary/60 border border-dashed border-border/50 rounded-lg p-4 text-center">
              No incoming shares yet.
            </div>
          )}
          {incoming.map(share => (
            <div key={share.share_id} className="p-3 rounded-lg border border-border/40 bg-background-tertiary/30 space-y-2">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="text-sm font-medium text-text-primary">{share.file_name ?? share.file_id}</div>
                  <div className="text-[11px] text-text-secondary/60">From {share.owner}</div>
                </div>
                <div className="text-[11px] text-text-secondary/60 flex items-center gap-1">
                  <Icon name="clock" size={12} className="text-text-secondary/40" />
                  {fmtDate(share.expires_at)}
                </div>
              </div>
              {share.note && <div className="text-[11px] text-text-secondary/80 italic">“{share.note}”</div>}
              <div className="text-[11px] text-text-secondary/70 flex flex-wrap gap-2">
                <span>Size: {fmtSize(share.file_size)}</span>
                <span>SHA256: <button className="underline decoration-dotted" onClick={() => copy(share.sha256)}>copy</button></span>
              </div>
              <div className="text-[11px] text-text-secondary/80 bg-background-secondary/60 border border-border/40 rounded-md p-2 font-mono break-all">
                {share.encrypted_key ?? '—'}
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => copy(share.encrypted_key)} leftIcon={<Icon name="copy" size={12} />}>Copy</Button>
                <Button size="sm" variant="primary" onClick={() => openDownload(share)} leftIcon={<Icon name="download" size={12} />}>Download</Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <Icon name="share" size={16} className="text-accent-blue" />
          Shares you sent
        </div>
        <div className="space-y-3 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
          {outgoing.length === 0 && (
            <div className="text-[12px] text-text-secondary/60 border border-dashed border-border/50 rounded-lg p-4 text-center">
              You have not shared any files yet.
            </div>
          )}
          {outgoing.map(share => (
            <div key={share.share_id} className="p-3 rounded-lg border border-border/40 bg-background-tertiary/30 space-y-2">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="text-sm font-medium text-text-primary">{share.file_name ?? share.file_id}</div>
                  <div className="text-[11px] text-text-secondary/60">To {share.recipient}</div>
                </div>
                <div className="flex flex-col items-end text-[11px] text-text-secondary/60">
                  <span>Created {fmtDate(share.created_at)}</span>
                  <span>Expires {fmtDate(share.expires_at)}</span>
                </div>
              </div>
              {share.note && <div className="text-[11px] text-text-secondary/80 italic">“{share.note}”</div>}
              <div className="flex justify-end">
                <Button size="sm" variant="danger" onClick={() => revokeShare(share)}>Revoke</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Modal
        open={dlModal.open}
        onClose={() => setDlModal({ open: false })}
        title={`Download ${dlModal.share?.file_name || dlModal.share?.file_id || ''}`.trim()}
        footer={<>
          <Button size="sm" variant="secondary" onClick={() => setDlModal({ open: false })}>Cancel</Button>
          <Button size="sm" variant="primary" onClick={submitDownload}>Download</Button>
        </>}
      >
        <div className="space-y-3">
          <p className="text-[11px] leading-relaxed">
            1. Copy the encrypted key from the share card. 2. Decrypt it locally with your RSA private key (offline or CLI). 3. Paste the resulting plaintext passphrase below to retrieve the file.
          </p>
          <Input data-autofocus label="Decrypted passphrase" value={dlPass} onChange={e => setDlPass(e.target.value)} placeholder="plaintext passphrase" revealToggle />
          <p className="text-[10px] text-text-secondary/60">We never store this passphrase; it is sent once to derive the file contents.</p>
        </div>
      </Modal>
    </section>
  );
};
