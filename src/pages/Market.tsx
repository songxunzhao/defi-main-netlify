import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRightIcon } from 'lucide-react';
import { formatUnits } from 'viem';
import { useAccount, usePublicClient, useReadContract, useWriteContract } from 'wagmi';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { FillAskModal } from '../components/modals/FillAskModal';
import { useAsks, ShareAsk } from '../hooks/useAsks';
import { useProperties } from '../hooks/useProperties';
import { useAuth } from '../context/AuthContext';
import {
  SHARE_MARKET_ADDRESS,
  isMarketConfigured,
  shareMarketAbi,
} from '../contracts/config';

function shortAddr(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export default function Market() {
  const { user } = useAuth();
  const { address, isConnected } = useAccount();
  const navigate = useNavigate();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { data: properties = [] } = useProperties();
  const { asks, isLoading, refetch } = useAsks();
  const [fillAsk, setFillAsk] = useState<ShareAsk | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const { data: paused } = useReadContract({
    address: isMarketConfigured ? (SHARE_MARKET_ADDRESS as `0x${string}`) : undefined,
    abi: shareMarketAbi,
    functionName: 'paused',
    query: { enabled: isMarketConfigured },
  });

  const titleById = new Map(properties.map((p) => [String(p.id), p.title]));

  const handleCancel = async (id: bigint) => {
    if (!isMarketConfigured) return;
    setError('');
    setCancellingId(id.toString());
    try {
      const hash = await writeContractAsync({
        address: SHARE_MARKET_ADDRESS as `0x${string}`,
        abi: shareMarketAbi,
        functionName: 'cancel',
        args: [id],
      } as never);
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      await refetch();
    } catch (err) {
      const anyErr = err as { shortMessage?: string; message?: string };
      setError(anyErr.shortMessage || anyErr.message || 'Could not cancel ask.');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="min-h-screen w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="font-display text-3xl md:text-4xl font-bold text-cream-100">Secondary market</h1>
                {paused === true && <Badge color="yellow">Paused</Badge>}
              </div>
              <p className="text-cream-400 max-w-2xl">
                KYC-gated asks only. There is no AMM or public DEX. List from My Dashboard; fills transfer shares
                seller to buyer and still require both wallets on the identity registry.
              </p>
            </div>
            <Button variant="outline" icon={<ArrowLeftRightIcon size={18} />} onClick={() => navigate('/user')}>
              List from dashboard
            </Button>
          </div>

          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

          {!isMarketConfigured ? (
            <div className="p-8 rounded-2xl border border-void-700 bg-void-800/40 text-cream-400">
              Set <span className="font-mono text-cream-200">VITE_SHARE_MARKET_ADDRESS</span> after{' '}
              <span className="font-mono text-cream-200">npm run deploy:protocol</span>.
            </div>
          ) : isLoading ? (
            <p className="text-cream-400">Reading open asks…</p>
          ) : asks.length === 0 ? (
            <div className="p-8 rounded-2xl border border-void-700 bg-void-800/40 text-cream-400">
              No open asks. Holders can list shares from My Dashboard after the primary sale.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-void-700 bg-void-800/40">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-void-700">
                    <th className="px-6 py-3 text-left text-xs font-medium text-cream-400 uppercase tracking-wider">Ask</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-cream-400 uppercase tracking-wider">Property</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-cream-400 uppercase tracking-wider">Seller</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-cream-400 uppercase tracking-wider">Shares</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-cream-400 uppercase tracking-wider">Price</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-cream-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-void-700">
                  {asks.map((ask) => {
                    const mine = Boolean(address && ask.seller.toLowerCase() === address.toLowerCase());
                    const title = titleById.get(ask.propertyId) || `Property ${ask.propertyId}`;
                    return (
                      <tr key={ask.id.toString()} className="hover:bg-void-700/30 transition-colors">
                        <td className="px-6 py-4 text-cream-400 font-mono text-sm">#{ask.id.toString()}</td>
                        <td className="px-6 py-4 text-cream-100 font-medium">{title}</td>
                        <td className="px-6 py-4 text-accent font-mono text-sm">{shortAddr(ask.seller)}</td>
                        <td className="px-6 py-4 text-cream-100">{ask.amount.toString()}</td>
                        <td className="px-6 py-4 text-accent">{formatUnits(ask.price, 6)} USDC</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => navigate(`/property/${ask.propertyId}`)}>
                              View
                            </Button>
                            {mine ? (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={!isConnected || cancellingId === ask.id.toString()}
                                onClick={() => handleCancel(ask.id)}
                              >
                                {cancellingId === ask.id.toString() ? 'Cancelling…' : 'Cancel'}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                disabled={paused === true || user?.kycStatus !== 'approved'}
                                onClick={() => setFillAsk(ask)}
                              >
                                Fill
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
      <FillAskModal
        isOpen={Boolean(fillAsk)}
        ask={fillAsk}
        propertyTitle={fillAsk ? titleById.get(fillAsk.propertyId) || `Property ${fillAsk.propertyId}` : ''}
        onClose={() => setFillAsk(null)}
        onFilled={async () => {
          setFillAsk(null);
          await refetch();
        }}
      />
    </div>
  );
}
