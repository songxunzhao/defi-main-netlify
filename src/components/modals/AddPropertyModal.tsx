import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon } from 'lucide-react';
import { Button } from '../ui/Button';
import { createProperty, fileToBase64, uploadPropertyDocument } from '../../utils/api';
import { ListingImageField } from '../ui/ListingImageField';
import { Property } from '../../utils/types';

const fieldClass =
  'w-full bg-void-700 border border-void-600 text-cream-100 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-accent/40';

type AddPropertyModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (property: Property) => void;
};

export function AddPropertyModal({ isOpen, onClose, onCreated }: AddPropertyModalProps) {
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [price, setPrice] = useState('500000');
  const [totalTokens, setTotalTokens] = useState('1000');
  const [returnRate, setReturnRate] = useState('8');
  const [occupancyPercent, setOccupancyPercent] = useState('95');
  const [capRate, setCapRate] = useState('6.5');
  const [rentRollExcerpt, setRentRollExcerpt] = useState('');
  const [mapUrl, setMapUrl] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [unitMix, setUnitMix] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [docName, setDocName] = useState('PPM');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle('');
    setLocation('');
    setDescription('');
    setImageUrl('');
    setPrice('500000');
    setTotalTokens('1000');
    setReturnRate('8');
    setOccupancyPercent('95');
    setCapRate('6.5');
    setRentRollExcerpt('');
    setMapUrl('');
    setLat('');
    setLng('');
    setUnitMix('');
    setBedrooms('');
    setBathrooms('');
    setDocName('PPM');
    setDocFile(null);
    setError('');
  };

  const handleClose = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const { property } = await createProperty({
        title,
        location,
        description,
        imageUrl: imageUrl || undefined,
        price: Number(price),
        totalTokens: Number(totalTokens),
        returnRate: Number(returnRate),
        occupancyPercent: Number(occupancyPercent),
        capRate: Number(capRate),
        rentRollExcerpt,
        mapUrl,
        lat: lat === '' ? undefined : Number(lat),
        lng: lng === '' ? undefined : Number(lng),
        unitMix,
        bedrooms: bedrooms === '' ? null : Number(bedrooms),
        bathrooms: bathrooms === '' ? null : Number(bathrooms),
        status: 'Coming Soon',
        documents: [],
      });
      if (docFile) {
        const data = await fileToBase64(docFile);
        const uploaded = await uploadPropertyDocument(property.id, {
          name: docName || docFile.name,
          filename: docFile.name,
          data,
        });
        reset();
        onCreated(uploaded.property);
      } else {
        reset();
        onCreated(property);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create property.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
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
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-void-700 bg-void-800 shadow-xl p-6"
            >
              <div className="flex justify-between items-center mb-5">
                <h3 className="font-display text-xl font-semibold text-cream-100">Add property</h3>
                <button
                  onClick={handleClose}
                  className="p-2 rounded-lg text-cream-400 hover:text-cream-100 hover:bg-void-700"
                >
                  <XIcon size={20} />
                </button>
              </div>
              <p className="text-cream-400 text-sm mb-5">
                Creates a catalog row. Deploy the on-chain offering next to open the sale.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-cream-400 mb-1.5">Title</label>
                  <input className={fieldClass} value={title} onChange={(e) => setTitle(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-cream-400 mb-1.5">Location</label>
                  <input className={fieldClass} value={location} onChange={(e) => setLocation(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-cream-400 mb-1.5">Description</label>
                  <textarea
                    className={`${fieldClass} min-h-[80px]`}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <ListingImageField
                  label="Listing image"
                  value={imageUrl}
                  onChange={setImageUrl}
                  placeholder="Upload a photo or leave blank for the catalog default"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-cream-400 mb-1.5">Property value (USD)</label>
                    <input className={fieldClass} type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-cream-400 mb-1.5">Share count</label>
                    <input className={fieldClass} type="number" min={1} value={totalTokens} onChange={(e) => setTotalTokens(e.target.value)} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-cream-400 mb-1.5">Occupancy %</label>
                    <input className={fieldClass} type="number" min={0} max={100} value={occupancyPercent} onChange={(e) => setOccupancyPercent(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-cream-400 mb-1.5">Cap rate %</label>
                    <input className={fieldClass} type="number" min={0} step="0.1" value={capRate} onChange={(e) => setCapRate(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-cream-400 mb-1.5">Expected return %</label>
                    <input className={fieldClass} type="number" min={0} step="0.1" value={returnRate} onChange={(e) => setReturnRate(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-cream-400 mb-1.5">Rent roll excerpt</label>
                  <textarea
                    className={`${fieldClass} min-h-[72px]`}
                    value={rentRollExcerpt}
                    onChange={(e) => setRentRollExcerpt(e.target.value)}
                    placeholder="Stabilized occupancy, lease terms…"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-cream-400 mb-1.5">Latitude</label>
                    <input className={fieldClass} value={lat} onChange={(e) => setLat(e.target.value)} placeholder="30.2672" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-cream-400 mb-1.5">Longitude</label>
                    <input className={fieldClass} value={lng} onChange={(e) => setLng(e.target.value)} placeholder="-97.7431" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-cream-400 mb-1.5">Rooms</label>
                    <input className={fieldClass} type="number" min={0} step="1" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} placeholder="3" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-cream-400 mb-1.5">WCs</label>
                    <input className={fieldClass} type="number" min={0} step="0.5" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} placeholder="2" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-cream-400 mb-1.5">Unit mix</label>
                  <input className={fieldClass} value={unitMix} onChange={(e) => setUnitMix(e.target.value)} placeholder="1× 2BR / 1BA, 900 sq ft" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-cream-400 mb-1.5">Map URL fallback</label>
                  <input className={fieldClass} value={mapUrl} onChange={(e) => setMapUrl(e.target.value)} placeholder="https://…" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-cream-400 mb-1.5">Document name</label>
                  <input className={fieldClass} value={docName} onChange={(e) => setDocName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-cream-400 mb-1.5">Vault file (optional)</label>
                  <input
                    className="block w-full text-sm text-cream-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-void-600 file:text-cream-100"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.txt"
                    onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                  />
                </div>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <Button type="submit" fullWidth disabled={saving}>
                  {saving ? 'Saving…' : 'Save catalog listing'}
                </Button>
              </form>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
