import React from 'react';
import { motion } from 'framer-motion';
import { ConnectWalletButton } from '../components/ui/ConnectWalletButton';
import { Logo } from '../components/ui/Logo';

/**
 * Shown as the only screen until a wallet is connected.
 */
export default function ConnectLanding() {
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
          className="flex flex-col items-center text-center max-w-md w-full"
        >
          <div className="mb-10">
            <Logo />
          </div>
          <p className="font-display text-accent font-semibold text-sm uppercase tracking-widest mb-4">
            RealtyChain
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-cream-100 mb-4 leading-tight">
            Connect your wallet to continue
          </h1>
          <p className="text-cream-400 text-base mb-10 leading-relaxed">
            Link a wallet to explore properties, invest, and open your dashboard.
          </p>
          <div className="w-full flex justify-center [&_button]:!bg-accent [&_button]:!text-void-950 [&_button]:!rounded-xl [&_button]:!min-h-[52px] [&_button]:!px-8 [&_button]:!text-base [&_button]:!font-semibold">
            <ConnectWalletButton />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
