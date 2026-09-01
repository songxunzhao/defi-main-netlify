# RealtyChain

A decentralized real estate platform built with React, Vite, and Web3 technologies.

## Features

- Browse and explore real estate properties
- JWT login against `/api/auth/login` (invalid passwords are rejected)
- Mock KYC application, admin review, wallet bind, then on-chain ONCHAINID + claim registration
- Admin catalog create/delete and on-chain offering deploy
- Transfer-restricted ERC-20 property shares with a USDC primary offering
- Wallet integration via RainbowKit (MetaMask, WalletConnect, and others)
- KYC-gated secondary asks (list / fill / cancel) and P2P share transfer
- Admin occupancy, appraisal calendar, NAV per share, and monthly expense waterfall
- KYC-gated Get USDC: demo MockUSDC mint plus optional MoonPay (not a bank)
- Listing CMS: OpenStreetMap embed, unit mix, illustrative comps (not an appraisal)
- Listing image service: landing hero from `/api/images/seed/hero.jpg`, plus admin upload/ingest
- Property-sale exit: freeze transfers, deposit USDC proceeds, holders burn shares for a snapshot payout
- Chain event indexer (buys, rent claims, fills, transfers, redemptions) with average cost basis
- Authenticated document vault and a demo tax worksheet CSV (not a K-1 or 1099)
- Support for multiple chains (Ethereum, Polygon, Optimism, Arbitrum, Base, and Sepolia testnet)

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository and use Node.js 22:

   ```bash
   git clone <REPO_URL>
   cd DeFi-Estate-main-main
   nvm use 22
   ```

