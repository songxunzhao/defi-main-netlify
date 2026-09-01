import { useReadContract } from 'wagmi';
import {
  isFactoryConfigured,
  PROPERTY_FACTORY_ADDRESS,
  propertyFactoryAbi,
} from '../contracts/config';

export function useListing(propertyId: string | undefined) {
  const enabled = isFactoryConfigured && Boolean(propertyId);
  return useReadContract({
    address: enabled ? (PROPERTY_FACTORY_ADDRESS as `0x${string}`) : undefined,
    abi: propertyFactoryAbi,
    functionName: 'getListing',
    args: propertyId ? [BigInt(propertyId)] : undefined,
    query: { enabled },
  });
}

export function listingFromResult(result: unknown): {
  token: `0x${string}`;
  offering: `0x${string}`;
  exists: boolean;
} | null {
  if (!result) return null;
  if (Array.isArray(result) && result.length >= 3) {
    return {
      token: result[0] as `0x${string}`,
      offering: result[1] as `0x${string}`,
      exists: Boolean(result[2]),
    };
  }
  const named = result as { token?: string; offering?: string; exists?: boolean };
  if (named.token && named.offering) {
    return {
      token: named.token as `0x${string}`,
      offering: named.offering as `0x${string}`,
      exists: Boolean(named.exists),
    };
  }
  return null;
}
