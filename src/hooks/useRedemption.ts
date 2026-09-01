import { useReadContract } from 'wagmi';
import {
  erc20Abi,
  isFactoryConfigured,
  isHexAddress,
  PROPERTY_FACTORY_ADDRESS,
  propertyFactoryAbi,
  redemptionAbi,
} from '../contracts/config';
import { Property } from '../utils/types';

const ZERO = '0x0000000000000000000000000000000000000000';

export function useRedemptionAddress(property: Property | undefined) {
  const enabled = isFactoryConfigured && Boolean(property?.id);
  const { data } = useReadContract({
    address: enabled ? (PROPERTY_FACTORY_ADDRESS as `0x${string}`) : undefined,
    abi: propertyFactoryAbi,
    functionName: 'getRedemption',
    args: property?.id ? [BigInt(property.id)] : undefined,
    query: { enabled },
  });
  if (property && isHexAddress(property.redemptionAddress)) return property.redemptionAddress;
  if (typeof data === 'string' && data.toLowerCase() !== ZERO) return data as `0x${string}`;
  return undefined;
}

export function useExitState(
  redemption: `0x${string}` | undefined,
  account: `0x${string}` | undefined,
  token: `0x${string}` | undefined
) {
  const enabled = Boolean(redemption);
  const opened = useReadContract({
    address: redemption,
    abi: redemptionAbi,
    functionName: 'opened',
    query: { enabled },
  });
  const funded = opened.data === true;
  const balance = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: account ? [account] : undefined,
    query: { enabled: Boolean(token && account && redemption) },
  });
  const shares = typeof balance.data === 'bigint' ? balance.data : 0n;
  const quote = useReadContract({
    address: redemption,
    abi: redemptionAbi,
    functionName: 'quote',
    args: [shares],
    query: { enabled: funded && shares > 0n },
  });
  const quoteOne = useReadContract({
    address: redemption,
    abi: redemptionAbi,
    functionName: 'quote',
    args: [1n],
    query: { enabled: funded },
  });

  return {
    exists: Boolean(redemption),
    opened: funded,
    shares,
    quoteUsdc: typeof quote.data === 'bigint' ? quote.data : 0n,
    quotePerShare: typeof quoteOne.data === 'bigint' ? quoteOne.data : 0n,
    refetch: async () => {
      await Promise.all([opened.refetch(), balance.refetch(), quote.refetch(), quoteOne.refetch()]);
    },
  };
}
