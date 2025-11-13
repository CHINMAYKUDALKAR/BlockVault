import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';

interface User {
  address: string;
  jwt?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  connectWallet: () => Promise<void>;
  login: (provider?: any) => Promise<void>;
  logout: () => void;
  isConnected: boolean;
  isAuthenticated: boolean;
  isMobile: boolean;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // Start with true to prevent redirect during restoration
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const isConnected = !!user?.address;
  const isAuthenticated = !!(user?.address && user?.jwt);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
    };
    setIsMobile(checkMobile());
  }, []);

  // Listen for wallet account changes and disconnections
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        // User disconnected wallet
        console.log('Wallet disconnected');
        logout();
      } else if (accounts[0] !== user?.address) {
        // User switched accounts
        console.log('Account changed:', accounts[0]);
        const newUser = { address: accounts[0] };
        setUser(newUser);
        localStorage.setItem('blockvault_user', JSON.stringify(newUser));
        toast.success('Wallet account changed');
      }
    };

    const handleChainChanged = () => {
      // Reload page when chain changes
      window.location.reload();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [user]);

  // Check for existing session on mount and validate token
  useEffect(() => {
    const restoreSession = async () => {
      const savedUser = localStorage.getItem('blockvault_user');
      if (savedUser) {
        try {
          const parsedUser = JSON.parse(savedUser);
          
          // Always restore the wallet address (keep user connected)
          setUser(parsedUser);
          
          // Optionally validate JWT token if it exists
          // But don't log out if validation fails - just invalidate the JWT
          if (parsedUser.jwt) {
            validateToken(parsedUser, parsedUser.jwt);
          }
        } catch (error) {
          console.error('Failed to parse saved user:', error);
          localStorage.removeItem('blockvault_user');
        }
      }
      // Set loading to false after restoration attempt completes
      setLoading(false);
    };

    restoreSession();
  }, []);

  useEffect(() => {
    const handleSessionExpired = () => {
      setUser((currentUser) => {
        if (currentUser?.address) {
          const minimalUser = { address: currentUser.address };
          localStorage.setItem('blockvault_user', JSON.stringify(minimalUser));
          return minimalUser;
        }

        localStorage.removeItem('blockvault_user');
        return null;
      });
    };

    window.addEventListener('blockvault:session-expired', handleSessionExpired);

    return () => {
      window.removeEventListener('blockvault:session-expired', handleSessionExpired);
    };
  }, []);

  // Validate JWT token by making a test request
  // If token is invalid, keep the wallet connected but remove JWT
  const validateToken = async (currentUser: User, token: string) => {
    try {
      const response = await fetch(`${getApiBase()}/users/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        console.log('Token validation failed, preserving current session state for now.');
        return;
      } else {
        // Token is still valid - user is fully authenticated
        console.log('Token is valid, user fully authenticated');
      }
    } catch (error) {
      // Network error or backend down - optimistically keep user connected
      console.log('Token validation error (backend might be offline), keeping user connected:', error);
      // Don't clear user data on network errors - assume token is still valid
    }
  };

  const connectWallet = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!window.ethereum) {
        throw new Error('MetaMask is not installed');
      }

      const provider = new ethers.BrowserProvider(window.ethereum!);
      const accounts = await provider.send('eth_requestAccounts', []);
      
      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const address = accounts[0];
      setUser({ address });
      
      // Save to localStorage
      localStorage.setItem('blockvault_user', JSON.stringify({ address }));
      
      toast.success('Wallet connected successfully');
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to connect wallet';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const login = async (provider?: any) => {
    if (!user?.address) {
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get nonce from backend
      const nonceResponse = await fetch(`${getApiBase()}/auth/get_nonce`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address: user.address }),
      });

      if (!nonceResponse.ok) {
        throw new Error('Failed to get nonce');
      }

      const { nonce } = await nonceResponse.json();

      // Sign message with wallet
      let signature: string;
      console.log('Login function called with:', { provider, isMobile, hasProvider: !!provider });
      
      if (provider && isMobile) {
        // Handle mobile wallet providers (only on mobile devices)
        const message = `BlockVault login nonce: ${nonce}`;
        console.log('Mobile wallet login attempt:', { provider, message, address: user.address });
        
        try {
          // Method 1: Try personal_sign with message first
          console.log('Trying personal_sign method...');
          signature = await provider.request({
            method: 'personal_sign',
            params: [message, user.address],
          });
          console.log('personal_sign successful:', signature);
        } catch (error) {
          console.log('personal_sign failed, trying eth_sign...', error);
          
          try {
            // Method 2: Try eth_sign
            console.log('Trying eth_sign method...');
            signature = await provider.request({
              method: 'eth_sign',
              params: [user.address, ethers.keccak256(ethers.toUtf8Bytes(message))],
            });
            console.log('eth_sign successful:', signature);
          } catch (error2) {
            console.log('eth_sign failed, trying ethers provider...', error2);
            
            try {
              // Method 3: Try ethers provider
              console.log('Trying ethers provider method...');
              const ethersProvider = new ethers.BrowserProvider(provider);
              const signer = await ethersProvider.getSigner();
              signature = await signer.signMessage(message);
              console.log('ethers provider successful:', signature);
            } catch (error3) {
              console.log('ethers provider failed, trying direct signing...', error3);
              
              try {
                // Method 4: Try direct signing with different message format
                console.log('Trying direct signing with hash...');
                signature = await provider.request({
                  method: 'personal_sign',
                  params: [ethers.keccak256(ethers.toUtf8Bytes(message)), user.address],
                });
                console.log('direct signing successful:', signature);
              } catch (error4) {
                console.error('All signing methods failed:', { error, error2, error3, error4 });
                throw new Error(`Failed to sign message with mobile wallet. Please try again or use desktop MetaMask.`);
              }
            }
          }
        }
      } else {
        // Handle desktop MetaMask
        const ethersProvider = new ethers.BrowserProvider(window.ethereum!);
        const signer = await ethersProvider.getSigner();
        signature = await signer.signMessage(`BlockVault login nonce: ${nonce}`);
      }

      // Send signature to backend for verification
      const loginResponse = await fetch(`${getApiBase()}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: user.address,
          signature,
        }),
      });

      if (!loginResponse.ok) {
        throw new Error('Login failed');
      }

      const { token } = await loginResponse.json();

      // Update user with JWT
      const updatedUser = { ...user, jwt: token };
      setUser(updatedUser);
      
      // Save to localStorage
      localStorage.setItem('blockvault_user', JSON.stringify(updatedUser));
      
      toast.success('Login successful');
    } catch (err: any) {
      const errorMessage = err.message || 'Login failed';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    if (user?.address) {
      const minimalUser = { address: user.address };
      setUser(minimalUser);
      localStorage.setItem('blockvault_user', JSON.stringify(minimalUser));
    } else {
      setUser(null);
      localStorage.removeItem('blockvault_user');
    }
    toast.success('Session cleared, wallet remains connected');
  };

  const value: AuthContextType = {
    user,
    loading,
    error,
    connectWallet,
    login,
    logout,
    isConnected,
    isAuthenticated,
    isMobile,
    setUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Helper function to get API base URL
function getApiBase(): string {
  return import.meta.env.VITE_API_URL || 'http://localhost:5000';
}
