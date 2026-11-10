import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { fieldClass } from './ownerForm';
import { fetchFundraising, saveFundraisingProspect, FundraisingProspect, ProspectInput, ProspectStage } from '../../utils/fundraisingApi';

const currency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
const labels: Record<ProspectStage, string> = { interested: 'Interested', signed: 'Signed commitment', withdrawn: 'Withdrawn' };
const blank = (propertyId = ''): ProspectInput => ({ propertyId, name: '', email: '', stage: 'interested', amount: '', documentReference: '', followUpDate: '', notes: '' });

export function FundraisingDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['fundraising', user?.id];
  const { data, isLoading, isFetching, error: loadError, refetch } = useQuery({ queryKey, queryFn: fetchFundraising, retry: false });
  const [propertyFilter, setPropertyFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<FundraisingProspect | null>(null);
  const [form, setForm] = useState<ProspectInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const formOpen = Boolean(form);
  useEffect(() => {
    if (formOpen) {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      formRef.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
    }
  }, [formOpen, editing?.id]);
  const localNow = new Date();
  const today = `${localNow.getFullYear()}-${String(localNow.getMonth() + 1).padStart(2, '0')}-${String(localNow.getDate()).padStart(2, '0')}`;
  const properties = (data?.properties || []).filter((row) => !propertyFilter || row.id === propertyFilter);
  const prospects = (data?.prospects || []).filter((row) => !propertyFilter || row.propertyId === propertyFilter);
  const displayed = prospects.filter((row) => (!stageFilter || row.stage === stageFilter) && `${row.name} ${row.email}`.toLowerCase().includes(search.toLowerCase()));
  const interest = prospects.filter((row) => row.stage === 'interested').reduce((sum, row) => sum + row.amountCents / 100, 0);
  const signed = prospects.filter((row) => row.stage === 'signed').reduce((sum, row) => sum + row.amountCents / 100, 0);
  const received = properties.reduce((sum, row) => sum + (row.campaign?.received || 0), 0);
  const due = prospects.filter((row) => row.stage !== 'withdrawn' && row.followUpDate && row.followUpDate <= today).length;

  const edit = (row: FundraisingProspect) => {
    setEditing(row);
    setForm({ propertyId: row.propertyId, name: row.name, email: row.email, stage: row.stage, amount: (row.amountCents / 100).toFixed(2), documentReference: row.documentReference, followUpDate: row.followUpDate, notes: row.notes, version: row.version });
    setError(''); setNotice('');
  };

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-accent text-xs uppercase tracking-[0.2em]">Capital relationships</p>
        <h1 className="font-display text-3xl font-bold text-cream-100 mt-1">Fundraising</h1>
        <p className="text-cream-400 text-sm mt-2 max-w-2xl">Track investor interest, signed commitments, and campaign funding separately. Pipeline records are operator-entered; signing and payments happen through their own workflows.</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" disabled={isFetching || busy} onClick={() => void refetch()}>{isFetching ? 'Refreshing…' : 'Refresh'}</Button>
        <Button disabled={!data?.properties.length || busy} onClick={() => { setEditing(null); setForm(blank(propertyFilter || data?.properties[0]?.id)); setError(''); setNotice(''); }}>Add prospect</Button>
      </div>
    </div>
    {isLoading && <p className="text-cream-400" role="status">Loading fundraising…</p>}
    {loadError && <div role="alert" className="text-red-300 text-sm">Could not load fundraising. {loadError instanceof Error ? loadError.message : ''} <button className="underline" onClick={() => void refetch()}>Retry</button></div>}
    {notice && <p role="status" className="text-emerald-300 text-sm">{notice}</p>}
    {data && <>
      <label className="block text-sm text-cream-400 max-w-md">View property
        <select className={fieldClass} value={propertyFilter} onChange={(event) => setPropertyFilter(event.target.value)}>
          <option value="">All my properties</option>
          {data.properties.map((row) => <option key={row.id} value={row.id}>{row.title}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Investor interest', currency(interest), 'Uncommitted prospect amounts'],
          ['Signed commitments', currency(signed), 'Recorded with document references'],
          ['Recorded campaign funds', currency(received), 'Existing application-ledger funding'],
          ['Follow-ups due', String(due), 'Active prospects due today or earlier'],
        ].map(([label, value, description]) => <div key={label} className="rounded-2xl border border-void-700 bg-void-800/40 p-4">
          <p className="text-cream-400 text-xs">{label}</p><p className="font-display text-2xl text-cream-100 mt-2 break-words">{value}</p><p className="text-cream-400 text-xs mt-2">{description}</p>
        </div>)}
      </div>
      <p className="text-xs text-cream-400">These amounts are separate measures and must not be added together. Recorded campaign funds may include demo balances and do not confirm a bank receipt or on-chain settlement.</p>
      <section aria-label="Campaign progress" className="grid md:grid-cols-2 gap-3">
        {!properties.length && <p className="text-cream-400 text-sm">Add a property to start tracking a raise. <Link className="text-accent underline" to="/user?tab=add">Add property</Link></p>}
        {properties.map((property) => {
          const campaign = property.campaign;
          const percent = campaign?.target > 0 ? Math.min(100, Math.max(0, campaign.received / campaign.target * 100)) : 0;
          return <article key={property.id} className="rounded-2xl border border-void-700 bg-void-800/40 p-5">
            <Link className="text-cream-100 font-medium hover:text-accent" to={`/property/${property.id}`}>{property.title}</Link>
            {campaign ? <>
              <div className="flex justify-between gap-2 text-sm mt-3"><span className="text-cream-300">{currency(campaign.received)} / {currency(campaign.target)}</span><span className="text-accent">{percent.toFixed(1)}%</span></div>
              <div role="progressbar" aria-label={`${property.title} campaign funding`} aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100} className="h-2 bg-void-700 rounded-full mt-3 overflow-hidden"><div className="h-full bg-accent" style={{ width: `${percent}%` }} /></div>
              <p className="text-cream-400 text-xs mt-3">Deadline {campaign.deadline} · {campaign.status}{campaign.deadline < today && campaign.status === 'open' ? ' · Deadline passed' : ''}</p>
            </> : <p className="text-cream-400 text-sm mt-3">No campaign configured. <Link className="text-accent underline" to="/user?tab=funding">Set up a campaign</Link></p>}
          </article>;
        })}
      </section>
    </>}
    {form && <form ref={formRef} className="scroll-mt-36 rounded-2xl border border-accent/40 bg-void-800/40 p-5 grid md:grid-cols-2 gap-4" onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setError('');
      try {
        const next = await saveFundraisingProspect(form, editing?.id);
        queryClient.setQueryData(queryKey, next); setForm(null); setEditing(null); setNotice('Prospect saved. Campaign funding is unchanged.');
      } catch (err) { setError(err instanceof Error ? err.message : 'Could not save this prospect.'); }
      finally { setBusy(false); }
    }}>
      <h2 className="md:col-span-2 text-cream-100 font-display text-lg">{editing ? 'Edit prospect' : 'New prospect'}</h2>
      <fieldset disabled={busy} className="contents">
        <label className="text-sm text-cream-400 md:col-span-2">Property<select required disabled={Boolean(editing)} className={fieldClass} value={form.propertyId} onChange={(e) => setForm({ ...form, propertyId: e.target.value })}>{data?.properties.map((row) => <option key={row.id} value={row.id}>{row.title}</option>)}</select></label>
        <label className="text-sm text-cream-400">Investor name<input required maxLength={120} className={fieldClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label className="text-sm text-cream-400">Email<input required type="email" maxLength={254} className={fieldClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label className="text-sm text-cream-400">Amount (USD)<input required type="number" min="0.01" max="1000000000" step="0.01" className={fieldClass} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
        <label className="text-sm text-cream-400">Stage<select className={fieldClass} value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as ProspectStage })}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-sm text-cream-400">Signed document reference{form.stage === 'signed' ? ' (required)' : ''}<input required={form.stage === 'signed'} maxLength={300} className={fieldClass} value={form.documentReference} onChange={(e) => setForm({ ...form, documentReference: e.target.value })} /><span className="block text-xs mt-1">Record the signed document’s ID or location. This does not verify or sign it.</span></label>
        <label className="text-sm text-cream-400">Follow-up date<input type="date" className={fieldClass} value={form.followUpDate} onChange={(e) => setForm({ ...form, followUpDate: e.target.value })} /></label>
        <label className="text-sm text-cream-400 md:col-span-2">Notes<textarea rows={3} maxLength={2000} className={fieldClass} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
      </fieldset>
      {error && <p role="alert" className="md:col-span-2 text-red-300 text-sm">{error} <button type="button" className="underline" onClick={() => void refetch()}>Refresh records</button></p>}
      <div className="md:col-span-2 flex gap-3 justify-end"><Button type="button" variant="outline" disabled={busy} onClick={() => { setForm(null); setEditing(null); }}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save prospect'}</Button></div>
    </form>}
    {data && <section className="space-y-3" aria-label="Investor pipeline">
      <h2 className="font-display text-xl text-cream-100">Investor pipeline</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-sm text-cream-400">Find investor<input type="search" className={fieldClass} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or email" /></label>
        <label className="text-sm text-cream-400">Stage<select className={fieldClass} value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}><option value="">All stages</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      {!displayed.length && <p className="text-cream-400 text-sm py-6">{prospects.length ? 'No prospects match these filters.' : 'No prospects yet. Add an investor to begin tracking interest and follow-ups.'}</p>}
      {displayed.map((row) => <article key={row.id} className="rounded-2xl border border-void-700 bg-void-800/40 p-4">
        <div className="flex flex-wrap justify-between gap-3">
          <div className="min-w-0"><h3 className="text-cream-100 font-medium break-words">{row.name}</h3><p className="text-cream-400 text-sm break-all">{row.email}</p><p className="text-cream-400 text-xs mt-1">{data.properties.find((p) => p.id === row.propertyId)?.title}</p></div>
          <div className="flex items-start gap-4"><div className="text-right"><p className="text-cream-100">{currency(row.amountCents / 100)}</p><p className={`text-xs mt-1 ${row.stage === 'signed' ? 'text-emerald-300' : 'text-cream-400'}`}>{labels[row.stage]}</p></div><Button size="sm" variant="outline" disabled={busy} onClick={() => edit(row)}>Edit</Button></div>
        </div>
        {row.followUpDate && <p className={`text-xs mt-3 ${row.stage !== 'withdrawn' && row.followUpDate <= today ? 'text-accent' : 'text-cream-400'}`}>Follow-up: {row.followUpDate}{row.stage !== 'withdrawn' && row.followUpDate <= today ? ' · Due' : ''}</p>}
        {row.documentReference && <p className="text-cream-400 text-xs mt-2 break-all">Document reference: {row.documentReference}</p>}
        {row.notes && <p className="text-cream-300 text-sm mt-2 whitespace-pre-wrap break-words">{row.notes}</p>}
        <details className="text-cream-400 text-xs mt-3"><summary className="cursor-pointer">Record history ({row.history.length})</summary><ul className="mt-2 space-y-2">{[...row.history].reverse().map((entry, index) => <li key={index} className="border-l border-void-600 pl-3 break-words">{new Date(entry.at).toLocaleString()} · {labels[entry.stage]} · {currency(entry.amountCents / 100)} · Operator {entry.actorId}<br />{entry.name} · {entry.email}{entry.documentReference && <span className="block">Document: {entry.documentReference}</span>}{entry.followUpDate && <span className="block">Follow-up: {entry.followUpDate}</span>}{entry.notes && <span className="block whitespace-pre-wrap">{entry.notes}</span>}</li>)}</ul></details>
      </article>)}
    </section>}
  </div>;
}
