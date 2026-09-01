import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { MailIcon, LockIcon, ShieldAlertIcon, ArrowRightIcon, LoaderIcon } from 'lucide-react';
import { Logo } from '../components/ui/Logo';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { loginRequest } from '../utils/api';

export default function Login() {
  const navigate = useNavigate();
  const { applySession } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ipBlocked, setIpBlocked] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      const session = await loginRequest(email, password);
      applySession(session.token, session.user);
      navigate('/home');
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (/ip address is not allowed/i.test(message)) {
        setIpBlocked(true);
      } else if (message === 'Invalid credentials') {
        setError('Invalid email or password.');
      } else if (message) {
        setError(message);
      } else {
        setError('Could not reach the server. Please make sure the backend is running and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-void-950 text-cream-100 flex flex-col relative overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-accent/[0.05] rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-0 w-[500px] h-[500px] bg-accent/[0.03] rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 flex flex-col flex-1 items-center justify-center px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-lg"
        >
          <div className="flex flex-col items-center text-center mb-10">
            <div className="mb-8">
              <Logo />
            </div>
            <p className="font-display text-accent font-semibold text-sm uppercase tracking-widest mb-3">
              RealtyChain
            </p>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-cream-100 mb-3 leading-tight">
              Welcome back
            </h1>
            <p className="text-cream-400 text-base leading-relaxed">
              Sign in with your email and password to continue.
            </p>
          </div>

          {ipBlocked ? (
            <div className="text-center p-12 rounded-3xl border border-red-500/30 bg-void-800/80">
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-5">
                <ShieldAlertIcon size={28} className="text-red-400" />
              </div>
              <h2 className="font-display text-xl font-semibold text-cream-100 mb-3">
                Access restricted
              </h2>
              <p className="text-cream-400 leading-relaxed mb-8">
                Your IP is not allowed to access this site. To allow your IP,
                please contact our team and follow the DNS configuration
                instructions.
              </p>
              <Button variant="secondary" fullWidth onClick={() => setIpBlocked(false)}>
                Try again
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="rounded-3xl border border-void-700 bg-void-800/80 p-10 shadow-xl">
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-cream-400 mb-2">
                    Email address
                  </label>
                  <div className="relative">
                    <MailIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cream-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                      className="w-full bg-void-700 border border-void-600 text-cream-100 placeholder:text-cream-400/50 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-accent/40"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-cream-400 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <LockIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cream-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                      className="w-full bg-void-700 border border-void-600 text-cream-100 placeholder:text-cream-400/50 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-accent/40"
                    />
                  </div>
                </div>

                {error && (
                  <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                    {error}
                  </div>
                )}

                <Button type="submit" fullWidth disabled={loading} size="lg" icon={loading ? <LoaderIcon size={18} className="animate-spin" /> : <ArrowRightIcon size={18} />}>
                  {loading ? 'Checking…' : 'Sign in'}
                </Button>
              </div>
            </form>
          )}

          <p className="text-center text-cream-400/60 text-xs mt-6">
            Use a registered account. Invalid credentials are rejected by the server.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
