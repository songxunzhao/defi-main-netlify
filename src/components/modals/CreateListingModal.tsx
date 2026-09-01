import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon } from 'lucide-react';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { Button } from '../ui/Button';
import { Property } from '../../utils/types';
import { sharePriceUsdc, shareSymbol, usdcToOnChain } from '../../utils/pricing';
import { updateProperty } from '../../utils/api';
import {
  PROPERTY_FACTORY_ADDRESS,
  isFactoryConfigured,
  isHexAddress,
  propertyFactoryAbi,
} from '../../contracts/config';
import { listingFromResult } from '../../hooks/useListing';
import { parseBytes32, ZERO_BYTES32 } from '../../utils/subscription';

const fieldClass =
  'w-full bg-void-700 border border-void-600 text-cream-100 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-accent/40';

type CreateListingModalProps = {
  isOpen: boolean;
  property: Property | null;
  onClose: () => void;
  onDeployed: () => void;
};

export function CreateListingModal({ isOpen, property, onClose, onDeployed }: CreateListingModalProps) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [symbol, setSymbol] = useState('SHR');
  const [priceUsd, setPriceUsd] = useState('100');
  const [cap, setCap] = useState('1000');
  const [minTicket, setMinTicket] = useState('1');
  const [lockupDays, setLockupDays] = useState('0');
  const [maxPerWallet, setMaxPerWallet] = useState('0');
  const [minRaise, setMinRaise] = useState('0');
  const [closeDays, setCloseDays] = useState('0');
  const [documentsHash, setDocumentsHash] = useState('');
  const [beneficiary, setBeneficiary] = useState('');
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<'idle' | 'signing' | 'distributor' | 'saving'>('idle');

  useEffect(() => {
    if (!property || !isOpen) return;
    setSymbol(shareSymbol(property.title));
    setPriceUsd(String(sharePriceUsdc(property)));
    setCap(String(property.totalTokens || 1000));
    setMinTicket('1');
    setLockupDays('0');
    setMaxPerWallet('0');
    setMinRaise('0');
    setCloseDays('0');
    setDocumentsHash('');
    setBeneficiary(address || '');
    setError('');
    setPhase('idle');
  }, [property, isOpen, address]);

  const busy = phase !== 'idle';

  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  const handleDeploy = async () => {
    if (!property || !isFactoryConfigured) return;
    setError('');
    const payTo = beneficiary || address || '';
    if (!isHexAddress(payTo)) {
      setError('Connect a wallet or enter a USDC beneficiary address.');
      return;
    }
    const price = Number(priceUsd);
    const capShares = Number(cap);
    const ticket = Number(minTicket);
    if (!(price > 0) || !(capShares > 0) || !(ticket > 0)) {
      setError('Price, cap, and min ticket must be greater than zero.');
      return;
    }
    const days = Number(lockupDays) || 0;
    const unlockTime = days > 0 ? BigInt(Math.floor(Date.now() / 1000) + Math.round(days * 86400)) : 0n;
    const walletMax = Number(maxPerWallet);
    const raiseMin = Number(minRaise);
    const close = Number(closeDays) || 0;
    if (!Number.isInteger(walletMax) || walletMax < 0 || !Number.isInteger(raiseMin) || raiseMin < 0) {
      setError('Max per wallet and min raise must be whole numbers (0 = no extra limit).');
      return;
    }
    if (raiseMin > 0 && close <= 0) {
      setError('A min raise needs a close window so unsold escrow can refund.');
      return;
    }
    const hash = parseBytes32(documentsHash);
    if (!hash) {
      setError('Document hash must be empty or a 32-byte hex (keccak of the PPM).');
      return;
    }
    const closesAt = close > 0 ? BigInt(Math.floor(Date.now() / 1000) + Math.round(close * 86400)) : 0n;
    try {
      setPhase('signing');
      const txHash = await writeContractAsync({
        address: PROPERTY_FACTORY_ADDRESS as `0x${string}`,
        abi: propertyFactoryAbi,
        functionName: 'createListing',
        args: [
          BigInt(property.id),
          property.title,
          symbol.slice(0, 8),
          payTo,
          usdcToOnChain(price),
          BigInt(capShares),
          BigInt(ticket),
          unlockTime,
          BigInt(walletMax),
          BigInt(raiseMin),
          closesAt,
          hash === ZERO_BYTES32 ? ZERO_BYTES32 : hash,
        ],
      } as never);
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: txHash });
        const result = await publicClient.readContract({
          address: PROPERTY_FACTORY_ADDRESS as `0x${string}`,
          abi: propertyFactoryAbi,
          functionName: 'getListing',
          args: [BigInt(property.id)],
        });
        const listing = listingFromResult(result);
        setPhase('distributor');
        let distributorAddress: `0x${string}` | undefined;
        try {
          const distHash = await writeContractAsync({
            address: PROPERTY_FACTORY_ADDRESS as `0x${string}`,
            abi: propertyFactoryAbi,
            functionName: 'createDistributor',
            args: [BigInt(property.id)],
          } as never);
          await publicClient.waitForTransactionReceipt({ hash: distHash });
          const dist = await publicClient.readContract({
            address: PROPERTY_FACTORY_ADDRESS as `0x${string}`,
            abi: propertyFactoryAbi,
            functionName: 'getDistributor',
            args: [BigInt(property.id)],
          });
          if (typeof dist === 'string' && dist !== '0x0000000000000000000000000000000000000000') {
            distributorAddress = dist as `0x${string}`;
          }
        } catch {
          // Listing is still usable; admin can enable distributions later.
        }
        setPhase('saving');
        if (listing?.exists) {
          await updateProperty(property.id, {
            tokenAddress: listing.token,
            offeringAddress: listing.offering,
            contractAddress: listing.token,
            sharePriceUsdc: price,
            totalTokens: capShares,
            status: 'Available',
            tokensSold: 0,
            distributorAddress,
          });
        }
      }
      onDeployed();
    } catch (err) {
      const anyErr = err as { shortMessage?: string; message?: string };
      setError(anyErr.shortMessage || anyErr.message || 'Deploy failed.');
      setPhase('idle');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && property && (
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
              className="w-full max-w-md rounded-2xl border border-void-700 bg-void-800 shadow-xl p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-5">
                <h3 className="font-display text-xl font-semibold text-cream-100">Deploy offering</h3>
                <button
                  onClick={handleClose}
                  disabled={busy}
                  className="p-2 rounded-lg text-cream-400 hover:text-cream-100 hover:bg-void-700 disabled:opacity-50"
                >
                  <XIcon size={20} />
                </button>
              </div>
              <p className="text-cream-400 text-sm mb-5">
                Deploys a share token and USDC offering for{' '}
                <span className="text-cream-200">{property.title}</span> (id {property.id}). Close days &gt; 0 escrows
                USDC until finalize; min raise below that refunds. A document hash requires an EIP-712 subscription
                signature. Use the factory admin wallet.
              </p>
              {!isFactoryConfigured && (
                <p className="text-amber-200 text-sm mb-4">Set VITE_PROPERTY_FACTORY_ADDRESS first.</p>
              )}
              {!isConnected && (
                <p className="text-amber-200 text-sm mb-4">Connect the protocol deployer wallet.</p>
              )}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-cream-400 mb-1.5">Symbol</label>
                  <input className={fieldClass} value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} maxLength={8} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-cream-400 mb-1.5">Share price (USDC)</label>
                    <input className={fieldClass} type="number" min={0.01} step="0.01" value={priceUsd} onChange={(e) => setPriceUsd(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-cream-400 mb-1.5">Cap (shares)</label>
                    <input className={fieldClass} type="number" min={1} value={cap} onChange={(e) => setCap(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-cream-400 mb-1.5">Min ticket</label>
                    <input className={fieldClass} type="number" min={1} value={minTicket} onChange={(e) => setMinTicket(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-cream-400 mb-1.5">Lockup (days)</label>
                    <input className={fieldClass} type="number" min={0} value={lockupDays} onChange={(e) => setLockupDays(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-cream-400 mb-1.5">Max per wallet</label>
                    <input className={fieldClass} type="number" min={0} value={maxPerWallet} onChange={(e) => setMaxPerWallet(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-cream-400 mb-1.5">Min raise (shares)</label>
                    <input className={fieldClass} type="number" min={0} value={minRaise} onChange={(e) => setMinRaise(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-cream-400 mb-1.5">Close (days)</label>
                    <input className={fieldClass} type="number" min={0} value={closeDays} onChange={(e) => setCloseDays(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-cream-400 mb-1.5">Document hash (optional)</label>
                  <input
                    className={`${fieldClass} font-mono text-sm`}
                    value={documentsHash}
                    onChange={(e) => setDocumentsHash(e.target.value)}
                    placeholder="keccak of PPM — empty = unsigned buy"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-cream-400 mb-1.5">USDC beneficiary</label>
                  <input className={`${fieldClass} font-mono text-sm`} value={beneficiary} onChange={(e) => setBeneficiary(e.target.value)} />
                </div>
              </div>
              {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
              <Button
                className="mt-5"
                fullWidth
                disabled={busy || !isFactoryConfigured || !isConnected}
                onClick={handleDeploy}
              >
                {phase === 'signing' ? 'Confirm listing…' : phase === 'distributor' ? 'Enabling distributions…' : phase === 'saving' ? 'Saving addresses…' : 'Create listing'}
              </Button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
