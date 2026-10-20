import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { WalletReadyState } from '@solana/wallet-adapter-base';
import { useWallet } from '@solana/wallet-adapter-react';
import { LoaderIcon, WalletIcon, XIcon } from 'lucide-react';
import { useWalletNotice } from '../../solana/provider';
import { useEthereumWallet } from '../../context/EthereumContext';

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

const rowClass = 'flex w-full items-center gap-3 rounded-xl border border-void-600 bg-void-700/40 px-4 py-3 text-left transition-colors hover:border-accent hover:bg-void-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-wait disabled:opacity-60';

export function ConnectWalletButton(_props: ConnectWalletButtonProps) {
  const solana = useWallet();
  const ethereum = useEthereumWallet();
  const { notice, clearNotice } = useWalletNotice();
  const [open, setOpen] = useState(false);
  const [pendingSolana, setPendingSolana] = useState('');
  const [pendingEthereum, setPendingEthereum] = useState('');
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const address = solana.publicKey?.toBase58() || ethereum.address;
  const installedSolana = solana.wallets.filter((wallet) => wallet.readyState === WalletReadyState.Installed);
  const busy = Boolean(pendingSolana || pendingEthereum || solana.connecting || ethereum.connecting);

  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);

  useEffect(() => {
    if (!pendingSolana || !solana.connected || solana.wallet?.adapter.name !== pendingSolana) return;
    setPendingSolana('');
    setOpen(false);
  }, [pendingSolana, solana.connected, solana.wallet]);

  useEffect(() => {
    if (!notice) return;
    setError(notice);
    setPendingSolana('');
    clearNotice();
  }, [notice, clearNotice]);

  const openPicker = () => {
    setError('');
    clearNotice();
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
              <h2 id={titleId} className="font-display text-xl font-semibold">Connect a wallet</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close wallet picker" className="rounded-lg p-2 text-cream-400 hover:bg-void-700 hover:text-cream-100"><XIcon size={20} /></button>
            </div>
            <p id={descriptionId} className="mb-5 text-sm leading-relaxed text-cream-400">Choose an installed wallet. Unlock and approve the connection in your wallet’s window.</p>
            <div className="grid gap-3">
              {installedSolana.map(({ adapter }) => {
                const connected = solana.connected && solana.wallet?.adapter === adapter;
                const pending = pendingSolana === adapter.name;
                return (
                  <button
                    type="button"
                    key={`solana:${adapter.name}`}
                    disabled={busy}
                    aria-busy={pending}
                    onClick={() => {
                      if (busy) return;
                      setError('');
                      clearNotice();
                      if (connected) {
                        void solana.disconnect().catch((err) => setError(err.message || 'Could not disconnect the wallet.'));
                        return;
                      }
                      setPendingSolana(adapter.name);
                      if (solana.wallet?.adapter === adapter) {
                        void solana.connect().catch((err) => {
                          setError(err.message || 'Could not connect the wallet.');
                          setPendingSolana('');
                        });
                      } else {
                        // WalletProvider connects the newly selected adapter.
                        solana.select(adapter.name);
                      }
                    }}
                    className={rowClass}
                  >
                    <ExtensionIcon src={adapter.icon} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{adapter.name}</span>
                      <span className="block text-xs text-cream-400">Solana{connected && solana.publicKey ? ` · ${shortAddress(solana.publicKey.toBase58())}` : ''}</span>
                    </span>
                    {pending ? <LoaderIcon size={18} className="animate-spin text-accent" /> : <span className="text-xs text-accent">{connected ? 'Disconnect' : 'Connect'}</span>}
                  </button>
                );
              })}
              {!ethereum.address && ethereum.wallets.map((wallet) => {
                const pending = pendingEthereum === wallet.id;
                return (
                  <button
                    type="button"
                    key={`evm:${wallet.id}`}
                    disabled={busy}
                    aria-busy={pending}
                    onClick={async () => {
                      if (busy) return;
                      setError('');
                      setPendingEthereum(wallet.id);
                      const connected = await ethereum.connect(wallet);
                      setPendingEthereum('');
                      if (connected) setOpen(false);
                    }}
                    className={rowClass}
                  >
                    <ExtensionIcon src={wallet.icon} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{wallet.name}</span>
                      <span className="block text-xs text-cream-400">Ethereum / EVM</span>
                    </span>
                    {pending ? <LoaderIcon size={18} className="animate-spin text-accent" /> : <span className="text-xs text-accent">Connect</span>}
                  </button>
                );
              })}
              {ethereum.address && (
                <div className="flex items-center gap-3 rounded-xl border border-void-600 px-4 py-3">
                  <WalletIcon className="h-8 w-8 text-cream-400" aria-hidden="true" />
                  <span className="flex-1 text-sm">{shortAddress(ethereum.address)}<span className="block text-xs text-cream-400">Ethereum / EVM</span></span>
                  <button type="button" disabled={busy} onClick={ethereum.disconnect} className="text-xs text-accent disabled:opacity-60">Disconnect</button>
                </div>
              )}
              {!installedSolana.length && !ethereum.wallets.length && (
                <div className="rounded-xl border border-dashed border-void-600 px-4 py-6 text-center">
                  <WalletIcon size={32} className="mx-auto mb-3 text-cream-400" />
                  <p className="text-sm font-medium">No wallet extensions detected</p>
                  <p className="mt-2 text-sm text-cream-400">Enable a compatible wallet extension for this site, then refresh this page.</p>
                  <button type="button" onClick={ethereum.discover} className="mt-4 text-sm font-semibold text-accent">Check again</button>
                </div>
              )}
            </div>
            {(error || ethereum.error) && <p role="alert" className="mt-4 rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-300">{error || ethereum.error}</p>}
            {busy && <p role="status" className="mt-4 text-sm text-cream-400">Waiting for your wallet. Check its window to continue.</p>}
            <p className="mt-5 text-xs leading-relaxed text-cream-400">RealtyChain transactions use Solana. Your wallet handles passwords and connection approval.</p>
          </div>
        </dialog>, document.body,
      )}
    </>
  );
}
