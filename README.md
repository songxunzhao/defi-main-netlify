# RealtyChain

A decentralized real estate platform built with React, Vite, and Web3 technologies.

## Features

- Browse and explore real estate properties
- JWT login against `/api/auth/login` (invalid passwords are rejected)
- Mock KYC application, admin review, and Solana wallet bind
- Admin catalog create/delete and property operations
- Property shares settled on the Solana program, with USDC as the cash leg. Each property is a Token-2022 mint with a freeze authority, a permanent delegate, and a transfer hook. The program config account stores the admin, the trusted issuer, the USDC mint, KYC claim topic 1, accredited claim topic 2, and whether holders must be verified
- Wallet connection via Phantom and Solflare
- KYC-gated secondary asks (list / fill / cancel) and P2P share transfer
- Admin occupancy, appraisal calendar, NAV per share, and monthly expense waterfall
- KYC-gated Get USDC: demo mint on the Solana program, plus optional MoonPay (not a bank)
- Listing CMS: OpenStreetMap embed, unit mix, illustrative comps (not an appraisal)
- Listing image service: landing hero from `/api/images/seed/hero.jpg`, plus admin upload/ingest
- Property-sale exit: freeze transfers, deposit USDC proceeds, holders burn shares for a snapshot payout
- Chain event indexer (buys, rent claims, fills, transfers, redemptions) with average cost basis
- Authenticated document vault and a demo tax worksheet CSV (not a K-1 or 1099)
- Solana devnet by default, with an institutional Corda desk that settles a commitment onto that program

## Property liquidity and scheduled exits

Each property detail page and the Exchange include an account-backed liquidity panel. Investors can post buy bids that reserve their full USDC value, cancel unfilled bids, inspect account-only depth and recent settlements, and estimate selling proceeds across bid levels. Synthetic orders, illustrative prints, and fills against the synthetic book are excluded from these liquidity metrics. NAV comparisons require an appraisal record.

Exit requests reserve unpledged, unreserved shares and specify a minimum price and a Friday 16:00 UTC processing window (next, second, or fourth). Once eligible, an investor can trigger processing of the property queue through their own active request. Earlier eligible requests are matched first against reserved account bids, at or above each seller's minimum price. Self-matching is excluded. Partial fills credit proceeds immediately in the application ledger; cancellation releases only the unfilled remainder. The tracker records window eligibility, queue position, settled shares, proceeds, and history. There is no background scheduler, guaranteed buyer, or guaranteed settlement date.

These features use application-ledger balances, including seeded balances when `DEMO_MODE=true`; they do not establish wallet escrow, bank funding, on-chain execution, or a property buyback facility. Existing Solana wallet asks and property-sale redemption remain separate flows. Existing historical trade records may have been truncated by older versions; metrics cannot reconstruct deleted history.

Authenticated endpoints under `/api/market/liquidity/:propertyId` provide the snapshot, `POST /bids`, `DELETE /bids/:id`, `POST /exits`, `DELETE /exits/:id`, and `POST /exits/:id/process`. Read retries are supported through the existing storage snapshot workflow; writes are never automatically replayed after a storage conflict.

## Income records, recurring purchases, and institutional quotes

Property pages now include source-referenced monthly income reports and the investor's own completed ledger distributions. Admins can record reports and pay eligible registered ledger holders from the property's owner funding account, either on the property page or Admin → Distributions. A report alone never credits cash. Reports are admin-attested and not independently verified. Old projection postings remain labeled as payment-unconfirmed. Payouts use the catalog share supply as the denominator; unallocated amounts remain with the funding account. Wallet-only holdings are outside this ledger payout flow.

Verified, accredited investor accounts can authorize weekly or monthly purchase plans and reinvestment of new completed ledger distributions. Plans enforce a USDC budget, maximum share price, start date, and active/paused/cancelled status. They buy whole shares from account-backed sell orders, skip synthetic asks and self-trades, and respect cash reservations. One successful attempt completes a scheduled cycle or consumes a distribution's reinvestment eligibility; unused budget stays in cash. Failed attempts spend nothing and can be retried. The service skips missed schedule cycles rather than accumulating catch-up spending. Users can run due plans manually from the property page.

