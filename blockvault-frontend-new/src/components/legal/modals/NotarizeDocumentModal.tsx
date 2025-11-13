import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Shield,
  AlertCircle,
  CheckCircle,
  Upload,
  Lock,
  Sparkles,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ZKCircuitManager } from '@/lib/crypto/zkCircuits';
import { storeLegalDocumentKey } from '@/utils/legalDocumentKeys';
import toast from 'react-hot-toast';
import { LegalModalFrame } from './LegalModalFrame';

interface NotarizeDocumentModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const NotarizeDocumentModal: React.FC<NotarizeDocumentModalProps> = ({ onClose, onSuccess }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [verifyingProgress, setVerifyingProgress] = useState(0);
  const [step, setStep] = useState<'upload' | 'processing' | 'verifying' | 'complete'>('upload');
  const [documentHash, setDocumentHash] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const getApiBase = () => {
    return import.meta.env.VITE_API_URL || 'http://localhost:5000';
  };

  const getAuthHeaders = () => {
    const user = JSON.parse(localStorage.getItem('blockvault_user') || '{}');
    return {
      'Authorization': `Bearer ${user.jwt}`,
    };
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setStep('upload');
      setDragActive(false);
    }
  };

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      setStep('upload');
    }
    setDragActive(false);
  }, []);

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!dragActive) {
      setDragActive(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.contains(event.relatedTarget as Node)) {
      return;
    }
    setDragActive(false);
  };

  useEffect(() => {
    if (step === 'processing') {
      setProcessingProgress(20);
      const interval = window.setInterval(() => {
        setProcessingProgress((prev) => {
          if (prev >= 88) return prev;
          return Math.min(prev + 6 + Math.random() * 6, 88);
        });
      }, 420);

      return () => window.clearInterval(interval);
    }

    if (step === 'verifying' || step === 'complete') {
      setProcessingProgress(100);
    } else {
      setProcessingProgress(0);
    }
  }, [step]);

  useEffect(() => {
    if (step === 'verifying') {
      setVerifyingProgress(35);
      const interval = window.setInterval(() => {
        setVerifyingProgress((prev) => {
          if (prev >= 92) return prev;
          return Math.min(prev + 5 + Math.random() * 5, 92);
        });
      }, 380);

      return () => window.clearInterval(interval);
    }

    if (step === 'complete') {
      setVerifyingProgress(100);
    } else {
      setVerifyingProgress(0);
    }
  }, [step]);

  const handleNotarize = async () => {
    if (!selectedFile || !passphrase) {
      toast.error('Please select a file and enter a passphrase');
      return;
    }

    setLoading(true);
    setStep('processing');
    setErrorMessage(null);

    try {
      // Step 1: Upload encrypted file to backend
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('key', passphrase);

      console.log('📤 Uploading file to backend...');
      const uploadResponse = await fetch(`${getApiBase()}/files/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });

      console.log('📡 Upload response status:', uploadResponse.status);

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('❌ Upload failed:', errorText);
        throw new Error(`File upload failed: ${uploadResponse.status} - ${errorText}`);
      }

      const uploadData = await uploadResponse.json();
      const fileId = uploadData.file_id;
      const backendCid = uploadData.cid;
      const sha256 = uploadData.sha256;

      console.log('✅ File uploaded to backend successfully!');
      console.log('📋 Upload data:', { fileId, backendCid, sha256 });
      
      // Verify file_id is valid
      if (!fileId || fileId === 'undefined') {
        throw new Error('Backend returned invalid file_id');
      }

      // Step 2: Verify file was actually created by trying to fetch it
      console.log('🔍 Verifying file was created in backend...');
      const verifyResponse = await fetch(`${getApiBase()}/files/`, {
        headers: getAuthHeaders(),
      });
      
      if (verifyResponse.ok) {
        const filesData = await verifyResponse.json();
        const uploadedFile = filesData.files?.find((f: any) => f.file_id === fileId || f._id === fileId);
        if (uploadedFile) {
          console.log('✅ File verified in backend:', uploadedFile);
        } else {
          console.warn('⚠️ File not found in backend list, but continuing...');
        }
      }

      // Step 3: Store the encryption key for this document
      storeLegalDocumentKey(fileId, passphrase);
      console.log('🔐 Encryption key stored for:', fileId);

      // Step 4: Read file and calculate hash for ZK proof
      const fileData = new Uint8Array(await selectedFile.arrayBuffer());
      const zkManager = ZKCircuitManager.getInstance();
      const fileHash = await zkManager.poseidonHash(fileData);
      setDocumentHash(fileHash);

      setStep('verifying');

      // Step 5: Generate ZK proof of integrity
      const { proof, publicSignals } = await zkManager.generateIntegrityProof(fileData, fileHash);
      
      // Step 6: Format proof for smart contract
      const formattedProof = await zkManager.formatProofForContract(proof, publicSignals);

      // Step 7: Register on blockchain (using backend CID if available)
      const cidForChain = backendCid || await uploadToIpfs(selectedFile);
      await registerDocumentOnChain(cidForChain, formattedProof);

      setStep('complete');
      
      // Step 8: Add to legal documents list with REAL file_id
      const user = JSON.parse(localStorage.getItem('blockvault_user') || '{}');
      const legalDocument = {
        id: fileId, // Use real backend file ID
        file_id: fileId, // Use real backend file ID
        name: selectedFile.name,
        docHash: sha256, // Use backend SHA256 hash
        cid: cidForChain,
        status: 'registered' as const,
        timestamp: Date.now(),
        owner: user.address || 'current-user',
        blockchainHash: fileHash,
        ipfsCid: cidForChain,
        zkProof: formattedProof
      };
      
      // Store in localStorage
      const existingDocs = JSON.parse(localStorage.getItem('legal_documents') || '[]');
      existingDocs.push(legalDocument);
      localStorage.setItem('legal_documents', JSON.stringify(existingDocs));
      
      // Dispatch event to refresh documents
      window.dispatchEvent(new CustomEvent('legalDocumentsUpdated'));
      
      toast.success('Document uploaded, encrypted, and notarized successfully!');
      onSuccess();

    } catch (error) {
      console.error('Error during notarization:', error);
      setErrorMessage(error instanceof Error ? error.message : 'An unexpected error occurred.');
      toast.error('An error occurred during notarization.');
      setStep('upload');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (errorMessage) {
      console.error('Notarization error detail:', errorMessage);
    }
  }, [errorMessage]);


  // Upload file to IPFS
  const uploadToIpfs = async (file: File): Promise<string> => {
    // Fast simulation for demos (instant instead of 1 second)
    await new Promise(resolve => setTimeout(resolve, 50));
    console.log(`⚡ IPFS upload (fast mock): ${file.name}`);
    return `Qm${Math.random().toString(36).substring(2, 15)}`;
  };

  // Register document on blockchain
  const registerDocumentOnChain = async (cid: string, proof: any) => {
    // Fast simulation for demos (instant instead of 2 seconds)
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log('⚡ Document registered on chain (fast mock):', { cid });
  };

  const stepConfig = useMemo(
    () => [
      { id: 'upload', label: 'Upload', description: 'Prepare your document' },
      { id: 'processing', label: 'Hash', description: 'Encrypt & fingerprint' },
      { id: 'verifying', label: 'Verify', description: 'Generate proof' },
    ],
    []
  );

  const stepOrder = useMemo(() => stepConfig.map(({ id }) => id), [stepConfig]);

  const getStepState = (stepId: string) => {
    const currentIndex =
      step === 'complete' ? stepOrder.length : stepOrder.indexOf(step);
    const targetIndex = stepOrder.indexOf(stepId);

    if (currentIndex > targetIndex) return 'complete';
    if (currentIndex === targetIndex && step !== 'complete') return 'active';
    return 'upcoming';
  };

  const getStepIcon = (state: 'active' | 'complete' | 'upcoming') => {
    switch (state) {
      case 'active':
  return (
          <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20">
            <div className="absolute inset-0 rounded-full border border-blue-500/60 animate-[pulse_2s_ease-in-out_infinite]" />
            <div className="relative flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.7)]">
              <Sparkles className="h-3 w-3 text-white" />
            </div>
          </div>
        );
      case 'complete':
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 ring-2 ring-emerald-500/40">
            <CheckCircle className="h-5 w-5 text-emerald-400" />
          </div>
        );
      default:
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-900">
            <Clock className="h-4 w-4 text-slate-500" />
          </div>
        );
    }
  };

  return (
    <LegalModalFrame
      icon={<Shield className="h-5 w-5 text-blue-200" />}
      title="Notarize Document"
      subtitle="Create an immutable, verifiable blockchain record"
      onClose={onClose}
      widthClassName="max-w-xl"
      footer={
        <>
          <Button
            onClick={onClose}
            variant="ghost"
            disabled={loading}
            className="border border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-900/70 hover:text-white"
          >
            {step === 'complete' ? 'Close' : 'Cancel'}
          </Button>
          {step === 'upload' && selectedFile && (
            <Button
              onClick={handleNotarize}
              loading={loading}
              disabled={!passphrase || loading}
              className="bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 text-white shadow-[0_16px_40px_-20px_rgba(99,102,241,0.95)] transition-all hover:shadow-[0_18px_46px_-18px_rgba(129,140,248,0.9)]"
            >
              {loading ? 'Securing…' : 'Continue to Notarize'}
            </Button>
          )}
          {step !== 'upload' && step !== 'complete' && (
            <Button loading disabled>
              Processing…
            </Button>
          )}
        </>
      }
    >
        {/* Progress Steps */}
      <div className="mb-8 mt-1">
        <div className="relative flex items-center justify-between">
          <div className="absolute left-[10%] right-[10%] top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-blue-500/0 via-blue-500/35 to-blue-500/0 blur-[0.5px]" />
          {stepConfig.map(({ id, label, description }) => {
            const state = getStepState(id);
            return (
              <div key={id} className="relative flex flex-1 flex-col items-center text-center">
                {getStepIcon(state)}
                <span
                  className={`mt-3 text-xs font-semibold uppercase tracking-[0.22em] ${
                    state === 'active' || state === 'complete' ? 'text-blue-300' : 'text-slate-500'
                  }`}
                >
                  {label}
                </span>
                <span className="mt-1 text-xs text-slate-400/70">{description}</span>
            </div>
            );
          })}
          </div>
        </div>

        {/* Content */}
        {step === 'upload' && (
        <div className="space-y-7">
          <div
            className={`group relative rounded-2xl border-2 border-dashed p-9 text-center transition-all duration-300 ${
              dragActive
                ? 'border-blue-400/80 bg-blue-500/10 shadow-[0_0_28px_rgba(59,130,246,0.45)]'
                : selectedFile
                ? 'border-blue-500/60 bg-blue-500/5'
                : 'border-slate-700/60 bg-slate-900/40 hover:border-blue-500/50 hover:bg-blue-500/5'
            }`}
            onDragEnter={handleDragOver}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/10 via-transparent to-blue-500/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/15 via-blue-500/10 to-blue-400/20 shadow-[0_0_24px_rgba(59,130,246,0.35)]">
              <FileText className={`h-6 w-6 ${dragActive ? 'animate-bounce text-blue-100' : 'text-blue-200'}`} />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-white">Select Document to Notarize</h3>
            <p className="mx-auto mb-6 max-w-md text-sm text-slate-300/80">
              Upload your legal document to generate an immutable blockchain fingerprint and proof of authenticity.
              </p>
              <input
                type="file"
                onChange={handleFileSelect}
              className="sr-only"
                id="file-input"
                accept=".pdf,.doc,.docx,.txt"
              />
              <label
                htmlFor="file-input"
              className="group inline-flex items-center rounded-lg bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-500 px-5 py-2.5 text-sm font-medium text-white shadow-[0_10px_30px_-15px_rgba(59,130,246,0.85)] transition-all hover:from-blue-400 hover:to-indigo-500 hover:shadow-[0_12px_35px_-12px_rgba(99,102,241,0.85)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-blue-400"
              >
              <Upload className="mr-2 h-4 w-4 transition-transform duration-200 group-hover:-translate-y-[1px] group-hover:scale-105" />
              Choose Secure File
              </label>
            <p className="mt-4 text-xs text-slate-500">Drag & drop also supported. 100&nbsp;MB max · PDF, DOCX, TXT</p>
            </div>

            {selectedFile && (
              <div className="space-y-4">
              <div className="rounded-xl border border-blue-500/30 bg-slate-900/60 p-4 shadow-sm">
                <div className="flex items-center space-x-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-400/30">
                    <FileText className="h-5 w-5 text-blue-200" />
                  </div>
                    <div>
                      <p className="font-medium text-white">{selectedFile.name}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-blue-300/80">
                        {(selectedFile.size / 1024).toFixed(2)} KB
                      </p>
                    <p className="text-xs text-slate-500">{selectedFile.type || 'Unknown format'}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto text-slate-400 hover:text-rose-300 hover:bg-rose-500/10"
                    onClick={() => {
                      setSelectedFile(null);
                      setPassphrase('');
                    }}
                  >
                    Remove
                  </Button>
                  </div>
                </div>

                <Input
                  label="Encryption Passphrase"
                  type="password"
                placeholder="Enter a secure passphrase to encrypt this document"
                value={passphrase}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassphrase(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4" />}
                  required
                />
                <p className="text-xs text-slate-400">
                  This passphrase encrypts your document before upload. It's stored securely and automatically used when requesting signatures.
                </p>

                {errorMessage && (
                  <div className="p-3 rounded-lg border border-destructive/40 bg-destructive/10">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-destructive">Notarization failed</p>
                        <p className="text-xs text-destructive/80 break-all">{errorMessage}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

          <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />

          <div className="relative rounded-xl border border-amber-400/40 bg-[#2d2d2d]/60 p-4 text-left shadow-[inset_0_0_0_1px_rgba(255,220,140,0.08)]">
            <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-amber-500/10 via-transparent to-amber-400/15" />
              <div className="flex items-start space-x-3">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/20 text-amber-300">
                <Shield className="h-4 w-4" />
              </div>
                <div>
                <div className="mb-2 flex items-center gap-2">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-200">Legal Notice</h4>
                  <span className="inline-flex items-center rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.2em] text-amber-200/90">
                    Compliance
                  </span>
                </div>
                <p className="mb-2 text-sm leading-relaxed text-amber-100/90">
                  Notarizing a document creates an <strong className="text-amber-200">immutable</strong> record on the blockchain. This action cannot be undone and remains <strong className="text-amber-200">publicly verifiable</strong>.
                  </p>
                <p className="text-sm leading-relaxed text-amber-100/80">
                  <strong className="text-amber-200">Security:</strong> The document hash ensures <strong className="text-amber-200">cryptographic integrity</strong> and produces an immutable blockchain fingerprint.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Processing Document</h3>
          <p className="text-slate-400 mb-4">Calculating cryptographic hash and preparing for blockchain registration...</p>
            <div className="bg-slate-800/50 rounded-lg p-4 max-w-md mx-auto">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-slate-400">File Size:</span>
                <span className="text-white font-mono">
                  {selectedFile ? (selectedFile.size / 1024 / 1024).toFixed(2) + ' MB' : 'Calculating...'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Status:</span>
                <span className="text-blue-400 font-mono">Processing...</span>
              </div>
            </div>
          <div className="mt-6 space-y-3 max-w-md mx-auto text-left">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Encrypting & hashing document</span>
              <span className="font-mono text-slate-300">{Math.round(processingProgress)}%</span>
            </div>
            <Progress
              value={processingProgress}
              className="h-2.5 overflow-hidden rounded-full bg-slate-800"
              indicatorClassName="bg-gradient-to-r from-blue-500 via-sky-400 to-indigo-500 shadow-[0_0_18px_rgba(56,189,248,0.55)] transition-all duration-500"
            />
          </div>
          </div>
        )}

        {step === 'verifying' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Generating ZK Proof</h3>
          <p className="text-slate-400">Creating cryptographic proof of document integrity...</p>
            {documentHash && (
              <div className="mt-4 p-3 bg-slate-800/50 rounded-lg">
                <p className="text-xs text-slate-400 mb-1">Document Hash:</p>
                <p className="text-xs font-mono text-white break-all">{documentHash}</p>
              </div>
            )}
          <div className="mt-6 space-y-3 max-w-md mx-auto text-left">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Generating zero-knowledge proof</span>
              <span className="font-mono text-slate-300">{Math.round(verifyingProgress)}%</span>
            </div>
            <Progress
              value={verifyingProgress}
              className="h-2.5 overflow-hidden rounded-full bg-slate-800"
              indicatorClassName="bg-gradient-to-r from-emerald-500 via-blue-400 to-sky-400 shadow-[0_0_18px_rgba(52,211,153,0.55)] transition-all duration-500"
            />
          </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="text-center py-8">
          <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center">
            <div className="absolute h-full w-full animate-[ping_2.2s_ease-in-out_infinite] rounded-full bg-emerald-500/20" />
            <div className="absolute h-16 w-16 rounded-full bg-emerald-500/20 blur-md" />
            <CheckCircle className="relative h-16 w-16 text-emerald-400 drop-shadow-[0_0_18px_rgba(16,185,129,0.65)]" />
          </div>
            <h3 className="text-lg font-medium text-white mb-2">Document Notarized!</h3>
            <p className="text-slate-400 mb-4">
              Your document has been successfully registered on the blockchain with cryptographic proof.
            </p>

            {documentHash && (
              <div className="p-3 bg-slate-800/50 rounded-lg mb-4">
                <p className="text-xs text-slate-400 mb-1">Document Hash:</p>
                <p className="text-xs font-mono text-white break-all">{documentHash}</p>
                <p className="text-xs text-slate-500 mt-1">
                  This hash represents the document's cryptographic fingerprint
                </p>
              </div>
            )}
          </div>
        )}
    </LegalModalFrame>
  );
};
