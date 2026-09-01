import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon } from 'lucide-react';
import { Button } from '../ui/Button';
import { Property } from '../../utils/types';
import { deletePropertyDocument, downloadVaultFile, fileToBase64, uploadPropertyDocument } from '../../utils/api';

const fieldClass =
  'w-full bg-void-700 border border-void-600 text-cream-100 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-accent/40';

type DocumentVaultModalProps = {
  isOpen: boolean;
  property: Property | null;
  onClose: () => void;
  onUpdated: (property: Property) => void;
};

export function DocumentVaultModal({ isOpen, property, onClose, onUpdated }: DocumentVaultModalProps) {
  const [name, setName] = useState('Deed');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName('Deed');
      setFile(null);
      setError('');
    }
  }, [isOpen, property?.id]);

  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  const handleUpload = async () => {
    if (!property || !file) {
      setError('Choose a file to upload.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const data = await fileToBase64(file);
      const { property: next } = await uploadPropertyDocument(property.id, {
        name: name || file.name,
        filename: file.name,
        data,
      });
      setFile(null);
      onUpdated(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (index: number) => {
    if (!property) return;
    setError('');
    setBusy(true);
    try {
      const { property: next } = await deletePropertyDocument(property.id, index);
      onUpdated(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove document.');
    } finally {
      setBusy(false);
    }
  };

  const docs = property?.documents || [];

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
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-void-700 bg-void-800 shadow-xl p-6"
            >
              <div className="flex justify-between items-center mb-5">
                <h3 className="font-display text-xl font-semibold text-cream-100">Document vault</h3>
                <button
                  onClick={handleClose}
                  disabled={busy}
                  className="p-2 rounded-lg text-cream-400 hover:text-cream-100 hover:bg-void-700 disabled:opacity-50"
                >
                  <XIcon size={20} />
                </button>
              </div>
              <p className="text-cream-400 text-sm mb-5">
                Files for {property.title}. Seed PDFs are demo placeholders, not recorded instruments.
              </p>
              <div className="space-y-2 mb-6">
                {docs.length === 0 ? (
                  <p className="text-cream-400 text-sm">No documents yet.</p>
                ) : (
                  docs.map((doc, index) => (
                    <div
                      key={`${doc.url}-${index}`}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl bg-void-700/50 border border-void-600"
                    >
                      <span className="text-cream-100 text-sm truncate">{doc.name}</span>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadVaultFile(doc.url, doc.name)}
                        >
                          Download
                        </Button>
                        <Button variant="danger" size="sm" disabled={busy} onClick={() => handleRemove(index)}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-cream-400 mb-1.5">Document name</label>
                  <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-cream-400 mb-1.5">File</label>
                  <input
                    className="block w-full text-sm text-cream-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-void-600 file:text-cream-100"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.txt"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </div>
              </div>
              {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
              <Button className="mt-5" fullWidth disabled={busy} onClick={handleUpload}>
                {busy ? 'Saving…' : 'Upload to vault'}
              </Button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
