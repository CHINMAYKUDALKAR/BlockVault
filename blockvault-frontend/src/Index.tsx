import { useState } from "react";
import { Header } from "@/components/Header";
import { FileUploadZone } from "@/components/FileUploadZone";
import { FileCard } from "@/components/FileCard";
import { EmptyVault } from "@/components/EmptyVault";
import { Shield, Lock, Zap } from "lucide-react";

interface FileItem {
  id: string;
  name: string;
  size: string;
  date: string;
}

const Index = () => {
  const [files, setFiles] = useState<FileItem[]>([]);

  const handleFilesSelected = (selectedFiles: File[]) => {
    const newFiles: FileItem[] = selectedFiles.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      name: file.name,
      size: formatFileSize(file.size),
      date: new Date().toLocaleDateString(),
    }));

    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleDeleteFile = (id: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== id));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container px-4 md:px-8 py-12">
        {/* Hero Section */}
        <div className="max-w-3xl mx-auto text-center mb-16 animate-fade-in">
          <div className="inline-flex items-center justify-center rounded-full bg-primary/10 px-4 py-2 mb-6">
            <Lock className="h-4 w-4 text-primary mr-2" />
            <span className="text-sm font-medium text-primary">End-to-End Encrypted</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Your files, secured on the{" "}
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              blockchain
            </span>
          </h1>

          <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
            Store your most important files with military-grade encryption and blockchain security.
            Simple, delightful, and completely secure.
          </p>

          {/* Feature Pills */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-12">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-sm">Encrypted Storage</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border">
              <Lock className="h-4 w-4 text-primary" />
              <span className="text-sm">Decentralized</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-sm">Lightning Fast</span>
            </div>
          </div>
        </div>

        {/* Upload Zone */}
        <div className="max-w-4xl mx-auto mb-12">
          <FileUploadZone onFilesSelected={handleFilesSelected} />
        </div>

        {/* Files Section */}
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground mb-2">Your Files</h2>
            <p className="text-muted-foreground">
              {files.length === 0
                ? "No files uploaded yet"
                : `${files.length} file${files.length === 1 ? "" : "s"} stored securely`}
            </p>
          </div>

          {files.length === 0 ? (
            <EmptyVault />
          ) : (
            <div className="space-y-3">
              {files.map((file) => (
                <FileCard
                  key={file.id}
                  name={file.name}
                  size={file.size}
                  date={file.date}
                  onDelete={() => handleDeleteFile(file.id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-20">
        <div className="container px-4 md:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">
                © 2024 BlockVault. Secured by blockchain.
              </span>
            </div>
            <div className="flex items-center gap-6">
              <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Privacy
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Terms
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Support
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
