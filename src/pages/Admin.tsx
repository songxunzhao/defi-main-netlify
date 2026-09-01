import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, TrashIcon, ShieldIcon, BuildingIcon, CoinsIcon, UsersIcon, BarChart2Icon } from 'lucide-react';
import { ConnectWalletButton } from '../components/ui/ConnectWalletButton';
import { useAccount, usePublicClient, useReadContract, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../context/AuthContext';
import { useProperties } from '../hooks/useProperties';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchInvestors, reviewKyc, deleteProperty, updateProperty, syncActivity, fetchReadiness, mediaUrl, AuthUser } from '../utils/api';
import {
  IDENTITY_REGISTRY_ADDRESS,
  CLAIM_ISSUER_ADDRESS,
  INVESTOR_ONBOARDER_ADDRESS,
  PROPERTY_FACTORY_ADDRESS,
  SHARE_MARKET_ADDRESS,
  USDC_ADDRESS,
  identityRegistryAbi,
  investorOnboarderAbi,
  offeringAbi,
  isClaimIssuerConfigured,
  isFactoryConfigured,
  isHexAddress,
  isIdentityConfigured,
  isMarketConfigured,
  isOnboarderConfigured,
  propertyFactoryAbi,
  shareMarketAbi,
  redemptionAbi,
} from '../contracts/config';
import { InvestorComplianceModal, ComplianceListing } from '../components/modals/InvestorComplianceModal';
import { listingFromResult } from '../hooks/useListing';
import { sharePriceUsdc } from '../utils/pricing';
import { AddPropertyModal } from '../components/modals/AddPropertyModal';
import { CreateListingModal } from '../components/modals/CreateListingModal';
import { DepositDistributionModal } from '../components/modals/DepositDistributionModal';
import { OpenExitModal } from '../components/modals/OpenExitModal';
import { OpsPropertyModal } from '../components/modals/OpsPropertyModal';
import { ListingCmsModal } from '../components/modals/ListingCmsModal';
import { DocumentVaultModal } from '../components/modals/DocumentVaultModal';
import { Property } from '../utils/types';
import { appraisalDue, formatUsd, navPerShare, waterfall } from '../utils/ops';

const ZERO = '0x0000000000000000000000000000000000000000';

