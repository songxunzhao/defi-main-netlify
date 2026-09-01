import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon } from 'lucide-react';
import { Button } from '../ui/Button';
import { Property } from '../../utils/types';
import { updateProperty } from '../../utils/api';
import { formatUsd, latestAppraisal, navPerShare, waterfall } from '../../utils/ops';

const fieldClass =
  'w-full bg-void-700 border border-void-600 text-cream-100 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-accent/40';

type OpsPropertyModalProps = {
  isOpen: boolean;
  property: Property | null;
  onClose: () => void;
  onSaved: () => void;
};

export function OpsPropertyModal({ isOpen, property, onClose, onSaved }: OpsPropertyModalProps) {
  const [occupancyPercent, setOccupancyPercent] = useState('90');
  const [capRate, setCapRate] = useState('6');
  const [grossRentMonthly, setGrossRentMonthly] = useState('');
  const [opexMonthly, setOpexMonthly] = useState('');
  const [reservesMonthly, setReservesMonthly] = useState('');
  const [nextAppraisalAt, setNextAppraisalAt] = useState('');
  const [appDate, setAppDate] = useState('');
  const [appValue, setAppValue] = useState('');
  const [appNote, setAppNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !property) return;
    setOccupancyPercent(property.occupancyPercent == null ? '' : String(property.occupancyPercent));
    setCapRate(property.capRate == null ? '' : String(property.capRate));
    setGrossRentMonthly(property.grossRentMonthly == null ? '' : String(property.grossRentMonthly));
    setOpexMonthly(property.opexMonthly == null ? '' : String(property.opexMonthly));
    setReservesMonthly(property.reservesMonthly == null ? '' : String(property.reservesMonthly));
    setNextAppraisalAt(property.nextAppraisalAt ? String(property.nextAppraisalAt).slice(0, 10) : '');
    setAppDate('');
    setAppValue('');
    setAppNote('');
    setError('');
  }, [isOpen, property]);

  const preview = property
    ? waterfall({
        ...property,
        occupancyPercent: occupancyPercent === '' ? null : Number(occupancyPercent),
        capRate: capRate === '' ? null : Number(capRate),
        grossRentMonthly: grossRentMonthly === '' ? null : Number(grossRentMonthly),
        opexMonthly: opexMonthly === '' ? null : Number(opexMonthly),
        reservesMonthly: reservesMonthly === '' ? null : Number(reservesMonthly),
      })
    : null;

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  const handleSave = async () => {
    if (!property) return;
    setError('');
    setSaving(true);
    try {
      const appraisals = [...(property.appraisals || [])];
      if (appDate && appValue) {
        appraisals.push({
          date: appDate,
          valueUsd: Number(appValue),
          note: appNote,
        });
      }
      await updateProperty(property.id, {
        occupancyPercent: occupancyPercent === '' ? undefined : Number(occupancyPercent),
        capRate: capRate === '' ? undefined : Number(capRate),
        grossRentMonthly: grossRentMonthly === '' ? undefined : Number(grossRentMonthly),
        opexMonthly: opexMonthly === '' ? undefined : Number(opexMonthly),
        reservesMonthly: reservesMonthly === '' ? undefined : Number(reservesMonthly),
        nextAppraisalAt,
        appraisals,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save ops fields.');
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
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-void-700 bg-void-800 shadow-xl p-6"
            >
              <div className="flex justify-between items-center mb-5">
                <h3 className="font-display text-xl font-semibold text-cream-100">Ops · {property.title}</h3>
                <button
                  onClick={handleClose}
                  disabled={saving}
                  className="p-2 rounded-lg text-cream-400 hover:text-cream-100 hover:bg-void-700 disabled:opacity-50"
                >
                  <XIcon size={20} />
                </button>
              </div>
              <p className="text-cream-400 text-sm mb-5">
                Admin-entered occupancy, rent, and appraisals. This is not a live property-manager feed.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-cream-400 mb-1.5">Occupancy %</label>
                  <input
                    className={fieldClass}
                    type="number"
                    min={0}
                    max={100}
                    value={occupancyPercent}
                    onChange={(e) => setOccupancyPercent(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-cream-400 mb-1.5">Cap rate %</label>
                  <input
                    className={fieldClass}
                    type="number"
                    min={0}
                    step="0.1"
                    value={capRate}
                    onChange={(e) => setCapRate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-cream-400 mb-1.5">Gross rent / mo</label>
                  <input
                    className={fieldClass}
                    type="number"
                    min={0}
                    value={grossRentMonthly}
                    onChange={(e) => setGrossRentMonthly(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-cream-400 mb-1.5">OpEx / mo</label>
                  <input
                    className={fieldClass}
                    type="number"
                    min={0}
                    value={opexMonthly}
                    onChange={(e) => setOpexMonthly(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-cream-400 mb-1.5">Reserves / mo</label>
                  <input
                    className={fieldClass}
                    type="number"
                    min={0}
                    value={reservesMonthly}
                    onChange={(e) => setReservesMonthly(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-cream-400 mb-1.5">Next appraisal</label>
                  <input
                    className={fieldClass}
                    type="date"
                    value={nextAppraisalAt}
                    onChange={(e) => setNextAppraisalAt(e.target.value)}
                  />
                </div>
              </div>
              {preview && (
                <div className="mt-4 p-3 rounded-xl border border-void-700 bg-void-700/40 text-sm text-cream-300 space-y-1">
                  <div>NAV / share: {formatUsd(navPerShare(property))} USDC</div>
                  <div>Collected: {formatUsd(preview.collected)} → distributable {formatUsd(preview.distributable)}</div>
                  {preview.usedCapRateNoi && !grossRentMonthly && (
                    <div className="text-cream-400 text-xs">Using cap-rate NOI as rent until gross rent is set.</div>
                  )}
                </div>
              )}
              <div className="mt-5">
                <h4 className="text-cream-100 font-medium mb-2">Log appraisal</h4>
                <div className="grid grid-cols-2 gap-3">
                  <input className={fieldClass} type="date" value={appDate} onChange={(e) => setAppDate(e.target.value)} />
                  <input
                    className={fieldClass}
                    type="number"
                    min={1}
                    placeholder="Value USD"
                    value={appValue}
                    onChange={(e) => setAppValue(e.target.value)}
                  />
                </div>
                <input
                  className={`${fieldClass} mt-3`}
                  placeholder="Note (optional)"
                  value={appNote}
                  onChange={(e) => setAppNote(e.target.value)}
                />
                {latestAppraisal(property) && (
                  <p className="text-cream-400 text-xs mt-2">
                    Latest on file: {latestAppraisal(property)!.date} · {formatUsd(latestAppraisal(property)!.valueUsd)} USD
                  </p>
                )}
              </div>
              {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
              <Button className="mt-5" fullWidth disabled={saving} onClick={handleSave}>
                {saving ? 'Saving…' : 'Save ops'}
              </Button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
