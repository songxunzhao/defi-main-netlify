import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  WalletConnectionError,
  WalletDisconnectedError,
  WalletError,
  WalletNotReadyError,
  WalletTimeoutError,
  WalletWindowBlockedError,
  WalletWindowClosedError,
} from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { clusterApiUrl } from '@solana/web3.js';

const WalletNoticeContext = createContext<{
  notice: string;
  clearNotice: () => void;
}>({ notice: '', clearNotice: () => undefined });

export function useWalletNotice() {
  return useContext(WalletNoticeContext);
}

function connectionFailureMessage(error: WalletError) {
  if (error instanceof WalletDisconnectedError) return '';
  if (error instanceof WalletNotReadyError) return 'Install Phantom or Solflare, then try connecting again.';
  if (error instanceof WalletWindowClosedError || error instanceof WalletWindowBlockedError) {
    return 'The wallet window closed before the connection was approved.';
  }
  if (error instanceof WalletTimeoutError) return 'The wallet did not respond. Try connecting again.';
  if (error instanceof WalletConnectionError) return error.message || 'The wallet refused the connection.';
  return error.message || 'Something went wrong while connecting the wallet.';
}

export function SolanaProviders({ children }: { children: React.ReactNode }) {
  const endpoint = import.meta.env.VITE_SOLANA_RPC_URL || clusterApiUrl('devnet');
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );
  const [notice, setNotice] = useState('');
  const clearNotice = useCallback(() => setNotice(''), []);
  const onError = useCallback((error: WalletError) => {
    const message = connectionFailureMessage(error);
    if (message) setNotice(message);
  }, []);
  const noticeValue = useMemo(() => ({ notice, clearNotice }), [notice, clearNotice]);

  return (
    <WalletNoticeContext.Provider value={noticeValue}>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect={false} onError={onError}>
          <WalletModalProvider>{children}</WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </WalletNoticeContext.Provider>
  );
}