For automatic execution on Netlify, set a random server-only `INVESTMENT_SCHEDULER_SECRET` of at least 32 characters in the Functions environment and deploy. `netlify/functions/investment-plans.mjs` runs daily at 14:00 UTC and calls the authenticated API endpoint through the normal transaction middleware. No secret is bundled into the client. Without this configuration the UI clearly reports manual processing. Production scheduling follows [Netlify Scheduled Functions](https://docs.netlify.com/build/functions/scheduled-functions/); branch previews and local development do not run a background schedule. The runner processes up to 200 eligible plans per invocation and does not automatically retry a conflicting write.

Lending uses prospective utilization-based APRs: 2% base borrowing APR, 8% at 80% utilization, then up to 68% at full utilization. Supply APR is borrow APR × utilization × 85%. Fifteen percent of borrower interest actually repaid is retained as a protected cash reserve and excluded from borrowable/withdrawable liquidity. Existing balances accrue their historical rate once during migration; subsequent accrual uses the last applied variable rate, retaining fractional cents. The lending desk separates interest received, interest withdrawn, accrued liabilities, and reserves.

Institutions and operators access private all-or-none block quotes at `/institution` (Admin → Block quotes). A verified institution requests a block, the operator proposes a funded counterparty and terms, that counterparty confirms and reserves assets, and the requester accepts and reserves its side. The operator can then settle within 48 hours. Quote expiry or cancellation releases outstanding reservations. Both participants must remain verified and unrestricted. Settlements conserve ledger cash and shares and create a trade reference and history. This workflow does not submit bank payments or Corda/Solana transactions; the existing bridge records remain separate.

## Owner fundraising dashboard

Owners can open **Fundraising** in the owner navigation (`/user?tab=fundraising`) to see campaign targets, deadlines, and recorded application-ledger funding alongside a private investor pipeline. Add and edit prospects with an amount, contact details, follow-up date, notes, and an interested, signed commitment, or withdrawn stage. Signed commitments require a document reference; references are operator-entered and are not independently verified or electronically signed by this feature.

Interest and signed commitments are separate pipeline stages. They do not move cash, reserve funds, issue shares, or increase campaign funding. Campaign progress comes only from the existing campaign's `raised` field; it may include demo balances and does not establish bank receipt or on-chain settlement. Withdrawn prospects remain in the history and are excluded from active pipeline amounts and due follow-ups. Follow-up dates are reminders in the dashboard; no email or background notification is sent.

Authenticated `/api/fundraising` reads return only an owner's properties and prospects; active admins can access all properties through the API. `POST /api/fundraising/prospects` creates a record and `PATCH /api/fundraising/prospects/:id` updates it with the last read `version`. Duplicate emails within one property are rejected, and each change records an attributed history snapshot. Stale edits return 409; refresh and reopen the record before retrying. Prospect data uses the existing persistence backend and is kept outside public catalog responses.

## Sample property documents

One reference property, Luxury Downtown Apartment, supplies three shared two-page PDFs: Property Deed, Financial Projections, and Inspection Report. All catalog listings link to this same set, rather than storing copies per property. Download them from the property Documents section or the admin vault. Every page is marked as a fictional sample: deeds are unsigned and unrecorded, projections disclose assumptions, and inspection findings are invented rather than site observations.

The three PDFs are bundled as `sample-deed.pdf`, `sample-financials.pdf`, and `sample-inspection.pdf` in `server/assets/vault/`, served through the authenticated `/api/vault/seed/:file` route. Netlify includes `server/assets/**`; Vercel includes these assets through `server/**`. Older property-specific sample URLs remain aliases to the shared set. Existing document links are upgraded, preserving uploaded files and earlier admin removals.

To regenerate with Python 3, ReportLab, and Node on PATH:

```bash
python3 scripts/generate_sample_documents.py --bundle
```

This generates only the reference property's three documents, with review/download copies in `output/pdf/` and deployment copies in `server/assets/vault/`. Financial assumptions use the reference property's catalog data: 3% annual rent growth, 2.5% expense/reserve growth, and an 80% distribution of positive cash after reserves. These sample assumptions do not describe other properties, amend any DAO agreement, or promise returns.

## Govern ticket flow

The DAO agreement is between investors, the SPV, and the property owner. Govern records performance of duties under that agreement. The SPV is the primary accountable party for coordinating tickets; assignment to the property owner does not remove SPV coordination responsibility.

1. **Configure:** Admin → Govern → SPV and DAO agreement setup records each property's SPV legal name, agreement/document reference and version, and authorized representative. Representatives use explicitly designated admin accounts in the existing account system; being a platform admin does not by itself make someone the SPV representative. Configuration changes are recorded in the property's agreement history. The app does not seed fictitious legal parties or verify authority or agreement validity.
2. **Submit and respond:** an investor holding property shares opens a budget, sale, manager, or distribution proposal. Its creator, accountable SPV, SPV response contact, and property owner are shown. The SPV coordinates the response. The property's owner and platform admins can also post attributed responses. Missing SPV details are explicitly flagged for admin setup.
3. **Vote:** investor shareholders vote for or against, weighted by their current app share balance when they cast or change their vote. At the deadline, turnout must reach the recorded quorum and votes for must exceed votes against. Ties and missed quorum reject the proposal. New proposals use a quorum of 20% of `tokensSold` (rounded), with a minimum of 20 shares. Windows are 3, 7, 14, or 30 days, with at most three open votes per property. These are app voting rules; the agreement must authorize the decision. There is no share snapshot or on-chain governance execution.
4. **SPV review and assignment:** a passed proposal requires SPV review. Only the recorded SPV representative can assign work to the listed property owner or to itself, with a target completion date (end of that day, UTC). The assignment note should identify the relevant agreement clause, scope, and timing. Assignment records a copy of the SPV/representative/agreement configuration, so subsequent configuration changes do not silently change existing work obligations in the record.
5. **Acknowledge:** only the assigned party acknowledges its duty. The duty remains governed by the DAO agreement before acknowledgment; lack of a click does not waive it or transfer it to another party. The app distinguishes assignment from acknowledgment and shows overdue assigned work even if unacknowledged.
6. **Track:** the assigned party or recorded SPV representative reports blockers, resumes work, and reports completion from the in-progress stage. A blocker before acknowledgment must return to acknowledgment when resumed. Each action requires a note and adds an attributed, timestamped history entry. Completion is self-reported; notes should reference supporting documents. Blockers document issues and do not automatically excuse duties. Historical acceptance records are preserved and explicitly labeled for SPV review.

`PUT /api/governance/properties/:propertyId/agreement` is admin-only and takes `spvName`, `representativeId`, and `reference`. `POST /api/governance/:id/respond` takes `action` (`respond`, `assign`, `acknowledge`, `block`, `resume`, `complete`) and `note`; assignment also requires `dueAt` (`YYYY-MM-DD`) and `assignee` (`owner` or `spv`). Permissions and transitions are enforced on the server. Records use existing app persistence.

The agreement defines response deadlines, permitted refusal reasons, escalation, remedies, and the effect of approved votes. This implementation does not invent those terms or enforce them automatically, validate agreements, execute contracts, release funds, or send notifications. Follow up with the SPV when tickets stall; contact a platform admin if the representative is missing. The recorded target date does not override contractual deadlines.

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
   - starts the Express API on port `4000`, or the next free port if `4000` is busy;
   - starts the Vite app on port `3000`.

   Open [http://localhost:3000](http://localhost:3000). Keep the terminal open and press **Ctrl+C** to stop the complete stack.

3. Local seed accounts (created on first server start):
   - User: `test1@gmail.com` / `pass1234`
   - Admin: `admin@defi.estate` / `admin1234`
   - Property owner: `owner@defi.estate` / `owner1234`
   - Institution: `institution@defi.estate` / `institution1234` (Corda desk at `/institution`; Solana sees the settlement only)

   Sign-in calls `POST /api/auth/login`. The catalog is served from `GET /api/properties` (JWT required).

   Buy path:
   1. Submit `/kyc` and have `admin@defi.estate` approve the application under Admin → Investors.
   2. Connect Phantom or Solflare and link that address on the account.
   3. Buy, list, transfer, claim, and redeem from the demo ledger. When `VITE_SOLANA_PROGRAM_ID` is set, those actions also send the matching program instruction.
   4. Export a demo tax CSV from My Dashboard → Transactions. Admin → Properties → **Docs** for the file vault.

   Admin origination: Admin → Add property. Admin → Ops for occupancy, appraisals, and the monthly waterfall. Admin → Properties → **Edit listing** for copy, photos, map pin, unit mix, and comps.

4. Use **Connect Wallet** to choose Solana (Phantom, Solflare, and Wallet Standard wallets) or an installed Ethereum/EVM browser wallet, such as MetaMask. Ethereum wallets are discovered individually through EIP-6963, with a legacy injected-provider fallback; no wallet API key is required. Ethereum connections display the address and chain ID, follow account/network changes, and can be disconnected from the app. Solana remains the network for account linking and RealtyChain on-chain actions; Ethereum connection does not enable Ethereum trading or wallet-based sign-in. Mobile wallets need to expose a compatible provider through their in-app browser; WalletConnect QR pairing is not included. The default Solana cluster is devnet (`VITE_SOLANA_RPC_URL`). On-chain actions use the RealtyChain program in `programs/realty_chain` after `VITE_SOLANA_PROGRAM_ID` is set to the deployed program address.

Optional MoonPay handoff (third-party; not a bank) can be added to `.env` with `VITE_MOONPAY_PUBLISHABLE_KEY` and `VITE_MOONPAY_SANDBOX=true`. The default local run uses the demo USDC mint on the Solana program.

## Deploy with PostgreSQL on Vercel or Netlify

For Vercel, create **Neon → PostgreSQL** in Storage/Marketplace and connect it to this project. Neon has a free plan; use the integration's pooled `DATABASE_URL`. Keep the existing private Blob store for uploaded images and documents. PostgreSQL is also supported on Netlify with the same database environment variables.

Set these server environment variables, then deploy the updated code:

- `DATABASE_URL` — pooled PostgreSQL connection URL, including its TLS parameters
- `DATA_STORAGE_PROVIDER=postgres` — requires PostgreSQL and prevents a silent fallback
- `DATA_NAMESPACE=production` — use the same value on both hosts to share records
- `JWT_SECRET` — a long random secret; preserve the existing value to retain valid tokens
- `ALLOWED_LOGIN_IPS` — your public sign-in addresses
- `DEMO_MODE=true` and `VITE_DEMO_MODE=true` for the hosted demo

On Vercel, retain the private Blob store credentials and `STORAGE_PROVIDER=vercel` for files. On Netlify, files can continue using Netlify Blobs. Keep server credentials free of the `VITE_` prefix. Preview/development deployments should use a different database branch or `DATA_NAMESPACE`.

For Netlify's fully managed Database, the app also accepts the automatically supplied `NETLIFY_DB_URL`. In Project configuration → Environment variables, add `DATA_STORAGE_PROVIDER=postgres` and `DATA_NAMESPACE=production` with Functions scope (or all scopes), then deploy this code. You do not need to copy the managed connection URL into `DATABASE_URL`. An explicitly configured `DATABASE_URL` takes precedence; remove that override if you want to use the Netlify-managed database. A separate Netlify database has separate records from the Vercel database, even when both use the same namespace.

The app creates `realtychain_records` automatically. Existing app state is stored in a JSONB record; settings and login history use separate records. Each request uses a database transaction and a namespace lock across function instances, so simultaneous saves wait rather than rejecting each other through Blob version checks. This retains the current service model while moving persistence into PostgreSQL. Binary files remain in object storage.

After deploying, check `/health`, sign in, and open Market, Lend, and Govern. A brand-new database starts with demo seed data. Existing Blob records are preserved in the old store and are not automatically copied.

### Preserve existing Vercel Blob records

Run the migration during a maintenance window while users are not changing the old deployment. Configure the old private store's credentials, `BLOB_PREFIX=realtychain/production` (or its actual prefix), the new `DATABASE_URL`, and `DATA_NAMESPACE=production` locally in `.env`.

```bash
npm run migrate:postgres
npm run migrate:postgres -- --apply
```

The first command reads the source and prints record counts without writing to PostgreSQL. The second copies app state, settings, and login history in one SQL transaction. It leaves Blob data and uploaded files untouched. If the SQL destination already contains app data, migration refuses replacement. Inspect it before deliberately using `--apply --replace-existing`; this makes a backup under a separate database namespace before replacing the destination records.

To run the real PostgreSQL integration tests, point `TEST_DATABASE_URL` at a disposable database on localhost. Tests refuse non-local URLs and clean up their own namespaces. Without that variable, the PostgreSQL integration test is skipped.

## Deploy on Netlify

This repo is set up as a Vite static site plus a Netlify Function that wraps the Express API (`netlify.toml`, `netlify/functions/api.js`). Catalog, KYC, settings, listing images, and the document vault persist in [Netlify Blobs](https://docs.netlify.com/blobs/overview/) because Functions have no writable filesystem.

1. Push the repo and import it in Netlify (build command `npm run build`, publish directory `dist`, Node 22).
2. Set environment variables in the Netlify UI. At minimum:
   - `JWT_SECRET` — long random string
   - `DEMO_MODE=true` and `VITE_DEMO_MODE=true` (already defaulted in `netlify.toml`)
   - `VITE_SOLANA_RPC_URL` — Solana cluster URL (devnet by default). Phantom and Solflare connect without a WalletConnect id.
   - `VITE_SOLANA_PROGRAM_ID` — deployed `programs/realty_chain` address, when transactions should land.
   - `ALLOWED_LOGIN_IPS` — comma-separated IPs that may sign in (for example `203.0.113.10,198.51.100.22`). Redeploy after changing this so the function picks it up.
3. See `.env.example` for the Solana mint and RPC variables.
4. Redeploy after changing any `VITE_*` variable so the frontend rebuilds.

Login is limited to the allowlist. Configure it in either place:

- **Netlify UI (recommended for deploy):** Site configuration → Environment variables → `ALLOWED_LOGIN_IPS`
- **In the app:** open `/adminuseradmin_useradminuser` on the live site (no login required), confirm **Your IP address**, and click **Allow this IP**. Extra addresses are stored in Netlify Blobs.

Allowlist reads use strong consistency so a saved address is available to the next login request. The settings page also shows the last ten sign-in addresses and the last successful login for up to ten addresses, persisted in the site-wide `login-activity` Blobs store. These are login records, not live sessions. Activity starts accumulating after deploying this version; earlier in-memory records cannot be recovered.

Default allowlist is only loopback (`127.0.0.1`), so a Netlify deploy will reject sign-in until you add your public IP with one of the methods above.

`/api/*`, `/health`, and `/ready` are proxied to the function. Client-side routes such as `/home` fall back to `index.html`.

Local production-like preview: `npx netlify dev` (after `npm install`) uses the same function + redirects. `npm start` starts the API and Vite.

## Deploy on Vercel with a private Blob store

The Vite frontend and Express API deploy together using `vercel.json` and `api/index.js`. The API stores JSON records, settings, login activity, images, and vault files in **private Vercel Blob storage**. File downloads continue through the existing API routes; vault routes still require authentication.

1. Import the repository into Vercel. Use the Vite preset, `npm run build`, output directory `dist`, and Node.js 22.
2. Connect your **private** Blob store to this project and the intended environment. Use the credentials Vercel provides: `BLOB_STORE_ID` with platform OIDC, or `BLOB_READ_WRITE_TOKEN`. These are server-only variables; never use a `VITE_` prefix.
3. Set `STORAGE_PROVIDER=vercel`, a long random `JWT_SECRET`, `DEMO_MODE=true`, `VITE_DEMO_MODE=true`, and your public IP in `ALLOWED_LOGIN_IPS`. Add the optional Solana and Sumsub variables from `.env.example` as needed. When using Sumsub webhooks, also set `NODEJS_HELPERS=0` in the project environment so Express can capture the original signed request bytes.
4. Deploy. Open `/health`, then `/adminuseradmin_useradminuser` to check your detected IP and the allowlist. Sign in and check that the recent successful login appears. Change a listing or upload a file and verify that it remains available after redeploying.

Reads bypass Blob caching. API requests reload the latest saved snapshot, wait for uploads and data commits, and return a conflict (409) if another instance changed the snapshot first. Market, Lend, and Govern reads automatically reload and retry their setup or accrual calculations up to three times after a conflict. Unchanged lending views avoid unnecessary writes. Order, lending, and voting submissions are not automatically replayed. Refresh before retrying a conflicting change. This remains a demo JSON snapshot store, with no database transactions spanning records, uploads, or external chain operations.

By default, blob paths are namespaced under `realtychain/<VERCEL_ENV>/` (`realtychain/development/` locally). Set `BLOB_PREFIX` for a different namespace, such as a separate preview branch. Use separate stores or prefixes for production and testing. A new store starts with demo seeds; existing Netlify data is **not** copied automatically.

For local use of Vercel Blob, put `STORAGE_PROVIDER=vercel` and the private store's `BLOB_READ_WRITE_TOKEN` in `.env`, using a development store/prefix. Without these variables, local development continues using files. Netlify deployments continue using Netlify Blobs unless Vercel storage is explicitly selected or its credentials are configured.

## Available Scripts

- `npm start` - Install if needed, then start the API and Vite
- `npm run dev` - Start the API and Vite
- `npm run build` - Build for production
- `npm run preview` - Preview a production build
- `npm run lint` - Run ESLint
- `npm test` - Run the API tests

## Tech Stack

- **Frontend**: React 18, Vite
- **Styling**: Tailwind CSS
- **Chain**: Solana (`@solana/web3.js`, Phantom, Solflare) and the program in `programs/realty_chain`
- **Routing**: React Router DOM
- **Animations**: Framer Motion
- **Icons**: Lucide React

## Project Structure

```
src/
├── components/     # Reusable UI components
├── pages/         # Page components
├── context/       # React context providers
├── hooks/         # Data hooks (properties catalog, Solana reads)
├── utils/         # Utility functions and types
└── styles/        # Global styles
server/
├── routes/        # Auth, properties, KYC, settings, activity, vault
└── mock/          # Seed users + property catalog
programs/realty_chain/  # Solana program: buys, transfers, compliance config, Corda settlement
```

