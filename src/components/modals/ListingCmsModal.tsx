import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon } from 'lucide-react';
import { Button } from '../ui/Button';
import { Property } from '../../utils/types';
import { fileToBase64, updateProperty, uploadListingImage } from '../../utils/api';
import { ListingImageField } from '../ui/ListingImageField';

const fieldClass =
  'w-full bg-void-700 border border-void-600 text-cream-100 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-accent/40';

type CompDraft = {
  address: string;
  soldDate: string;
  priceUsd: string;
  sqft: string;
  note: string;
};

const emptyComp = (): CompDraft => ({ address: '', soldDate: '', priceUsd: '', sqft: '', note: '' });

type ListingCmsModalProps = {
  isOpen: boolean;
  property: Property | null;
  onClose: () => void;
  onSaved: () => void;
};

export function ListingCmsModal({ isOpen, property, onClose, onSaved }: ListingCmsModalProps) {
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [gallery, setGallery] = useState('');
  const [features, setFeatures] = useState('');
  const [unitMix, setUnitMix] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [mapUrl, setMapUrl] = useState('');
  const [comps, setComps] = useState<CompDraft[]>([emptyComp(), emptyComp(), emptyComp()]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [galleryBusy, setGalleryBusy] = useState(false);

  useEffect(() => {
    if (!isOpen || !property) return;
    setTitle(property.title || '');
    setLocation(property.location || '');
    setDescription(property.description || '');
    setImageUrl(property.imageUrl || '');
    setGallery((property.galleryUrls || []).join('\n'));
    setFeatures((property.features || []).join(', '));
    setUnitMix(property.unitMix || '');
    setLat(property.lat == null ? '' : String(property.lat));
    setLng(property.lng == null ? '' : String(property.lng));
    setMapUrl(property.mapUrl || '');
    const existing = (property.comps || []).map((row) => ({
      address: row.address,
      soldDate: row.soldDate,
      priceUsd: String(row.priceUsd),
      sqft: row.sqft == null ? '' : String(row.sqft),
      note: row.note || '',
    }));
    setComps([...existing, emptyComp(), emptyComp()].slice(0, 6));
    setError('');
  }, [isOpen, property]);

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  const handleSave = async () => {
    if (!property) return;
    setError('');
    if (!title.trim() || !location.trim()) {
      setError('Title and location are required.');
      return;
    }
    const parsedComps = comps
      .filter((row) => row.address.trim() && row.priceUsd)
      .map((row) => ({
        address: row.address.trim(),
        soldDate: row.soldDate.trim(),
        priceUsd: Number(row.priceUsd),
        sqft: row.sqft === '' ? null : Number(row.sqft),
        note: row.note.trim(),
      }));
    if (parsedComps.some((row) => !Number.isFinite(row.priceUsd) || row.priceUsd < 1)) {
      setError('Each comp needs a sale price of at least 1.');
      return;
    }
    setSaving(true);
    try {
      await updateProperty(property.id, {
        title: title.trim(),
        location: location.trim(),
        description,
        imageUrl,
        galleryUrls: gallery
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
        features: features
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        unitMix,
        lat: lat === '' ? null : Number(lat),
        lng: lng === '' ? null : Number(lng),
        mapUrl,
        comps: parsedComps,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save listing.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && property && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-void-950/80 backdrop-blur-md z-50"
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl rounded-2xl border border-void-700 bg-void-800 shadow-xl p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-5">
                <h3 className="font-display text-xl font-semibold text-cream-100">Edit listing</h3>
                <button
                  onClick={handleClose}
                  disabled={saving}
                  className="p-2 rounded-lg text-cream-400 hover:text-cream-100 hover:bg-void-700 disabled:opacity-50"
                >
                  <XIcon size={20} />
                </button>
              </div>
              <p className="text-cream-400 text-sm mb-5">
                Catalog CMS: copy, photos, map pin, unit mix, and illustrative comps. This is listing polish, not an
                appraisal or a live offering document.
              </p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-cream-400 mb-1.5">Title</label>
                    <input className={fieldClass} value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-cream-400 mb-1.5">Location</label>
                    <input className={fieldClass} value={location} onChange={(e) => setLocation(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-cream-400 mb-1.5">Description</label>
                  <textarea className={`${fieldClass} min-h-[88px]`} value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <ListingImageField label="Hero image" value={imageUrl} onChange={setImageUrl} />
                <div>
                  <label className="block text-sm font-medium text-cream-400 mb-1.5">Gallery URLs (one per line)</label>
                  <textarea className={`${fieldClass} min-h-[72px] font-mono text-sm`} value={gallery} onChange={(e) => setGallery(e.target.value)} />
                  <input
                    className="mt-2 block w-full text-sm text-cream-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-void-600 file:text-cream-100"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                    multiple
                    disabled={galleryBusy || saving}
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      e.target.value = '';
                      if (!files.length) return;
                      setGalleryBusy(true);
                      setError('');
                      try {
                        const urls: string[] = [];
                        for (const file of files) {
                          const data = await fileToBase64(file);
                          const stored = await uploadListingImage({ filename: file.name, data });
                          urls.push(stored.url);
                        }
                        setGallery((prev) => [...prev.split('\n').map((line) => line.trim()).filter(Boolean), ...urls].join('\n'));
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Could not store gallery images.');
                      } finally {
                        setGalleryBusy(false);
                      }
                    }}
                  />
                  {galleryBusy && <p className="text-cream-400 text-xs mt-1.5">Saving gallery…</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-cream-400 mb-1.5">Features (comma-separated)</label>
                  <input className={fieldClass} value={features} onChange={(e) => setFeatures(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-cream-400 mb-1.5">Unit mix</label>
                  <input className={fieldClass} value={unitMix} onChange={(e) => setUnitMix(e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-cream-400 mb-1.5">Lat</label>
                    <input className={fieldClass} value={lat} onChange={(e) => setLat(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-cream-400 mb-1.5">Lng</label>
                    <input className={fieldClass} value={lng} onChange={(e) => setLng(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-cream-400 mb-1.5">Map URL fallback</label>
                    <input className={fieldClass} value={mapUrl} onChange={(e) => setMapUrl(e.target.value)} />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-cream-400 mb-2">Comps (illustrative)</p>
                  <div className="space-y-2">
                    {comps.map((row, i) => (
                      <div key={i} className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        <input
                          className={fieldClass}
                          placeholder="Address"
                          value={row.address}
                          onChange={(e) =>
                            setComps((prev) => prev.map((c, j) => (j === i ? { ...c, address: e.target.value } : c)))
                          }
                        />
                        <input
                          className={fieldClass}
                          placeholder="Sold date"
                          value={row.soldDate}
                          onChange={(e) =>
                            setComps((prev) => prev.map((c, j) => (j === i ? { ...c, soldDate: e.target.value } : c)))
                          }
                        />
                        <input
                          className={fieldClass}
                          placeholder="Price USD"
                          value={row.priceUsd}
                          onChange={(e) =>
                            setComps((prev) => prev.map((c, j) => (j === i ? { ...c, priceUsd: e.target.value } : c)))
                          }
                        />
                        <input
                          className={fieldClass}
                          placeholder="Sq ft"
                          value={row.sqft}
                          onChange={(e) =>
                            setComps((prev) => prev.map((c, j) => (j === i ? { ...c, sqft: e.target.value } : c)))
                          }
                        />
                        <input
                          className={fieldClass}
                          placeholder="Note"
                          value={row.note}
                          onChange={(e) =>
                            setComps((prev) => prev.map((c, j) => (j === i ? { ...c, note: e.target.value } : c)))
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
              <Button className="mt-5" fullWidth disabled={saving} onClick={handleSave}>
                {saving ? 'Saving…' : 'Save listing'}
              </Button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
