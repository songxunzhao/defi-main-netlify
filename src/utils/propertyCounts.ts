import { Property } from './types';

function firstMatch(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function fromFeatures(features: string[] | undefined, pattern: RegExp): number | null {
  for (const feature of features || []) {
    const value = firstMatch(feature, pattern);
    if (value != null) return value;
  }
  return null;
}

export function propertyRoomCount(property: Property): number | null {
  if (property.bedrooms != null && Number.isFinite(property.bedrooms)) {
    return Number(property.bedrooms);
  }
  const fromFeature = fromFeatures(
    property.features,
    /(\d+(?:\.\d+)?)\s*(?:bedrooms?|beds?|br)\b/i
  );
  if (fromFeature != null) return fromFeature;
  return firstMatch(property.unitMix || '', /(\d+(?:\.\d+)?)\s*BR\b/i);
}

export function propertyWcCount(property: Property): number | null {
  if (property.bathrooms != null && Number.isFinite(property.bathrooms)) {
    return Number(property.bathrooms);
  }
  const fromFeature = fromFeatures(
    property.features,
    /(\d+(?:\.\d+)?)\s*(?:bathrooms?|baths?|wcs?)\b/i
  );
  if (fromFeature != null) return fromFeature;
  return firstMatch(property.unitMix || '', /(\d+(?:\.\d+)?)\s*BA\b/i);
}

export function meetsMinCount(actual: number | null, minRaw: string): boolean {
  if (!minRaw || minRaw === 'all') return true;
  const min = Number(minRaw);
  if (!Number.isFinite(min)) return true;
  return actual != null && actual >= min;
}
