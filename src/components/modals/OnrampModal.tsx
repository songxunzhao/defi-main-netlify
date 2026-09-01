import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon } from 'lucide-react';
import { formatUnits } from 'viem';
import { useAccount, usePublicClient, useReadContract, useWriteContract } from 'wagmi';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { useAuth } from '../../context/AuthContext';
import {
  USDC_ADDRESS,
  erc20Abi,
  isMoonpayConfigured,
  isUsdcConfigured,
  isUsdcFaucetEnabled,
  moonpayBuyUrl,
  mockUsdcAbi,
} from '../../contracts/config';
import { usdcToOnChain } from '../../utils/pricing';

const fieldClass =
  'w-full bg-void-700 border border-void-600 text-cream-100 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-accent/40';

type OnrampModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function OnrampModal({ isOpen, onClose }: OnrampModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [amount, setAmount] = useState('1000');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const { data: balance, refetch } = useReadContract({
    address: isUsdcConfigured ? (USDC_ADDRESS as `0x${string}`) : undefined,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(isOpen && isUsdcConfigured && address) },
  });

  useEffect(() => {
    if (isOpen) {
      setAmount('1000');
      setError('');
      setBusy(false);
    }
  }, [isOpen]);

  const kycOk = user?.kycStatus === 'approved';
  const walletOk = Boolean(isConnected && address && user?.walletAddress && address.toLowerCase() === user.walletAddress.toLowerCase());

  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  const handleFaucet = async () => {
    if (!address || !isUsdcConfigured) return;
    const usd = Number(amount);
    if (!(usd > 0)) {
      setError('Enter an amount greater than zero.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const hash = await writeContractAsync({
        address: USDC_ADDRESS as `0x${string}`,
        abi: mockUsdcAbi,
        functionName: 'mint',
        args: [address, usdcToOnChain(usd)],
      } as never);
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      await refetch();
      onClose();
    } catch (err) {
      const anyErr = err as { shortMessage?: string; message?: string };
      setError(
        anyErr.shortMessage ||
          anyErr.message ||
          'Faucet mint failed. This only works on MockUSDC (local/demo), not canonical USDC.'
      );
      setBusy(false);
    }
  };

  const handleMoonpay = () => {
    if (!address) return;
    const usd = Number(amount);
    const url = moonpayBuyUrl(address, Number.isFinite(usd) && usd > 0 ? usd : undefined);
    if (!url) {
      setError('MoonPay is not configured. Set VITE_MOONPAY_PUBLISHABLE_KEY.');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-void-950/80 backdrop-blur-md z-[60]"
          />
          <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-void-700 bg-void-800 shadow-xl p-6"
            >
              <div className="flex justify-between items-center mb-5">
                <h3 className="font-display text-xl font-semibold text-cream-100">Get USDC</h3>
                <button
                  onClick={handleClose}
                  disabled={busy}
                  className="p-2 rounded-lg text-cream-400 hover:text-cream-100 hover:bg-void-700 disabled:opacity-50"
                >
                  <XIcon size={20} />
                </button>
              </div>
              <p className="text-cream-400 text-sm mb-5">
                Fiat on-ramp after KYC. The demo faucet mints MockUSDC on local/test chains. MoonPay is a third-party
                card/bank on-ramp when a publishable key is set. This is not a bank and not a live securities purchase.
              </p>
              {!kycOk && (
                <p className="text-amber-200 text-sm mb-4">
                  Approve KYC first.{' '}
                  <button type="button" className="text-accent hover:underline" onClick={() => navigate('/kyc')}>
                    Go to Verify
                  </button>
                </p>
              )}
              {kycOk && !walletOk && (
                <p className="text-amber-200 text-sm mb-4">Connect and link the wallet on this account under Dashboard.</p>
              )}
              {balance !== undefined && (
                <p className="text-cream-400 text-xs mb-3">Balance: {formatUnits(balance, 6)} USDC</p>
              )}
              <div className="mb-4">
                <label className="block text-sm font-medium text-cream-400 mb-1.5">Amount (USD / USDC)</label>
                <input
                  className={fieldClass}
                  type="number"
                  min={1}
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={busy}
                />
              </div>
              {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
              <div className="space-y-2">
                {isUsdcFaucetEnabled && (
                  <Button fullWidth disabled={busy || !kycOk || !walletOk} onClick={handleFaucet}>
                    {busy ? 'Minting MockUSDC…' : 'Mint demo USDC'}
                  </Button>
                )}
                {isMoonpayConfigured && (
                  <Button
                    variant={isUsdcFaucetEnabled ? 'outline' : 'primary'}
                    fullWidth
                    disabled={!kycOk || !walletOk}
                    onClick={handleMoonpay}
                  >
                    Continue with MoonPay
                  </Button>
                )}
                {!isUsdcFaucetEnabled && !isMoonpayConfigured && (
                  <p className="text-cream-400 text-sm">
                    No on-ramp is configured. For local demo set demo mode (default) against MockUSDC, or add{' '}
                    <span className="font-mono text-cream-200">VITE_MOONPAY_PUBLISHABLE_KEY</span>.
                  </p>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
