import { useReadContract, useReadContracts } from 'wagmi';
import {
  SHARE_MARKET_ADDRESS,
  isMarketConfigured,
  shareMarketAbi,
} from '../contracts/config';

const MAX_ASKS = 64;

export type ShareAsk = {
  id: bigint;
  seller: `0x${string}`;
  propertyId: string;
  token: `0x${string}`;
  amount: bigint;
  price: bigint;
  active: boolean;
};

export function askFromResult(id: bigint, result: unknown): ShareAsk | null {
  if (!result) return null;
  if (Array.isArray(result) && result.length >= 6) {
    return {
      id,
      seller: result[0] as `0x${string}`,
      propertyId: String(result[1]),
      token: result[2] as `0x${string}`,
      amount: result[3] as bigint,
      price: result[4] as bigint,
      active: Boolean(result[5]),
    };
  }
  const named = result as {
    seller?: string;
    propertyId?: bigint | number | string;
    token?: string;
    amount?: bigint;
    price?: bigint;
    active?: boolean;
  };
  if (!named.seller || !named.token) return null;
  return {
    id,
    seller: named.seller as `0x${string}`,
    propertyId: String(named.propertyId ?? ''),
    token: named.token as `0x${string}`,
    amount: named.amount ?? 0n,
    price: named.price ?? 0n,
    active: Boolean(named.active),
  };
}

export function useAsks(propertyId?: string) {
  const { data: nextAskId, refetch: refetchNext, isFetching: nextLoading } = useReadContract({
    address: isMarketConfigured ? (SHARE_MARKET_ADDRESS as `0x${string}`) : undefined,
    abi: shareMarketAbi,
    functionName: 'nextAskId',
    query: { enabled: isMarketConfigured },
  });

  const count = nextAskId && nextAskId > 1n ? Number(nextAskId - 1n) : 0;
  const ids = Array.from({ length: Math.min(count, MAX_ASKS) }, (_, i) => BigInt(i + 1));

  const { data: results, refetch: refetchAsks, isFetching: asksLoading } = useReadContracts({
    contracts: ids.map((id) => ({
      address: SHARE_MARKET_ADDRESS as `0x${string}`,
      abi: shareMarketAbi,
      functionName: 'getAsk' as const,
      args: [id] as const,
    })),
    query: { enabled: isMarketConfigured && ids.length > 0 },
  });

  const asks = ids
    .map((id, i) => askFromResult(id, results?.[i]?.result))
    .filter((ask): ask is ShareAsk => Boolean(ask && ask.active && ask.amount > 0n))
    .filter((ask) => (propertyId ? ask.propertyId === String(propertyId) : true));

  const refetch = async () => {
    await refetchNext();
    await refetchAsks();
  };

  return {
    asks,
    isLoading: nextLoading || asksLoading,
    refetch,
  };
}
