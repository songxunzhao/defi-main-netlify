import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPinIcon, CoinsIcon, TrendingUpIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Property } from '../../utils/types';
import { Badge } from './Badge';
import { mediaUrl } from '../../utils/api';
import { useOfferingAddress, useOfferingStats } from '../../hooks/useOffering';
import { propertyRoomCount, propertyWcCount } from '../../utils/propertyCounts';

type PropertyCardProps = {
  property: Property;
  featured?: boolean;
};

export function PropertyCard({
  property,
}: PropertyCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const offering = useOfferingAddress(property);
  const stats = useOfferingStats(offering);
  const sold = stats.sold !== undefined ? Number(stats.sold) : property.tokensSold;
  const cap = stats.cap !== undefined ? Number(stats.cap) : property.totalTokens;
  const progressPercentage = cap > 0 ? (sold / cap) * 100 : 0;
  const remaining = stats.remaining !== undefined ? Number(stats.remaining) : Math.max(0, cap - sold);
  const rooms = propertyRoomCount(property);
  const wcs = propertyWcCount(property);
  const soldOut =
    property.status === 'Sold Out' ||
    Boolean(property.redemptionAddress) ||
    (property.status === 'Available' && remaining <= 0);

  return (
    <motion.article
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={{ y: -8 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="group bg-void-800/80 border border-void-700 rounded-3xl overflow-hidden hover:border-void-600 hover:shadow-glow transition-all duration-300"
    >
      <Link to={`/property/${property.id}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden">
          <motion.img
            src={mediaUrl(property.imageUrl)}
            alt={property.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-void-950/90 via-void-950/20 to-transparent" />
          <div className="absolute top-4 left-4">
            <Badge
              color={
                soldOut
                  ? 'red'
                  : property.status === 'Available'
                    ? 'green'
                    : 'yellow'
              }
            >
              {soldOut ? 'Sold Out' : property.status}
            </Badge>
          </div>
          {soldOut && isHovered && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-void-950/85 backdrop-blur-sm flex items-center justify-center"
            >
              <span className="font-display font-semibold text-accent text-lg">Sold Out</span>
            </motion.div>
          )}
          <div className="absolute bottom-4 left-4 right-4">
            <h3 className="font-display font-bold text-2xl text-cream-100 line-clamp-2 drop-shadow-lg">
              {property.title}
            </h3>
            <div className="flex items-center gap-1.5 mt-1.5 text-cream-300/90 text-sm">
              <MapPinIcon size={14} className="flex-shrink-0" />
              <span className="truncate">{property.location}</span>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-4 text-sm text-cream-400 mb-4">
            <span className="flex items-center gap-1.5">
              <TrendingUpIcon size={14} />
              {property.returnRate}% APY
            </span>
            {rooms != null && <span>{rooms} {rooms === 1 ? 'room' : 'rooms'}</span>}
            {wcs != null && <span>{wcs} {wcs === 1 ? 'WC' : 'WCs'}</span>}
            {property.occupancyPercent != null && <span>{property.occupancyPercent}% occ.</span>}
            <span>{sold} / {cap} shares</span>
          </div>

          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-cream-400">Progress</span>
              <span className="text-cream-200 font-medium">{progressPercentage.toFixed(0)}%</span>
            </div>
            <div className="w-full h-1.5 bg-void-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-accent rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 0.8, delay: 0.2 }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-void-700">
            <div className="flex items-center gap-1.5">
              <CoinsIcon size={18} className="text-accent" />
              <span className="font-display font-semibold text-cream-100 text-xl">
                {property.price.toLocaleString()} USDC
              </span>
              <span className="text-cream-400 text-sm">/ share</span>
            </div>
            <span className="text-accent text-sm font-medium group-hover:underline">
              View →
            </span>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}
