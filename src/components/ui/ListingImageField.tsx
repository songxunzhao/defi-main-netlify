import React, { useState } from 'react';
import { fileToBase64, ingestListingImage, mediaUrl, uploadListingImage } from '../../utils/api';

const fieldClass =
  'w-full bg-void-700 border border-void-600 text-cream-100 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-accent/40';

type ListingImageFieldProps = {
  label: string;
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
};

export function ListingImageField({ label, value, onChange, placeholder }: ListingImageFieldProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const remote = /^https?:\/\//i.test(value);

  const run = async (work: () => Promise<void>) => {
    setError('');
    setBusy(true);
    try {
      await work();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not store image.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-cream-400 mb-1.5">{label}</label>
      <input
        className={fieldClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || '/api/images/…'}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          className="block flex-1 text-sm text-cream-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-void-600 file:text-cream-100"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            void run(async () => {
              const data = await fileToBase64(file);
              const stored = await uploadListingImage({ filename: file.name, data });
              onChange(stored.url);
            });
          }}
        />
        {remote && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const stored = await ingestListingImage(value);
                onChange(stored.url);
              })
            }
            className="text-sm text-accent hover:underline disabled:opacity-50"
          >
            Store on server
          </button>
        )}
      </div>
      {busy && <p className="text-cream-400 text-xs mt-1.5">Saving image…</p>}
      {error && <p className="text-red-400 text-sm mt-1.5">{error}</p>}
      {value && (
        <img src={mediaUrl(value)} alt="" className="mt-2 h-24 w-full object-cover rounded-xl border border-void-700" />
      )}
    </div>
  );
}
