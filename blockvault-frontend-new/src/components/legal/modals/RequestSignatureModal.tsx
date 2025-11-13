import React, { useState, useEffect } from 'react';
import { Users, AlertCircle, Lock, CheckCircle, Edit, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { getLegalDocumentKey } from '@/utils/legalDocumentKeys';
import { createSignatureRequest } from '@/utils/signatureRequestStorage';
import toast from 'react-hot-toast';
import { ScrollingText } from '@/components/ui/ScrollingText';
import { LegalModalFrame } from './LegalModalFrame';

interface RequestSignatureModalProps {
  document: {
    id: string;
    file_id?: string;
    name: string;
    docHash: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export const RequestSignatureModal: React.FC<RequestSignatureModalProps> = ({ 
  document, 
  onClose, 
  onSuccess 
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [signers, setSigners] = useState<Array<{
    address: string;
    name: string;
    email: string;
  }>>([{ address: '', name: '', email: '' }]);
  const [message, setMessage] = useState('Please review and sign this document');
  const [expiresAt, setExpiresAt] = useState('');
  const [filePassphrase, setFilePassphrase] = useState('');
  const [autoRetrievedKey, setAutoRetrievedKey] = useState(false);
  const [manualKeyEntry, setManualKeyEntry] = useState(false);

  // Auto-retrieve stored passphrase on mount
  useEffect(() => {
    const storedKey = getLegalDocumentKey(document.id);
    if (storedKey) {
      setFilePassphrase(storedKey);
      setAutoRetrievedKey(true);
      console.log('Auto-retrieved encryption key for document:', document.id);
    } else {
      setManualKeyEntry(true);
      console.log('No stored key found, manual entry required for:', document.id);
    }
  }, [document.id]);

  // API Base URL
  const getApiBase = () => {
    return import.meta.env.VITE_API_URL || 'http://localhost:5000';
  };

  // Auth Headers
  const getAuthHeaders = () => {
    const user = JSON.parse(localStorage.getItem('blockvault_user') || '{}');
    if (!user.jwt) {
      throw new Error('No authentication token found. Please login again.');
    }
    return {
      'Authorization': `Bearer ${user.jwt}`,
      'Content-Type': 'application/json',
    };
  };

  const addSigner = () => {
    setSigners(prev => [...prev, { address: '', name: '', email: '' }]);
  };

  const removeSigner = (index: number) => {
    setSigners(prev => prev.filter((_, i) => i !== index));
  };

  const updateSigner = (index: number, field: string, value: string) => {
    setSigners(prev => prev.map((signer, i) => 
      i === index ? { ...signer, [field]: value } : signer
    ));
  };

  const handleSubmit = async () => {
    if (!signers.some(s => s.address.trim())) {
      toast.error('Please add at least one signer');
      return;
    }

    if (!filePassphrase) {
      toast.error('Please enter the file encryption passphrase');
      return;
    }

    setLoading(true);
    try {
      // Step 1: Share the file with each signer so they can view it
      const validSigners = signers.filter(s => s.address.trim());
      let failedShares = 0;
      
      console.log('🔄 Starting file sharing process...');
      console.log('📋 Document to share:', { id: document.id, file_id: document.file_id, name: document.name });
      console.log('👥 Signers:', validSigners);
      console.log('🔑 Passphrase available:', !!filePassphrase);
      
      // Use file_id if available, fallback to id
      const fileIdToShare = document.file_id || document.id;
      console.log('📎 Using file_id for sharing:', fileIdToShare);
      
      const shareErrors: string[] = [];
      
      for (const signer of validSigners) {
        try {
          // Normalize address to lowercase
          const normalizedAddress = signer.address.trim().toLowerCase();
          console.log(`📤 Attempting to share with: ${normalizedAddress}`);
          
          const apiUrl = `${getApiBase()}/files/${fileIdToShare}/share`;
          console.log('🔗 API URL:', apiUrl);
          
          const headers = getAuthHeaders();
          console.log('📋 Headers:', Object.keys(headers));
          
          const body = {
            recipient: normalizedAddress,
            passphrase: filePassphrase,
          };
          console.log('📦 Request body:', { recipient: normalizedAddress, passphrase: '***' });
          
          // Share file using the backend API
          const shareResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              ...headers,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          });

          if (!shareResponse.ok) {
            const errorText = await shareResponse.text();
            console.error(`❌ Failed to share file with ${normalizedAddress}: ${errorText}`);
            
            // Store error for summary (don't show individual errors)
            if (errorText.includes('public key') || errorText.includes('registered')) {
              shareErrors.push(`${normalizedAddress.slice(0, 10)}... hasn't registered RSA keys`);
            } else {
              shareErrors.push(`${normalizedAddress.slice(0, 10)}... ${errorText}`);
            }
            failedShares++;
          } else {
            const shareData = await shareResponse.json();
            console.log(`✅ Successfully shared file with ${normalizedAddress}`, shareData);
          }
        } catch (shareError) {
          console.error(`Error sharing with ${signer.address}:`, shareError);
          shareErrors.push(`${signer.address.slice(0, 10)}... ${(shareError as Error).message}`);
          failedShares++;
        }
      }

      // Show single summary message at the end
      if (failedShares === validSigners.length) {
        // All shares failed
        toast.error(`Failed to share document with all signers. Errors: ${shareErrors.join(', ')}`);
      } else if (failedShares > 0) {
        // Some shares failed
        toast(`⚠️ Shared with ${validSigners.length - failedShares}/${validSigners.length} signers. Failed: ${shareErrors.join(', ')}`, {
          icon: '⚠️',
          duration: 6000,
        });
      }

      // Step 2: Create signature requests (stored locally)
      const expirationTimestamp = expiresAt 
        ? new Date(expiresAt).getTime()
        : Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days default

      console.log('Creating signature requests...');
      
      // Use file_id for signature requests (important for redacted documents)
      const documentIdForRequest = fileIdToShare; // Same ID used for sharing
      console.log('📎 Using document ID for signature request:', documentIdForRequest);
      
      // Create a signature request for each signer
      for (const signer of validSigners) {
        const normalizedAddress = signer.address.trim().toLowerCase();
        createSignatureRequest(
          documentIdForRequest, // Use the same file_id that was used for sharing
          document.name,
          user?.address?.toLowerCase() || '',
          normalizedAddress,
          message,
          expirationTimestamp
        );
        console.log(`Created signature request for ${normalizedAddress} with documentId: ${documentIdForRequest}`);
      }

      // Try to persist signature requests on the backend so recipients can fetch them
      try {
        const payload = {
          signers: validSigners.map(s => ({ address: s.address.trim().toLowerCase(), name: s.name || '', email: s.email || '' })),
          requestedBy: user?.address || '',
          documentName: document.name,
          message,
          expiresAt: expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        };

        const serverResp = await fetch(`${getApiBase()}/documents/${documentIdForRequest}/request-signature`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });

        if (serverResp.ok) {
          let body = null;
          try { body = await serverResp.json(); } catch (e) { /* ignore */ }
          console.log('✅ Persisted signature requests on backend', body);
          toast.success('Signature requests persisted on the server');
        } else {
          let errorText = '';
          try {
            const errJson = await serverResp.json();
            errorText = errJson.error || JSON.stringify(errJson);
          } catch (e) {
            errorText = await serverResp.text();
          }
          console.warn('⚠️ Backend rejected signature request persistence', errorText);
          toast.error('Failed to persist signature requests on server: ' + (errorText || serverResp.statusText));
        }
      } catch (serverErr) {
        console.warn('⚠️ Could not persist signature requests to backend:', serverErr);
      }

      // Trigger event to update signature request count in header
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'blockvault_signature_requests',
        newValue: localStorage.getItem('blockvault_signature_requests'),
        storageArea: localStorage
      }));
      console.log('Dispatched signature request update event');

      // Show appropriate success message
      if (failedShares === 0) {
        toast.success(`Signature request${validSigners.length > 1 ? 's' : ''} sent successfully! All signers can now view and sign the document.`);
      } else if (failedShares < validSigners.length) {
        toast.success(`Signature request${validSigners.length > 1 ? 's' : ''} sent! Note: ${failedShares} signer(s) may not be able to view the document.`);
      } else {
        toast.error('Signature requests sent, but document sharing failed for all signers. They won\'t be able to view the document.');
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error requesting signatures:', error);
      toast.error('Failed to send signature requests');
    } finally {
      setLoading(false);
    }
  };

  const footerContent = (
    <>
      <Button variant="outline" onClick={onClose} disabled={loading}>
        Cancel
      </Button>
      <Button onClick={handleSubmit} disabled={loading}>
        {loading ? 'Sending…' : 'Send Signature Requests'}
      </Button>
    </>
  );

  return (
    <LegalModalFrame
      widthClassName="max-w-2xl"
      title="Request Signatures"
      subtitle="Securely gather blockchain-backed signatures"
      icon={<Users className="h-5 w-5 text-blue-200" />}
      onClose={onClose}
      footer={footerContent}
    >
      <div className="space-y-6">
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <h3 className="mb-2 text-sm font-semibold text-white">Document</h3>
          <ScrollingText text={document.name} className="block text-slate-300" />
          <p className="mt-1 text-xs font-mono text-slate-500">
              Hash: {document.docHash.slice(0, 10)}...{document.docHash.slice(-10)}
            </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-white">File Encryption Passphrase</h3>
            {autoRetrievedKey ? (
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
                <div className="flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 text-green-400" />
                  <div className="flex-1">
                  <p className="text-sm font-semibold text-green-300">Encryption Key Retrieved</p>
                  <p className="text-xs text-green-200/80">
                      The document encryption key was automatically retrieved. Signers will be able to view this document.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAutoRetrievedKey(false);
                      setManualKeyEntry(true);
                      setFilePassphrase('');
                    }}
                  className="text-slate-300 hover:text-white"
                  >
                  <Edit className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
            <div className="space-y-2">
                <Input
                label="Encryption Passphrase"
                  type="password"
                placeholder="Enter the passphrase used to encrypt this file"
                value={filePassphrase}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilePassphrase(e.target.value)}
                leftIcon={<Lock className="h-4 w-4" />}
                  required
                />
              <p className="text-xs text-slate-400">
                  {manualKeyEntry 
                  ? 'This document was not uploaded via Legal Dashboard. Please enter the encryption passphrase manually.'
                  : 'This passphrase will be securely shared with signers so they can view the document before signing.'}
                </p>
              </div>
            )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Signers</h3>
              <Button onClick={addSigner} size="sm">
              <Users className="mr-2 h-4 w-4" />
                Add Signer
              </Button>
            </div>
            <div className="space-y-3">
              {signers.map((signer, index) => (
              <div key={index} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                <div className="mb-3 flex items-center justify-between">
                    <h4 className="font-medium text-white">Signer {index + 1}</h4>
                    {signers.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSigner(index)}
                        className="text-red-400 hover:text-red-300"
                      >
                      <X className="mr-1 h-4 w-4" />
                      Remove
                      </Button>
                    )}
                  </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                    <label className="mb-2 block text-sm font-medium text-white">Wallet Address *</label>
                      <input
                        type="text"
                        value={signer.address}
                        onChange={(e) => updateSigner(index, 'address', e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0x..."
                      />
                    </div>
                    <div>
                    <label className="mb-2 block text-sm font-medium text-white">Name</label>
                      <input
                        type="text"
                        value={signer.name}
                        onChange={(e) => updateSigner(index, 'name', e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Full name"
                      />
                    </div>
                    <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-white">Email</label>
                      <input
                        type="email"
                        value={signer.email}
                        onChange={(e) => updateSigner(index, 'email', e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="email@example.com"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
        </section>

        <section className="space-y-3">
          <label className="block text-sm font-medium text-white">Message to Signers</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Add a message for the signers..."
            />
        </section>

        <section className="space-y-2">
          <label className="block text-sm font-medium text-white">Expiration Date</label>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          <p className="text-xs text-slate-400">Leave empty for 7 days from now</p>
        </section>

        <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-start space-x-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-amber-400" />
              <div>
              <h4 className="mb-1 font-semibold text-amber-300">Legal Notice</h4>
                <p className="text-sm text-amber-200">
                  Requesting signatures creates a legally binding workflow. All signers will be notified 
                  and must sign the document for it to be considered executed.
                </p>
              </div>
            </div>
        </section>
          </div>
    </LegalModalFrame>
  );
};
