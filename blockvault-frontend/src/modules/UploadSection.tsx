import React, { useState } from 'react';
import axios from 'axios';
import { apiUrl } from '../api/base';
import { useAuthStore } from '../state/auth';
import { useToastStore } from '../state/toastHost';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ProgressBar } from '../components/ui/ProgressBar';
import { DragDrop } from '../components/ui/DragDrop';
import { useNetworkStore } from '../state/network';
import { Icon } from '../components/icons';

const API_BASE = process.env.REACT_APP_API_BASE || '';

export const UploadSection: React.FC = () => {
  const { jwt } = useAuthStore();
  const [file, setFile] = useState<File | null>(null);
  const [key, setKey] = useState('pass-phrase');
  const [aad, setAad] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const toast = useToastStore();
  const net = useNetworkStore();

  const upload = async () => {
    if (!file || !jwt) return;
    setStatus(null);
    const form = new FormData();
    form.append('file', file);
    form.append('key', key);
    if (aad) form.append('aad', aad);
    try {
        net.inc();
        const resp = await axios.post(apiUrl('/files'), form, {
        headers: { Authorization: `Bearer ${jwt}` },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        }
      }).finally(net.dec);
      setStatus(`Uploaded: ${resp.data.file_id}`);
      toast.push({ type:'success', msg:'Upload complete' });
      // Dispatch custom event for file list refresh
      window.dispatchEvent(new CustomEvent('blockvault_upload_done'));
    } catch (e: any) {
      setStatus(e.response?.data?.error || e.message);
      toast.push({ type:'error', msg:'Upload failed' });
    }
  };

  return (
    <section className="space-y-6">
      <div className="space-y-4">
        <DragDrop onFile={(f) => { setFile(f); }} disabled={!jwt} />
        {file && (
          <div className="text-xs text-text-secondary/80 flex items-center gap-2">
            <span className="font-medium text-text-primary">Selected:</span>
            <span className="truncate max-w-[240px]">{file.name}</span>
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary/50 text-xs"><Icon name="lock" size={14} /></span>
            <Input label="Passphrase" value={key} onChange={e => setKey(e.target.value)} placeholder="encryption key" revealToggle className="pl-8" />
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary/50 text-xs"><Icon name="info" size={14} /></span>
            <Input label="AAD (optional)" value={aad} onChange={e => setAad(e.target.value)} placeholder="associated data" className="pl-8" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Button onClick={upload} disabled={!file} variant="primary" loading={progress>0 && progress<100} leftIcon={<Icon name="shield" size={16} className="text-accent-blue" />}>Encrypt & Upload</Button>
          {progress > 0 && progress < 100 && <div className="text-xs text-text-secondary/70 w-32">{progress}%</div>}
        </div>
        {progress > 0 && <ProgressBar value={progress} />}
        {status && <div className="text-xs font-mono text-text-secondary/80 break-all">{status}</div>}
      </div>
    </section>
  );
};
