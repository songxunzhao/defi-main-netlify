export const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as const;

export const SUBSCRIPTION_TYPES = {
  Subscription: [
    { name: 'investor', type: 'address' },
    { name: 'offering', type: 'address' },
    { name: 'documentsHash', type: 'bytes32' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

export function isZeroBytes32(value: string | undefined | null): boolean {
  return !value || value.toLowerCase() === ZERO_BYTES32;
}

export function parseBytes32(value: string): `0x${string}` | null {
  const trimmed = value.trim();
  if (!trimmed) return ZERO_BYTES32;
  const hex = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
  if (!/^0x[a-fA-F0-9]{64}$/.test(hex)) return null;
  return hex as `0x${string}`;
}

export function subscriptionDomain(chainId: number, offering: `0x${string}`) {
  return {
    name: 'RealtyChain Offering',
    version: '1',
    chainId,
    verifyingContract: offering,
  } as const;
}
