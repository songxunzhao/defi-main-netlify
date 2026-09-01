import { useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { useAuth } from '../context/AuthContext';
import { bindWallet } from '../utils/api';

/** Links the first connected wallet to the account. Does not overwrite an existing binding. */
export function useWalletLink() {
  const { address } = useAccount();
  const { user, refreshUser, isLoggedIn } = useAuth();
  const inFlight = useRef(false);

  useEffect(() => {
    if (!isLoggedIn || !address || !user) return;
    if (user.walletAddress) return;
    if (inFlight.current) return;
    inFlight.current = true;
    bindWallet(address)
      .then(() => refreshUser())
      .catch(() => {
        // Conflict or validation is shown on the dashboard / KYC surfaces.
      })
      .finally(() => {
        inFlight.current = false;
      });
  }, [address, isLoggedIn, user?.id, user?.walletAddress, refreshUser]);
}
