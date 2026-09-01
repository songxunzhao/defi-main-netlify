import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon } from 'lucide-react';
import { formatUnits } from 'viem';
import { useAccount, usePublicClient, useReadContract, useWriteContract } from 'wagmi';
import { Button } from '../ui/Button';
import {
  SHARE_MARKET_ADDRESS,
  USDC_ADDRESS,
  erc20Abi,
  isHexAddress,
  isMarketConfigured,
  isUsdcConfigured,
  shareMarketAbi,
} from '../../contracts/config';
import { ShareAsk } from '../../hooks/useAsks';
import { canInvest } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const fieldClass =
  'w-full bg-void-700 border border-void-600 text-cream-100 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-accent/40';

type FillAskModalProps = {
  isOpen: boolean;
  ask: ShareAsk | null;
  propertyTitle: string;
  onClose: () => void;
  onFilled: () => void;
};

export function FillAskModal({ isOpen, ask, propertyTitle, onClose, onFilled }: FillAskModalProps) {
  const { user } = useAuth();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [amount, setAmount] = useState('1');
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<'idle' | 'approving' | 'filling'>('idle');

  const { data: usdcFromMarket } = useReadContract({
    address: isMarketConfigured ? (SHARE_MARKET_ADDRESS as `0x${string}`) : undefined,
    abi: shareMarketAbi,
    functionName: 'usdc',
    query: { enabled: isMarketConfigured },
  });
  const usdcAddress = isHexAddress(USDC_ADDRESS)
    ? USDC_ADDRESS
    : isHexAddress(usdcFromMarket)
      ? usdcFromMarket
      : undefined;

  const shares = ask ? BigInt(Math.max(0, Number(amount) || 0)) : 0n;
  const cost = ask ? ask.price * shares : 0n;

  const { data: allowance } = useReadContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args:
      address && isMarketConfigured
        ? [address, SHARE_MARKET_ADDRESS as `0x${string}`]
        : undefined,
    query: { enabled: Boolean(usdcAddress && address && isMarketConfigured) },
  });

  useEffect(() => {
    if (isOpen && ask) {
      setAmount(ask.amount.toString());
      setError('');
      setPhase('idle');
    }
  }, [isOpen, ask]);

  const busy = phase !== 'idle';
  const eligible = canInvest(user, address);
  const isOwnAsk = Boolean(ask && address && ask.seller.toLowerCase() === address.toLowerCase());

  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  const handleFill = async () => {
    if (!ask || !usdcAddress || !isMarketConfigured) return;
    const n = Number(amount);
    if (!Number.isInteger(n) || n <= 0 || n > Number(ask.amount)) {
      setError(`Enter a whole number of shares between 1 and ${ask.amount}.`);
      return;
    }
    if (isOwnAsk) {
      setError('You cannot fill your own ask.');
      return;
    }
    if (!eligible) {
      setError('Fill requires approved KYC, accreditation, and the wallet linked to this account.');
      return;
    }
    setError('');
    try {
      if ((allowance ?? 0n) < cost) {
        setPhase('approving');
        const approveHash = await writeContractAsync({
          address: usdcAddress,
          abi: erc20Abi,
          functionName: 'approve',
          args: [SHARE_MARKET_ADDRESS as `0x${string}`, cost],
        } as never);
        if (publicClient) await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }
      setPhase('filling');
      const hash = await writeContractAsync({
        address: SHARE_MARKET_ADDRESS as `0x${string}`,
        abi: shareMarketAbi,
        functionName: 'fill',
        args: [ask.id, BigInt(n)],
      } as never);
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      onFilled();
    } catch (err) {
      const anyErr = err as { shortMessage?: string; message?: string };
      setError(anyErr.shortMessage || anyErr.message || 'Fill failed. Both wallets must be verified on-chain.');
      setPhase('idle');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && ask && (
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
                <h3 className="font-display text-xl font-semibold text-cream-100">Buy from ask</h3>
                <button
                  onClick={handleClose}
                  disabled={busy}
                  className="p-2 rounded-lg text-cream-400 hover:text-cream-100 hover:bg-void-700 disabled:opacity-50"
                >
                  <XIcon size={20} />
                </button>
              </div>
              <p className="text-cream-400 text-sm mb-5">
                {propertyTitle}: {formatUnits(ask.price, 6)} USDC per share. Seller {ask.seller.slice(0, 6)}…
                {ask.seller.slice(-4)}. This is not an open DEX.
              </p>
              {!isConnected && <p className="text-amber-200 text-sm mb-4">Connect a verified wallet to fill.</p>}
              {!isUsdcConfigured && !usdcAddress && <p className="text-amber-200 text-sm mb-4">USDC address is missing.</p>}
              {isOwnAsk && <p className="text-amber-200 text-sm mb-4">This is your ask. Cancel it from the market instead of filling.</p>}
              <div>
                <label className="block text-sm font-medium text-cream-400 mb-1.5">
                  Shares (max {ask.amount.toString()})
                </label>
                <input
                  className={fieldClass}
                  type="number"
                  min={1}
                  max={Number(ask.amount)}
                  step={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <p className="text-cream-100 text-sm mt-3">
                Cost: <span className="text-accent font-medium">{formatUnits(cost, 6)} USDC</span>
              </p>
              {allowance !== undefined && usdcAddress && (
                <p className="text-cream-400 text-xs mt-2">Allowance: {formatUnits(allowance, 6)} USDC</p>
              )}
              {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
              <Button className="mt-5" fullWidth disabled={busy || !isConnected || isOwnAsk} onClick={handleFill}>
                {phase === 'approving' ? 'Approve USDC…' : phase === 'filling' ? 'Filling…' : 'Fill ask'}
              </Button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
