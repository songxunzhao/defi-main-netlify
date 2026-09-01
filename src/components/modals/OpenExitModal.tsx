import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon } from 'lucide-react';
import { formatUnits } from 'viem';
import { useAccount, usePublicClient, useReadContract, useWriteContract } from 'wagmi';
import { Button } from '../ui/Button';
import {
  USDC_ADDRESS,
  erc20Abi,
  isHexAddress,
  isUsdcConfigured,
  redemptionAbi,
} from '../../contracts/config';
import { usdcToOnChain } from '../../utils/pricing';

const fieldClass =
  'w-full bg-void-700 border border-void-600 text-cream-100 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-accent/40';

type OpenExitModalProps = {
  isOpen: boolean;
  propertyTitle: string;
  redemption: `0x${string}` | null;
  onClose: () => void;
  onOpened: () => void;
};

export function OpenExitModal({ isOpen, propertyTitle, redemption, onClose, onOpened }: OpenExitModalProps) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [amount, setAmount] = useState('10000');
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<'idle' | 'approving' | 'opening'>('idle');

  const { data: usdcFromPool } = useReadContract({
    address: redemption || undefined,
    abi: redemptionAbi,
    functionName: 'usdc',
    query: { enabled: Boolean(redemption) },
  });
  const usdcAddress = isHexAddress(USDC_ADDRESS)
    ? USDC_ADDRESS
    : isHexAddress(usdcFromPool)
      ? usdcFromPool
      : undefined;

  const { data: allowance } = useReadContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && redemption ? [address, redemption] : undefined,
    query: { enabled: Boolean(usdcAddress && address && redemption) },
  });

  useEffect(() => {
    if (isOpen) {
      setAmount('10000');
      setError('');
      setPhase('idle');
    }
  }, [isOpen]);

  const busy = phase !== 'idle';
  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  const handleOpen = async () => {
    if (!redemption || !usdcAddress || !address) return;
    const usd = Number(amount);
    if (!(usd > 0)) {
      setError('Enter sale proceeds greater than zero.');
      return;
    }
    const value = usdcToOnChain(usd);
    setError('');
    try {
      if ((allowance ?? 0n) < value) {
        setPhase('approving');
        const approveHash = await writeContractAsync({
          address: usdcAddress,
          abi: erc20Abi,
          functionName: 'approve',
          args: [redemption, value],
        } as never);
        if (publicClient) await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }
      setPhase('opening');
      const hash = await writeContractAsync({
        address: redemption,
        abi: redemptionAbi,
        functionName: 'open',
        args: [value],
      } as never);
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      onOpened();
    } catch (err) {
      const anyErr = err as { shortMessage?: string; message?: string };
      setError(anyErr.shortMessage || anyErr.message || 'Could not open the exit.');
      setPhase('idle');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && redemption && (
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
                <h3 className="font-display text-xl font-semibold text-cream-100">Deposit sale proceeds</h3>
                <button
                  onClick={handleClose}
                  disabled={busy}
                  className="p-2 rounded-lg text-cream-400 hover:text-cream-100 hover:bg-void-700 disabled:opacity-50"
                >
                  <XIcon size={20} />
                </button>
              </div>
              <p className="text-cream-400 text-sm mb-5">
                Snapshot payout for {propertyTitle}: each outstanding share gets proceeds / supply. Transfers are already
                frozen. Holders redeem from their dashboard.
              </p>
              {!isConnected && <p className="text-amber-200 text-sm mb-4">Connect the admin wallet that holds USDC.</p>}
              {!isUsdcConfigured && !usdcAddress && <p className="text-amber-200 text-sm mb-4">USDC address is missing.</p>}
              <div>
                <label className="block text-sm font-medium text-cream-400 mb-1.5">Net proceeds (USDC)</label>
                <input
                  className={fieldClass}
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              {allowance !== undefined && usdcAddress && (
                <p className="text-cream-400 text-xs mt-2">Allowance: {formatUnits(allowance, 6)} USDC</p>
              )}
              {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
              <Button className="mt-5" fullWidth disabled={busy || !isConnected} onClick={handleOpen}>
                {phase === 'approving' ? 'Approve USDC…' : phase === 'opening' ? 'Opening exit…' : 'Open exit'}
              </Button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
