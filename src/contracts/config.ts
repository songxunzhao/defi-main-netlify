/**
 * RealtyChain on-chain config: identity registry, claim issuer, onboarder, USDC, factory, and share market.
 */

import {
  erc20Abi,
  mockUsdcAbi,
  identityRegistryAbi,
  investorOnboarderAbi,
  claimIssuerAbi,
  offeringAbi,
  propertyFactoryAbi,
  distributorAbi,
  propertyShareAbi,
  shareMarketAbi,
  redemptionAbi,
} from './protocolAbi';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export function isHexAddress(value: string | undefined | null): value is `0x${string}` {
  return Boolean(value && ADDRESS_RE.test(value));
}

export const IDENTITY_REGISTRY_ADDRESS =
  (import.meta.env.VITE_IDENTITY_REGISTRY_ADDRESS as string) || '';
export const CLAIM_ISSUER_ADDRESS = (import.meta.env.VITE_CLAIM_ISSUER_ADDRESS as string) || '';
export const INVESTOR_ONBOARDER_ADDRESS =
  (import.meta.env.VITE_INVESTOR_ONBOARDER_ADDRESS as string) || '';
export const USDC_ADDRESS = (import.meta.env.VITE_USDC_ADDRESS as string) || '';
export const PROPERTY_FACTORY_ADDRESS =
  (import.meta.env.VITE_PROPERTY_FACTORY_ADDRESS as string) || '';
export const SHARE_MARKET_ADDRESS = (import.meta.env.VITE_SHARE_MARKET_ADDRESS as string) || '';

export const isFactoryConfigured = isHexAddress(PROPERTY_FACTORY_ADDRESS);
export const isIdentityConfigured = isHexAddress(IDENTITY_REGISTRY_ADDRESS);
export const isClaimIssuerConfigured = isHexAddress(CLAIM_ISSUER_ADDRESS);
export const isOnboarderConfigured = isHexAddress(INVESTOR_ONBOARDER_ADDRESS);
export const isUsdcConfigured = isHexAddress(USDC_ADDRESS);
export const isMarketConfigured = isHexAddress(SHARE_MARKET_ADDRESS);

export const isDemoMode = import.meta.env.VITE_DEMO_MODE !== 'false';

/** Demo faucet: MockUSDC.mint. Disabled when demo mode is off. Fails on canonical USDC. */
export const isUsdcFaucetEnabled = isDemoMode && isUsdcConfigured;

export const MOONPAY_KEY = (import.meta.env.VITE_MOONPAY_PUBLISHABLE_KEY as string) || '';
export const isMoonpayConfigured = Boolean(MOONPAY_KEY.trim());

export function moonpayBuyUrl(walletAddress: string, usd?: number) {
  if (!isMoonpayConfigured || !isHexAddress(walletAddress)) return '';
  const sandbox = import.meta.env.VITE_MOONPAY_SANDBOX === 'true';
  const origin = sandbox ? 'https://buy-sandbox.moonpay.com' : 'https://buy.moonpay.com';
  const params = new URLSearchParams({
    apiKey: MOONPAY_KEY.trim(),
    currencyCode: 'usdc',
    walletAddress,
  });
  if (usd !== undefined && Number.isFinite(usd) && usd > 0) {
    params.set('baseCurrencyAmount', String(usd));
  }
  return `${origin}/?${params.toString()}`;
}

/** @deprecated Use isFactoryConfigured. Kept so older imports keep compiling. */
export const isContractConfigured = isFactoryConfigured;

export {
  erc20Abi,
  mockUsdcAbi,
  identityRegistryAbi,
  investorOnboarderAbi,
  claimIssuerAbi,
  offeringAbi,
  propertyFactoryAbi,
  distributorAbi,
  propertyShareAbi,
  shareMarketAbi,
  redemptionAbi,
};
