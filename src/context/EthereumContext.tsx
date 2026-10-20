import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

type EthereumProvider = {
  request: (args: { method: string }) => Promise<unknown>;
  on?: (event: string, listener: (...args: any[]) => void) => void;
  removeListener?: (event: string, listener: (...args: any[]) => void) => void;
};
export type BrowserWallet = {
  id: string;
  name: string;
  icon?: string;
  rdns?: string;
  source: 'eip6963' | 'legacy';
  provider: EthereumProvider;
};
type EthereumState = {
  wallets: BrowserWallet[];
  address: string;
  chainId: string;
  connectedWalletId: string | null;
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
      // window.ethereum can be a different wrapper around an announced wallet.
      // Only use it when no wallet supports standard discovery.
      setWallets((current) => current.some((wallet) => wallet.source === 'eip6963')
        ? current.filter((wallet) => wallet.source !== 'legacy')
        : [{ id: 'injected', name: 'Browser Ethereum wallet', source: 'legacy', provider: legacy }]);
    }
  }, []);

  useEffect(() => {
    const announce = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (typeof detail?.info?.uuid !== 'string' || typeof detail?.info?.name !== 'string' || typeof detail?.provider?.request !== 'function') return;
      const name = detail.info.name.trim();
      if (!name) return;
      const rdns = typeof detail.info.rdns === 'string' ? detail.info.rdns.trim().toLowerCase() || undefined : undefined;
      const icon = typeof detail.info.icon === 'string' && /^data:image\//i.test(detail.info.icon)
        ? detail.info.icon : undefined;
      setWallets((current) => {
        // Some extensions re-announce with a new UUID and provider wrapper.
        // Prefer the stable wallet identity and preserve its original provider
        // so rediscovery cannot redirect a selected wallet's connection.
        const existing = current.find((item) => item.source === 'eip6963' && (
          item.provider === detail.provider
          || item.id === detail.info.uuid
          || (rdns && item.rdns === rdns)
          || ((!rdns || !item.rdns) && item.name.toLowerCase() === name.toLowerCase())
        ));
        const discovered = current.filter((item) => item.source !== 'legacy');
        if (existing) return discovered.map((item) => item === existing
          ? { ...item, rdns: item.rdns || rdns, icon: item.icon || icon } : item);
        return [...discovered, { id: detail.info.uuid, name, rdns, icon, source: 'eip6963', provider: detail.provider }];
      });
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

  const connectedWalletId = wallets.find((wallet) => wallet.provider === provider)?.id || null;
  return <EthereumContext.Provider value={{ wallets, address, chainId, connectedWalletId, connecting, error, discover, connect, disconnect }}>{children}</EthereumContext.Provider>;
}

export function useEthereumWallet() {
  const context = useContext(EthereumContext);
  if (!context) throw new Error('useEthereumWallet requires EthereumWalletProvider');
  return context;
}