function shortAddr(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export default function Admin() {
  const { user } = useAuth();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: properties = [], isLoading } = useProperties();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('properties');
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [registeringId, setRegisteringId] = useState<number | null>(null);
  const [registerError, setRegisterError] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [deployProperty, setDeployProperty] = useState<Property | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pausingId, setPausingId] = useState<string | null>(null);
  const [pauseError, setPauseError] = useState('');
  const [finalizingId, setFinalizingId] = useState<string | null>(null);
  const [enablingDistId, setEnablingDistId] = useState<string | null>(null);
  const [distError, setDistError] = useState('');
  const [depositTarget, setDepositTarget] = useState<{ title: string; distributor: `0x${string}` } | null>(null);
  const [pausingMarket, setPausingMarket] = useState(false);
  const [opsProperty, setOpsProperty] = useState<Property | null>(null);
  const [cmsProperty, setCmsProperty] = useState<Property | null>(null);
  const [enablingExitId, setEnablingExitId] = useState<string | null>(null);
  const [exitError, setExitError] = useState('');
  const [exitTarget, setExitTarget] = useState<{ title: string; redemption: `0x${string}` } | null>(null);
  const [vaultProperty, setVaultProperty] = useState<Property | null>(null);
  const [syncingActivity, setSyncingActivity] = useState(false);
  const [activitySyncNote, setActivitySyncNote] = useState('');
  const [freezingWallet, setFreezingWallet] = useState<string | null>(null);
  const [compliance, setCompliance] = useState<{
    mode: 'recover' | 'force';
    wallet: `0x${string}`;
    label: string;
  } | null>(null);
  const isAdmin = user?.role === 'admin';

  const tabs = [
    {
      id: 'properties',
      label: 'Properties',
      icon: <BuildingIcon size={16} />,
    },
    {
      id: 'ops',
      label: 'Ops',
      icon: <BarChart2Icon size={16} />,
    },
    {
      id: 'investors',
      label: 'Investors',
      icon: <UsersIcon size={16} />,
    },
    {
      id: 'contracts',
      label: 'Contracts',
      icon: <CoinsIcon size={16} />,
    },
    {
      id: 'production',
      label: 'Production',
      icon: <ShieldIcon size={16} />,
    },
  ];

  const { data: investorData, isLoading: investorsLoading } = useQuery({
    queryKey: ['kyc-investors'],
    queryFn: fetchInvestors,
    enabled: isAdmin,
  });
  const investors = investorData?.investors || [];
  const pendingCount = investors.filter((i) => i.kycStatus === 'pending').length;

  const { data: readiness, isFetching: readinessLoading } = useQuery({
    queryKey: ['ops-readiness'],
    queryFn: fetchReadiness,
    enabled: isAdmin,
  });

  const { data: listingResults, isFetching: listingsLoading, refetch: refetchListings } = useReadContracts({
    contracts: properties.map((p) => ({
      address: PROPERTY_FACTORY_ADDRESS as `0x${string}`,
      abi: propertyFactoryAbi,
      functionName: 'getListing' as const,
      args: [BigInt(p.id)] as const,
    })),
    query: { enabled: isAdmin && isFactoryConfigured && properties.length > 0 },
  });

  const listingById = new Map(
    properties.map((p, i) => [p.id, listingFromResult(listingResults?.[i]?.result)])
  );

  const factoryListings = properties
    .map((p) => ({ property: p, listing: listingById.get(p.id) || null }))
    .filter(
      (row) =>
        row.listing?.exists &&
        row.listing.token &&
        row.listing.token.toLowerCase() !== ZERO
    );

  const { data: pauseResults, refetch: refetchPaused } = useReadContracts({
    contracts: factoryListings.map((row) => ({
      address: row.listing!.offering,
      abi: offeringAbi,
      functionName: 'paused' as const,
    })),
    query: { enabled: isAdmin && factoryListings.length > 0 },
  });

  const { data: offeringFinalizedResults, refetch: refetchOfferingFinalized } = useReadContracts({
    contracts: factoryListings.map((row) => ({
      address: row.listing!.offering,
      abi: offeringAbi,
      functionName: 'finalized' as const,
    })),
    query: { enabled: isAdmin && factoryListings.length > 0 },
  });

  const { data: offeringClosesResults } = useReadContracts({
    contracts: factoryListings.map((row) => ({
      address: row.listing!.offering,
      abi: offeringAbi,
      functionName: 'closesAt' as const,
    })),
    query: { enabled: isAdmin && factoryListings.length > 0 },
  });

  const { data: offeringSuccessResults, refetch: refetchOfferingSuccess } = useReadContracts({
    contracts: factoryListings.map((row) => ({
      address: row.listing!.offering,
      abi: offeringAbi,
      functionName: 'successful' as const,
    })),
    query: { enabled: isAdmin && factoryListings.length > 0 },
  });

  const { data: distributorResults, refetch: refetchDistributors } = useReadContracts({
    contracts: factoryListings.map((row) => ({
      address: PROPERTY_FACTORY_ADDRESS as `0x${string}`,
      abi: propertyFactoryAbi,
      functionName: 'getDistributor' as const,
      args: [BigInt(row.property.id)] as const,
    })),
    query: { enabled: isAdmin && isFactoryConfigured && factoryListings.length > 0 },
  });

  const { data: redemptionResults, refetch: refetchRedemptions } = useReadContracts({
    contracts: factoryListings.map((row) => ({
      address: PROPERTY_FACTORY_ADDRESS as `0x${string}`,
      abi: propertyFactoryAbi,
      functionName: 'getRedemption' as const,
      args: [BigInt(row.property.id)] as const,
    })),
    query: { enabled: isAdmin && isFactoryConfigured && factoryListings.length > 0 },
  });

  const exitRows = factoryListings
    .map((row, i) => {
      const raw = redemptionResults?.[i]?.result;
      const redemption =
        typeof raw === 'string' && raw.toLowerCase() !== ZERO ? (raw as `0x${string}`) : null;
      return { id: row.property.id, redemption };
    })
    .filter((row): row is { id: string; redemption: `0x${string}` } => Boolean(row.redemption));

  const { data: exitOpenedResults, refetch: refetchExitOpened } = useReadContracts({
    contracts: exitRows.map((row) => ({
      address: row.redemption,
      abi: redemptionAbi,
      functionName: 'opened' as const,
    })),
    query: { enabled: isAdmin && exitRows.length > 0 },
  });
  const exitOpenedById = new Map(exitRows.map((row, i) => [row.id, exitOpenedResults?.[i]?.result === true]));

  const investorsWithWallet = investors.filter((inv) => isHexAddress(inv.walletAddress));
  const {
    data: verifiedResults,
    refetch: refetchVerified,
    isFetching: verifiedLoading,
  } = useReadContracts({
    contracts: investorsWithWallet.map((inv) => ({
      address: IDENTITY_REGISTRY_ADDRESS as `0x${string}`,
      abi: identityRegistryAbi,
      functionName: 'isVerified' as const,
      args: [inv.walletAddress as `0x${string}`] as const,
    })),
    query: { enabled: isAdmin && isIdentityConfigured && investorsWithWallet.length > 0 },
  });

  const onChainVerified = new Set(
    investorsWithWallet
      .filter((_, i) => verifiedResults?.[i]?.result === true)
      .map((inv) => inv.walletAddress!.toLowerCase())
  );

  const {
    data: frozenResults,
    refetch: refetchFrozen,
    isFetching: frozenLoading,
  } = useReadContracts({
    contracts: investorsWithWallet.map((inv) => ({
      address: IDENTITY_REGISTRY_ADDRESS as `0x${string}`,
      abi: identityRegistryAbi,
      functionName: 'isFrozen' as const,
      args: [inv.walletAddress as `0x${string}`] as const,
    })),
    query: { enabled: isAdmin && isIdentityConfigured && investorsWithWallet.length > 0 },
  });

  const onChainFrozen = new Set(
    investorsWithWallet
      .filter((_, i) => frozenResults?.[i]?.result === true)
      .map((inv) => inv.walletAddress!.toLowerCase())
  );

  const { data: identityResults, refetch: refetchIdentities } = useReadContracts({
    contracts: investorsWithWallet.map((inv) => ({
      address: IDENTITY_REGISTRY_ADDRESS as `0x${string}`,
      abi: identityRegistryAbi,
      functionName: 'identity' as const,
      args: [inv.walletAddress as `0x${string}`] as const,
    })),
    query: { enabled: isAdmin && isIdentityConfigured && investorsWithWallet.length > 0 },
  });

  const identityByWallet = new Map(
    investorsWithWallet.map((inv, i) => {
      const raw = identityResults?.[i]?.result;
      const id =
        typeof raw === 'string' && raw.toLowerCase() !== ZERO ? (raw as `0x${string}`) : null;
      return [inv.walletAddress!.toLowerCase(), id] as const;
    })
  );

  const complianceListings: ComplianceListing[] = factoryListings
    .filter((row) => isHexAddress(row.listing?.token))
    .map((row) => ({
      id: row.property.id,
      title: row.property.title,
      token: row.listing!.token as `0x${string}`,
    }));

  const { data: marketPaused, refetch: refetchMarketPaused } = useReadContract({
    address: isMarketConfigured ? (SHARE_MARKET_ADDRESS as `0x${string}`) : undefined,
    abi: shareMarketAbi,
    functionName: 'paused',
    query: { enabled: isAdmin && isMarketConfigured },
  });
  const { writeContractAsync, data: registerHash, reset: resetRegister } = useWriteContract();
  const { writeContractAsync: writeOfferingAsync } = useWriteContract();
  const { writeContractAsync: writeFactoryAsync } = useWriteContract();
  const { writeContractAsync: writeMarketAsync } = useWriteContract();
  const { isLoading: registerConfirming, isSuccess: registerSuccess } = useWaitForTransactionReceipt({
    hash: registerHash,
  });

  useEffect(() => {
    if (!registerSuccess) return;
    refetchVerified();
    refetchFrozen();
    refetchIdentities();
    setRegisteringId(null);
    resetRegister();
  }, [registerSuccess, refetchVerified, refetchFrozen, refetchIdentities, resetRegister]);

  const handleRegister = async (inv: AuthUser) => {
    if (!isOnboarderConfigured || !isHexAddress(inv.walletAddress)) return;
    setRegisterError('');
    setRegisteringId(inv.id);
    try {
      await writeContractAsync({
        address: INVESTOR_ONBOARDER_ADDRESS as `0x${string}`,
        abi: investorOnboarderAbi,
        functionName: 'onboardIso',
        args: [inv.walletAddress, (inv.kyc?.country || 'US').trim() || 'US', Boolean(inv.accredited)],
      } as never);
    } catch (err) {
      const anyErr = err as { shortMessage?: string; message?: string };
      setRegisterError(anyErr.shortMessage || anyErr.message || 'Could not register wallet on-chain.');
      setRegisteringId(null);
    }
  };

  const handleFreeze = async (wallet: `0x${string}`, frozen: boolean) => {
    if (!isIdentityConfigured) return;
    setRegisterError('');
    setFreezingWallet(wallet.toLowerCase());
    try {
      const hash = await writeContractAsync({
        address: IDENTITY_REGISTRY_ADDRESS as `0x${string}`,
        abi: identityRegistryAbi,
        functionName: 'setAddressFrozen',
        args: [wallet, frozen],
      } as never);
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      await refetchFrozen();
    } catch (err) {
      const anyErr = err as { shortMessage?: string; message?: string };
      setRegisterError(anyErr.shortMessage || anyErr.message || 'Could not update freeze state.');
    } finally {
      setFreezingWallet(null);
    }
  };

  const handlePause = async (propertyId: string, offering: `0x${string}`, currentlyPaused: boolean) => {
    setPauseError('');
    setPausingId(propertyId);
    try {
      const hash = await writeOfferingAsync({
        address: offering,
        abi: offeringAbi,
        functionName: 'setPaused',
        args: [!currentlyPaused],
      } as never);
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      await refetchPaused();
    } catch (err) {
      const anyErr = err as { shortMessage?: string; message?: string };
      setPauseError(anyErr.shortMessage || anyErr.message || 'Could not update pause state.');
    } finally {
      setPausingId(null);
    }
  };

  const handleFinalize = async (propertyId: string, offering: `0x${string}`) => {
    setPauseError('');
    setFinalizingId(propertyId);
    try {
      const hash = await writeOfferingAsync({
        address: offering,
        abi: offeringAbi,
        functionName: 'finalize',
      } as never);
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      await refetchOfferingFinalized();
      await refetchOfferingSuccess();
      await refetchPaused();
    } catch (err) {
      const anyErr = err as { shortMessage?: string; message?: string };
      setPauseError(anyErr.shortMessage || anyErr.message || 'Could not finalize the offering.');
    } finally {
      setFinalizingId(null);
    }
  };

  const handleEnableDistributor = async (propertyId: string) => {
    setDistError('');
    setEnablingDistId(propertyId);
    try {
      const hash = await writeFactoryAsync({
        address: PROPERTY_FACTORY_ADDRESS as `0x${string}`,
        abi: propertyFactoryAbi,
        functionName: 'createDistributor',
        args: [BigInt(propertyId)],
      } as never);
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
        const dist = await publicClient.readContract({
          address: PROPERTY_FACTORY_ADDRESS as `0x${string}`,
          abi: propertyFactoryAbi,
          functionName: 'getDistributor',
          args: [BigInt(propertyId)],
        } as never);
        if (typeof dist === 'string' && dist.toLowerCase() !== ZERO) {
          await updateProperty(propertyId, { distributorAddress: dist });
          await queryClient.invalidateQueries({ queryKey: ['properties'] });
        }
      }
      await refetchDistributors();
    } catch (err) {
      const anyErr = err as { shortMessage?: string; message?: string };
      setDistError(anyErr.shortMessage || anyErr.message || 'Could not create distributor.');
    } finally {
      setEnablingDistId(null);
    }
  };

  const handleEnableExit = async (propertyId: string) => {
    setExitError('');
    setEnablingExitId(propertyId);
    try {
      const hash = await writeFactoryAsync({
        address: PROPERTY_FACTORY_ADDRESS as `0x${string}`,
        abi: propertyFactoryAbi,
        functionName: 'createRedemption',
        args: [BigInt(propertyId)],
      } as never);
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
        const redemption = await publicClient.readContract({
          address: PROPERTY_FACTORY_ADDRESS as `0x${string}`,
          abi: propertyFactoryAbi,
          functionName: 'getRedemption',
          args: [BigInt(propertyId)],
        } as never);
        if (typeof redemption === 'string' && redemption.toLowerCase() !== ZERO) {
          await updateProperty(propertyId, { redemptionAddress: redemption, status: 'Sold Out' });
          await queryClient.invalidateQueries({ queryKey: ['properties'] });
        }
      }
      await refetchRedemptions();
      await refetchPaused();
    } catch (err) {
      const anyErr = err as { shortMessage?: string; message?: string };
      setExitError(anyErr.shortMessage || anyErr.message || 'Could not enable exit. Shares must be outstanding.');
    } finally {
      setEnablingExitId(null);
    }
  };

  const handlePauseMarket = async () => {
    if (!isMarketConfigured) return;
    setPauseError('');
    setPausingMarket(true);
    try {
      const hash = await writeMarketAsync({
        address: SHARE_MARKET_ADDRESS as `0x${string}`,
        abi: shareMarketAbi,
        functionName: 'setPaused',
        args: [!marketPaused],
      } as never);
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      await refetchMarketPaused();
    } catch (err) {
      const anyErr = err as { shortMessage?: string; message?: string };
      setPauseError(anyErr.shortMessage || anyErr.message || 'Could not pause the market.');
    } finally {
      setPausingMarket(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center px-4">
        <div className="text-center max-w-md w-full p-10 rounded-2xl border border-void-700 bg-void-800/80">
          <div className="w-16 h-16 rounded-2xl bg-accent-muted border border-accent/20 flex items-center justify-center mx-auto mb-6">
            <ShieldIcon size={32} className="text-accent" />
          </div>
          <h2 className="font-display text-2xl font-semibold text-cream-100 mb-3">
            Admin access required
          </h2>
          <p className="text-cream-400 mb-8">
            You need admin privileges to access this dashboard.
          </p>
          <Button onClick={() => navigate('/home')}>Back to Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
            <div>
              <h1 className="font-display text-3xl md:text-4xl font-bold text-cream-100 mb-2">
                Admin Dashboard
              </h1>
              <p className="text-cream-400">
                Create catalog listings, deploy USDC offerings, review KYC, and register wallets on-chain.
              </p>
            </div>
            <div className="flex gap-2 [&_button]:!rounded-lg">
              <ConnectWalletButton />
              <Button icon={<PlusIcon size={18} />} onClick={() => setAddOpen(true)}>
                Add property
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {[
              { icon: BuildingIcon, label: 'Total properties', value: isLoading ? '—' : properties.length },
              { icon: UsersIcon, label: 'Pending KYC', value: investorsLoading ? '—' : pendingCount, accent: true },
              {
                icon: CoinsIcon,
                label: 'Live offerings',
                value: !isFactoryConfigured ? '—' : listingsLoading ? '—' : factoryListings.length,
              },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="p-6 rounded-2xl border border-void-700 bg-void-800/60"
              >
                <div className="flex items-center gap-2 text-cream-400 text-sm mb-2">
                  {stat.icon && <stat.icon size={16} />}
                  {stat.label}
                </div>
                <div className={`font-display text-2xl font-bold ${stat.accent ? 'text-accent' : 'text-cream-100'}`}>
                  {stat.value}
                </div>
              </motion.div>
            ))}
          </div>

          <div className="rounded-2xl border border-void-700 bg-void-800/40 overflow-hidden">
            <nav className="flex border-b border-void-700">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-4 flex items-center gap-2 text-sm font-medium transition-colors ${
                    activeTab === tab.id ? 'border-b-2 border-accent text-accent bg-accent-muted/30' : 'text-cream-400 hover:text-cream-100'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
            <div className="p-6">
              {activeTab === 'properties' && (
                <div>
                  <h3 className="font-display text-lg font-semibold text-cream-100 mb-2">Manage properties</h3>
                  <p className="text-cream-400 text-sm mb-6">
                    Catalog rows. Use Edit listing for copy, photos, map pin, and comps (polish, not an appraisal). Docs is the file vault. Deploy opens the on-chain offering.
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-void-700">
                    <table className="min-w-full">
                      <thead>
                        <tr className="border-b border-void-700">
                          <th className="px-6 py-3 text-left text-xs font-medium text-cream-400 uppercase tracking-wider">Property</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-cream-400 uppercase tracking-wider">Location</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-cream-400 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-cream-400 uppercase tracking-wider">Share price</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-cream-400 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-void-700">
                        {properties.map((p) => {
                          const listing = listingById.get(p.id);
                          const live =
                            Boolean(listing?.exists) &&
                            listing?.token &&
                            listing.token.toLowerCase() !== ZERO;
                          return (
                          <tr key={p.id} className="hover:bg-void-700/30 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg overflow-hidden flex-shrink-0">
                                  <img src={mediaUrl(p.imageUrl)} alt={p.title} className="h-full w-full object-cover" />
                                </div>
                                <span className="font-medium text-cream-100">{p.title}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-cream-400">{p.location}</td>
                            <td className="px-6 py-4">
                              <Badge color={p.status === 'Available' ? 'green' : p.status === 'Sold Out' ? 'red' : 'yellow'}>{p.status}</Badge>
                            </td>
                            <td className="px-6 py-4 text-accent">{sharePriceUsdc(p).toLocaleString()} USDC</td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                {live ? (
                                  <Badge color="green">On-chain</Badge>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={!isFactoryConfigured || !isConnected}
                                    onClick={() => setDeployProperty(p)}
                                  >
                                    Deploy
                                  </Button>
                                )}
                                <Button variant="outline" size="sm" onClick={() => setCmsProperty(p)}>
                                  Edit listing
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setVaultProperty(p)}>
                                  Docs
                                </Button>
                                <Button
                                  variant="danger"
                                  size="sm"
                                  icon={<TrashIcon size={14} />}
                                  disabled={deletingId === p.id}
                                  onClick={async () => {
                                    if (!window.confirm(`Delete ${p.title} from the catalog?`)) return;
                                    setDeletingId(p.id);
                                    try {
                                      await deleteProperty(p.id);
                                      await queryClient.invalidateQueries({ queryKey: ['properties'] });
                                    } finally {
                                      setDeletingId(null);
                                    }
                                  }}
                                >
                                  Delete
                                </Button>
                              </div>
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {activeTab === 'ops' && (
                <div>
                  <h3 className="font-display text-lg font-semibold text-cream-100 mb-2">Occupancy and NAV</h3>
                  <p className="text-cream-400 text-sm mb-6">
                    Monthly waterfall is gross rent × occupancy, then OpEx and reserves. NAV per share uses the latest appraisal, or listed property value if none is on file.
                  </p>
                  {(() => {
                    const rows = properties.map((p) => ({ property: p, flow: waterfall(p), nav: navPerShare(p), due: appraisalDue(p) }));
                    const withOcc = rows.filter((r) => r.flow.occupancyPercent != null);
                    const avgOcc =
                      withOcc.length > 0
                        ? withOcc.reduce((sum, r) => sum + (r.flow.occupancyPercent || 0), 0) / withOcc.length
                        : 0;
                    const dueCount = rows.filter((r) => r.due).length;
                    const distTotal = rows.reduce((sum, r) => sum + r.flow.distributable, 0);
                    return (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                          <div className="p-4 rounded-xl border border-void-700 bg-void-800/60">
                            <div className="text-cream-400 text-xs uppercase tracking-wider mb-1">Avg occupancy</div>
                            <div className="font-display text-2xl font-bold text-cream-100">{withOcc.length ? `${avgOcc.toFixed(1)}%` : '—'}</div>
                          </div>
                          <div className="p-4 rounded-xl border border-void-700 bg-void-800/60">
                            <div className="text-cream-400 text-xs uppercase tracking-wider mb-1">Appraisals due</div>
                            <div className="font-display text-2xl font-bold text-cream-100">{dueCount}</div>
                          </div>
                          <div className="p-4 rounded-xl border border-void-700 bg-void-800/60">
                            <div className="text-cream-400 text-xs uppercase tracking-wider mb-1">Distributable / mo</div>
                            <div className="font-display text-2xl font-bold text-accent">{formatUsd(distTotal)}</div>
                          </div>
                        </div>
                        <div className="overflow-x-auto rounded-xl border border-void-700">
                          <table className="min-w-full">
                            <thead>
                              <tr className="border-b border-void-700">
                                <th className="px-6 py-3 text-left text-xs font-medium text-cream-400 uppercase tracking-wider">Property</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-cream-400 uppercase tracking-wider">Occupancy</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-cream-400 uppercase tracking-wider">NAV / share</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-cream-400 uppercase tracking-wider">Distributable</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-cream-400 uppercase tracking-wider">Next appraisal</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-cream-400 uppercase tracking-wider">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-void-700">
                              {rows.map(({ property: p, flow, nav, due }) => (
                                <tr key={p.id} className="hover:bg-void-700/30 transition-colors">
                                  <td className="px-6 py-4 text-cream-100 font-medium">{p.title}</td>
                                  <td className="px-6 py-4">
                                    {flow.occupancyPercent == null ? (
                                      <span className="text-cream-400">—</span>
                                    ) : (
                                      <div className="min-w-[120px]">
                                        <div className="flex justify-between text-xs text-cream-300 mb-1">
                                          <span>{flow.occupancyPercent}%</span>
                                        </div>
                                        <div className="h-1.5 bg-void-700 rounded-full overflow-hidden">
                                          <div className="h-full bg-accent rounded-full" style={{ width: `${Math.min(100, flow.occupancyPercent)}%` }} />
                                        </div>
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 text-accent">{formatUsd(nav)}</td>
                                  <td className="px-6 py-4 text-cream-100">{formatUsd(flow.distributable)}</td>
                                  <td className="px-6 py-4">
                                    {p.nextAppraisalAt ? (
                                      <span className={due ? 'text-amber-200' : 'text-cream-400'}>
                                        {String(p.nextAppraisalAt).slice(0, 10)}
                                        {due ? ' due' : ''}
                                      </span>
                                    ) : (
                                      <span className="text-cream-400">—</span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <Button variant="outline" size="sm" onClick={() => setOpsProperty(p)}>
                                      Update
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
              {activeTab === 'investors' && (
                <div>
                  <h3 className="font-display text-lg font-semibold text-cream-100 mb-2">Investor verification</h3>
                  <p className="text-cream-400 text-sm mb-4">
                    Approve applications in the app, then register the linked wallet. Register deploys an ONCHAINID,
                    issues KYC (and accredited) claims from the demo ClaimIssuer, and maps the wallet on the identity
                    registry — one transaction. <span className="text-cream-200">Registered</span> means that identity
                    still holds valid claims from a trusted issuer, not a boolean whitelist. Freeze blocks buys,
                    transfers, claims, and redemptions. Recover remaps the same identity onto a replacement wallet;
                    forced transfer is an agent move (estate / court demo).
                  </p>
                  {(!isIdentityConfigured || !isOnboarderConfigured) && (
                    <p className="text-amber-200 text-sm mb-4">
                      Set <span className="font-mono">VITE_IDENTITY_REGISTRY_ADDRESS</span> and{' '}
                      <span className="font-mono">VITE_INVESTOR_ONBOARDER_ADDRESS</span> to enable on-chain
                      registration.
                    </p>
                  )}
                  {isIdentityConfigured && !isConnected && (
                    <p className="text-amber-200 text-sm mb-4">
                      Connect the registrar / agent wallet (the protocol deployer) to register, freeze, recover, or
                      force-transfer.
                    </p>
                  )}
                  {registerError && <p className="text-red-400 text-sm mb-4">{registerError}</p>}
                  <div className="overflow-x-auto rounded-xl border border-void-700">
                    <table className="min-w-full">
                      <thead>
                        <tr className="border-b border-void-700">
                          <th className="px-6 py-3 text-left text-xs font-medium text-cream-400 uppercase tracking-wider">Investor</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-cream-400 uppercase tracking-wider">Country</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-cream-400 uppercase tracking-wider">KYC</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-cream-400 uppercase tracking-wider">Wallet</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-cream-400 uppercase tracking-wider">On-chain</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-cream-400 uppercase tracking-wider">Frozen</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-cream-400 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-void-700">
                        {investorsLoading ? (
                          <tr>
                            <td colSpan={7} className="px-6 py-8 text-cream-400 text-sm">Loading investors…</td>
                          </tr>
                        ) : investors.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-6 py-8 text-cream-400 text-sm">No accounts yet.</td>
                          </tr>
                        ) : investors.map((inv) => {
                          const wallet = inv.walletAddress;
                          const verifiedOnChain = wallet ? onChainVerified.has(wallet.toLowerCase()) : false;
                          const frozenOnChain = wallet ? onChainFrozen.has(wallet.toLowerCase()) : false;
                          const onchainIdentity = wallet ? identityByWallet.get(wallet.toLowerCase()) : null;
                          const canRegister =
                            inv.kycStatus === 'approved' &&
                            Boolean(inv.accredited) &&
                            isHexAddress(wallet) &&
                            isIdentityConfigured &&
                            isOnboarderConfigured &&
                            isConnected &&
                            !verifiedOnChain &&
                            !onchainIdentity;
                          const canAgent =
                            isHexAddress(wallet) && isIdentityConfigured && isConnected && (verifiedOnChain || frozenOnChain);
                          return (
                            <tr key={inv.id} className="hover:bg-void-700/30 transition-colors">
                              <td className="px-6 py-4">
                                <div className="text-cream-100 font-medium">{inv.name || '—'}</div>
                                <div className="text-cream-400 text-xs">{inv.email}</div>
                              </td>
                              <td className="px-6 py-4 text-cream-400">{inv.kyc?.country || '—'}</td>
                              <td className="px-6 py-4">
                                <Badge
                                  color={
                                    inv.kycStatus === 'approved'
                                      ? 'green'
                                      : inv.kycStatus === 'pending'
                                        ? 'yellow'
                                        : inv.kycStatus === 'rejected'
                                          ? 'red'
                                          : 'accent'
                                  }
                                >
                                  {inv.kycStatus}
                                </Badge>
                              </td>
                              <td className="px-6 py-4 text-cream-100 font-mono text-xs">
                                {wallet ? shortAddr(wallet) : '—'}
                              </td>
                              <td className="px-6 py-4">
                                {!wallet ? (
                                  <span className="text-cream-400 text-sm">—</span>
                                ) : !isIdentityConfigured ? (
                                  <span className="text-cream-400 text-sm">n/a</span>
                                ) : verifiedLoading && verifiedResults === undefined ? (
                                  <span className="text-cream-400 text-sm">…</span>
                                ) : (
                                  <div>
                                    <Badge color={verifiedOnChain ? 'green' : 'yellow'}>
                                      {verifiedOnChain ? 'Registered' : 'Not registered'}
                                    </Badge>
                                    {onchainIdentity && (
                                      <div className="text-cream-400 text-xs font-mono mt-1">
                                        ID {shortAddr(onchainIdentity)}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                {!wallet || !isIdentityConfigured ? (
                                  <span className="text-cream-400 text-sm">—</span>
                                ) : frozenLoading && frozenResults === undefined ? (
                                  <span className="text-cream-400 text-sm">…</span>
                                ) : (
                                  <Badge color={frozenOnChain ? 'red' : 'green'}>
                                    {frozenOnChain ? 'Frozen' : 'Active'}
                                  </Badge>
                                )}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex justify-end flex-wrap gap-2">
                                  {inv.kycStatus === 'pending' && (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={reviewingId === inv.id}
                                        onClick={async () => {
                                          setReviewingId(inv.id);
                                          try {
                                            await reviewKyc(inv.id, 'approved');
                                            await queryClient.invalidateQueries({ queryKey: ['kyc-investors'] });
                                          } finally {
                                            setReviewingId(null);
                                          }
                                        }}
                                      >
                                        Approve
                                      </Button>
                                      <Button
                                        variant="danger"
                                        size="sm"
                                        disabled={reviewingId === inv.id}
                                        onClick={async () => {
                                          setReviewingId(inv.id);
                                          try {
                                            await reviewKyc(inv.id, 'rejected', 'Incomplete or ineligible application.');
                                            await queryClient.invalidateQueries({ queryKey: ['kyc-investors'] });
                                          } finally {
                                            setReviewingId(null);
                                          }
                                        }}
                                      >
                                        Reject
                                      </Button>
                                    </>
                                  )}
                                  {canRegister && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={registeringId === inv.id || registerConfirming}
                                      onClick={() => handleRegister(inv)}
                                    >
                                      {registeringId === inv.id || (registerConfirming && registeringId === inv.id)
                                        ? 'Registering…'
                                        : 'Register on-chain'}
                                    </Button>
                                  )}
                                  {canAgent && (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={freezingWallet === wallet.toLowerCase()}
                                        onClick={() => handleFreeze(wallet as `0x${string}`, !frozenOnChain)}
                                      >
                                        {freezingWallet === wallet.toLowerCase()
                                          ? 'Updating…'
                                          : frozenOnChain
                                            ? 'Unfreeze'
                                            : 'Freeze'}
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          setCompliance({
                                            mode: 'recover',
                                            wallet: wallet as `0x${string}`,
                                            label: inv.name || inv.email,
                                          })
                                        }
                                      >
                                        Recover
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          setCompliance({
                                            mode: 'force',
                                            wallet: wallet as `0x${string}`,
                                            label: inv.name || inv.email,
                                          })
                                        }
                                      >
                                        Move shares
                                      </Button>
                                    </>
                                  )}
                                  {inv.kycStatus !== 'pending' && !canRegister && !canAgent && (
                                    <span className="text-cream-400 text-sm">—</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {address && (
                    <p className="text-cream-400 text-xs mt-3 font-mono">
                      Connected registrar: {shortAddr(address)}
                    </p>
                  )}
                </div>
              )}
              {activeTab === 'contracts' && (
                <div>
                  <h3 className="font-display text-lg font-semibold text-cream-100 mb-2">Protocol deployments</h3>
                  <p className="text-cream-400 text-sm mb-6">
                    Listings come from PropertyFactory.getListing. Use Deploy on the Properties tab, or seed with{' '}
                    <span className="font-mono text-cream-200">npm run deploy:protocol</span>. Enable exit freezes
                    transfers and pauses the sale; deposit proceeds, then holders redeem from My Dashboard.
                  </p>
                  {pauseError && <p className="text-red-400 text-sm mb-4">{pauseError}</p>}
                  {distError && <p className="text-red-400 text-sm mb-4">{distError}</p>}
                  {exitError && <p className="text-red-400 text-sm mb-4">{exitError}</p>}
                  {activitySyncNote && <p className="text-cream-400 text-sm mb-4">{activitySyncNote}</p>}
                  <div className="flex justify-end mb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={syncingActivity}
                      onClick={async () => {
                        setSyncingActivity(true);
                        setActivitySyncNote('');
                        try {
                          const result = await syncActivity();
                          setActivitySyncNote(
                            result.synced
                              ? `Indexed ${result.added ?? 0} new events.`
                              : `Sync skipped: ${result.reason || 'RPC unavailable'}. Start Hardhat and set CHAIN_RPC_URL.`
                          );
                          await queryClient.invalidateQueries({ queryKey: ['activity'] });
                        } catch (err) {
                          setActivitySyncNote(err instanceof Error ? err.message : 'Sync failed.');
                        } finally {
                          setSyncingActivity(false);
                        }
                      }}
                    >
                      {syncingActivity ? 'Syncing…' : 'Sync activity index'}
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    {[
                      { label: 'Identity registry', value: IDENTITY_REGISTRY_ADDRESS, ok: isIdentityConfigured },
                      { label: 'Claim issuer', value: CLAIM_ISSUER_ADDRESS, ok: isClaimIssuerConfigured },
                      { label: 'Investor onboarder', value: INVESTOR_ONBOARDER_ADDRESS, ok: isOnboarderConfigured },
                      { label: 'USDC', value: USDC_ADDRESS, ok: isHexAddress(USDC_ADDRESS) },
                      { label: 'Property factory', value: PROPERTY_FACTORY_ADDRESS, ok: isFactoryConfigured },
                      { label: 'Share market', value: SHARE_MARKET_ADDRESS, ok: isMarketConfigured },
                    ].map((row) => (
                      <div key={row.label} className="p-4 rounded-xl border border-void-700 bg-void-800/60">
                        <div className="text-cream-400 text-xs uppercase tracking-wider mb-1">{row.label}</div>
                        <div className={`font-mono text-sm break-all ${row.ok ? 'text-accent' : 'text-cream-400'}`}>
                          {row.value || 'not set'}
                        </div>
                      </div>
                    ))}
                  </div>
                  {isMarketConfigured && (
                    <div className="flex items-center justify-between gap-4 mb-6 p-4 rounded-xl border border-void-700 bg-void-800/60">
                      <div>
                        <div className="text-cream-100 font-medium">Secondary market</div>
                        <p className="text-cream-400 text-sm">
                          {marketPaused ? 'Asks cannot be listed or filled while paused.' : 'KYC-gated asks are open.'}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!isConnected || pausingMarket}
                        onClick={handlePauseMarket}
                      >
                        {pausingMarket ? 'Updating…' : marketPaused ? 'Unpause market' : 'Pause market'}
                      </Button>
                    </div>
                  )}
                  <div className="overflow-x-auto rounded-xl border border-void-700">
                    <table className="min-w-full">
                      <thead>
                        <tr className="border-b border-void-700">
                          <th className="px-6 py-3 text-left text-xs font-medium text-cream-400 uppercase tracking-wider">Property</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-cream-400 uppercase tracking-wider">Share token</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-cream-400 uppercase tracking-wider">Offering</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-cream-400 uppercase tracking-wider">Sale</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-cream-400 uppercase tracking-wider">Rent pool</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-cream-400 uppercase tracking-wider">Exit</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-cream-400 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-void-700">
                        {!isFactoryConfigured ? (
                          <tr>
                            <td colSpan={7} className="px-6 py-8 text-cream-400 text-sm">
                              Set VITE_PROPERTY_FACTORY_ADDRESS after deploying the protocol. The seed deploy creates listings for property ids 1, 3, and 5.
                            </td>
                          </tr>
                        ) : listingsLoading && factoryListings.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-6 py-8 text-cream-400 text-sm">Reading factory listings…</td>
                          </tr>
                        ) : factoryListings.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-6 py-8 text-cream-400 text-sm">
                              No listings on this factory yet. Call createListing for a catalog property id.
                            </td>
                          </tr>
                        ) : (
                          factoryListings.map((row, i) => {
                            const paused = pauseResults?.[i]?.result === true;
                            const offeringFinalized = offeringFinalizedResults?.[i]?.result === true;
                            const offeringSuccessful = offeringSuccessResults?.[i]?.result === true;
                            const closesAtRaw = offeringClosesResults?.[i]?.result;
                            const closesAt = typeof closesAtRaw === 'bigint' ? closesAtRaw : 0n;
                            const escrowOpen = closesAt > 0n && !offeringFinalized;
                            const distRaw = distributorResults?.[i]?.result;
                            const distributor =
                              typeof distRaw === 'string' && distRaw.toLowerCase() !== ZERO
                                ? (distRaw as `0x${string}`)
                                : null;
                            const redRaw = redemptionResults?.[i]?.result;
                            const redemption =
                              typeof redRaw === 'string' && redRaw.toLowerCase() !== ZERO
                                ? (redRaw as `0x${string}`)
                                : null;
                            const exitOpen = Boolean(redemption && exitOpenedById.get(row.property.id));
                            return (
                            <tr key={row.property.id} className="hover:bg-void-700/30 transition-colors">
                              <td className="px-6 py-4 text-cream-100">{row.property.title}</td>
                              <td className="px-6 py-4 text-accent font-mono text-sm">{row.listing?.token ? shortAddr(row.listing.token) : '—'}</td>
                              <td className="px-6 py-4 text-accent font-mono text-sm">{row.listing?.offering ? shortAddr(row.listing.offering) : '—'}</td>
                              <td className="px-6 py-4">
                                {offeringFinalized ? (
                                  <Badge color={offeringSuccessful ? 'green' : 'red'}>
                                    {offeringSuccessful ? 'Filled' : 'Failed'}
                                  </Badge>
                                ) : (
                                  <Badge color={paused ? 'yellow' : 'green'}>{paused ? 'Paused' : escrowOpen ? 'Escrow' : 'Open'}</Badge>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                {distributor ? (
                                  <span className="text-accent font-mono text-sm">{shortAddr(distributor)}</span>
                                ) : (
                                  <span className="text-cream-400 text-sm">Off</span>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                {exitOpen ? (
                                  <Badge color="yellow">Open</Badge>
                                ) : redemption ? (
                                  <span className="text-cream-400 text-sm">Frozen</span>
                                ) : (
                                  <span className="text-cream-400 text-sm">Off</span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex justify-end flex-wrap gap-2">
                                  {escrowOpen && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={!isConnected || finalizingId === row.property.id || !row.listing?.offering}
                                      onClick={() =>
                                        row.listing && handleFinalize(row.property.id, row.listing.offering)
                                      }
                                    >
                                      {finalizingId === row.property.id ? 'Finalizing…' : 'Finalize'}
                                    </Button>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={!isConnected || pausingId === row.property.id || !row.listing?.offering}
                                    onClick={() =>
                                      row.listing &&
                                      handlePause(row.property.id, row.listing.offering, paused)
                                    }
                                  >
                                    {pausingId === row.property.id ? 'Updating…' : paused ? 'Unpause' : 'Pause'}
                                  </Button>
                                  {distributor ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        setDepositTarget({ title: row.property.title, distributor })
                                      }
                                    >
                                      Deposit rent
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={!isConnected || enablingDistId === row.property.id}
                                      onClick={() => handleEnableDistributor(row.property.id)}
                                    >
                                      {enablingDistId === row.property.id ? 'Enabling…' : 'Enable rent'}
                                    </Button>
                                  )}
                                  {exitOpen ? (
                                    <Badge color="yellow">Exit funded</Badge>
                                  ) : redemption ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setExitTarget({ title: row.property.title, redemption })}
                                    >
                                      Deposit proceeds
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={!isConnected || enablingExitId === row.property.id}
                                      onClick={() => handleEnableExit(row.property.id)}
                                    >
                                      {enablingExitId === row.property.id ? 'Enabling…' : 'Enable exit'}
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {activeTab === 'production' && (
                <div>
                  <h3 className="font-display text-lg font-semibold text-cream-100 mb-2">Production readiness</h3>
                  <p className="text-cream-400 text-sm mb-6">
                    Automated checks plus items that stay open until a real audit, bounty, KYC vendor, and first close exist.
                    See <span className="font-mono text-cream-200">PRODUCTION.md</span>. This tab does not make the demo a live offering.
                  </p>
                  {readinessLoading && !readiness ? (
                    <p className="text-cream-400 text-sm">Reading readiness…</p>
                  ) : readiness ? (
                    <>
                      <div className="flex flex-wrap gap-2 mb-6">
                        <Badge color={readiness.demo ? 'yellow' : 'green'}>
                          {readiness.demo ? 'Demo' : 'Production env'}
                        </Badge>
                        <Badge color={readiness.ready ? 'green' : 'red'}>
                          {readiness.ready ? 'Ready probe ok' : 'Ready probe degraded'}
                        </Badge>
                        <Badge color={readiness.liveOfferingAllowed ? 'green' : 'yellow'}>
                          {readiness.liveOfferingAllowed ? 'Live offering flags set' : 'Live offering not allowed'}
                        </Badge>
                        <span className="text-cream-400 text-sm self-center">Chain {readiness.chainId}</span>
                      </div>
                      <div className="overflow-x-auto rounded-xl border border-void-700">
                        <table className="min-w-full">
                          <thead>
                            <tr className="border-b border-void-700">
                              <th className="px-6 py-3 text-left text-xs font-medium text-cream-400 uppercase tracking-wider">Check</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-cream-400 uppercase tracking-wider">Status</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-cream-400 uppercase tracking-wider">Detail</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-void-700">
                            {readiness.checks.map((row) => (
                              <tr key={row.id}>
                                <td className="px-6 py-4 text-cream-100 text-sm">{row.label}</td>
                                <td className="px-6 py-4">
                                  <Badge
                                    color={
                                      row.status === 'pass'
                                        ? 'green'
                                        : row.status === 'fail'
                                          ? 'red'
                                          : 'yellow'
                                    }
                                  >
                                    {row.status}
                                  </Badge>
                                </td>
                                <td className="px-6 py-4 text-cream-400 text-sm">{row.detail}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <p className="text-cream-400 text-sm">Could not load readiness.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
      <AddPropertyModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={async () => {
          setAddOpen(false);
          await queryClient.invalidateQueries({ queryKey: ['properties'] });
        }}
      />
      <CreateListingModal
        isOpen={Boolean(deployProperty)}
        property={deployProperty}
        onClose={() => setDeployProperty(null)}
        onDeployed={async () => {
          setDeployProperty(null);
          await queryClient.invalidateQueries({ queryKey: ['properties'] });
          await refetchListings();
        }}
      />
      <DepositDistributionModal
        isOpen={Boolean(depositTarget)}
        propertyTitle={depositTarget?.title || ''}
        distributor={depositTarget?.distributor || null}
        onClose={() => setDepositTarget(null)}
        onDeposited={() => setDepositTarget(null)}
      />
      <OpenExitModal
        isOpen={Boolean(exitTarget)}
        propertyTitle={exitTarget?.title || ''}
        redemption={exitTarget?.redemption || null}
        onClose={() => setExitTarget(null)}
        onOpened={async () => {
          setExitTarget(null);
          await refetchExitOpened();
        }}
      />
      <OpsPropertyModal
        isOpen={Boolean(opsProperty)}
        property={opsProperty}
        onClose={() => setOpsProperty(null)}
        onSaved={async () => {
          setOpsProperty(null);
          await queryClient.invalidateQueries({ queryKey: ['properties'] });
        }}
      />
      <ListingCmsModal
        isOpen={Boolean(cmsProperty)}
        property={cmsProperty}
        onClose={() => setCmsProperty(null)}
        onSaved={async () => {
          setCmsProperty(null);
          await queryClient.invalidateQueries({ queryKey: ['properties'] });
        }}
      />
      <DocumentVaultModal
        isOpen={Boolean(vaultProperty)}
        property={vaultProperty}
        onClose={() => setVaultProperty(null)}
        onUpdated={async (next) => {
          setVaultProperty(next);
          await queryClient.invalidateQueries({ queryKey: ['properties'] });
        }}
      />
      <InvestorComplianceModal
        isOpen={Boolean(compliance)}
        mode={compliance?.mode || 'recover'}
        fromWallet={compliance?.wallet || null}
        investorLabel={compliance?.label || ''}
        listings={complianceListings}
        onClose={() => setCompliance(null)}
        onDone={async () => {
          setCompliance(null);
          await refetchVerified();
          await refetchFrozen();
        }}
      />
    </div>
  );
}
