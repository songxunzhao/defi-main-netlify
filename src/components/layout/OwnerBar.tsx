import React, { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { LogOutIcon, MenuIcon, PlusIcon, XIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Logo } from '../ui/Logo';
import { ConnectWalletButton } from '../ui/ConnectWalletButton';
import { useWallet } from '../../context/WalletContext';

export const OWNER_LINKS = [
  { id: 'dashboard', label: 'Dashboard', to: '/user' },
  { id: 'add', label: 'Add property', to: '/user?tab=add' },
  { id: 'funding', label: 'Funding', to: '/user?tab=funding' },
  { id: 'fundraising', label: 'Fundraising', to: '/user?tab=fundraising' },
  { id: 'tokenize', label: 'Tokenize', to: '/user?tab=tokenize' },
  { id: 'financing', label: 'Financing', to: '/user?tab=financing' },
  { id: 'governance', label: 'Govern', to: '/governance' },
] as const;

export function OwnerBar() {
  const { user, logout } = useAuth();
  const { disconnectWallet } = useWallet();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const [open, setOpen] = useState(false);
  const current = pathname === '/governance' ? 'governance' : pathname.startsWith('/user') ? (params.get('tab') || 'dashboard') : '';

  return (
    <header className="sticky top-0 z-50 w-full border-b border-void-700 bg-void-950/95 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          <Link to="/user" className="flex items-center gap-3 min-w-0">
            <Logo />
            <span className="hidden sm:block text-[11px] uppercase tracking-[0.2em] text-cream-400 border-l border-void-600 pl-3">Owner</span>
          </Link>
          <div className="flex items-center gap-2">
            <ConnectWalletButton />
            <Link
              to="/user?tab=add"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-void-950"
            >
              <PlusIcon size={15} />
              Add property
            </Link>
            <div className="hidden md:block text-right">
              <div className="text-sm text-cream-100 leading-tight truncate max-w-[12rem]">{user?.name || user?.email}</div>
              <div className="text-[11px] uppercase tracking-wider text-cream-400">Property owner</div>
            </div>
            <button
              type="button"
              onClick={() => {
                disconnectWallet();
                logout();
                navigate('/');
              }}
              className="hidden md:inline-flex items-center gap-2 rounded-lg border border-void-600 px-3 py-1.5 text-sm text-cream-200 hover:border-accent/50"
            >
              <LogOutIcon size={15} />
              Sign out
            </button>
            <button
              type="button"
              className="lg:hidden p-2 rounded-lg text-cream-300 hover:bg-void-800"
              aria-label="Open owner menu"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <XIcon size={20} /> : <MenuIcon size={20} />}
            </button>
          </div>
        </div>
        <nav className="hidden lg:flex items-end gap-1">
          {OWNER_LINKS.map((item) => {
            const active = current === item.id;
            return (
              <Link
                key={item.id}
                to={item.to}
                className={`px-3 py-2.5 text-sm border-b-2 whitespace-nowrap ${
                  active ? 'border-accent text-cream-100 font-medium' : 'border-transparent text-cream-400 hover:text-cream-100'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        {open && (
          <div className="lg:hidden grid grid-cols-2 gap-2 pb-4">
            {OWNER_LINKS.map((item) => (
              <Link
                key={item.id}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-lg border border-void-700 px-3 py-2 text-sm text-cream-100"
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
