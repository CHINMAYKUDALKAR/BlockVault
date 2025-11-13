import { Shield, Lock, FileCheck, ArrowRight, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GlowingSeparator } from "@/components/ui/glowing-separator";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { MobileWalletModal } from "@/components/auth/MobileWalletModal";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const IndexPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isMobile, connectWallet, login, loading, user, isConnected } = useAuth();
  const [showMobileWallet, setShowMobileWallet] = useState(false);

  // Redirect to files if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/files');
    }
  }, [isAuthenticated, navigate]);

  const handleConnect = async () => {
    if (isMobile) {
      setShowMobileWallet(true);
    } else {
      await connectWallet();
    }
  };

  const handleLogin = async () => {
    await login();
  };

  const features = [
    {
      icon: Shield,
      title: "Blockchain Security",
      description: "Immutable document storage with cryptographic verification",
    },
    {
      icon: Lock,
      title: "Zero-Knowledge Proofs",
      description: "Redact sensitive data while maintaining document integrity",
    },
    {
      icon: FileCheck,
      title: "Legal Workflows",
      description: "Multi-party signatures, notarization, and chain of custody",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto flex justify-end px-6 pt-8">
        <ThemeToggle />
      </div>
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="container mx-auto px-6 py-24">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-5xl font-bold tracking-tight mb-6">
              Enterprise Document Management
              <br />
              <span className="text-muted-foreground">Built on Blockchain</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              Secure, verifiable, and compliant document workflows for legal professionals.
              Leverage blockchain technology and zero-knowledge proofs for unmatched security.
            </p>
            <div className="flex items-center justify-center gap-4">
              {isAuthenticated ? (
                <Button size="lg" onClick={() => navigate("/files")} className="gap-2">
                  Go to Dashboard
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : isConnected && user?.address ? (
                <>
                  <Button
                    size="lg" 
                    onClick={handleLogin} 
                    className="gap-2"
                    disabled={loading}
                  >
                    <Shield className="h-4 w-4" />
                    {loading ? 'Signing...' : 'Complete Login'}
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Connected: {user.address.slice(0, 6)}...{user.address.slice(-4)}
                  </p>
                </>
                ) : (
                <>
                  <Button
                    size="lg" 
                    onClick={handleConnect} 
                    className="gap-2"
                    disabled={loading}
                  >
                    <Wallet className="h-4 w-4" />
                         {loading ? 'Connecting...' : 'Connect Wallet'}
                       </Button>
                       <Button size="lg" variant="outline" onClick={() => navigate("/learn-more")}>
                         Learn More
                       </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">
              Why BlockVault?
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Advanced cryptographic features designed for modern legal workflows
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {features.map((feature) => (
              <Card key={feature.title} className="p-6 hover:border-primary/50 transition-colors">
                <div className="flex flex-col items-center text-center">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-border py-16">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">
              Ready to secure your documents?
            </h2>
            <p className="text-muted-foreground mb-8">
              Join legal teams worldwide using BlockVault for secure document management
            </p>
            {isAuthenticated ? (
              <Button
                size="lg" 
                onClick={() => navigate("/files")}
                className="gap-2"
              >
                Go to Dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : isConnected && user?.address ? (
              <Button
                size="lg" 
                onClick={handleLogin}
                disabled={loading}
                className="gap-2"
              >
                <Shield className="h-4 w-4" />
                {loading ? 'Signing...' : 'Complete Login'}
              </Button>
            ) : (
              <Button
                size="lg" 
                onClick={handleConnect}
                disabled={loading}
                className="gap-2"
              >
                <Wallet className="h-4 w-4" />
                {loading ? 'Connecting...' : 'Connect Wallet to Start'}
              </Button>
          )}
        </div>
      </div>
      </section>

      {/* Mobile Wallet Modal */}
      {showMobileWallet && (
        <MobileWalletModal
          onClose={() => setShowMobileWallet(false)}
          onConnect={login}
        />
      )}
    </div>
  );
};

export default IndexPage;
