import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon } from 'lucide-react';
import { isAddress } from 'viem';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { Button } from '../ui/Button';
import {
  IDENTITY_REGISTRY_ADDRESS,
  identityRegistryAbi,
  isHexAddress,
  isIdentityConfigured,
  propertyShareAbi,
} from '../../contracts/config';

const fieldClass =
  'w-full bg-void-700 border border-void-600 text-cream-100 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-accent/40';

export type ComplianceListing = {
  id: string;
  title: string;
  token: `0x${string}`;
};

type InvestorComplianceModalProps = {
  isOpen: boolean;
  mode: 'recover' | 'force';
  fromWallet: `0x${string}` | null;
  investorLabel: string;
  listings: ComplianceListing[];
  onClose: () => void;
  onDone: () => void;
};

export function InvestorComplianceModal({
  isOpen,
  mode,
  fromWallet,
  investorLabel,
  listings,
  onClose,
  onDone,
}: InvestorComplianceModalProps) {
  const { isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('1');
  const [propertyId, setPropertyId] = useState('');
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<'idle' | 'identity' | 'shares'>('idle');

  useEffect(() => {
    if (isOpen) {
      setTo('');
      setAmount('1');
      setPropertyId(listings[0]?.id || '');
      setError('');
      setPhase('idle');
    }
  }, [isOpen, listings]);

  const busy = phase !== 'idle';
  const listing = listings.find((row) => row.id === propertyId) || listings[0];
  const recover = mode === 'recover';

  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  const handleSubmit = async () => {
    if (!fromWallet || !listing) return;
    if (!isAddress(to) || !isHexAddress(to)) {
      setError('Enter a valid destination wallet.');
      return;
    }
    if (to.toLowerCase() === fromWallet.toLowerCase()) {
      setError('Destination must be a different wallet.');
      return;
    }
    const shares = Number(amount);
    if (!recover && (!Number.isInteger(shares) || shares <= 0)) {
      setError('Enter a whole number of shares greater than zero.');
      return;
    }
    setError('');
    try {
      if (recover) {
        if (!isIdentityConfigured) {
          setError('Identity registry is not configured.');
          return;
        }
        setPhase('identity');
        const idHash = await writeContractAsync({
          address: IDENTITY_REGISTRY_ADDRESS as `0x${string}`,
          abi: identityRegistryAbi,
          functionName: 'recoverIdentity',
          args: [fromWallet, to as `0x${string}`],
        } as never);
        if (publicClient) await publicClient.waitForTransactionReceipt({ hash: idHash });
        setPhase('shares');
        const shareHash = await writeContractAsync({
          address: listing.token,
          abi: propertyShareAbi,
          functionName: 'recover',
          args: [fromWallet, to as `0x${string}`],
        } as never);
        if (publicClient) await publicClient.waitForTransactionReceipt({ hash: shareHash });
      } else {
        setPhase('shares');
        const hash = await writeContractAsync({
          address: listing.token,
          abi: propertyShareAbi,
          functionName: 'forcedTransfer',
          args: [fromWallet, to as `0x${string}`, BigInt(shares)],
        } as never);
        if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      }
      onDone();
    } catch (err) {
      const anyErr = err as { shortMessage?: string; message?: string };
      setError(
        anyErr.shortMessage ||
          anyErr.message ||
          (recover ? 'Recovery failed.' : 'Forced transfer failed.')
      );
      setPhase('idle');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && fromWallet && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-void-950/80 backdrop-blur-md z-50"
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-void-700 bg-void-800 shadow-xl p-6"
            >
              <div className="flex justify-between items-center mb-5">
                <h3 className="font-display text-xl font-semibold text-cream-100">
                  {recover ? 'Recover wallet' : 'Forced transfer'}
                </h3>
                <button
                  onClick={handleClose}
                  disabled={busy}
                  className="p-2 rounded-lg text-cream-400 hover:text-cream-100 hover:bg-void-700 disabled:opacity-50"
                >
                  <XIcon size={20} />
                </button>
              </div>
              <p className="text-cream-400 text-sm mb-5">
                {recover
                  ? `Move identity and all shares of the selected listing from ${investorLabel} to a replacement wallet. Onboard the replacement first, or recover will remap this ONCHAINID onto it. The lost wallet is unverified and frozen. Parked rent on that listing moves with the shares. Demo only — not a court order flow.`
                  : `Agent move of shares from ${investorLabel}. Bypasses lockup, listing freeze, and a frozen sender. The recipient must already be verified and not frozen.`}
              </p>
              {!isConnected && (
                <p className="text-amber-200 text-sm mb-4">Connect the protocol deployer (agent) wallet.</p>
              )}
              {listings.length === 0 && (
                <p className="text-amber-200 text-sm mb-4">No factory listings to move shares on.</p>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-cream-400 mb-1.5">Listing</label>
                  <select
                    className={fieldClass}
                    value={listing?.id || ''}
                    onChange={(e) => setPropertyId(e.target.value)}
                    disabled={busy || listings.length === 0}
                  >
                    {listings.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-cream-400 mb-1.5">
                    {recover ? 'Replacement wallet' : 'Recipient wallet'}
                  </label>
                  <input
                    className={fieldClass}
                    value={to}
                    onChange={(e) => setTo(e.target.value.trim())}
                    placeholder="0x…"
                    disabled={busy}
                  />
                </div>
                {!recover && (
                  <div>
                    <label className="block text-sm font-medium text-cream-400 mb-1.5">Shares</label>
                    <input
                      className={fieldClass}
                      type="number"
                      min={1}
                      step={1}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      disabled={busy}
                    />
                  </div>
                )}
              </div>
              {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
              <Button
                className="mt-5"
                fullWidth
                disabled={busy || !isConnected || !listing}
                onClick={handleSubmit}
              >
                {phase === 'identity'
                  ? 'Recovering identity…'
                  : phase === 'shares'
                    ? recover
                      ? 'Moving shares…'
                      : 'Transferring…'
                    : recover
                      ? 'Recover identity and shares'
                      : 'Forced transfer'}
              </Button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
