import { Property } from './types';

/** Listed share price in USD. Falls back to property value / share count. */
export function sharePriceUsdc(property: Property): number {
  if (property.sharePriceUsdc && property.sharePriceUsdc > 0) {
    return property.sharePriceUsdc;
  }
  if (property.totalTokens > 0) {
    return Math.round((property.price / property.totalTokens) * 100) / 100;
  }
  return 0;
}

/** USDC amount with 6 decimals. */
export function usdcToOnChain(usd: number): bigint {
  return BigInt(Math.round(usd * 1_000_000));
}

export function shareSymbol(title: string): string {
  const letters = title.replace(/[^A-Za-z]/g, '').toUpperCase();
  return (letters.slice(0, 4) || 'SHR').slice(0, 5);
}
