import { useReadContract } from 'wagmi';
import { offeringAbi, isHexAddress } from '../contracts/config';
import { listingFromResult, useListing } from './useListing';
import { Property } from '../utils/types';

const ZERO = '0x0000000000000000000000000000000000000000';

export function useOfferingAddress(property: Property | undefined) {
  const { data } = useListing(property?.id);
  const fromFactory = listingFromResult(data);
  if (property && isHexAddress(property.offeringAddress)) return property.offeringAddress;
  if (fromFactory?.exists && fromFactory.offering && fromFactory.offering.toLowerCase() !== ZERO) {
    return fromFactory.offering;
  }
  return undefined;
}

export function useOfferingStats(offering: `0x${string}` | undefined) {
  const enabled = Boolean(offering);
  const sold = useReadContract({
    address: offering,
    abi: offeringAbi,
    functionName: 'sold',
    query: { enabled },
  });
  const remaining = useReadContract({
    address: offering,
    abi: offeringAbi,
    functionName: 'remaining',
    query: { enabled },
  });
  const cap = useReadContract({
    address: offering,
    abi: offeringAbi,
    functionName: 'cap',
    query: { enabled },
  });
  const paused = useReadContract({
    address: offering,
    abi: offeringAbi,
    functionName: 'paused',
    query: { enabled },
  });
  return {
    sold: sold.data,
    remaining: remaining.data,
    cap: cap.data,
    paused: paused.data,
    refetch: () => {
      sold.refetch();
      remaining.refetch();
      cap.refetch();
      paused.refetch();
    },
  };
}
