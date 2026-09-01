export type Comp = {
  address: string;
  soldDate: string;
  priceUsd: number;
  sqft?: number | null;
  note?: string;
};

export function osmEmbedSrc(lat: number, lng: number, delta = 0.012) {
  const minLng = lng - delta;
  const minLat = lat - delta;
  const maxLng = lng + delta;
  const maxLat = lat + delta;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${minLng}%2C${minLat}%2C${maxLng}%2C${maxLat}&layer=mapnik&marker=${lat}%2C${lng}`;
}

export function osmBrowseUrl(lat: number, lng: number) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
}

export function hasCoords(property: { lat?: number | null; lng?: number | null }) {
  return (
    typeof property.lat === 'number' &&
    Number.isFinite(property.lat) &&
    typeof property.lng === 'number' &&
    Number.isFinite(property.lng)
  );
}
