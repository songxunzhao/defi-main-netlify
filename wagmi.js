import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  arbitrum,
  base,
  hardhat,
  mainnet,
  optimism,
  polygon,
  sepolia,
} from 'wagmi/chains';

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID';

const CHAIN_MAP = {
  mainnet,
  polygon,
  optimism,
  arbitrum,
  base,
  sepolia,
  hardhat,
};

function allowedChains() {
  const raw = (import.meta.env.VITE_ALLOWED_CHAINS || '').trim();
  if (raw) {
    const list = raw
      .split(',')
      .map((name) => CHAIN_MAP[name.trim()])
      .filter(Boolean);
    if (list.length) return list;
  }
  return [
    mainnet,
    polygon,
    optimism,
    arbitrum,
    base,
    ...(import.meta.env.VITE_ENABLE_TESTNETS === 'true' ? [sepolia, hardhat] : []),
  ];
}

export const config = getDefaultConfig({
  appName: 'RealtyChain',
  projectId,
  chains: allowedChains(),
  ssr: false,
});
