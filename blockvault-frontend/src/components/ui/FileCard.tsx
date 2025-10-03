import React, { useState } from 'react';
import { Button } from './Button';

export interface BVFileItem {
  file_id: string;
  name: string;
  size: number;
  created_at: number;
  cid?: string | null;
  gateway_url?: string | null;
  sha256: string;
}

interface FileCardProps {
  f: BVFileItem;
  onDownload: () => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onVerify: () => Promise<void> | void;
  onCopyCid?: () => void;
  onCopyHash?: () => void;
  compact?: boolean;
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(2)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export const FileCard: React.FC<FileCardProps> = ({ f, onDownload, onDelete, onVerify, onCopyCid, onCopyHash, compact }) => {
  const [expanded, setExpanded] = useState(!compact);
  return (
    <div className="group relative p-4 rounded-xl border border-border/40 bg-background-tertiary/30 backdrop-blur-sm hover:border-accent-blue/60 hover:shadow-[0_0_0_1px_#00C0FF] transition grid grid-cols-[auto_1fr_auto] gap-4 items-start">
      <div className="w-10 h-10 rounded-lg bg-accent-blue/10 border border-accent-blue/30 flex items-center justify-center text-accent-blue text-xs font-bold">{f.name.split('.').pop()?.slice(0,4).toUpperCase()}</div>
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-2">
          <div className="font-medium text-sm truncate max-w-[220px] text-text-primary" title={f.name}>{f.name}</div>
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-background-tertiary/60 border border-border/40 text-text-secondary/70">{fmtSize(f.size)}</span>
        </div>
        {expanded && (
          <div className="mt-1 space-y-1">
            <div className="text-[11px] font-mono break-all text-text-secondary/80 flex items-center gap-1">
              <span className="text-text-secondary/50">CID:</span>
              {f.cid ? <button className="hover:text-accent-blue truncate" onClick={onCopyCid} title="Copy CID">{f.cid}</button> : '—'}
            </div>
            {f.gateway_url && <a className="text-[11px] text-accent-blue/90 hover:underline break-all" href={f.gateway_url} target="_blank" rel="noreferrer">Gateway</a>}
            <div className="text-[10px] font-mono break-all text-text-secondary/70 flex items-center gap-1">
              <span className="text-text-secondary/50">SHA256:</span>
              <button className="hover:text-accent-blue" onClick={onCopyHash} title="Copy SHA256">{f.sha256}</button>
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-col items-end gap-2">
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={onDownload} title="Download" leftIcon={<span>⬇️</span>} />
          <Button size="sm" variant="danger" onClick={onDelete} title="Delete" leftIcon={<span>🗑️</span>} />
          <Button size="sm" variant="secondary" onClick={onVerify} title="Verify" leftIcon={<span>✔️</span>} />
          <button
            className="text-[10px] text-text-secondary hover:text-accent-blue ml-1 px-1"
            onClick={() => setExpanded(e => !e)}
            title="Toggle details"
          >{expanded ? '−' : '+'}</button>
        </div>
      </div>
    </div>
  );
};
