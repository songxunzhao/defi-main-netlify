import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { PlusIcon } from 'lucide-react';
import { Button } from '../ui/Button';
import { useAuth } from '../../context/AuthContext';
import { useProperties } from '../../hooks/useProperties';
import { mediaUrl, uploadAvatar } from '../../utils/api';
import { Property } from '../../utils/types';
import { PropertyThumb } from '../ui/PropertyThumb';
import { formatUsd } from '../../utils/ops';
import { AddProperty } from './AddProperty';
import { OwnerFinance } from './OwnerFinance';
import { OwnerFunding } from './OwnerFunding';
import { OwnerTokenize } from './OwnerTokenize';
import { FundraisingDashboard } from './FundraisingDashboard';

const TABS = ['dashboard', 'add', 'funding', 'fundraising', 'tokenize', 'financing', 'settings'] as const;

function valuationOf(property: Property) {
  return property.offering?.valuation || property.price || 0;
}

function rentOf(property: Property) {
  return property.offering?.monthlyRent || property.grossRentMonthly || 0;
}

function raisedOf(property: Property) {
  const campaign = property.offering?.campaign?.raised || 0;
  const sold = (property.tokensSold || 0) * (property.sharePriceUsdc || property.tokenPrice || 0);
  return campaign + sold;
}

