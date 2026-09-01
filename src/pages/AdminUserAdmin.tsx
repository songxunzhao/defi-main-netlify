import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon, ShieldCheckIcon, PlusIcon, TrashIcon, GlobeIcon, LoaderIcon, AlertCircleIcon, CheckCircleIcon } from 'lucide-react';
import { Logo } from '../components/ui/Logo';
import { Button } from '../components/ui/Button';
import { apiFetch, ServerSettings } from '../utils/api';

export default function AdminUserAdmin() {
  const [settings, setSettings] = useState<ServerSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [newIp, setNewIp] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const s = await apiFetch<ServerSettings>('/api/settings');
      setSettings(s);
    } catch (err) {
      setError('Failed to load server settings. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleFlag = async () => {
    if (!settings || saving) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const s = await apiFetch<ServerSettings>('/api/settings/flag', {
        method: 'POST',
        body: JSON.stringify({ serverFlag: !settings.serverFlag }),
      });
      setSettings(s);
      setSaved(true);
    } catch (err) {
      setError('Failed to update the server flag.');
    } finally {
      setSaving(false);
    }
  };

  const updateIps = async (ips: string[]) => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const s = await apiFetch<ServerSettings>('/api/settings/allowed-ips', {
        method: 'POST',
        body: JSON.stringify({ allowedAdminIps: ips }),
      });
      setSettings(s);
      setSaved(true);
    } catch (err) {
      setError('Failed to update allowed IPs.');
    } finally {
      setSaving(false);
    }
  };

  const addIp = () => {
    if (!settings || !newIp.trim()) return;
    const next = [...settings.allowedAdminIps, newIp.trim()];
    setNewIp('');
    updateIps(next);
  };

  const allowCurrentIp = () => {
    if (!settings || !settings.currentIp) return;
    if (settings.ipAllowed) return;
    updateIps([...settings.allowedAdminIps, settings.currentIp]);
  };

  const removeIp = (ip: string) => {
    if (!settings) return;
    if ((settings.envAllowedIps || []).includes(ip)) return;
    updateIps(settings.allowedAdminIps.filter((entry) => entry !== ip));
  };

  const envIps = new Set(settings?.envAllowedIps || []);

  return (
    <div className="min-h-screen bg-void-950 text-cream-100 flex flex-col relative overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-accent/[0.04] rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="flex items-center justify-between mb-8">
            <Link to="/" className="inline-flex items-center gap-2 text-cream-400 hover:text-accent transition-colors text-sm font-medium">
              <ArrowLeftIcon size={16} />
              Back to login
            </Link>
            <Link to="/home" className="text-sm text-cream-400 hover:text-accent transition-colors">
              Go to /home
            </Link>
          </div>

          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-accent-muted border border-accent/20 flex items-center justify-center">
              <ShieldCheckIcon size={24} className="text-accent" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-cream-100">Server settings</h1>
              <p className="text-sm text-cream-400">Restricted-mode flag &amp; login IP allowlist</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-cream-400">
              <LoaderIcon size={20} className="animate-spin mr-2" /> Loading settings…
            </div>
          ) : (
            <div className="space-y-6">
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                  <AlertCircleIcon size={16} className="flex-shrink-0" />
                  {error}
                </div>
              )}
              {saved && (
                <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3">
                  <CheckCircleIcon size={16} className="flex-shrink-0" />
                  Settings saved.
                </div>
              )}

              {/* Server flag toggle */}
              {settings && (
                <div className="rounded-2xl border border-void-700 bg-void-800/80 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-display text-lg font-semibold text-cream-100 mb-1">
                        Restricted mode
                      </h2>
                      <p className="text-sm text-cream-400 leading-relaxed max-w-md">
                        When enabled, every sign-in requires an IP-restricted admin
                        approval before the user can continue to the app.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={toggleFlag}
                      disabled={saving}
                      aria-pressed={settings.serverFlag}
                      className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-200 flex-shrink-0 ${
                        settings.serverFlag ? 'bg-accent' : 'bg-void-600'
                      } disabled:opacity-50`}
                    >
                      <span
                        className={`inline-block h-6 w-6 transform rounded-full bg-cream-100 shadow transition-transform duration-200 ${
                          settings.serverFlag ? 'translate-x-7' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="mt-4 inline-flex items-center gap-2 text-sm rounded-full px-3 py-1.5 border ${
                    settings.serverFlag
                      ? 'text-accent border-accent/30 bg-accent-muted'
                      : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                  }">
                    <span className={`w-2 h-2 rounded-full ${settings.serverFlag ? 'bg-accent' : 'bg-emerald-400'}`} />
                    {settings.serverFlag ? 'Server flag is ON' : 'Server flag is OFF'}
                  </div>
                </div>
              )}

              {/* Current IP status */}
              {settings && (
                <div className="rounded-2xl border border-void-700 bg-void-800/80 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <GlobeIcon size={18} className="text-accent" />
                    <h2 className="font-display text-lg font-semibold text-cream-100">Your IP address</h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <code className="px-3 py-1.5 rounded-lg bg-void-700 border border-void-600 text-sm text-cream-100">
                      {settings.currentIp || 'unknown'}
                    </code>
                    <span className={`inline-flex items-center gap-2 text-sm font-medium ${
                      settings.ipAllowed ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${settings.ipAllowed ? 'bg-emerald-400' : 'bg-red-400'}`} />
                      {settings.ipAllowed ? 'Allowed to sign in' : 'Not allowed to sign in'}
                    </span>
                    {!settings.ipAllowed && settings.currentIp && (
                      <Button onClick={allowCurrentIp} disabled={saving} size="sm" icon={<PlusIcon size={14} />}>
                        Allow this IP
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-cream-400/70 mt-3">
                    On Netlify this is the visitor address from <code className="text-cream-300">X-Forwarded-For</code>.
                    You can also set <code className="text-cream-300">ALLOWED_LOGIN_IPS</code> in Site configuration → Environment variables.
                  </p>
                </div>
              )}

              {/* Allowed admin IPs */}
              {settings && (
                <div className="rounded-2xl border border-void-700 bg-void-800/80 p-6">
                  <h2 className="font-display text-lg font-semibold text-cream-100 mb-1">
                    Allowed login IPs
                  </h2>
                  <p className="text-sm text-cream-400 mb-5">
                    Only these addresses may sign in. Add them here, or set{' '}
                    <code className="text-cream-200">ALLOWED_LOGIN_IPS</code> in Netlify
                    (comma-separated). Env-var addresses cannot be removed from this page.
                  </p>

                  <div className="flex gap-2 mb-5">
                    <input
                      value={newIp}
                      onChange={(e) => setNewIp(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addIp()}
                      placeholder="e.g. 203.0.113.10"
                      className="flex-1 bg-void-700 border border-void-600 text-cream-100 placeholder:text-cream-400/50 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/40"
                    />
                    <Button onClick={addIp} disabled={saving || !newIp.trim()} icon={<PlusIcon size={16} />}>
                      Add
                    </Button>
                  </div>

                  {settings.allowedAdminIps.length === 0 ? (
                    <p className="text-sm text-cream-400/60">No allowed IPs configured.</p>
                  ) : (
                    <ul className="space-y-2">
                      {settings.allowedAdminIps.map((ip) => {
                        const fromEnv = envIps.has(ip);
                        return (
                        <li key={ip} className="flex items-center justify-between gap-3 rounded-xl bg-void-700/50 border border-void-600 px-4 py-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <code className="text-sm text-cream-100">{ip}</code>
                            {fromEnv && (
                              <span className="text-[10px] uppercase tracking-wide text-accent border border-accent/30 rounded-full px-2 py-0.5">
                                env
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeIp(ip)}
                            disabled={saving || fromEnv}
                            className="p-2 rounded-lg text-cream-400 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                            aria-label={fromEnv ? `${ip} comes from ALLOWED_LOGIN_IPS` : `Remove ${ip}`}
                          >
                            <TrashIcon size={16} />
                          </button>
                        </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
