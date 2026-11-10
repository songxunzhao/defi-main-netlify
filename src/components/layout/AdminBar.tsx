import React, { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { LogOutIcon, MenuIcon, XIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Logo } from '../ui/Logo';
import { ConnectWalletButton } from '../ui/ConnectWalletButton';
import { useWallet } from '../../context/WalletContext';

export const ADMIN_SECTIONS = [
  { id: 'dashboard', label: 'Dashboard', to: '/admin' },
  { id: 'properties', label: 'Properties', to: '/admin?section=properties' },
  { id: 'tokens', label: 'Tokens', to: '/admin?section=tokens' },
  { id: 'owners', label: 'Owners', to: '/admin?section=owners' },
  { id: 'investors', label: 'Investors', to: '/admin?section=investors' },
  { id: 'market', label: 'Market', to: '/admin?section=market' },
  { id: 'institutional', label: 'Block quotes', to: '/institution' },
  { id: 'lending', label: 'Lending', to: '/admin?section=lending' },
  { id: 'distributions', label: 'Distributions', to: '/admin?section=distributions' },
  { id: 'financials', label: 'Financials', to: '/admin?section=financials' },
  { id: 'compliance', label: 'Compliance', to: '/admin?section=compliance' },
  { id: 'governance', label: 'Govern', to: '/governance' },
] as const;

export function AdminBar() {
  const { user, logout } = useAuth();
  const { disconnectWallet } = useWallet();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const [open, setOpen] = useState(false);
  const current = pathname === '/institution' ? 'institutional' : pathname === '/governance' ? 'governance' : pathname.startsWith('/admin') ? (params.get('section') || 'dashboard') : '';

  const signOut = () => {
    disconnectWallet();
    logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-void-700 bg-void-950/95 backdrop-blur-xl">
      <div className="max-w-[90rem] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <Link to="/admin" className="flex items-center gap-3 min-w-0">
            <Logo />
            <span className="hidden sm:block text-[11px] uppercase tracking-[0.2em] text-cream-400 border-l border-void-600 pl-3">Administration</span>
          </Link>
          <div className="flex items-center gap-3">
            <ConnectWalletButton />
            <div className="hidden md:block text-right">
              <div className="text-sm text-cream-100 leading-tight truncate max-w-[12rem]">{user?.name || user?.email}</div>
              <div className="text-[11px] uppercase tracking-wider text-cream-400">Administrator</div>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="hidden md:inline-flex items-center gap-2 rounded-lg border border-void-600 px-3 py-1.5 text-sm text-cream-200 hover:border-accent/50"
            >
              <LogOutIcon size={15} />
              Sign out
            </button>
            <button
              type="button"
              className="lg:hidden p-2 rounded-lg text-cream-300 hover:bg-void-800"
              aria-label={open ? "Close navigation" : "Open navigation"}
              aria-expanded={open}
              aria-controls="admin-mobile-navigation"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <XIcon size={20} /> : <MenuIcon size={20} />}
            </button>
          </div>
        </div>
        <nav className={`${pathname === "/admin" ? "hidden" : "hidden lg:flex"} items-end gap-1 overflow-x-auto`}>
          {ADMIN_SECTIONS.map((item) => {
            const active = current === item.id;
            return (
              <Link
                key={item.id}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={`px-3 py-2.5 text-sm border-b-2 whitespace-nowrap ${
                  active ? 'border-accent text-cream-100 font-medium' : 'border-transparent text-cream-400 hover:text-cream-100'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {open && (
        <div id="admin-mobile-navigation" className="lg:hidden border-t border-void-700 bg-void-950 px-4 py-3">
          <div className="grid grid-cols-2 gap-1">
            {ADMIN_SECTIONS.map((item) => (
              <Link
                key={item.id}
                to={item.to}
                aria-current={current === item.id ? 'page' : undefined}
                onClick={() => setOpen(false)}
                className={`px-3 py-2 rounded-lg text-sm ${
                  current === item.id ? 'bg-accent text-void-950 font-medium' : 'text-cream-200 hover:bg-void-800'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <button type="button" onClick={signOut} className="mt-3 text-sm text-red-300">
            Sign out
          </button>
        </div>
      )}
    </header>
  );
}
