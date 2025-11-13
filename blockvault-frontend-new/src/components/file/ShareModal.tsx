import React, { useState, useEffect, useCallback } from 'react';
import { User, Lock, AlertCircle, Copy, Check, Key, Share2 } from 'lucide-react';
import { useFiles } from '@/contexts/FileContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { rsaKeyManager } from '@/lib/crypto/rsa';
import toast from 'react-hot-toast';
import { LegalModalFrame } from '@/components/legal/modals/LegalModalFrame';

interface ShareModalProps {
  fileId: string;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ fileId, onClose }) => {
  const { shareFile, loading } = useFiles();
  const [recipientAddress, setRecipientAddress] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [copiedPassphrase, setCopiedPassphrase] = useState(false);
  const [copiedFileId, setCopiedFileId] = useState(false);
  const [hasRSAKeys, setHasRSAKeys] = useState(false);
  const [isPublicKeyRegistered, setIsPublicKeyRegistered] = useState(false);

  const getApiBase = () => import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const checkRSAStatus = useCallback(async () => {
    const hasKeys = rsaKeyManager.hasKeyPair();
    setHasRSAKeys(hasKeys);

    if (!hasKeys) return;

    try {
      const user = JSON.parse(localStorage.getItem('blockvault_user') || '{}');
      if (!user.jwt) return;

      const response = await fetch(`${getApiBase()}/users/profile`, {
        headers: {
          Authorization: `Bearer ${user.jwt}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setIsPublicKeyRegistered(Boolean(data.has_public_key));
      }
    } catch (error) {
      console.error('Failed to check RSA registration status:', error);
    }
  }, []);

  useEffect(() => {
    checkRSAStatus();
  }, [checkRSAStatus]);

  const handleShare = async () => {
    if (!recipientAddress || !passphrase) {
      toast.error('Please fill in all fields');
      return;
    }

    if (!recipientAddress.startsWith('0x') || recipientAddress.length !== 42) {
      toast.error('Please enter a valid Ethereum address');
      return;
    }

    await shareFile(fileId, recipientAddress, passphrase);
    onClose();
  };

  const copyToClipboard = (
    text: string,
    setCopied: React.Dispatch<React.SetStateAction<boolean>>,
  ) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard');
  };

  const footer = (
    <>
      <Button
        variant="ghost"
        onClick={onClose}
        className="text-slate-300 hover:text-white"
      >
        Cancel
      </Button>
      <Button
        onClick={handleShare}
        disabled={!recipientAddress || !passphrase || loading || !hasRSAKeys || !isPublicKeyRegistered}
        className="min-w-[190px]"
      >
        Share File
      </Button>
    </>
  );

  return (
    <LegalModalFrame
      icon={<Share2 className="h-5 w-5 text-white" />}
      title="Share File"
      subtitle="Grant encrypted access to a trusted wallet."
      onClose={onClose}
      widthClassName="max-w-3xl"
      contentClassName="space-y-6"
      footer={footer}
      headerAccent="blue"
    >
      {!hasRSAKeys && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-4">
          <div className="flex items-start gap-3">
            <Key className="w-5 h-5 text-red-300 mt-0.5" />
            <div className="text-sm text-red-100 space-y-1">
              <p className="font-semibold">RSA Keys Required</p>
              <p>
                Generate and register your RSA keys from the dashboard header before sharing encrypted files.
              </p>
            </div>
          </div>
        </div>
      )}

      {hasRSAKeys && !isPublicKeyRegistered && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-300 mt-0.5" />
            <div className="text-sm text-amber-100 space-y-1">
              <p className="font-semibold">Public Key Not Registered</p>
              <p>
                Register your RSA public key with the backend so recipients can verify your signature and decrypt the file.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-blue-500/25 bg-blue-500/10 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-200 mt-0.5" />
          <div className="text-sm text-blue-100 space-y-1">
            <p className="font-semibold">Security Reminder</p>
            <p>Share the passphrase via a separate secure channel. Blockchain logs who receives access.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <label className="text-sm font-medium text-white flex items-center gap-2">
            <User className="w-4 h-4 text-primary-400" />
            Recipient Address
          </label>
          <Input
            value={recipientAddress}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRecipientAddress(e.target.value)}
            placeholder="0x1234...ABCD"
            className="bg-slate-900/80 border-primary-500/30 text-white placeholder:text-slate-500"
            required
          />
          <p className="text-xs text-slate-400 leading-relaxed">
            The wallet receiving this share. Only addresses you trust should receive encrypted access.
          </p>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium text-white flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary-400" />
            Encryption Passphrase
          </label>
          <Input
            type="password"
            value={passphrase}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassphrase(e.target.value)}
            placeholder="Enter the original file passphrase"
            className="bg-slate-900/80 border-primary-500/30 text-white placeholder:text-slate-500"
            required
          />
          <p className="text-xs text-slate-400 leading-relaxed">
            Reuse the passphrase from the original upload so document provenance remains intact.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-primary-500/25 bg-primary-500/10 p-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="text-xs text-primary-100 space-y-1">
          <p className="text-sm font-semibold text-primary-200">Encrypted Delivery</p>
          <p>
            The passphrase is re-encrypted with the recipient&apos;s RSA key. You can still copy it for record keeping.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => copyToClipboard(passphrase, setCopiedPassphrase)}
          className="border-primary-400/50 text-primary-100 hover:bg-primary-500/20 md:ml-auto"
          disabled={!passphrase}
        >
          {copiedPassphrase ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Passphrase Copied
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-2" />
              Copy Passphrase
            </>
          )}
        </Button>
      </div>

      <div className="rounded-xl border border-slate-800/70 bg-slate-900/60 p-4 flex items-center justify-between">
        <span className="text-sm text-slate-400">File ID</span>
        <div className="flex items-center gap-2">
          <code className="text-xs font-mono text-slate-300 bg-slate-950/50 px-2 py-1 rounded">
            {fileId}
          </code>
          <button
            onClick={() => copyToClipboard(fileId, setCopiedFileId)}
            className="p-1 text-slate-400 hover:text-white transition-colors"
          >
            {copiedFileId ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>
    </LegalModalFrame>
  );
};
