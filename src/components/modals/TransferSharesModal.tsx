import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon } from 'lucide-react';
import { isAddress } from 'viem';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { Button } from '../ui/Button';
import { erc20Abi, isHexAddress } from '../../contracts/config';

const fieldClass =
  'w-full bg-void-700 border border-void-600 text-cream-100 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-accent/40';

type TransferSharesModalProps = {
  isOpen: boolean;
  propertyTitle: string;
  token: `0x${string}` | null;
  maxShares: number;
  onClose: () => void;
  onSent: () => void;
};

export function TransferSharesModal({
  isOpen,
  propertyTitle,
  token,
  maxShares,
  onClose,
  onSent,
}: TransferSharesModalProps) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('1');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTo('');
      setAmount('1');
      setError('');
      setBusy(false);
    }
  }, [isOpen]);

  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  const handleSend = async () => {
    if (!token || !address) return;
    const shares = Number(amount);
    if (!isAddress(to) || !isHexAddress(to)) {
      setError('Enter a valid recipient wallet.');
      return;
    }
    if (to.toLowerCase() === address.toLowerCase()) {
      setError('Recipient must be a different wallet.');
      return;
    }
    if (!Number.isInteger(shares) || shares <= 0 || shares > maxShares) {
      setError(`Enter a whole number of shares between 1 and ${maxShares}.`);
      return;
    }
    setError('');
    setBusy(true);
    try {
      const hash = await writeContractAsync({
        address: token,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [to as `0x${string}`, BigInt(shares)],
      } as never);
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      onSent();
    } catch (err) {
      const anyErr = err as { shortMessage?: string; message?: string };
      setError(anyErr.shortMessage || anyErr.message || 'Transfer failed. Recipient must be verified and not frozen, and lockup must have elapsed.');
      setBusy(false);
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
                <h3 className="font-display text-xl font-semibold text-cream-100">Send shares</h3>
                <button
                  onClick={handleClose}
                  disabled={busy}
                  className="p-2 rounded-lg text-cream-400 hover:text-cream-100 hover:bg-void-700 disabled:opacity-50"
                >
                  <XIcon size={20} />
                </button>
              </div>
              <p className="text-cream-400 text-sm mb-5">
                Transfer {propertyTitle} shares to another verified wallet. This is not a sale — no USDC moves.
              </p>
              {!isConnected && <p className="text-amber-200 text-sm mb-4">Connect the wallet that holds the shares.</p>}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-cream-400 mb-1.5">Recipient</label>
                  <input
                    className={fieldClass}
                    placeholder="0x…"
                    value={to}
                    onChange={(e) => setTo(e.target.value.trim())}
                  />
                </div>
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
              </div>
              {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
              <Button className="mt-5" fullWidth disabled={busy || !isConnected} onClick={handleSend}>
                {busy ? 'Sending…' : 'Send shares'}
              </Button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
