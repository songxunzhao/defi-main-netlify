import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeftIcon,
  MapPinIcon,
  CoinsIcon,
  FileTextIcon,
  ClipboardCheckIcon,
  BarChart2Icon,
  CalendarIcon,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PropertyMap } from '../components/ui/PropertyMap';
import { TransactionModal } from '../components/modals/TransactionModal';
import { FillAskModal } from '../components/modals/FillAskModal';
import { OnrampModal } from '../components/modals/OnrampModal';
import { useWallet } from '../context/WalletContext';
import { useAuth } from '../context/AuthContext';
import { useProperty } from '../hooks/useProperties';
import { canInvest, downloadVaultFile, mediaUrl } from '../utils/api';
import { formatUsd, latestAppraisal, navPerShare, navValueUsd, waterfall } from '../utils/ops';
import { useOfferingAddress, useOfferingStats } from '../hooks/useOffering';
import { listingFromResult, useListing } from '../hooks/useListing';
import { useExitState, useRedemptionAddress } from '../hooks/useRedemption';
import { useAsks, ShareAsk } from '../hooks/useAsks';
import { isHexAddress, redemptionAbi } from '../contracts/config';
import { formatUnits } from 'viem';
import { usePublicClient, useWriteContract } from 'wagmi';

const ZERO = '0x0000000000000000000000000000000000000000';

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isConnected, address } = useWallet();
  const { user } = useAuth();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [onrampOpen, setOnrampOpen] = useState(false);
  const [fillAsk, setFillAsk] = useState<ShareAsk | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState('');
  const { data: property, isLoading, isError } = useProperty(id);
  const offering = useOfferingAddress(property);
  const stats = useOfferingStats(offering);
  const { asks, refetch: refetchAsks } = useAsks(id);
  const listing = listingFromResult(useListing(id).data);
  const redemption = useRedemptionAddress(property);
  const catalogToken = property?.tokenAddress || property?.contractAddress;
  const shareTokenForExit = isHexAddress(catalogToken)
    ? catalogToken
    : listing?.token && listing.token.toLowerCase() !== ZERO
      ? listing.token
      : undefined;
  const exit = useExitState(redemption, isHexAddress(address) ? address : undefined, shareTokenForExit);

  const handleRedeem = async () => {
    if (!redemption || exit.shares <= 0n) return;
    setRedeemError('');
    setRedeeming(true);
    try {
      const hash = await writeContractAsync({
        address: redemption,
        abi: redemptionAbi,
        functionName: 'redeem',
        args: [exit.shares],
      } as never);
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      await exit.refetch();
    } catch (err) {
      const anyErr = err as { shortMessage?: string; message?: string };
      setRedeemError(anyErr.shortMessage || anyErr.message || 'Redeem failed.');
    } finally {
      setRedeeming(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <p className="text-cream-400">Loading property…</p>
      </div>
    );
  }

  if (isError || !property) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="font-display text-2xl font-semibold text-cream-100 mb-4">
            Property not found
          </h2>
          <button
            onClick={() => navigate('/browse')}
            className="text-accent hover:underline font-medium"
          >
            Back to Browse
          </button>
        </div>
      </div>
    );
  }

  const sold = stats.sold !== undefined ? Number(stats.sold) : property.tokensSold;
  const cap = stats.cap !== undefined ? Number(stats.cap) : property.totalTokens;
  const remaining = stats.remaining !== undefined ? Number(stats.remaining) : Math.max(0, cap - sold);
  const progressPercentage = cap > 0 ? (sold / cap) * 100 : 0;
  const shareToken = catalogToken || listing?.token;
  const flow = waterfall(property);
  const navShare = navPerShare(property);
  const navTotal = navValueUsd(property);
  const appraisal = latestAppraisal(property);
  const verified = user?.kycStatus === 'approved' && user?.accredited;
  const inExit = Boolean(redemption);
  const saleOpen = !inExit && property.status === 'Available' && stats.paused !== true && remaining > 0;
  const eligible = canInvest(user, address) && saleOpen;
  const buyLabel = inExit
    ? exit.opened && exit.shares > 0n
      ? `Redeem ${exit.shares.toString()} shares`
      : exit.opened
        ? 'Exit funded'
        : 'Primary closed'
    : !verified
      ? 'Complete verification to buy'
      : !isConnected
        ? 'Connect wallet to buy'
        : !user?.walletAddress
          ? 'Link wallet to buy'
          : address && user.walletAddress && address.toLowerCase() !== user.walletAddress.toLowerCase()
            ? 'Switch to your linked wallet'
            : property.status !== 'Available'
              ? property.status
              : stats.paused
                ? 'Offering paused'
                : remaining <= 0
                  ? 'Sold Out'
                  : 'Buy shares';

  return (
    <div className="min-h-screen w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-cream-400 hover:text-accent mb-8 transition-colors font-medium text-sm"
          >
            <ArrowLeftIcon size={18} />
            Back
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="rounded-2xl overflow-hidden border border-void-700 bg-void-800/60"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <img
                    src={mediaUrl(property.imageUrl)}
                    alt={property.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-void-950/80 to-transparent" />
                  <div className="absolute top-4 right-4">
                    <Badge
                      color={
                        property.status === 'Available'
                          ? 'green'
                          : property.status === 'Sold Out'
                            ? 'red'
                            : 'yellow'
                      }
                    >
                      {property.status}
                    </Badge>
                  </div>
                </div>
                <div className="p-6 md:p-8">
                  <h1 className="font-display text-3xl md:text-4xl font-bold text-cream-100 mb-2">
                    {property.title}
                  </h1>
                  <div className="flex items-center gap-2 text-cream-400 mb-8">
                    <MapPinIcon size={18} />
                    <span>{property.location}</span>
                    {property.mapUrl && (
                      <a href={property.mapUrl} target="_blank" rel="noreferrer" className="text-accent text-sm hover:underline">
                        Map link
                      </a>
                    )}
                  </div>
                  <div className="mb-8">
                    <h2 className="font-display text-lg font-semibold text-cream-100 mb-3">
                      About this property
                    </h2>
                    <p className="text-cream-400 leading-relaxed">{property.description}</p>
                  </div>
                  <div className="mb-8">
                    <h2 className="font-display text-lg font-semibold text-cream-100 mb-3">
                      Features
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2">
                      {(property.features || []).map((feature, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <ClipboardCheckIcon size={16} className="text-accent flex-shrink-0" />
                          <span className="text-cream-400 text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {property.unitMix && (
                    <div className="mb-8">
                      <h2 className="font-display text-lg font-semibold text-cream-100 mb-3">Unit mix</h2>
                      <p className="text-cream-400">{property.unitMix}</p>
                    </div>
                  )}
                  <PropertyMap lat={property.lat} lng={property.lng} title={property.title} mapUrl={property.mapUrl} />
                  {property.comps && property.comps.length > 0 && (
                    <div className="mb-8">
                      <h2 className="font-display text-lg font-semibold text-cream-100 mb-3">Nearby comps</h2>
                      <p className="text-cream-400 text-sm mb-3">
                        Illustrative sales for listing polish. Not an appraisal and not a live offering document.
                      </p>
                      <div className="overflow-x-auto rounded-xl border border-void-700">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="border-b border-void-700">
                              <th className="px-4 py-2 text-left text-cream-400 font-medium">Address</th>
                              <th className="px-4 py-2 text-left text-cream-400 font-medium">Sold</th>
                              <th className="px-4 py-2 text-right text-cream-400 font-medium">Price</th>
                              <th className="px-4 py-2 text-right text-cream-400 font-medium">Sq ft</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-void-700">
                            {property.comps.map((row) => (
                              <tr key={`${row.address}-${row.soldDate}`}>
                                <td className="px-4 py-2 text-cream-100">
                                  {row.address}
                                  {row.note ? <div className="text-cream-400 text-xs mt-0.5">{row.note}</div> : null}
                                </td>
                                <td className="px-4 py-2 text-cream-400 whitespace-nowrap">{row.soldDate}</td>
                                <td className="px-4 py-2 text-cream-100 text-right whitespace-nowrap">${row.priceUsd.toLocaleString()}</td>
                                <td className="px-4 py-2 text-cream-400 text-right">{row.sqft ?? '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {property.galleryUrls && property.galleryUrls.length > 0 && (
                    <div className="mb-8">
                      <h2 className="font-display text-lg font-semibold text-cream-100 mb-3">Gallery</h2>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {property.galleryUrls.map((url) => (
                          <img key={url} src={mediaUrl(url)} alt="" className="h-28 w-full object-cover rounded-xl border border-void-700" />
                        ))}
                      </div>
                    </div>
                  )}
                  {property.rentRollExcerpt && (
                    <div className="mb-8">
                      <h2 className="font-display text-lg font-semibold text-cream-100 mb-3">Rent roll</h2>
                      <p className="text-cream-400 leading-relaxed">{property.rentRollExcerpt}</p>
                    </div>
                  )}
                  {(flow.collected > 0 || flow.opex > 0) && (
                    <div className="mb-8">
                      <h2 className="font-display text-lg font-semibold text-cream-100 mb-3">Monthly waterfall</h2>
                      <p className="text-cream-400 text-sm mb-4">
                        Occupancy applied to gross rent, then operating expenses and reserves. Admin-entered, not a live rent-roll feed.
                      </p>
                      <div className="space-y-3">
                        {[
                          { label: 'Collected rent', value: flow.collected },
                          { label: 'OpEx', value: flow.opex },
                          { label: 'Reserves', value: flow.reserves },
                          { label: 'Distributable', value: flow.distributable },
                        ].map((row) => {
                          const max = Math.max(flow.collected, flow.opex, flow.reserves, flow.distributable, 1);
                          return (
                            <div key={row.label}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="text-cream-400">{row.label}</span>
                                <span className="text-cream-100">{formatUsd(row.value)}</span>
                              </div>
                              <div className="h-1.5 bg-void-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-accent rounded-full"
                                  style={{ width: `${Math.min(100, (row.value / max) * 100)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div>
                    <h2 className="font-display text-lg font-semibold text-cream-100 mb-3">
                      Documents
                    </h2>
                    <div className="space-y-2">
                      {(property.documents || []).map((doc, index) => (
                        <button
                          key={`${doc.url}-${index}`}
                          type="button"
                          onClick={() => downloadVaultFile(doc.url, doc.name)}
                          className="flex items-center gap-3 p-3 rounded-xl bg-void-700/50 border border-void-600 hover:border-void-500 hover:bg-void-700 transition-colors w-full text-left"
                        >
                          <FileTextIcon size={18} className="text-accent flex-shrink-0" />
                          <span className="text-cream-300">{doc.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="lg:sticky lg:top-28 h-fit"
            >
              <div className="rounded-2xl border border-void-700 bg-void-800/80 p-6 shadow-glow-sm">
                <div className="flex justify-between items-start gap-4 mb-6">
                  <div>
                    <div className="text-cream-400 text-sm mb-0.5">{appraisal ? 'NAV' : 'Listed value'}</div>
                    <div className="font-display text-2xl font-bold text-cream-100">
                      ${navTotal.toLocaleString()}
                    </div>
                    {appraisal ? (
                      <div className="text-cream-400 text-xs mt-1">Appraisal {appraisal.date.slice(0, 10)}</div>
                    ) : (
                      <div className="text-cream-400 text-xs mt-1">No appraisal on file</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-cream-400 text-sm mb-0.5">Listed / share</div>
                    <div className="font-display text-2xl font-bold text-accent flex items-center justify-end gap-1">
                      <CoinsIcon size={20} />
                      {property.price.toLocaleString()} USDC
                    </div>
                    <div className="text-cream-400 text-xs mt-1">
                      NAV {formatUsd(navShare)} / share
                    </div>
                  </div>
                </div>
                <div className="mb-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-cream-400">Funding progress</span>
                    <span className="text-cream-100 font-medium">
                      {sold} / {cap} shares
                      {offering ? ' on-chain' : ''}
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-void-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-accent rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercentage}%` }}
                      transition={{ duration: 1, delay: 0.3 }}
                    />
                  </div>
                  <div className="flex justify-between text-xs mt-1.5 text-cream-400">
                    <span>{progressPercentage.toFixed(1)}% funded</span>
                    <span>Goal: {cap} shares</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 rounded-xl bg-void-700/50 border border-void-600">
                    <div className="flex items-center gap-1.5 text-cream-400 text-xs mb-1">
                      <BarChart2Icon size={14} />
                      Expected return
                    </div>
                    <div className="font-display font-semibold text-cream-100">
                      {property.returnRate || 0}% <span className="text-cream-400 text-sm font-normal">/ year</span>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-void-700/50 border border-void-600">
                    <div className="flex items-center gap-1.5 text-cream-400 text-xs mb-1">
                      <CalendarIcon size={14} />
                      Occupancy
                    </div>
                    <div className="font-display font-semibold text-cream-100">
                      {property.occupancyPercent != null ? `${property.occupancyPercent}%` : '—'}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-void-700/50 border border-void-600">
                    <div className="text-cream-400 text-xs mb-1">Cap rate</div>
                    <div className="font-display font-semibold text-cream-100">
                      {property.capRate != null ? `${property.capRate}%` : '—'}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-void-700/50 border border-void-600">
                    <div className="text-cream-400 text-xs mb-1">Next appraisal</div>
                    <div className="font-display font-semibold text-cream-100">
                      {property.nextAppraisalAt ? String(property.nextAppraisalAt).slice(0, 10) : '—'}
                    </div>
                  </div>
                </div>
                {(shareToken || offering) && (
                  <div className="mb-6 space-y-2">
                    {shareToken && (
                      <div>
                        <div className="text-sm text-cream-400 mb-2">Share token</div>
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-void-700/50 border border-void-600">
                          <span className="text-accent font-mono text-sm truncate flex-1">{shareToken}</span>
                          <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(shareToken)}>
                            Copy
                          </Button>
                        </div>
                      </div>
                    )}
                    {offering && (
                      <div>
                        <div className="text-sm text-cream-400 mb-2">Offering</div>
                        <div className="p-3 rounded-xl bg-void-700/50 border border-void-600 text-accent font-mono text-sm truncate">
                          {offering}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {inExit && (
                  <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10">
                    <p className="text-amber-100 text-sm font-medium mb-1">
                      {exit.opened ? 'Sale exit is funded' : 'Sale exit is frozen'}
                    </p>
                    <p className="text-cream-400 text-sm">
                      {exit.opened
                        ? `Primary sale is closed and transfers are frozen. Each share at open pays ${formatUnits(exit.quotePerShare, 6)} USDC.`
                        : 'Primary sale is paused and transfers are frozen. Holders can redeem after admin deposits proceeds.'}
                    </p>
                  </div>
                )}
                <Button
                  fullWidth
                  size="lg"
                  disabled={
                    inExit
                      ? !exit.opened || exit.shares === 0n || redeeming || !isConnected
                      : property.status !== 'Available'
                  }
                  onClick={() => {
                    if (inExit) {
                      void handleRedeem();
                      return;
                    }
                    if (!verified) {
                      navigate('/kyc');
                      return;
                    }
                    if (!isConnected || !user?.walletAddress || (address && user.walletAddress && address.toLowerCase() !== user.walletAddress.toLowerCase())) {
                      navigate('/user');
                      return;
                    }
                    if (eligible) setIsTransactionModalOpen(true);
                  }}
                >
                  {redeeming ? 'Redeeming…' : buyLabel}
                </Button>
                <Button variant="outline" fullWidth className="mt-2" onClick={() => setOnrampOpen(true)}>
                  Get USDC
                </Button>
                {redeemError && <p className="text-center text-sm text-red-400 mt-4">{redeemError}</p>}
                {inExit && exit.opened && exit.shares > 0n && (
                  <p className="text-center text-sm text-cream-400 mt-4">
                    Quote for your {exit.shares.toString()} shares: {formatUnits(exit.quoteUsdc, 6)} USDC
                  </p>
                )}
                {!eligible && !inExit && property.status === 'Available' && (
                  <p className="text-center text-sm text-cream-400 mt-4">
                    Purchases require approved KYC, an accredited-investor attestation, and the wallet linked to this account.
                  </p>
                )}
                {asks.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-void-700">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-cream-100 font-medium">Secondary asks</h3>
                      <button
                        type="button"
                        onClick={() => navigate('/market')}
                        className="text-accent text-sm hover:underline"
                      >
                        All asks
                      </button>
                    </div>
                    <div className="space-y-2">
                      {asks.map((ask) => (
                        <div
                          key={ask.id.toString()}
                          className="flex items-center justify-between gap-3 p-3 rounded-xl bg-void-700/50 border border-void-600"
                        >
                          <div>
                            <div className="text-cream-100 text-sm">
                              {ask.amount.toString()} shares at {formatUnits(ask.price, 6)} USDC
                            </div>
                            <div className="text-cream-400 text-xs font-mono">
                              {ask.seller.slice(0, 6)}…{ask.seller.slice(-4)}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={inExit}
                            onClick={() => setFillAsk(ask)}
                          >
                            {inExit ? 'Frozen' : 'Fill'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>

      <TransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
        property={{
          id: property.id,
          title: property.title,
          price: property.price,
          tokenPrice: property.tokenPrice,
          totalTokens: property.totalTokens,
          offeringAddress: property.offeringAddress || offering,
          sharePriceUsdc: property.sharePriceUsdc,
        }}
      />
      <FillAskModal
        isOpen={Boolean(fillAsk)}
        ask={fillAsk}
        propertyTitle={property.title}
        onClose={() => setFillAsk(null)}
        onFilled={async () => {
          setFillAsk(null);
          await refetchAsks();
        }}
      />
      <OnrampModal isOpen={onrampOpen} onClose={() => setOnrampOpen(false)} />
    </div>
  );
}