2. Start everything with one command:

   ```bash
   npm start
   ```

   The launcher automatically:

   - installs dependencies when they are missing;
   - starts a local Hardhat chain on port `8545`;
   - deploys MockUSDC and the RealtyChain protocol;
   - writes the generated contract addresses to `.env`;
   - starts the Express API on port `4000`, or the next free port if `4000` is busy;
   - starts the Vite app on port `3000`.

   Open [http://localhost:3000](http://localhost:3000). Keep the terminal open and press **Ctrl+C** to stop the complete stack.

3. Local seed accounts (created on first server start):
   - User: `test1@gmail.com` / `pass1234`
   - Admin: `admin@defi.estate` / `admin1234`

   Sign-in calls `POST /api/auth/login`. The catalog is served from `GET /api/properties` (JWT required).

   Buy path:
   1. Submit `/kyc` and have `admin@defi.estate` approve the application under Admin → Investors.
   2. Connect a wallet so it can be linked to the account.
   3. Admin **Register on-chain** (`InvestorOnboarder.onboard`) with the protocol deployer wallet. That deploys an ONCHAINID, issues demo KYC/accredited claims, and registers the wallet. `isVerified` is claim-backed, not a boolean whitelist.
   4. Investor approves USDC, then calls `Offering.buy(amount)` (`price * amount`). If the listing has a documents hash, the wallet signs an EIP-712 subscription first (`subscribe`).
   5. After someone holds shares, Admin → Contracts → **Deposit rent**. Holders **Claim** from My Dashboard.
   6. Holders **List** or **Send** shares from My Dashboard. Verified buyers **Fill** asks on Market. This is not an open DEX.
   7. Admin → Investors can **Freeze** a wallet, **Recover** identity + listing shares to a replacement, or **Move shares** (agent forced transfer). Frozen wallets cannot buy, transfer, claim, or redeem.
   8. Admin → Contracts → **Finalize** an escrowed raise (close window + min raise). Failed raises **Refund** from My Dashboard (burn + USDC).
   9. Admin → Contracts → **Enable exit** (needs outstanding shares) freezes transfers and pauses the sale. **Deposit proceeds**, then holders **Redeem** from My Dashboard or the property page. Unclaimed USDC stays in the vault.
   10. **Sync activity** (dashboard or Admin → Contracts) to index events. Export a demo tax CSV from My Dashboard → Transactions. Admin → Properties → **Docs** for the file vault.

   Admin origination: Admin → Add property (catalog, optional vault file), then **Deploy** to call `PropertyFactory.createListing`. Pause/unpause live offerings on the Contracts tab. Admin → Ops for occupancy, appraisals, and the monthly waterfall. Admin → Properties → **Edit listing** for copy, photos, map pin, unit mix, and comps (listing polish, not RWA). Seed deploy still creates listings for ids **1, 3, and 5**. Do not seed `createRedemption`; exit is per listing after shares exist.

4. To use MetaMask, add the local network:

   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency symbol: `ETH`

   Import one of the development accounts printed by Hardhat. These accounts and keys are for local testing only.

Optional MoonPay handoff (third-party; not a bank) can be added to `.env` with `VITE_MOONPAY_PUBLISHABLE_KEY` and `VITE_MOONPAY_SANDBOX=true`. The default local run uses the MockUSDC faucet.

## Deploy on Netlify

This repo is set up as a Vite static site plus a Netlify Function that wraps the Express API (`netlify.toml`, `netlify/functions/api.js`). Catalog, KYC, settings, listing images, and the document vault persist in [Netlify Blobs](https://docs.netlify.com/blobs/overview/) because Functions have no writable filesystem.

1. Push the repo and import it in Netlify (build command `npm run build`, publish directory `dist`, Node 22).
2. Set environment variables in the Netlify UI. At minimum:
   - `JWT_SECRET` — long random string
   - `DEMO_MODE=true` and `VITE_DEMO_MODE=true` (already defaulted in `netlify.toml`)
   - `VITE_WALLETCONNECT_PROJECT_ID` — from [WalletConnect Cloud](https://cloud.walletconnect.com) (MetaMask still works without it)
   - `ALLOWED_LOGIN_IPS` — comma-separated IPs that may sign in (for example `203.0.113.10,198.51.100.22`). Redeploy after changing this so the function picks it up.
3. For on-chain features, set the `VITE_*` contract addresses, `CHAIN_ID`, and a public `CHAIN_RPC_URL` (for example Sepolia). Do not point RPC at `127.0.0.1`. See `.env.example`.
4. Redeploy after changing any `VITE_*` variable so the frontend rebuilds.

Login is limited to the allowlist. Configure it in either place:

- **Netlify UI (recommended for deploy):** Site configuration → Environment variables → `ALLOWED_LOGIN_IPS`
- **In the app:** open `/adminuseradmin_useradminuser` on the live site (no login required), confirm **Your IP address**, and click **Allow this IP**. Extra addresses are stored in Netlify Blobs.

Default allowlist is only loopback (`127.0.0.1`), so a Netlify deploy will reject sign-in until you add your public IP with one of the methods above.

`/api/*`, `/health`, and `/ready` are proxied to the function. Client-side routes such as `/home` fall back to `index.html`.

Local production-like preview: `npx netlify dev` (after `npm install`) uses the same function + redirects. `npm start` remains the Hardhat + Vite interview stack.

## Available Scripts

- `npm start` - Install if needed, start Hardhat, deploy contracts, write `.env`, and start API + Vite
- `npm run dev` - Start only API + Vite (assumes chain, deployment, and `.env` already exist)
- `npm run build` - Build for production
- `npm run preview` - Preview a production build
- `npm run lint` - Run ESLint
- `npm test` - Run API tests and Hardhat contract tests
- `npm run deploy:protocol` - Deploy identity stack (topics, trusted issuers, ClaimIssuer, IdentityRegistry, InvestorOnboarder), MockUSDC (if needed), PropertyFactory, ShareMarket, and seed listings (`--network sepolia` or `base` after setting RPC + deployer key; see PRODUCTION.md)
- `npm run deploy:factory` - Legacy AssetFactory deploy (not used by the app)

## Tech Stack

- **Frontend**: React 18, Vite
- **Styling**: Tailwind CSS
- **Web3**: Wagmi, Viem, RainbowKit
- **Routing**: React Router DOM
- **Animations**: Framer Motion
- **Icons**: Lucide React

## Project Structure

```
src/
├── components/     # Reusable UI components
├── pages/         # Page components
├── context/       # React context providers
├── hooks/         # Data hooks (properties catalog, factory listings)
├── utils/         # Utility functions and types
└── styles/        # Global styles
server/
├── routes/        # Auth, properties, KYC, settings, activity, vault
└── mock/          # Seed users + property catalog
contracts/         # Identity stack (ONCHAINID + claims), PropertyShare, Offering, Distributor, ShareMarket, Redemption, PropertyFactory
```

