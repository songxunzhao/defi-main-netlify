import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { AnimatePresence, motion } from 'framer-motion';
import { XIcon } from 'lucide-react';

/**
 * Interview defect: show a fake browser-extension error instead of opening
 * the wallet modal. Flip this constant, or set
 * VITE_SIMULATE_WALLET_EXTENSION_ERROR=true|false in .env.
 */
const SIMULATE_WALLET_EXTENSION_ERROR_DEFAULT = false;

export function simulateWalletExtensionErrorEnabled(): boolean {
  const env = import.meta.env.VITE_SIMULATE_WALLET_EXTENSION_ERROR?.trim().toLowerCase();
  if (env === 'true') return true;
  if (env === 'false') return false;
  return SIMULATE_WALLET_EXTENSION_ERROR_DEFAULT;
}

const EXTENSION_ERROR = 'Could not reach your wallet browser extension.';

type ConnectWalletButtonProps = {
  showBalance?: boolean;
};

export function ConnectWalletButton({ showBalance = true }: ConnectWalletButtonProps) {
  const simulateExtensionError = simulateWalletExtensionErrorEnabled();
  const { isConnected } = useAccount();
  const [toastVisible, setToastVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  const hideToast = () => {
    clearTimeout(hideTimer.current);
    setToastVisible(false);
  };

  const showToast = () => {
    setToastVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(hideToast, 4500);
  };

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  const blockConnect = (event: React.SyntheticEvent) => {
    if (!simulateExtensionError || isConnected) return;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <>
      <div
        onPointerDownCapture={(event) => {
          if (!simulateExtensionError || isConnected) return;
          blockConnect(event);
          showToast();
        }}
        onClickCapture={blockConnect}
      >
        <ConnectButton showBalance={showBalance} />
      </div>
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {toastVisible && (
              <motion.div
                role="status"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="fixed top-5 right-5 z-[200] max-w-sm rounded-xl border border-amber-500/30 bg-void-800 px-4 py-3 shadow-xl"
              >
                <div className="flex items-start gap-3">
                  <p className="text-sm text-amber-100 leading-snug">{EXTENSION_ERROR}</p>
                  <button
                    type="button"
                    onClick={hideToast}
                    className="shrink-0 rounded-md p-0.5 text-cream-400 hover:text-cream-100"
                    aria-label="Dismiss"
                  >
                    <XIcon size={16} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
