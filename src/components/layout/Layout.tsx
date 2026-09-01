import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { motion } from 'framer-motion';
import { useWalletLink } from '../../hooks/useWalletLink';

export function Layout() {
  useWalletLink();
  return (
    <div className="min-h-screen bg-void-950 text-cream-100 flex flex-col relative overflow-x-hidden">
      {/* Subtle gradient orbs in background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-accent/[0.03] rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-0 w-[500px] h-[500px] bg-accent/[0.02] rounded-full blur-[100px]" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'.03\'/%3E%3C/svg%3E')] opacity-30" />
      </div>

      <Navbar />
      {import.meta.env.VITE_DEMO_MODE !== 'false' && (
        <div className="relative z-20 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-100">
          Demo only — not a securities offering, not audited, KYC is mock review. Do not send real funds.
        </div>
      )}
      <motion.main
        className="flex-grow relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35 }}
      >
        <Outlet />
      </motion.main>
      <Footer />
    </div>
  );
}
