export type Property = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  location: string;
  price: number;
  tokenPrice: number;
  totalTokens: number;
  tokensSold: number;
  status: 'Available' | 'Sold Out' | 'Coming Soon';
  features: string[];
  documents: {
    name: string;
    url: string;
  }[];
  contractAddress?: string;
  offeringAddress?: string;
  tokenAddress?: string;
  sharePriceUsdc?: number;
  returnRate?: number;
  occupancyPercent?: number | null;
  capRate?: number | null;
  rentRollExcerpt?: string;
  galleryUrls?: string[];
  mapUrl?: string;
  lat?: number | null;
  lng?: number | null;
  unitMix?: string;
  comps?: {
    address: string;
    soldDate: string;
    priceUsd: number;
    sqft?: number | null;
    note?: string;
  }[];
  distributorAddress?: string;
  redemptionAddress?: string;
  grossRentMonthly?: number | null;
  opexMonthly?: number | null;
  reservesMonthly?: number | null;
  nextAppraisalAt?: string;
  appraisals?: {
    date: string;
    valueUsd: number;
    note?: string;
  }[];
};

export type ActivityLot = {
  propertyId: string;
  shares: number;
  costUsdc: number;
  rentClaimedUsdc: number;
};

export type UserPortfolio = {
  totalInvested: number;
  totalProperties: number;
  properties: {
    propertyId: string;
    propertyName: string;
    tokensOwned: number;
    investmentValue: number;
    costBasisUsdc?: number;
  }[];
};
