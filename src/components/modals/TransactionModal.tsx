import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, CheckCircleIcon, AlertCircleIcon, LoaderIcon } from 'lucide-react';
import { formatUnits } from 'viem';
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useSignTypedData,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import { Button } from '../ui/Button';
import { useNavigate } from 'react-router-dom';
import {
  erc20Abi,
  identityRegistryAbi,
  IDENTITY_REGISTRY_ADDRESS,
  isFactoryConfigured,
  isHexAddress,
  offeringAbi,
} from '../../contracts/config';
import { listingFromResult, useListing } from '../../hooks/useListing';
import { isZeroBytes32, subscriptionDomain, SUBSCRIPTION_TYPES } from '../../utils/subscription';
import { OnrampModal } from './OnrampModal';

type TransactionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  property: {
    id: string;
    title: string;
    price: number;
    tokenPrice: number;
    totalTokens?: number;
    offeringAddress?: string;
    sharePriceUsdc?: number;
  };
};

export function TransactionModal({ isOpen, onClose, property }: TransactionModalProps) {
  const navigate = useNavigate();
  const { address, chain } = useAccount();
  const publicClient = usePublicClient();
  const [tokenAmount, setTokenAmount] = useState(1);
  const [errorMessage, setErrorMessage] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'signing' | 'approving' | 'buying'>('idle');
  const [onrampOpen, setOnrampOpen] = useState(false);

  const { data: listingData } = useListing(isOpen ? property.id : undefined);
  const listing = listingFromResult(listingData);
  const offeringAddress = isHexAddress(property.offeringAddress)
    ? property.offeringAddress
    : listing?.exists
      ? listing.offering
      : undefined;

  const offeringEnabled = Boolean(isOpen && offeringAddress);

  const { data: onChainPrice } = useReadContract({
    address: offeringAddress,
    abi: offeringAbi,
    functionName: 'price',
    query: { enabled: offeringEnabled },
  });
  const { data: usdcAddress } = useReadContract({
    address: offeringAddress,
    abi: offeringAbi,
    functionName: 'usdc',
    query: { enabled: offeringEnabled },
  });
  const { data: paused } = useReadContract({
    address: offeringAddress,
    abi: offeringAbi,
    functionName: 'paused',
    query: { enabled: offeringEnabled },
  });
  const { data: remaining } = useReadContract({
    address: offeringAddress,
    abi: offeringAbi,
    functionName: 'remaining',
    query: { enabled: offeringEnabled },
  });
  const { data: minTicket } = useReadContract({
    address: offeringAddress,
    abi: offeringAbi,
    functionName: 'minTicket',
    query: { enabled: offeringEnabled },
  });
  const { data: verified } = useReadContract({
    address: isHexAddress(IDENTITY_REGISTRY_ADDRESS) ? IDENTITY_REGISTRY_ADDRESS : undefined,
    abi: identityRegistryAbi,
    functionName: 'isVerified',
    args: address ? [address] : undefined,
    query: { enabled: isOpen && isHexAddress(IDENTITY_REGISTRY_ADDRESS) && Boolean(address) },
  });
  const { data: frozen } = useReadContract({
    address: isHexAddress(IDENTITY_REGISTRY_ADDRESS) ? IDENTITY_REGISTRY_ADDRESS : undefined,
    abi: identityRegistryAbi,
    functionName: 'isFrozen',
    args: address ? [address] : undefined,
    query: { enabled: isOpen && isHexAddress(IDENTITY_REGISTRY_ADDRESS) && Boolean(address) },
  });
  const { data: documentsHash } = useReadContract({
    address: offeringAddress,
    abi: offeringAbi,
    functionName: 'documentsHash',
    query: { enabled: offeringEnabled },
  });
  const { data: maxPerWallet } = useReadContract({
    address: offeringAddress,
    abi: offeringAbi,
    functionName: 'maxPerWallet',
    query: { enabled: offeringEnabled },
  });
  const { data: purchased } = useReadContract({
    address: offeringAddress,
    abi: offeringAbi,
    functionName: 'purchased',
    args: address ? [address] : undefined,
    query: { enabled: offeringEnabled && Boolean(address) },
  });
  const { data: nonce } = useReadContract({
    address: offeringAddress,
    abi: offeringAbi,
    functionName: 'nonces',
    args: address ? [address] : undefined,
    query: { enabled: offeringEnabled && Boolean(address) },
  });
  const { data: finalized } = useReadContract({
    address: offeringAddress,
    abi: offeringAbi,
    functionName: 'finalized',
    query: { enabled: offeringEnabled },
  });
  const { data: closesAt } = useReadContract({
    address: offeringAddress,
    abi: offeringAbi,
    functionName: 'closesAt',
    query: { enabled: offeringEnabled },
  });
  const { data: minRaise } = useReadContract({
    address: offeringAddress,
    abi: offeringAbi,
    functionName: 'minRaise',
    query: { enabled: offeringEnabled },
  });
  const { data: escrowed } = useReadContract({
    address: offeringAddress,
    abi: offeringAbi,
    functionName: 'escrowed',
    query: { enabled: offeringEnabled },
  });
  const { data: allowance } = useReadContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && offeringAddress ? [address, offeringAddress] : undefined,
    query: { enabled: Boolean(isOpen && usdcAddress && address && offeringAddress) },
  });
  const { data: usdcBalance, refetch: refetchUsdc } = useReadContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(isOpen && usdcAddress && address) },
  });
  const { data: usdcDecimals } = useReadContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: 'decimals',
    query: { enabled: Boolean(isOpen && usdcAddress) },
  });

  const { writeContractAsync, data: hash, isPending, reset } = useWriteContract();
  const { signTypedDataAsync } = useSignTypedData();
  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: Boolean(hash) && phase === 'buying' },
  });

  useEffect(() => {
    if (!isOpen) {
      setTokenAmount(1);
      setErrorMessage('');
      setAgreed(false);
      setPhase('idle');
      reset();
    }
  }, [isOpen, reset]);

  const decimals = usdcDecimals ?? 6;
  const cost = onChainPrice !== undefined ? onChainPrice * BigInt(tokenAmount) : undefined;
  const listed =
    property.sharePriceUsdc ||
    (property.totalTokens ? Math.round((property.price / property.totalTokens) * 100) / 100 : property.tokenPrice);
  const needsApprove = cost !== undefined && (allowance ?? 0n) < cost;

  const explorerTx =
    hash && chain?.blockExplorers?.default.url
      ? `${chain.blockExplorers.default.url}/tx/${hash}`
      : null;

  const needsSignature = !isZeroBytes32(documentsHash);
  const walletRoom =
    maxPerWallet !== undefined && purchased !== undefined ? maxPerWallet - purchased : undefined;
  const closed =
    typeof closesAt === 'bigint' && closesAt > 0n && BigInt(Math.floor(Date.now() / 1000)) >= closesAt;

  const handleClose = () => {
    if (isPending || isConfirming || phase === 'approving' || phase === 'signing') return;
    onClose();
  };

  const handleTransaction = async () => {
    setErrorMessage('');
    if (!offeringAddress || !address || !usdcAddress || cost === undefined) {
      setErrorMessage(
        isFactoryConfigured
          ? 'No offering is deployed for this property yet. Create a listing with the PropertyFactory.'
          : 'Set VITE_PROPERTY_FACTORY_ADDRESS after deploying the protocol.'
      );
      return;
    }
    if (needsSignature && !agreed) {
      setErrorMessage('Confirm you have read the offering documents bound to the on-chain hash.');
      return;
    }
    try {
      let signature: `0x${string}` | undefined;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 30 * 60);
      if (needsSignature) {
        if (!chain?.id || !documentsHash) {
          setErrorMessage('Connect a wallet on the offering chain to sign the subscription.');
          return;
        }
        setPhase('signing');
        signature = await signTypedDataAsync({
          domain: subscriptionDomain(chain.id, offeringAddress),
          types: SUBSCRIPTION_TYPES,
          primaryType: 'Subscription',
          message: {
            investor: address,
            offering: offeringAddress,
            documentsHash,
            amount: BigInt(tokenAmount),
            nonce: nonce ?? 0n,
            deadline,
          },
        });
      }
      if (needsApprove) {
        setPhase('approving');
        const approveHash = await writeContractAsync({
          address: usdcAddress,
          abi: erc20Abi,
          functionName: 'approve',
          args: [offeringAddress, cost],
        });
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }
      }
      setPhase('buying');
      if (needsSignature && signature) {
        await writeContractAsync({
          address: offeringAddress,
          abi: offeringAbi,
          functionName: 'subscribe',
          args: [BigInt(tokenAmount), deadline, signature],
        });
      } else {
        await writeContractAsync({
          address: offeringAddress,
          abi: offeringAbi,
          functionName: 'buy',
          args: [BigInt(tokenAmount)],
        });
      }
    } catch (err) {
      const anyErr = err as { shortMessage?: string; message?: string };
      setErrorMessage(anyErr.shortMessage || anyErr.message || 'Transaction failed');
      setPhase('idle');
    }
  };

  const status = isSuccess
    ? 'success'
    : isPending || isConfirming || phase === 'approving' || phase === 'signing'
      ? 'processing'
      : errorMessage || receiptError
        ? 'error'
        : 'initial';

  const displayError =
    errorMessage ||
    (receiptError as { shortMessage?: string } | undefined)?.shortMessage ||
    receiptError?.message ||
    '';

  const processingLabel =
    phase === 'signing'
      ? 'Sign the subscription in your wallet…'
      : phase === 'approving'
        ? 'Approve USDC in your wallet…'
        : isConfirming
          ? 'Waiting for confirmation…'
          : 'Confirm purchase in your wallet…';

  return (
    <>
    <AnimatePresence>
      {isOpen && (
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
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-display text-xl font-semibold text-cream-100">
                  {status === 'initial' && 'Purchase shares'}
                  {status === 'processing' && 'Processing'}
                  {status === 'success' && 'Complete'}
                  {status === 'error' && 'Failed'}
                </h3>
                <button
                  onClick={handleClose}
                  disabled={status === 'processing'}
                  className="p-2 rounded-lg text-cream-400 hover:text-cream-100 hover:bg-void-700 transition-colors disabled:opacity-50"
                >
                  <XIcon size={20} />
                </button>
              </div>

              {status === 'initial' && (
                <>
                  <div className="mb-6 space-y-4">
                    <p className="text-cream-400">
                      <span className="text-cream-200 font-medium">{property.title}</span>
                      <br />
                      {cost !== undefined ? (
                        <>
                          On-chain price:{' '}
                          <span className="text-accent">
                            {formatUnits(onChainPrice ?? 0n, decimals)} USDC
                          </span>
                          <span className="text-cream-400 text-sm"> / share</span>
                        </>
                      ) : (
                        <>
                          Listed share price:{' '}
                          <span className="text-accent">${listed.toLocaleString()} USDC</span>
                        </>
                      )}
                    </p>

                    {!offeringAddress && (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-200">
                        No offering deployed for this property. Deploy the protocol and call
                        createListing, then set VITE_PROPERTY_FACTORY_ADDRESS.
                      </div>
                    )}

                    {offeringAddress && verified === false && (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-200">
                        This wallet is not verified on-chain. After mock KYC, an admin must Register on-chain so the
                        wallet has an ONCHAINID with valid KYC claims.
                      </div>
                    )}

                    {offeringAddress && frozen === true && (
                      <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">
                        This wallet is frozen on the identity registry. An agent must unfreeze or recover it before
                        you can buy.
                      </div>
                    )}

                    {paused && (
                      <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">
                        This offering is paused.
                      </div>
                    )}

                    {(finalized || closed) && (
                      <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">
                        This primary sale is closed.
                      </div>
                    )}

                    {escrowed && !finalized && !closed && (
                      <p className="text-cream-400 text-xs">
                        USDC is escrowed until admin finalizes
                        {minRaise !== undefined && minRaise > 0n ? ` (min ${minRaise.toString()} shares)` : ''}. If the
                        raise fails, you can refund from My Dashboard.
                      </p>
                    )}

                    {needsSignature && documentsHash && (
                      <label className="flex items-start gap-3 p-3 rounded-xl bg-void-700/50 border border-void-600 text-sm text-cream-300">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={agreed}
                          onChange={(e) => setAgreed(e.target.checked)}
                        />
                        <span>
                          I agree to the offering documents whose keccak is{' '}
                          <span className="font-mono text-xs break-all text-cream-200">{documentsHash}</span>. This is a
                          demo subscription, not a live PPM.
                        </span>
                      </label>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-cream-400 mb-2">Number of shares</label>
                      <div className="flex items-center gap-0">
                        <button
                          type="button"
                          onClick={() => setTokenAmount((n) => Math.max(1, n - 1))}
                          className="bg-void-700 border border-void-600 text-cream-100 px-3 py-2.5 rounded-l-xl hover:bg-void-600 transition-colors"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          value={tokenAmount}
                          onChange={(e) => setTokenAmount(Math.max(1, parseInt(e.target.value) || 1))}
                          min={1}
                          className="w-20 bg-void-700 border-y border-void-600 text-cream-100 text-center py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/40"
                        />
                        <button
                          type="button"
                          onClick={() => setTokenAmount((n) => n + 1)}
                          className="bg-void-700 border border-void-600 text-cream-100 px-3 py-2.5 rounded-r-xl hover:bg-void-600 transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-void-700/50 border border-void-600 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-cream-400">Total</span>
                        <span className="text-cream-100">
                          {cost !== undefined ? `${formatUnits(cost, decimals)} USDC` : '—'}
                        </span>
                      </div>
                      {usdcBalance !== undefined && (
                        <div className="flex justify-between text-sm">
                          <span className="text-cream-400">USDC balance</span>
                          <span className="text-cream-100">{formatUnits(usdcBalance, decimals)}</span>
                        </div>
                      )}
                      <button
                        type="button"
                        className="text-accent text-xs hover:underline"
                        onClick={() => setOnrampOpen(true)}
                      >
                        Get USDC
                      </button>
                      {remaining !== undefined && (
                        <div className="flex justify-between text-sm">
                          <span className="text-cream-400">Remaining</span>
                          <span className="text-cream-100">{remaining.toString()} shares</span>
                        </div>
                      )}
                      {walletRoom !== undefined && (
                        <div className="flex justify-between text-sm">
                          <span className="text-cream-400">Your remaining max</span>
                          <span className="text-cream-100">{walletRoom.toString()} shares</span>
                        </div>
                      )}
                      <p className="text-xs text-cream-400">
                        {needsSignature
                          ? 'You will sign a subscription, then approve USDC if needed, then buy.'
                          : needsApprove
                            ? 'Your wallet will approve USDC, then buy. Two transactions.'
                            : 'Payment is USDC. Amount × price is pulled from your wallet.'}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleTransaction}
                    fullWidth
                    disabled={
                      !offeringAddress ||
                      !address ||
                      paused === true ||
                      finalized === true ||
                      closed ||
                      cost === undefined ||
                      verified === false ||
                      frozen === true ||
                      (needsSignature && !agreed) ||
                      (minTicket !== undefined && BigInt(tokenAmount) < minTicket) ||
                      (remaining !== undefined && BigInt(tokenAmount) > remaining) ||
                      (walletRoom !== undefined && BigInt(tokenAmount) > walletRoom)
                    }
                  >
                    {!offeringAddress
                      ? 'Offering not deployed'
                      : needsSignature
                        ? needsApprove
                          ? 'Sign, approve, and subscribe'
                          : 'Sign and subscribe'
                        : needsApprove
                          ? 'Approve USDC and buy'
                          : 'Buy shares'}
                  </Button>
                </>
              )}

              {status === 'processing' && (
                <div className="text-center py-10">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="inline-flex mb-4"
                  >
                    <LoaderIcon size={48} className="text-accent" />
                  </motion.div>
                  <p className="text-cream-300 mb-1">{processingLabel}</p>
                  <p className="text-sm text-cream-400">Do not close this window.</p>
                </div>
              )}

              {status === 'success' && (
                <div className="text-center py-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                    className="inline-flex mb-4 text-emerald-400"
                  >
                    <CheckCircleIcon size={48} />
                  </motion.div>
                  <h4 className="font-display text-xl font-semibold text-cream-100 mb-2">Purchase submitted</h4>
                  <p className="text-cream-400 mb-4">
                    You bought {tokenAmount} share{tokenAmount > 1 ? 's' : ''} of {property.title}.
                  </p>
                  {hash && (
                    <p className="text-xs font-mono text-cream-400 break-all mb-6">
                      {explorerTx ? (
                        <a href={explorerTx} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                          {hash}
                        </a>
                      ) : (
                        hash
                      )}
                    </p>
                  )}
                  <Button
                    onClick={() => {
                      handleClose();
                      navigate('/user');
                    }}
                    fullWidth
                  >
                    View portfolio
                  </Button>
                </div>
              )}

              {status === 'error' && (
                <div className="text-center py-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                    className="inline-flex mb-4 text-red-400"
                  >
                    <AlertCircleIcon size={48} />
                  </motion.div>
                  <h4 className="font-display text-xl font-semibold text-cream-100 mb-2">Transaction failed</h4>
                  <p className="text-cream-400 mb-6 text-sm break-words">
                    {displayError ||
                      'The offering rejected this purchase. Common causes: not verified, missing subscription signature, over wallet max, insufficient USDC, paused, closed, or sold out.'}
                  </p>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={handleClose} fullWidth>
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        setErrorMessage('');
                        setPhase('idle');
                        reset();
                      }}
                      fullWidth
                    >
                      Try again
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
      <OnrampModal
        isOpen={onrampOpen}
        onClose={() => {
          setOnrampOpen(false);
          void refetchUsdc();
        }}
      />
    </>
  );
}
