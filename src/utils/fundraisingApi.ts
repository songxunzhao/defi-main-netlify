import { apiFetch } from './api';

export type ProspectStage = 'interested' | 'signed' | 'withdrawn';
export type ProspectFields = {
  name: string;
  email: string;
  stage: ProspectStage;
  amountCents: number;
  documentReference: string;
  followUpDate: string;
  notes: string;
};
export type FundraisingProspect = ProspectFields & {
  id: string;
  propertyId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  history: (ProspectFields & { at: string; actorId: string })[];
};
export type FundraisingDesk = {
  properties: { id: string; title: string; campaign: { target: number; received: number; deadline: string; status: string } | null }[];
  prospects: FundraisingProspect[];
};
export type ProspectInput = Omit<ProspectFields, 'amountCents'> & { amount: string; propertyId: string; version?: number };
export const fetchFundraising = () => apiFetch<FundraisingDesk>('/api/fundraising');
export const saveFundraisingProspect = (input: ProspectInput, id?: string) => apiFetch<FundraisingDesk>(
  id ? `/api/fundraising/prospects/${encodeURIComponent(id)}` : '/api/fundraising/prospects',
  { method: id ? 'PATCH' : 'POST', body: JSON.stringify(input) },
);
