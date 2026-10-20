import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

type EthereumProvider = {
  request: (args: { method: string }) => Promise<unknown>;
  on?: (event: string, listener: (...args: any[]) => void) => void;
  removeListener?: (event: string, listener: (...args: any[]) => void) => void;
};
type BrowserWallet = { id: string; name: string; icon?: string; provider: EthereumProvider };
type EthereumState = {
  wallets: BrowserWallet[];
  address: string;
  chainId: string;
  connecting: boolean;
  error: string;
  discover: () => void;
  connect: (wallet: BrowserWallet) => Promise<boolean>;
  disconnect: () => void;
};
const EthereumContext = createContext<EthereumState | null>(null);
const validAddress = (value: unknown): value is string => typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);

export function EthereumWalletProvider({ children }: { children: React.ReactNode }) {
  const [wallets, setWallets] = useState<BrowserWallet[]>([]);
  const [provider, setProvider] = useState<EthereumProvider | null>(null);
  const [address, setAddress] = useState('');
  const [chainId, setChainId] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const attempt = useRef(0);
  const pending = useRef(false);

  const discover = useCallback(() => {
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    const legacy = (window as Window & { ethereum?: EthereumProvider }).ethereum;
    if (legacy?.request) {
      setWallets((current) => current.some((wallet) => wallet.provider === legacy)
        ? current : [...current, { id: 'injected', name: 'Browser Ethereum wallet', provider: legacy }]);
    }
  }, []);

  useEffect(() => {
    const announce = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (typeof detail?.info?.uuid !== 'string' || typeof detail?.info?.name !== 'string' || typeof detail?.provider?.request !== 'function') return;
      const icon = typeof detail.info.icon === 'string' && /^data:image\//i.test(detail.info.icon)
        ? detail.info.icon : undefined;
      const wallet = { id: detail.info.uuid, name: detail.info.name, icon, provider: detail.provider };
      setWallets((current) => [...current.filter((item) => item.id !== wallet.id && item.provider !== wallet.provider), wallet]);
    };
    window.addEventListener('eip6963:announceProvider', announce);
    discover();
    return () => {
      window.removeEventListener('eip6963:announceProvider', announce);
      attempt.current += 1;
      pending.current = false;
    };
  }, [discover]);

  const disconnect = useCallback(() => {
    attempt.current += 1;
    pending.current = false;
    setProvider(null);
    setAddress('');
    setChainId('');
    setConnecting(false);
    setError('');
  }, []);

  const connect = useCallback(async (wallet: BrowserWallet) => {
    if (pending.current) return false;
    pending.current = true;
    const current = ++attempt.current;
    setConnecting(true);
    setError('');
    try {
      const accounts = await wallet.provider.request({ method: 'eth_requestAccounts' });
      if (!Array.isArray(accounts) || !validAddress(accounts[0])) throw new Error('The wallet did not return an Ethereum address.');
      const chain = await wallet.provider.request({ method: 'eth_chainId' });
      if (typeof chain !== 'string' || !/^0x[0-9a-f]+$/i.test(chain)) throw new Error('The wallet returned an invalid network.');
      if (current !== attempt.current) return false;
      setProvider(wallet.provider);
      setAddress(accounts[0]);
      setChainId(chain);
      return true;
    } catch (err) {
      if (current === attempt.current) {
        const failure = err as { code?: number; message?: string };
        setError(failure.code === 4001 ? 'Wallet connection was declined. Try again when ready.' : failure.message || 'Could not connect the Ethereum wallet.');
      }
      return false;
    } finally {
      if (current === attempt.current) {
        pending.current = false;
        setConnecting(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!provider) return;
    const accountsChanged = (accounts: unknown) => {
      if (Array.isArray(accounts) && validAddress(accounts[0])) setAddress(accounts[0]);
      else disconnect();
    };
    const chainChanged = (chain: unknown) => {
      if (typeof chain === 'string' && /^0x[0-9a-f]+$/i.test(chain)) setChainId(chain);
      else disconnect();
    };
    provider.on?.('accountsChanged', accountsChanged);
    provider.on?.('chainChanged', chainChanged);
    provider.on?.('disconnect', disconnect);
    return () => {
      provider.removeListener?.('accountsChanged', accountsChanged);
      provider.removeListener?.('chainChanged', chainChanged);
      provider.removeListener?.('disconnect', disconnect);
    };
  }, [provider, disconnect]);

  return <EthereumContext.Provider value={{ wallets, address, chainId, connecting, error, discover, connect, disconnect }}>{children}</EthereumContext.Provider>;
}

export function useEthereumWallet() {
  const context = useContext(EthereumContext);
  if (!context) throw new Error('useEthereumWallet requires EthereumWalletProvider');
  return context;
}
