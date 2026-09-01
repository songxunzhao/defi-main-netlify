import { Property } from './types';

export type Appraisal = {
  date: string;
  valueUsd: number;
  note?: string;
};

export type Waterfall = {
  occupancyPercent: number | null;
  grossPotential: number;
  collected: number;
  opex: number;
  reserves: number;
  distributable: number;
  usedCapRateNoi: boolean;
};

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

export function latestAppraisal(property: Property): Appraisal | null {
  const rows = [...(property.appraisals || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return rows[0] || null;
}

export function navValueUsd(property: Property): number {
  return latestAppraisal(property)?.valueUsd || property.price || 0;
}

export function navPerShare(property: Property): number {
  if (!property.totalTokens) return 0;
  return roundMoney(navValueUsd(property) / property.totalTokens);
}

export function waterfall(property: Property): Waterfall {
  const occupancy = property.occupancyPercent == null ? null : Number(property.occupancyPercent);
  const occFactor = occupancy == null ? 1 : Math.min(1, Math.max(0, occupancy / 100));
  const capNoi =
    property.capRate && property.price ? roundMoney((property.capRate / 100) * property.price / 12) : 0;
  const usedCapRateNoi = property.grossRentMonthly == null || property.grossRentMonthly <= 0;
  const grossPotential = usedCapRateNoi ? capNoi : Number(property.grossRentMonthly) || 0;
  const collected = roundMoney(grossPotential * occFactor);
  const opex = Number(property.opexMonthly) || 0;
  const reserves = Number(property.reservesMonthly) || 0;
  const distributable = roundMoney(Math.max(0, collected - opex - reserves));
  return {
    occupancyPercent: occupancy,
    grossPotential: roundMoney(grossPotential),
    collected,
    opex,
    reserves,
    distributable,
    usedCapRateNoi,
  };
}

export function appraisalDue(property: Property, now = new Date()): boolean {
  if (!property.nextAppraisalAt) return false;
  const due = new Date(property.nextAppraisalAt);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() <= now.getTime();
}

export function formatUsd(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
