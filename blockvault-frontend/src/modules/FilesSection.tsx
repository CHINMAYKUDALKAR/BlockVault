import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { apiUrl } from '../api/base';
import { useToastStore } from '../state/toastHost';
import { useAuthStore } from '../state/auth';
import { Button } from '../components/ui/Button';
import { FileCard, BVFileItem } from '../components/ui/FileCard';

const API_BASE = process.env.REACT_APP_API_BASE || '';// kept for compatibility but dynamic apiUrl used

interface FileItem extends BVFileItem {}

export const FilesSection: React.FC = () => {
  const { jwt } = useAuthStore();
  const toast = useToastStore();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const removeFile = (fid: string) => setFiles(prev => prev.filter(f => f.file_id !== fid));

  const load = async () => {
    if (!jwt) return;
    setLoading(true);
  try {
	  const resp = await axios.get(apiUrl('/files?limit=100'), { headers: { Authorization: `Bearer ${jwt}` } });
      setFiles(resp.data.items);
    } catch (e: any) {
      setError(e.response?.data?.error || e.message);
      toast.push({ type: 'error', msg: 'Failed to load files' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [jwt]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener('blockvault_upload_done', h);
    return () => window.removeEventListener('blockvault_upload_done', h);
  }, [jwt]);

  if (!jwt) return null;

  const handleDownload = async (f: FileItem) => {
    const pass = prompt('Enter passphrase to decrypt/download');
    if(!pass) return;
    try {
      const url = apiUrl(`/files/${f.file_id}?key=${encodeURIComponent(pass)}`);
      const r = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` }});
      if(!r.ok){
        try {
          const j = await r.json();
          if(r.status === 400) {
            toast.push({type:'error', msg: j.error || 'Bad passphrase'});
          } else if (r.status === 404) {
            toast.push({type:'error', msg: 'File not found (stale entry?)'});
            removeFile(f.file_id);
          } else if (r.status === 410) {
            toast.push({type:'error', msg: 'Encrypted blob missing'});
          } else {
            toast.push({type:'error', msg: j.error || `Download failed (${r.status})`});
          }
        } catch {
          toast.push({type:'error', msg:`Download failed (${r.status})`});
        }
        return;
      }
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = f.name;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.push({ type:'success', msg:'Downloaded' });
    } catch(e:any){ toast.push({type:'error', msg:'Download error'}); }
  };

  const handleDelete = async (f: FileItem) => {
    if(!confirm('Delete this file?')) return;
    try {
      await axios.delete(apiUrl(`/files/${f.file_id}`), { headers: { Authorization: `Bearer ${jwt}` }});
      toast.push({ type:'success', msg:'Deleted' });
      load();
    } catch(e:any){ toast.push({type:'error', msg:'Delete failed'}); }
  };

  const handleVerify = async (f: FileItem) => {
    try {
      const vr = await axios.get(apiUrl(`/files/${f.file_id}/verify`), { headers: { Authorization: `Bearer ${jwt}` }});
      toast.push({ type:'info', msg: vr.data.has_encrypted_blob ? 'Blob present' : 'Blob missing' });
    } catch(e:any){
      const status = e?.response?.status;
      if(status === 404){
        toast.push({type:'error', msg:'File not found (removed or server restarted)'});
        removeFile(f.file_id);
      } else {
        toast.push({type:'error', msg:'Verify failed'});
      }
    }
  };

  const skeletons = Array.from({ length: 5 }).map((_,i) => (
    <div key={i} className="p-4 rounded-xl border border-border/30 bg-background-tertiary/20 animate-pulse flex flex-col gap-3">
      <div className="h-3 w-1/2 bg-background-tertiary/60 rounded" />
      <div className="h-2 w-1/3 bg-background-tertiary/50 rounded" />
      <div className="h-2 w-5/6 bg-background-tertiary/40 rounded" />
    </div>
  ));

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold tracking-tight">Your Files</h2>
        <Button size="sm" variant="secondary" onClick={load} disabled={loading}>Refresh</Button>
      </div>
      {error && <div className="text-xs text-accent-red">{error}</div>}
      <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1 scrollbar-thin">
        {loading && skeletons}
        {!loading && files.map(f => (
          <FileCard
            key={f.file_id}
            f={f}
            onDownload={() => handleDownload(f)}
            onDelete={() => handleDelete(f)}
            onVerify={() => handleVerify(f)}
            onCopyCid={() => { if(f.cid) { navigator.clipboard.writeText(f.cid); toast.push({type:'success', msg:'CID copied'});} }}
            onCopyHash={() => { navigator.clipboard.writeText(f.sha256); toast.push({type:'success', msg:'Hash copied'});} }
          />
        ))}
        {!loading && !files.length && (
          <div className="flex flex-col items-center justify-center text-center py-16 gap-4 border border-dashed border-border/50 rounded-2xl bg-background-tertiary/20">
            <div className="w-16 h-16 rounded-2xl bg-background-tertiary/40 flex items-center justify-center text-3xl">📁</div>
            <div className="space-y-1">
              <div className="text-sm font-medium text-text-primary">Your encrypted files will appear here</div>
              <div className="text-[11px] text-text-secondary/60">Upload a file to begin</div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
