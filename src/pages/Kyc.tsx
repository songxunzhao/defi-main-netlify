import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ShieldCheckIcon } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../context/AuthContext';
import { submitKyc } from '../utils/api';

export default function Kyc() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [legalName, setLegalName] = useState(user?.name || '');
  const [country, setCountry] = useState(user?.kyc?.country || 'US');
  const [accredited, setAccredited] = useState(false);
  const [attested, setAttested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const status = user?.kycStatus || 'unverified';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await submitKyc({ legalName, country, accredited, attested });
      await refreshUser();
      navigate('/user');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit verification.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <p className="font-display text-accent text-sm uppercase tracking-widest mb-2">Compliance</p>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-cream-100 mb-3">
            Investor verification
          </h1>
          <p className="text-cream-400 mb-8 leading-relaxed">
            Tokenized real estate is treated as a security. You must complete identity
            checks and an accredited-investor attestation before buying. This form is a
            platform control, not a substitute for a licensed KYC vendor or legal counsel.
          </p>

          <div className="mb-8">
            <Badge
              color={
                status === 'approved' ? 'green' : status === 'pending' ? 'yellow' : status === 'rejected' ? 'red' : 'accent'
              }
            >
              {status}
            </Badge>
          </div>

          {status === 'approved' && (
            <div className="rounded-2xl border border-void-700 bg-void-800/60 p-8">
              <div className="flex items-center gap-3 mb-3">
                <ShieldCheckIcon className="text-accent" size={22} />
                <h2 className="font-display text-xl font-semibold text-cream-100">You are verified</h2>
              </div>
              <p className="text-cream-400 mb-6">
                This account can buy tokens once the linked wallet is connected.
              </p>
              <Button onClick={() => navigate('/browse')}>Browse properties</Button>
            </div>
          )}

          {status === 'pending' && (
            <div className="rounded-2xl border border-void-700 bg-void-800/60 p-8">
              <h2 className="font-display text-xl font-semibold text-cream-100 mb-2">In review</h2>
              <p className="text-cream-400">
                An admin will approve or reject this application. You cannot purchase until it is approved.
              </p>
            </div>
          )}

          {(status === 'unverified' || status === 'rejected') && (
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-void-700 bg-void-800/80 p-8 space-y-5"
            >
              {status === 'rejected' && user?.kyc?.reviewNote && (
                <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                  Previous decision: {user.kyc.reviewNote}
                </p>
              )}

              <div>
                <label className="block text-sm font-medium text-cream-400 mb-2">Legal name</label>
                <input
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  required
                  className="w-full bg-void-700 border border-void-600 text-cream-100 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-cream-400 mb-2">
                  Country of residence (ISO code)
                </label>
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value.toUpperCase())}
                  maxLength={2}
                  required
                  placeholder="US"
                  className="w-full bg-void-700 border border-void-600 text-cream-100 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={accredited}
                  onChange={(e) => setAccredited(e.target.checked)}
                  className="mt-1 rounded border-void-600 bg-void-700 text-accent focus:ring-accent/50"
                />
                <span className="text-cream-300 text-sm">
                  I am an accredited investor under applicable U.S. securities law (Reg D 506(c)-style attestation).
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={attested}
                  onChange={(e) => setAttested(e.target.checked)}
                  className="mt-1 rounded border-void-600 bg-void-700 text-accent focus:ring-accent/50"
                />
                <span className="text-cream-300 text-sm">
                  I understand this is not legal advice, that transfers may be restricted, and that false statements can void my participation.
                </span>
              </label>

              {error && (
                <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                  {error}
                </div>
              )}

              <Button type="submit" disabled={loading} size="lg">
                {loading ? 'Submitting…' : 'Submit for review'}
              </Button>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}
