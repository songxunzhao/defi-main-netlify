import React from 'react';
import { hasCoords, osmBrowseUrl, osmEmbedSrc } from '../../utils/geo';

type PropertyMapProps = {
  lat?: number | null;
  lng?: number | null;
  title: string;
  mapUrl?: string;
};

export function PropertyMap({ lat, lng, title, mapUrl }: PropertyMapProps) {
  const coords = hasCoords({ lat, lng });
  const src = coords ? osmEmbedSrc(lat as number, lng as number) : '';

  if (!coords && !mapUrl) return null;

  return (
    <div className="mb-8">
      <h2 className="font-display text-lg font-semibold text-cream-100 mb-3">Location</h2>
      {coords ? (
        <>
          <div className="rounded-xl overflow-hidden border border-void-700 bg-void-900 aspect-[16/10]">
            <iframe
              title={`Map of ${title}`}
              src={src}
              className="w-full h-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <p className="text-cream-400 text-xs mt-2">
            OpenStreetMap embed for demo pins.{' '}
            <a
              href={osmBrowseUrl(lat as number, lng as number)}
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              Open full map
            </a>
          </p>
        </>
      ) : (
        <a href={mapUrl} target="_blank" rel="noreferrer" className="text-accent text-sm hover:underline">
          Open map
        </a>
      )}
    </div>
  );
}
