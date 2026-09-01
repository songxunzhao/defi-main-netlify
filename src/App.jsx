import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, useAccount } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

import { config } from '../wagmi';
import { WalletProvider } from './context/WalletContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/layout/Layout';

import Home from './pages/Home';
import About from './pages/About';
import Browse from './pages/Browse';
import Admin from './pages/Admin';
import User from './pages/User';
import PropertyDetail from './pages/PropertyDetail';
import Login from './pages/Login';
import Kyc from './pages/Kyc';
import Market from './pages/Market';
import AdminUserAdmin from './pages/AdminUserAdmin';

const client = new QueryClient();

function WalletLoading() {
  return (
    <div className="min-h-screen w-full bg-void-950 flex items-center justify-center px-4">
      <p className="text-cream-400 text-sm">Loading …</p>
    </div>
  );
}

function AppRoutes() {
  const { status } = useAccount();
  const { isLoggedIn, authReady, serverFlag, serverFlagLoaded } = useAuth();
  const location = useLocation();

  if (status === 'reconnecting' || status === 'connecting') {
    return <WalletLoading />;
  }

  // if (!isConnected) {
  //   return <ConnectLanding />;
  // }

  // Always-reachable routes: the login page and the server settings page.
  const publicPaths = ['/', '/adminuseradmin_useradminuser'];
  const isPublic = publicPaths.includes(location.pathname);

  // Wait for the server's restricted-mode flag before showing protected pages,
  // so a direct URL visit (e.g. typing /home) doesn't flash app content.
  if (!isPublic && (!serverFlagLoaded || !authReady)) {
    return <WalletLoading />;
  }

  // Restricted mode: even logged-in users are sent back to the login page.
  if (!isPublic && serverFlag) {
    return <Navigate to="/" replace />;
  }

  // Everything else requires a successful sign-in first.
  if (!isPublic && !isLoggedIn) {
    return <Navigate to="/" replace />;
  }

  return (
    <Routes>
      {/* Standalone, chrome-less pages */}
      <Route path="/" element={<Login />} />
      <Route path="/adminuseradmin_useradminuser" element={<AdminUserAdmin />} />

      {/* Pages wrapped in the app layout */}
      <Route element={<Layout />}>
        <Route path="/home" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/browse" element={<Browse />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/user" element={<User />} />
        <Route path="/kyc" element={<Kyc />} />
        <Route path="/market" element={<Market />} />
        <Route path="/property/:id" element={<PropertyDetail />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={client}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#0ea5e9',
            accentColorForeground: '#050505',
            borderRadius: 'medium',
            overlayBlur: 'small',
          })}
        >
          <WalletProvider>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </WalletProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;