function statusLine(property: Property) {
  const campaign = property.offering?.campaign;
  if (campaign && campaign.target > 0 && (campaign.status === 'open' || campaign.status === 'funded')) {
    const pct = Math.min(100, Math.round((campaign.raised / campaign.target) * 100));
    return pct >= 100 || campaign.status === 'funded' ? 'Funding: Complete' : `Funding: ${pct}%`;
  }
  const token = property.offering?.tokenization;
  if (token?.status === 'live') return `Tokenized: ${token.offeredPercent}%`;
  if (property.totalTokens > 0 && property.tokensSold > 0) {
    return `Tokenized: ${Math.round((property.tokensSold / property.totalTokens) * 100)}%`;
  }
  return 'Not offered';
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function OwnerDesk() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab') || 'dashboard';
  const tab = (TABS as readonly string[]).includes(requested) ? requested : 'dashboard';
  const { data: properties = [] } = useProperties();
  const owned = properties.filter((property) => user?.id != null && Number(property.ownerId) === Number(user.id));
  const [notice, setNotice] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);

  const portfolio = owned.reduce((total, property) => total + valuationOf(property), 0);
  const raised = owned.reduce((total, property) => total + raisedOf(property), 0);
  const income = owned.reduce((total, property) => total + rentOf(property), 0);
  const loans = owned.reduce((total, property) => total + (property.offering?.financing?.outstanding || 0), 0);

  const open = (next: string) => setParams(next === 'dashboard' ? {} : { tab: next });

  const saved = (property: Property, message: string) => {
    queryClient.setQueryData<Property[]>(['properties'], (rows) => {
      const list = rows || [];
      const index = list.findIndex((row) => row.id === property.id);
      if (index === -1) return [...list, property];
      const copy = list.slice();
      copy[index] = property;
      return copy;
    });
    setNotice(message);
    open('dashboard');
  };

  return (
    <div className="min-h-screen w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {notice && <p className="text-emerald-300 text-sm mb-4">{notice}</p>}
        {user?.kycStatus !== 'approved' && tab === 'dashboard' && (
          <button type="button" onClick={() => navigate('/kyc')} className="text-sm text-accent mb-4 hover:underline">
            Identity verification is still open
          </button>
        )}

        {tab === 'dashboard' && (
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-accent">{greeting()}</p>
            <h1 className="font-display text-3xl font-bold text-cream-100 mt-1 mb-6">{user?.name || 'Owner'}</h1>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              {[
                ['Portfolio value', `$${formatUsd(portfolio)}`],
                ['Capital raised', `$${formatUsd(raised)}`],
                ['Monthly rental income', `$${formatUsd(income)}`],
                ['Outstanding loans', `$${formatUsd(loans)}`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-void-700 bg-void-800/40 p-4">
                  <div className="text-cream-400 text-xs">{label}</div>
                  <div className="font-display text-2xl font-semibold text-cream-100 mt-1">{value}</div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => open('add')}
              className="w-full rounded-2xl border border-dashed border-accent/50 bg-accent/10 py-8 mb-8 hover:bg-accent/15"
            >
              <span className="inline-flex items-center gap-2 font-display text-2xl font-semibold text-cream-100">
                <PlusIcon size={22} />
                Add property
              </span>
              <p className="text-cream-400 text-sm mt-2">Property, photos, financials, documents, ownership, then funding or tokenization.</p>
            </button>
            <h2 className="font-display text-lg font-semibold text-cream-100 mb-3">My properties</h2>
            {owned.length === 0 ? (
              <p className="text-cream-400 text-sm">No properties yet.</p>
            ) : (
              <div className="space-y-2">
                {owned.map((property) => {
                  const occupancy = property.offering?.occupancy ?? property.occupancyPercent ?? 0;
                  return (
                    <button
                      key={property.id}
                      type="button"
                      onClick={() => open(property.offering?.campaign ? 'funding' : 'tokenize')}
                      className="w-full text-left rounded-2xl border border-void-700 bg-void-800/40 px-3 py-3 hover:border-accent/40"
                    >
                      <div className="flex items-center gap-3">
                        <PropertyThumb title={property.title} imageUrl={property.imageUrl} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="text-cream-100 font-medium truncate">{property.title}</span>
                            <span className="text-accent text-sm">{statusLine(property)}</span>
                          </div>
                          <p className="text-cream-400 text-sm mt-1">
                            ${formatUsd(valuationOf(property))} · {Math.round(occupancy)}% occupied
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <button type="button" onClick={() => open('settings')} className="mt-6 text-sm text-cream-400 hover:text-cream-100">
              Profile and verification
            </button>
          </div>
        )}

        {tab === 'add' && (
          <section>
            <h1 className="font-display text-3xl font-bold text-cream-100 mb-2">Add property</h1>
            <p className="text-cream-400 mb-6">Walk the listing from the building through the raise, then submit it.</p>
            <AddProperty onCreated={(property) => saved(property, `${property.title} is on your desk. Investors can see an open campaign.`)} />
          </section>
        )}

        {tab === 'funding' && (
          <section>
            <h1 className="font-display text-3xl font-bold text-cream-100 mb-2">Funding campaign</h1>
            <p className="text-cream-400 mb-6">Raise a set amount. Investors see the terms on the property.</p>
            <OwnerFunding properties={owned} onSaved={saved} />
          </section>
        )}

        {tab === 'fundraising' && <FundraisingDashboard />}

        {tab === 'tokenize' && (
          <section>
            <h1 className="font-display text-3xl font-bold text-cream-100 mb-2">Tokenization</h1>
            <p className="text-cream-400 mb-6">Offer a slice of a property you already own.</p>
            <OwnerTokenize properties={owned} onSaved={saved} />
          </section>
        )}

        {tab === 'financing' && (
          <section>
            <h1 className="font-display text-3xl font-bold text-cream-100 mb-2">Property financing</h1>
            <p className="text-cream-400 mb-6">Borrow against a property you own. This is not the investor lending pool.</p>
            <OwnerFinance properties={owned} onSaved={saved} />
          </section>
        )}

        {tab === 'settings' && (
          <section className="max-w-lg space-y-6">
            <h1 className="font-display text-3xl font-bold text-cream-100">Profile</h1>
            <div>
              <h2 className="text-cream-100 font-medium mb-2">Profile photo</h2>
              <div className="flex items-center gap-4">
                {user?.avatarUrl ? (
                  <img src={mediaUrl(user.avatarUrl)} alt="" className="h-16 w-16 rounded-full object-cover border border-void-600" />
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-void-950 text-lg font-semibold">
                    {(user?.name || user?.email || '?').slice(0, 1).toUpperCase()}
                  </span>
                )}
                <label className="inline-flex items-center px-3 py-1.5 rounded-lg border border-void-500 text-sm text-cream-200 cursor-pointer">
                  {photoBusy ? 'Uploading…' : 'Upload image'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    disabled={photoBusy}
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      if (!file) return;
                      if (file.size > 1_500_000) {
                        setPhotoError('Image must be 1.5 MB or smaller.');
                        return;
                      }
                      setPhotoError('');
                      setPhotoBusy(true);
                      try {
                        const data = await new Promise<string>((resolve, reject) => {
                          const reader = new FileReader();
                          reader.onload = () => resolve(String(reader.result || ''));
                          reader.onerror = () => reject(new Error('Could not read that image.'));
                          reader.readAsDataURL(file);
                        });
                        await uploadAvatar({ data, filename: file.name });
                        await refreshUser();
                      } catch (err) {
                        setPhotoError(err instanceof Error ? err.message : 'Could not save that image.');
                      } finally {
                        setPhotoBusy(false);
                      }
                    }}
                  />
                </label>
              </div>
              {photoError && <p className="text-red-400 text-sm mt-2">{photoError}</p>}
            </div>
            <div>
              <h2 className="text-cream-100 font-medium mb-2">Identity verification</h2>
              <p className="text-cream-400 text-sm mb-3">Status: {user?.kycStatus || 'unverified'}</p>
              <Button variant="outline" onClick={() => navigate('/kyc')}>Open verification</Button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
