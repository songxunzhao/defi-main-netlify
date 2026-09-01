import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, ShieldCheckIcon, LockIcon, AlertCircleIcon, LoaderIcon } from 'lucide-react';
import { Button } from '../ui/Button';
import { apiFetch } from '../../utils/api';

type AdminApprovalModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onApproved: () => void;
  email: string; // email entered on the login form, shown for context
};

/**
 * IP-restricted admin approval modal. Shown after any login attempt when the
 * server flag is enabled. The backend enforces that the requesting IP is in the
 * allowed list and that the supplied credentials belong to an 'admin' account.
 */
export function AdminApprovalModal({ isOpen, onClose, onApproved, email }: AdminApprovalModalProps) {
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ipBlocked, setIpBlocked] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail || !adminPassword) {
      setError('Enter the admin email and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await apiFetch<{ ok: boolean }>('/api/settings/admin/verify', {
        method: 'POST',
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      });
      onApproved();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verification failed';
      setIpBlocked(/ip/i.test(message));
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setError('');
    setIpBlocked(false);
    setAdminPassword('');
    onClose();
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
              className="w-full max-w-md rounded-2xl border border-void-700 bg-void-800 shadow-xl p-6"
            >
              <div className="flex justify-between items-center mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent-muted border border-accent/20 flex items-center justify-center">
                    <ShieldCheckIcon size={20} className="text-accent" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-semibold text-cream-100">
                      Admin approval required
                    </h3>
                    <p className="text-xs text-cream-400">This server is in restricted mode</p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  disabled={loading}
                  className="p-2 rounded-lg text-cream-400 hover:text-cream-100 hover:bg-void-700 transition-colors disabled:opacity-50"
                  aria-label="Close"
                >
                  <XIcon size={20} />
                </button>
              </div>

              {ipBlocked ? (
                <div className="text-center py-4">
                  <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
                    <LockIcon size={22} className="text-red-400" />
                  </div>
                  <h4 className="font-display text-base font-semibold text-cream-100 mb-2">
                    IP not authorized
                  </h4>
                  <p className="text-sm text-cream-400 leading-relaxed mb-6">
                    Your IP address is not in the allowed admin list. Contact the
                    server administrator to be granted access.
                  </p>
                  <Button variant="secondary" fullWidth onClick={handleClose}>
                    Back to login
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="p-3 rounded-xl bg-void-700/50 border border-void-600 text-sm text-cream-300">
                    Sign-in requested for <span className="text-cream-100 font-medium">{email || '—'}</span>.
                    Enter administrator credentials from an authorized IP to continue.
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-cream-400 mb-2">
                      Admin email
                    </label>
                    <div className="relative">
                      <ShieldCheckIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cream-400" />
                      <input
                        type="email"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="admin@defi.estate"
                        autoComplete="username"
                        className="w-full bg-void-700 border border-void-600 text-cream-100 placeholder:text-cream-400/50 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-accent/40"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-cream-400 mb-2">
                      Admin password
                    </label>
                    <div className="relative">
                      <LockIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cream-400" />
                      <input
                        type="password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className="w-full bg-void-700 border border-void-600 text-cream-100 placeholder:text-cream-400/50 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-accent/40"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                      <AlertCircleIcon size={16} className="mt-0.5 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <Button type="submit" fullWidth disabled={loading} size="lg">
                    {loading ? (
                      <>
                        <LoaderIcon size={18} className="animate-spin" />
                        Verifying…
                      </>
                    ) : (
                      'Approve sign-in'
                    )}
                  </Button>
                </form>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
