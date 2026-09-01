import React from 'react';
import { motion } from 'framer-motion';
import { Building2 } from 'lucide-react';

export function Logo() {
  return (
    <motion.div
      className="flex items-center gap-2.5"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-accent-muted border border-accent/20">
        <Building2 size={22} className="text-accent" strokeWidth={1.75} />
      </div>
      <span className="font-display text-xl font-bold tracking-tight text-cream-100">
        Realty<span className="text-accent">Chain</span>
      </span>
    </motion.div>
  );
}
