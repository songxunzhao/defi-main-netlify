import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { openWalletDemo } from '../utils/walletDemo';
import { useEthereumWallet } from './EthereumContext';
import { useAccount, useDisconnect } from '../solana/wagmi';

type WalletContextType = {
  isConnected: boolean;
  address: string | null;
  isAdmin: boolean;
  connectWallet: () => void;
  disconnectWallet: () => void;
};

const WalletContext = createContext<WalletContextType | undefined>(undefined);

// List of admin addresses (can be moved to environment variables or fetched from contract)
const ADMIN_ADDRESSES: string[] = [
  // Add admin addresses here, e.g.:
  // '0x1234567890123456789012345678901234567890',
  // '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
];

export function WalletProvider({
  children
}: {
  children: React.ReactNode;
}) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { disconnect: disconnectEthereum } = useEthereumWallet();
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if connected address is an admin
  useEffect(() => {
    if (address && isConnected) {
      const normalizedAddress = address.toLowerCase();
      setIsAdmin(ADMIN_ADDRESSES.some(admin => admin.toLowerCase() === normalizedAddress));
    } else {
      setIsAdmin(false);
    }
  }, [address, isConnected]);

  const connectWallet = useCallback(() => { openWalletDemo(); }, []);

  const disconnectWallet = () => {
    disconnect().catch(() => undefined);
    disconnectEthereum();
  };

  const value = useMemo(
    () => ({
      isConnected: isConnected ?? false,
      address: address ?? null,
      isAdmin,
      connectWallet,
      disconnectWallet,
    }),
    [isConnected, address, isAdmin, disconnect, disconnectEthereum, connectWallet]
  );

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
