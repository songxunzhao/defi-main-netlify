import React from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ConnectWalletButton } from '../components/ui/ConnectWalletButton';
import { ArrowRightIcon, BuildingIcon, CoinsIcon, ShieldIcon } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { PropertyCard } from '../components/ui/PropertyCard';
import { useProperties } from '../hooks/useProperties';
import { mediaUrl } from '../utils/api';

export default function Home() {
  const { data: properties = [], isLoading, isError } = useProperties();
  const featuredProperties = properties.slice(0, 3);
  const navigate = useNavigate();

  return (
    <div className="w-full">
      {/* Hero */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src={mediaUrl('/api/images/seed/hero.jpg')}
            alt=""
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-void-950/60 via-void-950/80 to-void-950" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32 relative z-10 w-full">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-4xl"
          >
            <p className="font-display text-accent font-semibold text-sm uppercase tracking-widest mb-6">
              Tokenized Real Estate
            </p>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-cream-100 leading-[1.1] tracking-tight mb-6">
              Own fractions of
              <br />
              <span className="text-accent">premium properties</span>
              <br />
              on-chain.
            </h1>
            <p className="text-lg sm:text-xl text-cream-300 max-w-xl mb-10 leading-relaxed">
            Invest in a demo of tokenized real estate. This is not a live
            offering—KYC is mock review, and contracts are unaudited.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" onClick={() => navigate('/browse')} icon={<ArrowRightIcon size={20} />}>
                Explore Properties
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate('/about')}>
                How It Works
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Featured */}
      <section className="relative py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-14">
            <div>
              <p className="font-display text-accent text-sm uppercase tracking-widest mb-2">
                Curated
              </p>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-cream-100">
                Featured Properties
              </h2>
            </div>
            <Link
              to="/browse"
              className="group inline-flex items-center gap-2 text-accent hover:text-accent-light font-medium text-sm transition-colors"
            >
              View all
              <ArrowRightIcon size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {isLoading && (
            <p className="text-cream-400 text-sm mb-8">Loading properties…</p>
          )}
          {isError && (
            <p className="text-red-400 text-sm mb-8">Could not load properties. Is the server running?</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {featuredProperties.map((property, index) => (
              <motion.div
                key={property.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <PropertyCard property={property} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative py-24 md:py-32 border-y border-void-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="font-display text-accent text-sm uppercase tracking-widest mb-2">
              Process
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-cream-100 mb-4">
              How It Works
            </h2>
            <p className="text-cream-400 text-lg max-w-2xl mx-auto">
              DeFi Estates makes real estate investment accessible and liquid through
              blockchain technology.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              {
                icon: BuildingIcon,
                title: 'Property Tokenization',
                description:
                  'Premium properties are verified and tokenized into smart contracts for fractional ownership.',
              },
              {
                icon: CoinsIcon,
                title: 'Invest & Earn',
                description:
                  'Buy shares with USDC and earn returns from rental income and appreciation.',
              },
              {
                icon: ShieldIcon,
                title: 'Security & Transparency',
                description:
                  'All transactions and ownership are on-chain—fully transparent and secure.',
              },
            ].map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="relative p-8 rounded-2xl bg-void-800/60 border border-void-700 hover:border-void-600 transition-colors group"
              >
                <div className="w-14 h-14 rounded-xl bg-accent-muted border border-accent/20 flex items-center justify-center mb-6 group-hover:shadow-glow-sm transition-shadow">
                  <item.icon size={28} className="text-accent" strokeWidth={1.5} />
                </div>
                <h3 className="font-display text-xl font-semibold text-cream-100 mb-3">
                  {item.title}
                </h3>
                <p className="text-cream-400 leading-relaxed">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative rounded-3xl overflow-hidden border border-void-700 bg-void-800/80 p-12 md:p-16 lg:p-20"
          >
            <div className="absolute inset-0 bg-accent/[0.04]" />
            <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-8">
              <div>
                <h2 className="font-display text-3xl md:text-4xl font-bold text-cream-100 mb-4">
                  Ready to start investing?
                </h2>
                <p className="text-cream-400 text-lg max-w-xl">
                  Join investors building real estate portfolios with DeFi Estates.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 flex-shrink-0">
                <div className="[&_button]:!bg-accent [&_button]:!text-void-950 [&_button]:!rounded-lg [&_button]:min-h-[48px] [&_button]:px-8">
                  <ConnectWalletButton />
                </div>
                <Button size="lg" variant="outline" onClick={() => navigate('/about')}>
                  Learn more
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
