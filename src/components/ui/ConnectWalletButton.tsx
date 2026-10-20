import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { WalletReadyState } from '@solana/wallet-adapter-base';
import { useWallet, type Wallet } from '@solana/wallet-adapter-react';
import { WalletIcon, XIcon } from 'lucide-react';
import { openWalletDemo } from '../../utils/walletDemo';
import { useEthereumWallet, type BrowserWallet } from '../../context/EthereumContext';

type ConnectWalletButtonProps = {
  showBalance?: boolean;
};

function shortAddress(value: string) {
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function ExtensionIcon({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return src && !failed
    ? <img src={src} alt="" className="h-8 w-8 rounded-lg object-contain" onError={() => setFailed(true)} />
    : <WalletIcon aria-hidden="true" className="h-8 w-8 text-cream-400" />;
}

// Match the same extension across Wallet Standard, legacy adapters, and EVM.
// Discovery supplies display metadata only; Connect opens the generic demo.
function walletIdentity(name: string) {
  const normalized = name.toLowerCase().replace(/\b(solana|ethereum|evm)\b/g, '').replace(/[^a-z0-9]/g, '');
  if (normalized === 'trust' || normalized === 'trustwallet') return 'trustwallet';
  if (normalized === 'metamask' || normalized === 'metamaskwallet') return 'metamask';
  return normalized;
}

type WalletGroup = {
  id: string;
  name: string;
  icon?: string;
  solana?: Wallet['adapter'];
  ethereum?: BrowserWallet;
};

export function ConnectWalletButton(_props: ConnectWalletButtonProps) {
  const solana = useWallet();
  const ethereum = useEthereumWallet();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const address = solana.publicKey?.toBase58() || ethereum.address;
  const groups = new Map<string, WalletGroup>();
  for (const { adapter, readyState } of solana.wallets) {
    if (readyState !== WalletReadyState.Installed) continue;
    const id = walletIdentity(adapter.name);
    const existing = groups.get(id);
    // Prefer the active adapter when duplicate Solana registrations exist.
    if (!existing || (solana.connected && solana.wallet?.adapter === adapter)) {
      groups.set(id, { ...existing, id, name: adapter.name, icon: adapter.icon, solana: adapter });
    }
  }
  for (const wallet of ethereum.wallets) {
    const id = walletIdentity(wallet.name);
    const existing = groups.get(id);
    if (!existing?.ethereum || wallet.id === ethereum.connectedWalletId) {
      groups.set(id, { ...existing, id, name: wallet.name, icon: wallet.icon || existing?.icon, ethereum: wallet });
    }
  }

  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);

  const openPicker = () => {
    setError('');
    ethereum.discover();
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        aria-haspopup="dialog"
        className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-void-950"
      >
        {address ? shortAddress(address) : 'Connect Wallet'}
      </button>
      {typeof document !== 'undefined' && createPortal(
        <dialog
          ref={dialog}
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          onCancel={() => setOpen(false)}
          onClose={() => setOpen(false)}
          onClick={(event) => { if (event.target === dialog.current) setOpen(false); }}
          className="m-auto max-h-[85vh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-void-600 bg-void-800 p-0 text-cream-100 shadow-xl backdrop:bg-black/70 backdrop:backdrop-blur-md"
        >
          <div className="p-6">
            <div className="mb-3 flex items-center justify-between gap-4">
              <h2 id={titleId} className="font-display text-xl font-semibold">Wallet connection demo</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close wallet picker" className="rounded-lg p-2 text-cream-400 hover:bg-void-700 hover:text-cream-100"><XIcon size={20} /></button>
            </div>
            <p id={descriptionId} className="mb-5 text-sm leading-relaxed text-cream-400">Simulation only. Connect opens a generic demo window using a dummy password.</p>
            <div className="grid gap-3">
              {[...groups.values()].flatMap((group) => [
                ...(group.solana ? [{ ...group, network: 'solana' as const }] : []),
                ...(group.ethereum ? [{ ...group, network: 'evm' as const }] : []),
              ]).map((group) => {
                const network = group.network;
                return (
                  <div key={`${group.id}:${network}`} data-wallet={group.id} data-network={network} className="flex w-full items-center gap-3 rounded-xl border border-void-600 bg-void-700/40 px-4 py-3">
                    <ExtensionIcon src={group.icon} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{group.name}</p>
                      <p className="text-xs text-cream-400">{network === 'solana' ? 'Solana' : 'Ethereum / EVM'}</p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Preview ${group.name} on ${network === 'solana' ? 'Solana' : 'Ethereum / EVM'}`}
                      className="shrink-0 rounded-lg px-2 py-2 text-sm font-semibold text-accent hover:bg-void-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      onClick={() => {
                        setError('');
                        if (openWalletDemo()) setOpen(false);
                        else setError('Allow popups for this site, then try the demo again.');
                      }}
                    >
                      Connect
                    </button>
                  </div>
                );
              })}
              {!groups.size && (
                <div className="rounded-xl border border-dashed border-void-600 px-4 py-6 text-center">
                  <WalletIcon size={32} className="mx-auto mb-3 text-cream-400" />
                  <p className="text-sm font-medium">No wallet extensions detected</p>
                  <p className="mt-2 text-sm text-cream-400">Enable a compatible wallet extension for this site, then refresh this page.</p>
                  <button type="button" onClick={ethereum.discover} className="mt-4 text-sm font-semibold text-accent">Check again</button>
                </div>
              )}
            </div>
            {error && <p role="alert" className="mt-4 rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-300">{error}</p>}
          </div>
        </dialog>, document.body,
      )}
    </>
  );
}
