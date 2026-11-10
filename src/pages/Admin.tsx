import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRightIcon, RefreshCwIcon, SearchIcon, LayoutDashboardIcon, AlertCircleIcon, CheckCircle2Icon, InboxIcon, ChevronRightIcon, BanknoteIcon, Building2Icon, CoinsIcon, HandCoinsIcon, KeyRoundIcon, LandmarkIcon, LineChartIcon, ShieldIcon, UsersIcon, type LucideIcon } from 'lucide-react';
import { PropertyIncomePanel } from '../components/property/PropertyIncomePanel';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../context/AuthContext';
import { useProperties } from '../hooks/useProperties';
import { AdminAccount, AdminDesk, AdminPoint, adminAction, fetchAdmin } from '../utils/api';
import { DocumentVaultModal } from '../components/modals/DocumentVaultModal';
import { GrowthChart } from '../components/admin/GrowthChart';
import { LoginAttempts } from '../components/admin/LoginAttempts';
import { PropertyThumb } from '../components/ui/PropertyThumb';
import { formatUsd } from '../utils/ops';
import '../styles/admin.css';

const SECTIONS = ['dashboard', 'properties', 'tokens', 'owners', 'investors', 'market', 'lending', 'distributions', 'financials', 'compliance'] as const;

const STAGES = ['draft', 'review', 'approved', 'tokenized', 'funded', 'active'];
const fieldClass = 'admin-field';
const SECTION_DETAILS = {
  dashboard: { label: 'Overview', description: 'Your platform at a glance.', icon: LayoutDashboardIcon },
  properties: { label: 'Properties', description: 'Review listings, verify ownership, and manage the property lifecycle.', icon: Building2Icon },
  tokens: { label: 'Tokenization', description: 'Configure issuance terms and manage trading permissions.', icon: CoinsIcon },
  owners: { label: 'Property owners', description: 'Manage onboarding, property ownership, and account access.', icon: KeyRoundIcon },
  investors: { label: 'Investors', description: 'Review investor identity, holdings, and account restrictions.', icon: UsersIcon },
  market: { label: 'Marketplace', description: 'Monitor trading activity, orders, and transaction fees.', icon: LineChartIcon },
  lending: { label: 'Lending', description: 'Monitor pool liquidity, collateral, and loan health.', icon: HandCoinsIcon },
  distributions: { label: 'Distributions', description: 'Manage rental income and review distribution records.', icon: BanknoteIcon },
  financials: { label: 'Financials', description: 'Review property income, expenses, and allocation.', icon: LandmarkIcon },
  compliance: { label: 'Compliance', description: 'Review account exceptions and the administrative audit trail.', icon: ShieldIcon },
};

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function stageColor(stage: string): 'green' | 'yellow' | 'red' | 'accent' | 'blue' {
  if (stage === 'active' || stage === 'funded') return 'green';
  if (stage === 'review' || stage === 'draft') return 'yellow';
  if (stage === 'tokenized' || stage === 'approved') return 'blue';
  return 'accent';
}

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: catalog = [] } = useProperties();
  const isAdmin = user?.role === 'admin';
  const { data: desk, isLoading, error: loadError, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['admin-desk'],
    queryFn: fetchAdmin,
    enabled: isAdmin,
  });
  const [params, setParams] = useSearchParams();
  const requested = params.get('section');
  const section = (SECTIONS as readonly string[]).includes(requested || '') ? (requested as (typeof SECTIONS)[number]) : 'dashboard';
  const setSection = (id: (typeof SECTIONS)[number]) => {
    if (id === 'dashboard') setParams({});
    else setParams({ section: id });
  };
  const [propertyId, setPropertyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [vaultId, setVaultId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ title: '', location: '', description: '' });
  const [valuation, setValuation] = useState('');
  const [token, setToken] = useState({ supply: '', price: '', ownerPercent: '30' });
  const [mintShares, setMintShares] = useState('100');
  const [feeBps, setFeeBps] = useState('100');

  const selected = desk?.properties.find((row) => row.id === propertyId) || desk?.properties[0] || null;

  useEffect(() => {
    if (!propertyId && desk?.properties[0]) setPropertyId(desk.properties[0].id);
  }, [desk, propertyId]);

  useEffect(() => {
    if (!selected) return;
    setEdit({ title: selected.title, location: selected.location, description: selected.description });
    setValuation(String(selected.valuationUsd || ''));
    setToken({
      supply: String(selected.token.totalSupply || ''),
      price: String(selected.token.price || ''),
      ownerPercent: String(selected.token.ownerPercent ?? 30),
    });
    setFeeBps(String(selected.feeBps || 0));
  }, [selected?.id]);

  const run = async (key: string, payload: Record<string, unknown>, message: string) => {
    if (busy) return;
    setError('');
    setNotice('');
    setBusy(key);
    try {
      const next = await adminAction(payload);
      queryClient.setQueryData(['admin-desk'], next);
      void queryClient.invalidateQueries({ queryKey: ['properties'] });
      setNotice(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed.');
    } finally {
      setBusy('');
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center px-4">
        <div className="text-center max-w-md w-full p-10 rounded-2xl border border-void-700 bg-void-800/80">
          <ShieldIcon size={32} className="text-accent mx-auto mb-4" />
          <h2 className="font-display text-2xl font-semibold text-cream-100 mb-3">Admin access required</h2>
          <Button onClick={() => navigate('/home')}>Back to Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-workspace min-h-screen w-full">
      <div className="admin-shell">
        <aside className="admin-sidebar" aria-label="Administration navigation">
          <div className="admin-sidebar-caption">Workspace</div>
          {SECTIONS.map((id) => {
            const item = SECTION_DETAILS[id];
            const Icon = item.icon;
            return <Link key={id} to={id === 'dashboard' ? '/admin' : `/admin?section=${id}`} aria-current={section === id ? 'page' : undefined} className={`admin-nav-item ${section === id ? 'is-active' : ''}`}><Icon size={17} /><span>{item.label}</span>{section === id && <ChevronRightIcon size={14} className="ml-auto" />}</Link>;
          })}
          <div className="admin-sidebar-caption mt-8">Connected workspaces</div>
          <Link className="admin-nav-item" to="/institution"><Building2Icon size={17} />Block quotes<ArrowRightIcon size={14} className="ml-auto" /></Link>
          <Link className="admin-nav-item" to="/governance"><ShieldIcon size={17} />Governance<ArrowRightIcon size={14} className="ml-auto" /></Link>
          <div className="admin-sidebar-note"><ShieldIcon size={17} /><span>Administrator workspace<br /><span className="text-cream-400">Role-based access</span></span></div>
        </aside>
        <div className="admin-main min-w-0">
          <div className="admin-breadcrumb">Administration <ChevronRightIcon size={13} /><span>{SECTION_DETAILS[section].label}</span></div>
          <header className="admin-page-heading">
            <div><h1>{section === 'dashboard' ? 'Platform overview' : SECTION_DETAILS[section].label}</h1><p>{SECTION_DETAILS[section].description}</p></div>
            <div className="flex items-center gap-3">
              {dataUpdatedAt > 0 && <span className="hidden sm:block text-xs text-cream-400">Updated {new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
              <Button variant="outline" size="sm" disabled={isFetching || Boolean(busy)} onClick={() => { void refetch(); }} icon={<RefreshCwIcon size={14} className={isFetching ? 'animate-spin' : ''} />}>{isFetching ? 'Refreshing…' : 'Refresh'}</Button>
            </div>
          </header>
          {error && <div role="alert" className="admin-message admin-message-error"><AlertCircleIcon size={18} />{error}</div>}
          {notice && <div role="status" className="admin-message admin-message-success"><CheckCircle2Icon size={18} />{notice}</div>}
          {loadError && <div role="alert" className="admin-message admin-message-error"><AlertCircleIcon size={18} /><div>Unable to refresh the console.<p className="text-xs mt-1">{loadError instanceof Error ? loadError.message : 'Please try again.'}</p></div><button className="ml-auto underline" onClick={() => void refetch()}>Retry</button></div>}
          {isLoading ? (
            <div role="status" aria-label="Loading console" className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-pulse">{[0, 1, 2, 3, 4, 5].map((id) => <div key={id} className="h-40 rounded-xl border border-void-700 bg-void-800" />)}<span className="sr-only">Loading console…</span></div>
          ) : desk ? section === 'dashboard' ? (
            <Dashboard desk={desk} onOpen={setSection} />
          ) : (
            <fieldset className="admin-console" disabled={Boolean(busy)} aria-busy={Boolean(busy)}>
              {busy && <div role="status" className="admin-saving"><RefreshCwIcon size={14} className="animate-spin" />Saving changes…</div>}
              <Console section={section} desk={desk} selectedId={selected?.id || ''} onSelect={setPropertyId} edit={edit} setEdit={setEdit} valuation={valuation} setValuation={setValuation} token={token} setToken={setToken} mintShares={mintShares} setMintShares={setMintShares} feeBps={feeBps} setFeeBps={setFeeBps} busy={busy} run={run} onDocs={setVaultId} />
            </fieldset>
          ) : !loadError && <div className="admin-empty"><InboxIcon size={28} /><h3>No console data available</h3><p>Refresh to load the latest platform records.</p></div>}
        </div>
      </div>
      <DocumentVaultModal
        isOpen={Boolean(vaultId)}
        property={catalog.find((row) => row.id === vaultId) || null}
        onClose={() => setVaultId(null)}
        onUpdated={async () => {
          await queryClient.invalidateQueries({ queryKey: ['admin-desk'] });
          await queryClient.invalidateQueries({ queryKey: ['properties'] });
        }}
      />
    </div>
  );
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function changeLabel(points: AdminPoint[]) {
  if (points.length < 2 || points[0].value === 0) return null;
  const delta = ((points[points.length - 1].value - points[0].value) / Math.abs(points[0].value)) * 100;
  return { text: `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`, up: delta >= 0 };
}

function Dashboard({ desk, onOpen }: { desk: AdminDesk; onOpen: (id: (typeof SECTIONS)[number]) => void }) {
  const rent = sum(desk.properties.map((row) => row.flow.rent));
  const expenses = sum(desk.properties.map((row) => row.flow.expenses));
  const fees = sum(desk.properties.map((row) => row.flow.fee));
  const net = sum(desk.properties.map((row) => row.flow.net));
  const investorShare = sum(desk.properties.map((row) => row.flow.investor));
  const ownerShare = sum(desk.properties.map((row) => row.flow.owner));
  const aum = sum(desk.properties.map((row) => row.valuationUsd));
  const debt = sum(desk.lending.loans.map((row) => row.debt));
  const collateral = sum(desk.lending.loans.map((row) => row.collateral));
  const pending = [...desk.investors, ...desk.owners].filter((row) => row.kycStatus === 'pending').length;
  const flagged = [...desk.investors, ...desk.owners].filter((row) => row.suspicious || row.restricted || row.suspended).length;
  const approved = [...desk.investors, ...desk.owners].filter((row) => row.kycStatus === 'approved').length;
  const growth = desk.growth;
  const charts: { title: string; points: AdminPoint[]; kind: 'usd' | 'count' }[] = [
    { title: 'Portfolio value', points: growth.asset, kind: 'usd' },
    { title: 'Sold tokens', points: growth.sold, kind: 'usd' },
    { title: 'Trading volume', points: growth.volume, kind: 'usd' },
    { title: 'Lending capacity', points: growth.capacity, kind: 'usd' },
    { title: 'Accrued net income', points: growth.accrued, kind: 'usd' },
    { title: 'Investors', points: growth.investors, kind: 'count' },
  ];
  const departments: {
    id: (typeof SECTIONS)[number];
    title: string;
    icon: LucideIcon;
    stats: [string, string][];
  }[] = [
    {
      id: 'financials',
      title: 'Financials',
      icon: LandmarkIcon,
      stats: [
        ['Asset value', `$${formatUsd(aum)}`],
        ['Monthly rent', `$${formatUsd(rent)}`],
        ['Expenses', `$${formatUsd(expenses)}`],
        ['Fees', `$${formatUsd(fees)}`],
        ['Net income', `$${formatUsd(net)}`],
      ],
    },
    {
      id: 'properties',
      title: 'Properties',
      icon: Building2Icon,
      stats: [
        ['Listings', String(desk.properties.length)],
        ['In review', String(desk.properties.filter((row) => row.stage === 'review').length)],
        ['Active', String(desk.properties.filter((row) => row.stage === 'active').length)],
        ['Suspended', String(desk.properties.filter((row) => row.suspended).length)],
      ],
    },
    {
      id: 'tokens',
      title: 'Tokens',
      icon: CoinsIcon,
      stats: [
        ['Sold', sum(desk.properties.map((row) => row.tokensSold)).toLocaleString()],
        ['Supply', sum(desk.properties.map((row) => row.totalTokens)).toLocaleString()],
        ['Investor value', `$${formatUsd(growth.sold[growth.sold.length - 1]?.value || 0)}`],
      ],
    },
    {
      id: 'owners',
      title: 'Owners',
      icon: KeyRoundIcon,
      stats: [
        ['Owners', String(desk.owners.length)],
        ['Unverified', String(desk.owners.filter((row) => row.kycStatus !== 'approved').length)],
        ['Distributions', `$${formatUsd(ownerShare)}`],
      ],
    },
    {
      id: 'investors',
      title: 'Investors',
      icon: UsersIcon,
      stats: [
        ['Investors', String(desk.investors.length)],
        ['Pending KYC', String(desk.investors.filter((row) => row.kycStatus === 'pending').length)],
        ['Distributions', `$${formatUsd(investorShare)}`],
      ],
    },
    {
      id: 'market',
      title: 'Market',
      icon: LineChartIcon,
      stats: [
        ['Volume', `$${formatUsd(desk.market.volume)}`],
        ['Open orders', String(desk.market.orders.length)],
        ['Rejected', String(desk.market.failures.length)],
      ],
    },
    {
      id: 'lending',
      title: 'Lending',
      icon: HandCoinsIcon,
      stats: [
        ['Pool', `$${formatUsd(desk.lending.poolUsdc)}`],
        ['Debt', `$${formatUsd(debt)}`],
        ['Collateral', `$${formatUsd(collateral)}`],
        ['Loans', String(desk.lending.loans.length)],
      ],
    },
    {
      id: 'distributions',
      title: 'Distributions',
      icon: BanknoteIcon,
      stats: [
        ['Monthly net', `$${formatUsd(net)}`],
        ['Investors', `$${formatUsd(investorShare)}`],
        ['Owners', `$${formatUsd(ownerShare)}`],
        ['Posted', String(desk.distributions.length)],
      ],
    },
    {
      id: 'compliance',
      title: 'Compliance',
      icon: ShieldIcon,
      stats: [
        ['Approved', String(approved)],
        ['Pending', String(pending)],
        ['Flagged', String(flagged)],
      ],
    },
  ];

  return (
    <div>
      <div className="admin-metrics">
        {[
          { label: 'Assets under management', value: `$${formatUsd(aum)}`, note: `${desk.properties.length} properties in portfolio`, icon: Building2Icon },
          { label: 'Monthly net income', value: `$${formatUsd(net)}`, note: 'After expenses and management fees', icon: BanknoteIcon },
          { label: 'Investor accounts', value: desk.investors.length.toLocaleString(), note: `${desk.investors.filter((row) => row.kycStatus === 'approved').length} identity verified`, icon: UsersIcon },
          { label: 'Outstanding debt', value: `$${formatUsd(debt)}`, note: `${desk.lending.loans.length} loans in the lending book`, icon: HandCoinsIcon },
        ].map(({ label, value, note, icon: Icon }) => <div className="admin-metric" key={label}><div className="flex items-center justify-between"><span>{label}</span><Icon size={17} className="text-accent" /></div><strong>{value}</strong><p>{note}</p></div>)}
      </div>
      <div className="admin-attention">
        <div className="flex items-center gap-3"><span className="admin-icon-tile"><ShieldIcon size={19} /></span><div><h2>Review queue</h2><p>{pending} pending identity reviews · {flagged} flagged or restricted accounts · {desk.properties.filter((row) => row.stage === 'review').length} properties in review</p></div></div>
        <Button size="sm" variant="outline" onClick={() => onOpen('compliance')} icon={<ArrowRightIcon size={14} />}>Open compliance</Button>
      </div>
      <section className="mb-8">
        <div className="admin-section-heading"><div><h2>Platform performance</h2><p>Recorded history across the latest 60 sessions</p></div><span className="admin-label">Historical activity</span></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {charts.map((chart) => {
            const change = changeLabel(chart.points);
            return (
              <div key={chart.title} className="admin-chart-card">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h3 className="text-sm font-medium text-cream-100">{chart.title}</h3>
                  {change && (
                    <span className={`text-xs font-medium ${change.up ? 'text-emerald-300' : 'text-red-300'}`}>{change.text}</span>
                  )}
                </div>
                <GrowthChart points={chart.points} kind={chart.kind} />
              </div>
            );
          })}
        </div>
      </section>
      <section>
        <div className="admin-section-heading"><div><h2>Operations</h2><p>Manage platform activity by department</p></div></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {departments.map((department) => {
            const Icon = department.icon;
            return (
              <button
                key={department.id}
                type="button"
                onClick={() => onOpen(department.id)}
                className="admin-department"
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                      <Icon size={16} />
                    </span>
                    <span className="font-medium text-cream-100">{department.title}</span>
                  </div>
                  <ArrowRightIcon size={16} className="text-cream-400" />
                </div>
                <dl className="space-y-1.5">
                  {department.stats.map(([label, value]) => (
                    <div key={label} className="flex items-baseline justify-between gap-3 text-sm">
                      <dt className="text-cream-400">{label}</dt>
                      <dd className="text-cream-100 font-medium text-right">{value}</dd>
                    </div>
                  ))}
                </dl>
              </button>
            );
          })}
        </div>
      </section>
      <section className="mt-8"><LoginAttempts /></section>
    </div>
  );
}

function PropertySelect({ desk, value, onChange }: { desk: AdminDesk; value: string; onChange: (id: string) => void }) {
  return (
    <div className="admin-property-select">
      <label htmlFor="admin-property">Selected property<span>Choose the asset you want to manage</span></label>
      <select id="admin-property" className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)}>
        {desk.properties.map((row) => <option key={row.id} value={row.id}>{row.title} · {row.stage}</option>)}
      </select>
    </div>
  );
}

function Console(props: {
  section: string;
  desk: AdminDesk;
  selectedId: string;
  onSelect: (id: string) => void;
  edit: { title: string; location: string; description: string };
  setEdit: (value: { title: string; location: string; description: string }) => void;
  valuation: string;
  setValuation: (value: string) => void;
  token: { supply: string; price: string; ownerPercent: string };
  setToken: (value: { supply: string; price: string; ownerPercent: string }) => void;
  mintShares: string;
  setMintShares: (value: string) => void;
  feeBps: string;
  setFeeBps: (value: string) => void;
  busy: string;
  run: (key: string, payload: Record<string, unknown>, message: string) => Promise<void>;
  onDocs: (id: string) => void;
}) {
  const { section, desk, selectedId, onSelect, run, busy } = props;
  const property = desk.properties.find((row) => row.id === selectedId) || desk.properties[0];
  if (section === 'owners') return <Accounts title="Owner management" copy="Onboarding, identity, ownership, wallet, listings, and payouts." rows={desk.owners} desk={desk} run={run} busy={busy} kind="owner" />;
  if (section === 'investors') return <Accounts title="Investor management" copy="Identity, accreditation, wallets, holdings, cash, and restrictions." rows={desk.investors} desk={desk} run={run} busy={busy} kind="investor" />;

  if (!property && ['properties', 'tokens', 'market', 'distributions', 'financials'].includes(section)) return <div className="admin-empty"><Building2Icon size={30} /><h3>No properties available</h3><p>Property submissions will appear here when owners add their listings.</p></div>;

  if (section === 'properties') {
    return (
      <div>
        <div className="flex items-start gap-4 mb-4">
          <PropertyThumb title={property.title} imageUrl={property.imageUrl} className="h-16 w-24" />
          <div>
            <h2 className="font-display text-xl font-semibold text-cream-100 mb-1">Property management</h2>
            <p className="text-cream-400 text-sm">Draft, review, approved, tokenized, funded, then active. Suspend a listing or open a sale from here.</p>
          </div>
        </div>
        <PropertySelect desk={desk} value={property.id} onChange={onSelect} />
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Badge color={stageColor(property.stage)}>{property.stage}</Badge>
          {property.suspended && <Badge color="red">Suspended</Badge>}
          {property.sale && <Badge color="orange">Sale initiated</Badge>}
          <Badge color={property.ownershipVerified ? 'green' : 'yellow'}>
            {property.ownershipVerified ? 'Ownership verified' : 'Documents unverified'}
          </Badge>
          <span className="text-cream-400 text-sm">{property.ownerName || 'No owner'} · {property.tokensSold}/{property.totalTokens} sold</span>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {STAGES.map((stage) => (
            <Button key={stage} size="sm" variant={property.stage === stage ? 'primary' : 'outline'} disabled={busy === 'stage'} onClick={() => run('stage', { type: 'property-stage', id: property.id, stage }, `Stage set to ${stage}.`)}>
              {stage}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mb-6">
          <Button size="sm" variant="outline" onClick={() => run('review', { type: 'property-review', id: property.id, decision: 'approved' }, 'Property approved.')}>Approve</Button>
          <Button size="sm" variant="danger" onClick={() => run('review', { type: 'property-review', id: property.id, decision: 'rejected' }, 'Property returned to draft.')}>Reject</Button>
          <Button size="sm" variant="outline" onClick={() => run('verify', { type: 'property-verify', id: property.id }, 'Ownership documents verified.')}>Verify documents</Button>
          <Button size="sm" variant="outline" onClick={() => props.onDocs(property.id)}>Upload documents</Button>
          <Button size="sm" variant="outline" onClick={() => run('suspend', { type: 'property-suspend', id: property.id, suspended: !property.suspended }, property.suspended ? 'Property restored.' : 'Property suspended.')}>
            {property.suspended ? 'Restore' : 'Freeze'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => run('sale', { type: 'property-sale', id: property.id, sale: property.sale ? null : 'initiated' }, property.sale ? 'Sale cleared.' : 'Sale initiated.')}>
            {property.sale ? 'Clear sale' : 'Initiate sale'}
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); run('value', { type: 'property-valuation', id: property.id, usd: Number(props.valuation) }, 'Valuation saved.'); }}>
            <label className="text-sm text-cream-400">Valuation (USD)
              <input type="number" min="0" step="0.01" required value={props.valuation} onChange={(event) => props.setValuation(event.target.value)} className={fieldClass} />
            </label>
            <Button type="submit" size="sm" disabled={busy === 'value'}>Save valuation</Button>
          </form>
          <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); run('edit', { type: 'property-edit', id: property.id, ...props.edit }, 'Listing updated.'); }}>
            <label className="text-sm text-cream-400">Title
              <input required value={props.edit.title} onChange={(event) => props.setEdit({ ...props.edit, title: event.target.value })} className={fieldClass} />
            </label>
            <label className="text-sm text-cream-400">Location
              <input required value={props.edit.location} onChange={(event) => props.setEdit({ ...props.edit, location: event.target.value })} className={fieldClass} />
            </label>
            <label className="text-sm text-cream-400">Description
              <textarea value={props.edit.description} onChange={(event) => props.setEdit({ ...props.edit, description: event.target.value })} rows={3} className={fieldClass} />
            </label>
            <Button type="submit" size="sm" disabled={busy === 'edit'}>Save listing</Button>
          </form>
        </div>
        <ul className="mt-4 text-sm text-cream-300 space-y-1">
          {property.documents.length === 0 && <li>No documents on file.</li>}
          {property.documents.map((doc) => (
            <li key={doc.name}>{doc.name}{doc.review ? ` · ${doc.review}` : ''}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (section === 'tokens') {
    return (
      <div>
        <h2 className="font-display text-xl font-semibold text-cream-100 mb-1">Tokenization</h2>
        <p className="text-cream-400 text-sm mb-4">Set supply, price, and the owner’s retained percentage. Minting and burning update the catalog supply. Trading pause and transfer limits apply on the market.</p>
        <PropertySelect desk={desk} value={property.id} onChange={onSelect} />
        <p className="text-cream-300 text-sm mb-4">
          Supply {property.token.totalSupply} · price ${formatUsd(property.token.price)} · owner {property.token.ownerPercent}% · minted {property.token.minted} · burned {property.token.burned}
          {property.token.contract ? ` · ${property.token.contract}` : ' · Ledger only; no deployed contract'}
        </p>
        <form className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4" onSubmit={(event) => { event.preventDefault(); run('token', { type: 'token-set', id: property.id, totalSupply: Number(props.token.supply), price: Number(props.token.price), ownerPercent: Number(props.token.ownerPercent) }, 'Token terms saved.'); }}>
          <label className="text-sm text-cream-400">Total supply
            <input type="number" min="1" step="1" required value={props.token.supply} onChange={(event) => props.setToken({ ...props.token, supply: event.target.value })} className={fieldClass} />
          </label>
          <label className="text-sm text-cream-400">Initial price (USDC)
            <input type="number" min="0.01" step="0.01" required value={props.token.price} onChange={(event) => props.setToken({ ...props.token, price: event.target.value })} className={fieldClass} />
          </label>
          <label className="text-sm text-cream-400">Owner percentage
            <input type="number" min="0" max="100" step="0.01" required value={props.token.ownerPercent} onChange={(event) => props.setToken({ ...props.token, ownerPercent: event.target.value })} className={fieldClass} />
          </label>
          <div className="md:col-span-3"><Button type="submit" size="sm" disabled={busy === 'token'}>Save token</Button></div>
        </form>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm text-cream-400">Shares
            <input type="number" min="1" step="1" required value={props.mintShares} onChange={(event) => props.setMintShares(event.target.value)} className={fieldClass} />
          </label>
          <Button size="sm" disabled={busy === 'mint'} onClick={() => run('mint', { type: 'token-mint', id: property.id, shares: Number(props.mintShares) }, 'Tokens minted.')}>Mint</Button>
          <Button size="sm" variant="outline" disabled={busy === 'burn'} onClick={() => run('burn', { type: 'token-burn', id: property.id, shares: Number(props.mintShares) }, 'Tokens burned.')}>Burn</Button>
          <Button size="sm" variant="outline" onClick={() => run('pause', { type: 'token-pause', id: property.id, paused: !property.tradingPaused }, property.tradingPaused ? 'Trading opened.' : 'Trading paused.')}>
            {property.tradingPaused ? 'Resume trading' : 'Pause trading'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => run('restrict', { type: 'token-restrict', id: property.id, restricted: !property.transfersRestricted }, property.transfersRestricted ? 'Transfers opened.' : 'Transfers restricted.')}>
            {property.transfersRestricted ? 'Allow transfers' : 'Restrict transfers'}
          </Button>
        </div>
      </div>
    );
  }


  if (section === 'market') {
    return (
      <div>
        <h2 className="font-display text-xl font-semibold text-cream-100 mb-1">Marketplace</h2>
        <p className="text-cream-400 text-sm mb-4">Monitor open orders, executed trades, and rejected orders. Configure trading fees for the selected property.</p>
        <p className="text-cream-100 mb-4">Volume ${formatUsd(desk.market.volume)}</p>
        <PropertySelect desk={desk} value={property.id} onChange={onSelect} />
        <form className="flex items-end gap-2 mb-6" onSubmit={(event) => { event.preventDefault(); run('fee', { type: 'market-fee', id: property.id, feeBps: Number(props.feeBps) }, 'Fee updated.'); }}>
          <label className="text-sm text-cream-400">Fee (bps)
            <input type="number" min="0" max="10000" step="1" required value={props.feeBps} onChange={(event) => props.setFeeBps(event.target.value)} className={fieldClass} />
          </label>
          <Button type="submit" size="sm">Save fee</Button>
          <span className="text-cream-400 text-sm pb-2">{property.tradingPaused ? 'Trading paused' : 'Trading open'}</span>
        </form>
        <h3 className="text-cream-100 font-medium mb-2">Open orders</h3>
        <SimpleTable
          empty="No open orders."
          rows={desk.market.orders.map((order) => [order.id, titleOf(desk, order.propertyId), order.side, `$${formatUsd(order.price)}`, String(order.shares)])}
          headers={['Order', 'Property', 'Side', 'Price', 'Shares']}
        />
        <h3 className="text-cream-100 font-medium mt-6 mb-2">Trades</h3>
        <SimpleTable
          empty="No trades yet."
          rows={desk.market.trades.map((trade) => [trade.at.slice(0, 16).replace('T', ' '), titleOf(desk, trade.propertyId), `$${formatUsd(trade.price)}`, String(trade.shares)])}
          headers={['Time', 'Property', 'Price', 'Shares']}
        />
        <h3 className="text-cream-100 font-medium mt-6 mb-2">Failed orders</h3>
        <SimpleTable
          empty="No rejected orders."
          rows={desk.market.failures.map((row) => [row.at.slice(0, 16).replace('T', ' '), row.propertyId || '—', row.error])}
          headers={['Time', 'Property', 'Reason']}
        />
      </div>
    );
  }

  if (section === 'lending') {
    const loans = desk.lending.loans;
    return (
      <div>
        <h2 className="font-display text-xl font-semibold text-cream-100 mb-1">DeFi lending</h2>
        <p className="text-cream-400 text-sm mb-4">
          Max LTV {pct(desk.lending.maxLtv)} · liquidation {pct(desk.lending.liquidationLtv)} · borrow {pct(desk.lending.borrowApr)} · supply {pct(desk.lending.supplyApr)} · pool ${formatUsd(desk.lending.poolUsdc)}
        </p>
        <SimpleTable
          empty="No open loans."
          headers={['Borrower', 'Debt', 'Interest', 'Collateral', 'LTV', 'Health']}
          rows={loans.map((loan) => [loan.borrower, `$${formatUsd(loan.debt)}`, `$${formatUsd(loan.interest)}`, `$${formatUsd(loan.collateral)}`, pct(loan.ltv), loan.health])}
        />
        <p className="text-cream-400 text-sm mt-4">
          Margin is a loan between 50% and 65% LTV. At 65% another account can liquidate it from the Lend page. Repayments return to the pool. Bad debt appears when collateral no longer covers the balance.
        </p>
        <ul className="mt-3 text-sm text-cream-300">
          {loans.filter((loan) => loan.collateral < loan.debt).map((loan) => (
            <li key={loan.id}>{loan.borrower} is undercollateralized by ${formatUsd(loan.debt - loan.collateral)}.</li>
          ))}
          {loans.every((loan) => loan.collateral >= loan.debt) && <li>No bad debt.</li>}
        </ul>
      </div>
    );
  }

  if (section === 'distributions' || section === 'financials') {
    const flow = property.flow;
    return (
      <div>
        <h2 className="font-display text-xl font-semibold text-cream-100 mb-1">
          {section === 'financials' ? 'Property financials' : 'Rental distributions'}
        </h2>
        <PropertySelect desk={desk} value={property.id} onChange={onSelect} />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4 text-sm">
          {[
            ['Monthly rent', flow.rent],
            ['Property expenses', flow.expenses],
            ['Management fee', flow.fee],
            ['Net income', flow.net],
            ['Investor distribution', flow.investor],
            ['Owner distribution', flow.owner],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-void-700 p-3">
              <div className="text-cream-400 text-xs">{label}</div>
              <div className="text-cream-100 font-medium">${formatUsd(Number(value))}</div>
            </div>
          ))}
        </div>
        <p className="text-cream-400 text-sm mb-4">Owner retains {flow.ownerPercent}% of net income. The rest is the investor distribution.</p>
        {section === 'distributions' && (
          <>
            <PropertyIncomePanel key={property.id} propertyId={property.id} />
            <details><summary className="cursor-pointer text-sm text-cream-400 mb-3">Legacy projection postings · no cash transfer</summary>
            <Button size="sm" disabled={busy === 'dist'} onClick={() => run('dist', { type: 'distribution-run', id: property.id }, 'Distribution posted.')}>Post distribution</Button>
            <div className="mt-4">
              <SimpleTable
                empty="No distributions posted."
                headers={['When', 'Property', 'Net', 'Investors', 'Owner', 'Status']}
                rows={desk.distributions.map((row) => [row.at.slice(0, 10), row.title, `$${formatUsd(row.net)}`, `$${formatUsd(row.investor)}`, `$${formatUsd(row.owner)}`, row.status])}
              />
            </div>
            </details>
          </>
        )}
      </div>
    );
  }

  const flagged = [...desk.investors, ...desk.owners].filter((row) => row.suspicious || row.restricted || !row.screenedAt || row.kycStatus !== 'approved');
  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-cream-100 mb-1">Compliance</h2>
      <p className="text-cream-400 text-sm mb-4">Identity status, screening marks, restrictions, and the admin audit trail. Screening here is a platform record, not a licensed AML vendor.</p>
      <SimpleTable
        empty="No accounts need attention."
        headers={['Account', 'Role', 'KYC', 'Country', 'Screened', 'Flags']}
        rows={flagged.map((row) => [
          row.email,
          row.role === 'owner' ? 'Owner' : 'Investor',
          row.kycStatus,
          row.country || '—',
          row.screenedAt ? row.screenedAt.slice(0, 10) : 'Not screened',
          [row.suspicious ? 'suspicious' : '', row.restricted ? 'restricted' : '', row.suspended ? 'suspended' : ''].filter(Boolean).join(', ') || '—',
        ])}
      />
      <h3 className="text-cream-100 font-medium mt-6 mb-2">Audit trail</h3>
      <SimpleTable
        empty="No admin actions yet."
        headers={['When', 'Action', 'Target', 'Detail']}
        rows={desk.audit.map((row) => [row.at.slice(0, 16).replace('T', ' '), row.action, row.target || '—', row.detail])}
      />
    </div>
  );
}

function Accounts({ title, copy, rows, desk, run, busy, kind }: {
  title: string;
  copy: string;
  rows: AdminAccount[];
  desk: AdminDesk;
  run: (key: string, payload: Record<string, unknown>, message: string) => Promise<void>;
  busy: string;
  kind: 'owner' | 'investor';
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const filtered = rows.filter((row) => `${row.name} ${row.email} ${row.walletAddress || ''}`.toLowerCase().includes(search.toLowerCase()) && (status === 'all' || (status === 'flagged' ? row.suspicious || row.suspended || row.restricted : row.kycStatus === status)));
  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-cream-100 mb-1">{title}</h2>
      <p className="text-cream-400 text-sm mb-4">{copy}</p>
      <div className="admin-filter-bar">
        <label className="admin-search"><SearchIcon size={16} /><input aria-label="Search accounts" placeholder="Search name, email, or wallet…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <select aria-label="Filter accounts by status" className={fieldClass} value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option><option value="pending">Pending review</option><option value="approved">Verified</option><option value="rejected">Rejected</option><option value="flagged">Flagged or restricted</option></select>
        <span className="text-xs text-cream-400 whitespace-nowrap">{filtered.length} of {rows.length} accounts</span>
      </div>
      <div className="space-y-3">
        {filtered.map((row) => (
          <article key={row.id} className="admin-account">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-cream-100 font-medium">{row.name || row.email}</span>
              <Badge color={row.kycStatus === 'approved' ? 'green' : row.kycStatus === 'rejected' ? 'red' : 'yellow'}>{row.kycStatus}</Badge>
              {row.accredited && <Badge color="blue">Accredited</Badge>}
              {row.suspended && <Badge color="red">Suspended</Badge>}
              {row.restricted && <Badge color="orange">Restricted</Badge>}
              {row.suspicious && <Badge color="yellow">Suspicious</Badge>}
            </div>
            <p className="text-cream-400 text-sm mt-1">{row.email} · {row.country || 'No country'} · {row.walletAddress || 'No wallet'}</p>
            <p className="text-cream-300 text-sm mt-1">Cash ${formatUsd(row.cashUsdc)} · {row.holdings.map((holding) => `${holding.shares} ${holding.title}`).join(', ') || 'No tokens'}</p>
            {kind === 'owner' && (
              <p className="text-cream-300 text-sm">Listings: {row.properties.map((item) => item.title).join(', ') || 'None'}</p>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              {row.kycStatus === 'pending' && (
                <>
                  <Button size="sm" variant="outline" disabled={busy === `kyc-${row.id}`} onClick={() => run(`kyc-${row.id}`, { type: 'account-kyc', id: row.id, decision: 'approved' }, 'Application approved.')}>Approve KYC</Button>
                  <Button size="sm" variant="danger" disabled={busy === `kyc-${row.id}`} onClick={() => run(`kyc-${row.id}`, { type: 'account-kyc', id: row.id, decision: 'rejected', note: 'Incomplete application.' }, 'Application rejected.')}>Reject</Button>
                </>
              )}
              <Button size="sm" variant="outline" onClick={() => run(`sus-${row.id}`, { type: 'account-suspend', id: row.id, suspended: !row.suspended }, row.suspended ? 'Account restored.' : 'Account suspended.')}>
                {row.suspended ? 'Restore' : 'Suspend'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => run(`flag-${row.id}`, { type: 'account-flag', id: row.id, suspicious: !row.suspicious, restricted: row.restricted }, row.suspicious ? 'Flag cleared.' : 'Marked suspicious.')}>
                {row.suspicious ? 'Clear flag' : 'Flag'}
              </Button>
              {kind === 'investor' && (
                <Button size="sm" variant="outline" onClick={() => run(`rest-${row.id}`, { type: 'account-flag', id: row.id, suspicious: row.suspicious, restricted: !row.restricted }, row.restricted ? 'Restriction lifted.' : 'Account restricted.')}>
                  {row.restricted ? 'Lift restriction' : 'Restrict'}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => run(`screen-${row.id}`, { type: 'account-screen', id: row.id }, 'Screening recorded.')}>
                {row.screenedAt ? 'Screened' : 'Mark screened'}
              </Button>
            </div>
            {kind === 'owner' && (
              <p className="text-cream-400 text-xs mt-2">
                Payouts: {desk.distributions.filter((item) => row.properties.some((owned) => owned.title === item.title)).map((item) => `$${formatUsd(item.owner)} on ${item.at.slice(0, 10)}`).join(' · ') || 'None posted'}
              </p>
            )}
          </article>
        ))}
        {filtered.length === 0 && <div className="admin-empty"><UsersIcon size={28} /><h3>{rows.length ? 'No matching accounts' : 'No accounts yet'}</h3><p>{rows.length ? 'Try another search or status filter.' : 'Registered accounts will appear here.'}</p>{rows.length > 0 && <button className="text-accent text-sm mt-3" onClick={() => { setSearch(''); setStatus('all'); }}>Clear filters</button>}</div>}
      </div>
    </div>
  );
}

function titleOf(desk: AdminDesk, id: string) {
  return desk.properties.find((row) => row.id === id)?.title || id;
}

function SimpleTable({ headers, rows, empty }: { headers: string[]; rows: string[][]; empty: string }) {
  if (rows.length === 0) return <div className="admin-table-empty"><InboxIcon size={20} /><span>{empty}</span></div>;
  return (
    <div className="admin-table-wrap" tabIndex={0} aria-label="Scrollable records" role="region">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-void-700">
            {headers.map((header) => (
              <th scope="col" key={header} className="px-3 py-2 text-left text-xs font-medium text-cream-400 uppercase">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-void-700">
          {rows.map((row, index) => (
            <tr key={`${row[0]}-${index}`}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-2 text-cream-200">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
