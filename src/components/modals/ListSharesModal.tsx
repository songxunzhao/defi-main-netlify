import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon } from 'lucide-react';
import { formatUnits } from 'viem';
import { useAccount, usePublicClient, useReadContract, useWriteContract } from 'wagmi';
import { Button } from '../ui/Button';
import {
  SHARE_MARKET_ADDRESS,
  erc20Abi,
  isMarketConfigured,
  shareMarketAbi,
} from '../../contracts/config';
import { usdcToOnChain } from '../../utils/pricing';

const fieldClass =
  'w-full bg-void-700 border border-void-600 text-cream-100 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-accent/40';

type ListSharesModalProps = {
  isOpen: boolean;
  propertyId: string;
  propertyTitle: string;
  token: `0x${string}` | null;
  maxShares: number;
  defaultPriceUsdc: number;
  onClose: () => void;
  onListed: () => void;
};

export function ListSharesModal({
  isOpen,
  propertyId,
  propertyTitle,
  token,
  maxShares,
  defaultPriceUsdc,
  onClose,
  onListed,
}: ListSharesModalProps) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [amount, setAmount] = useState('1');
  const [price, setPrice] = useState('1');
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<'idle' | 'approving' | 'listing'>('idle');

  const { data: allowance } = useReadContract({
    address: token || undefined,
    abi: erc20Abi,
    functionName: 'allowance',
    args:
      address && isMarketConfigured
        ? [address, SHARE_MARKET_ADDRESS as `0x${string}`]
        : undefined,
    query: { enabled: Boolean(token && address && isMarketConfigured) },
  });

  useEffect(() => {
    if (isOpen) {
      setAmount('1');
      setPrice(String(defaultPriceUsdc || 1));
      setError('');
      setPhase('idle');
    }
  }, [isOpen, defaultPriceUsdc]);

  const busy = phase !== 'idle';
  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  const handleList = async () => {
    if (!token || !isMarketConfigured) return;
    const shares = Number(amount);
    const usd = Number(price);
    if (!Number.isInteger(shares) || shares <= 0 || shares > maxShares) {
      setError(`Enter a whole number of shares between 1 and ${maxShares}.`);
      return;
    }
    if (!(usd > 0)) {
      setError('Price per share must be greater than zero.');
      return;
    }
    const shareAmount = BigInt(shares);
    const unitPrice = usdcToOnChain(usd);
    setError('');
    try {
      if ((allowance ?? 0n) < shareAmount) {
        setPhase('approving');
        const approveHash = await writeContractAsync({
          address: token,
          abi: erc20Abi,
          functionName: 'approve',
          args: [SHARE_MARKET_ADDRESS as `0x${string}`, shareAmount],
        } as never);
        if (publicClient) await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }
      setPhase('listing');
      const hash = await writeContractAsync({
        address: SHARE_MARKET_ADDRESS as `0x${string}`,
        abi: shareMarketAbi,
        functionName: 'list',
        args: [BigInt(propertyId), shareAmount, unitPrice],
      } as never);
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      onListed();
    } catch (err) {
      const anyErr = err as { shortMessage?: string; message?: string };
      setError(anyErr.shortMessage || anyErr.message || 'Could not list shares.');
      setPhase('idle');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && token && (
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
                <h3 className="font-display text-xl font-semibold text-cream-100">List shares</h3>
                <button
                  onClick={handleClose}
                  disabled={busy}
                  className="p-2 rounded-lg text-cream-400 hover:text-cream-100 hover:bg-void-700 disabled:opacity-50"
                >
                  <XIcon size={20} />
                </button>
              </div>
              <p className="text-cream-400 text-sm mb-5">
                Post a KYC-gated ask for {propertyTitle}. Shares stay in your wallet until someone fills.
                Buyer and seller must both be verified on-chain.
              </p>
              {!isConnected && <p className="text-amber-200 text-sm mb-4">Connect the wallet that holds the shares.</p>}
              {!isMarketConfigured && (
                <p className="text-amber-200 text-sm mb-4">Set VITE_SHARE_MARKET_ADDRESS after deploying ShareMarket.</p>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-cream-400 mb-1.5">Shares (max {maxShares})</label>
                  <input
                    className={fieldClass}
                    type="number"
                    min={1}
                    max={maxShares}
                    step={1}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-cream-400 mb-1.5">Price per share (USDC)</label>
                  <input
                    className={fieldClass}
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
              </div>
              {allowance !== undefined && (
                <p className="text-cream-400 text-xs mt-2">Market allowance: {formatUnits(allowance, 0)} shares</p>
              )}
              {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
              <Button className="mt-5" fullWidth disabled={busy || !isConnected || !isMarketConfigured} onClick={handleList}>
                {phase === 'approving' ? 'Approve shares…' : phase === 'listing' ? 'Listing…' : 'List ask'}
              </Button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
