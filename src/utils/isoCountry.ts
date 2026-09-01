/** ISO 3166-1 alpha-2 → numeric. Demo KYC stores country as a 2-letter code. */
const ISO3166_NUMERIC: Record<string, number> = {
  US: 840,
  GB: 826,
  CA: 124,
  AU: 36,
  DE: 276,
  FR: 250,
  ES: 724,
  IT: 380,
  NL: 528,
  CH: 756,
  IE: 372,
  SG: 702,
  JP: 392,
  KR: 410,
  IN: 356,
  BR: 76,
  MX: 484,
  NZ: 554,
  SE: 752,
  NO: 578,
  DK: 208,
  FI: 246,
  AT: 40,
  BE: 56,
  PT: 620,
  PL: 616,
  AE: 784,
  HK: 344,
};

export function isoCountryNumeric(code: string | null | undefined): number {
  const key = (code || 'US').trim().toUpperCase();
  if (/^\d{1,3}$/.test(key)) return Number(key);
  return ISO3166_NUMERIC[key] ?? 840;
}
