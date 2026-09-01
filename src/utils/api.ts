export type ServerSettings = {
  serverFlag: boolean;
  allowedAdminIps: string[];
  currentIp: string;
  ipAllowed: boolean;
};

export type KycStatus = 'unverified' | 'pending' | 'approved' | 'rejected';

export type AuthUser = {
  id: number;
  email: string;
  name: string | null;
  role: string;
  kycStatus: KycStatus;
  accredited: boolean;
  walletAddress: string | null;
  kyc: {
    legalName: string | null;
    country: string | null;
    submittedAt: string | null;
    reviewedAt: string | null;
    reviewNote: string | null;
  } | null;
};

export type Eligibility = {
  canInvest: boolean;
  reasons: string[];
  kycStatus: KycStatus;
  accredited: boolean;
  walletAddress: string | null;
};

export type KycResponse = {
  user: AuthUser;
  eligibility: Eligibility;
};

export type LoginResponse = {
  token: string;
  user: AuthUser;
};

export const TOKEN_KEY = 'defi_estate_token';

const API_BASE = import.meta.env.VITE_API_URL || '';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore storage failures (e.g. private mode)
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string })?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export function loginRequest(email: string, password: string) {
  return apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function fetchMe() {
  return apiFetch<{ user: AuthUser }>('/api/auth/me');
}

export function fetchKyc() {
  return apiFetch<KycResponse>('/api/kyc');
}

export function submitKyc(payload: {
  legalName: string;
  country: string;
  accredited: boolean;
  attested: boolean;
}) {
  return apiFetch<KycResponse>('/api/kyc', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function bindWallet(address: string) {
  return apiFetch<KycResponse>('/api/kyc/wallet', {
    method: 'POST',
    body: JSON.stringify({ address }),
  });
}

export function fetchInvestors() {
  return apiFetch<{ investors: AuthUser[] }>('/api/kyc/admin/investors');
}

export function reviewKyc(userId: number, decision: 'approved' | 'rejected', note?: string) {
  return apiFetch<KycResponse>(`/api/kyc/admin/${userId}/review`, {
    method: 'POST',
    body: JSON.stringify({ decision, note }),
  });
}

export function createProperty(payload: Partial<import('./types').Property>) {
  return apiFetch<{ property: import('./types').Property }>('/api/properties', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateProperty(id: string, payload: Partial<import('./types').Property>) {
  return apiFetch<{ property: import('./types').Property }>(`/api/properties/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteProperty(id: string) {
  return apiFetch<{ property: import('./types').Property }>(`/api/properties/${id}`, {
    method: 'DELETE',
  });
}

export function fetchReadiness() {
  return apiFetch<{
    demo: boolean;
    production: boolean;
    chainId: number;
    rpcUrl: string;
    ready: boolean;
    liveOfferingAllowed: boolean;
    checks: { id: string; label: string; status: string; detail: string }[];
    rpc: { reachable: boolean; block: number | null; factoryCode: boolean; error: string | null };
  }>('/api/ops/readiness');
}

export type ActivityEvent = {
  id: string;
  type: string;
  propertyId: string;
  wallet: string;
  counterparty: string | null;
  shares: string;
  usdc: string;
  txHash: string;
  logIndex: number;
  blockNumber: number;
  timestamp: number;
};

export type ActivityHolding = {
  propertyId: string;
  propertyTitle: string;
  shares: number;
  costUsdc: number;
  rentClaimedUsdc: number;
  redeemProceedsUsdc: number;
  secondaryProceedsUsdc: number;
};

export type ActivityResponse = {
  wallet: string;
  lastSyncAt: string | null;
  events: ActivityEvent[];
  holdings: ActivityHolding[];
  totals: {
    shares: number;
    costUsdc: number;
    rentClaimedUsdc: number;
    redeemProceedsUsdc: number;
    secondaryProceedsUsdc: number;
  };
};

export type TaxPack = {
  disclaimer: string;
  year: number;
  wallet: string;
  holdings: ActivityHolding[];
  yearActivity: ActivityHolding[];
  events: ActivityEvent[];
  totals: ActivityResponse['totals'];
  yearTotals: ActivityResponse['totals'];
};

export function fetchActivity() {
  return apiFetch<ActivityResponse>('/api/activity');
}

export function syncActivity() {
  return apiFetch<{ synced: boolean; added?: number; reason?: string; lastSyncAt?: string }>('/api/activity/sync', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function fetchTaxPack(year: number) {
  return apiFetch<TaxPack>(`/api/activity/tax?year=${year}`);
}

export function uploadPropertyDocument(propertyId: string, payload: { name: string; filename: string; data: string }) {
  return apiFetch<{ property: import('./types').Property }>(`/api/properties/${propertyId}/documents`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deletePropertyDocument(propertyId: string, index: number) {
  return apiFetch<{ property: import('./types').Property }>(`/api/properties/${propertyId}/documents/${index}`, {
    method: 'DELETE',
  });
}

export async function downloadVaultFile(url: string, filename: string) {
  if (!url.startsWith('/api/vault/')) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  const token = getToken();
  const res = await fetch(`${API_BASE}${url}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Could not download document.');
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename || 'document.pdf';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

export async function downloadTaxCsv(year: number) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/activity/tax.csv?year=${year}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Could not export tax worksheet.');
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = `realtychain-tax-${year}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

export function mediaUrl(url: string | undefined | null) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
  return `${API_BASE}${url}`;
}

export function uploadListingImage(payload: { filename: string; data: string }) {
  return apiFetch<{ url: string; contentType: string; bytes: number; filename: string }>('/api/images', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function ingestListingImage(sourceUrl: string) {
  return apiFetch<{ url: string; contentType: string; bytes: number; filename: string }>('/api/images', {
    method: 'POST',
    body: JSON.stringify({ sourceUrl }),
  });
}

export function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

export function canInvest(user: AuthUser | null, connectedAddress?: string | null) {
  if (!user) return false;
  if (user.kycStatus !== 'approved' || !user.accredited || !user.walletAddress) return false;
  if (connectedAddress && user.walletAddress.toLowerCase() !== connectedAddress.toLowerCase()) {
    return false;
  }
  return true;
}
