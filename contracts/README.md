# RealtyChain – Smart Contracts

Transfer-restricted ERC-20 property shares, a USDC primary offering, a rent distributor, a KYC-gated secondary ask book, and a snapshot sale-exit vault. OpenZeppelin **4.9.x** is required (`_beforeTokenTransfer`, `_setupRole` / `_grantRole` patterns).

This is not a full ERC-3643 / T-REX stack, and it is not a live securities offering. Identity is ERC-3643-shaped (ONCHAINID + claim topics + trusted issuers). The share token is still custom `PropertyShare`, **not** a T-REX Token. Claims are issued by the demo `ClaimIssuer` after mock admin KYC — not Persona/Sumsub. Freeze, forced transfer, and recover stay as platform-agent controls on the shared registry.

---

## Contracts

### identity/ (ONCHAINID + claims)

- **Identity.sol** — compact ONCHAINID-shaped claim holder (ERC-735 subset). Investor is the management key; the platform issuer may add claims.
- **ClaimTopicsRegistry.sol** — required topics. Seed deploy adds `1` (KYC) and `2` (accredited).
- **TrustedIssuersRegistry.sol** — which issuers may stand behind those topics.
- **ClaimIssuer.sol** — demo issuer. `issueClaim` / `revokeClaim`. Not a KYC vendor.
- **IdentityDeployer.sol** — linked library so `InvestorOnboarder` does not embed `new Identity`.
- **InvestorOnboarder.sol** — `REGISTRAR_ROLE` helper: deploy identity, issue KYC (and accredited) claims, `registerIdentity` in one transaction. Admin **Register on-chain** calls `onboardIso(wallet, "US", accredited)` so `US` → `840` on-chain.

### IdentityRegistry.sol

Wallet → ONCHAINID + country. `isVerified(user)` is true only while the wallet is registered and every required topic has a valid, non-revoked claim from a trusted issuer. There is no `setVerified` boolean. Freeze is separate (`isFrozen`) so one freeze applies to every listing. `REGISTRAR_ROLE` calls `registerIdentity` / `deleteIdentity` / `updateIdentity`. `AGENT_ROLE` can `setAddressFrozen` and `recoverIdentity(lost, new)` (remaps the same identity onto an unregistered replacement, or requires the replacement already verified; unverifies and freezes the lost wallet). Purchases and secondary transfers require `isVerified` and not frozen.

### PropertyShare.sol

ERC-20 with **0 decimals** (1 token = 1 share). `MINTER_ROLE` mints. `BURNER_ROLE` burns via `burnFrom` (no allowance). Transfers require both parties verified and not frozen. If `unlockTime > 0`, secondary transfers revert until that timestamp. Optional `setDistributor` hooks rent accounting into transfers. `setTransfersFrozen` blocks mint and secondary transfer (`exit frozen`) but still allows burns unless the holder is frozen. `AGENT_ROLE` `forcedTransfer` bypasses lockup, listing freeze, and a frozen sender (recipient must still be verified and thawed). `recover` moves the full balance and parked rent after `recoverIdentity`.

### Offering.sol

Primary sale: USDC `transferFrom` the buyer, then mint `amount` shares. Cost is `price * amount` (USDC 6 decimals). Enforces cap, `minTicket`, `maxPerWallet`, and pause. If `closesAt > 0`, USDC is escrowed on the offering until admin `finalize()`; a failed `minRaise` lets holders `refund()` (burn + USDC). A non-zero `documentsHash` blocks unsigned `buy`; investors must `subscribe(amount, deadline, signature)` with an EIP-712 `Subscription` over that hash. Immediate-settle (no close time) still pays the beneficiary on buy.

### Distributor.sol

Pull USDC rent for one share token. Anyone may `deposit` USDC after shares exist. Holders `claim` their pro-rata balance. PropertyShare calls `sync` / `setDebtToBalance` on every transfer so new buyers and transferees cannot harvest past rent.

### ShareMarket.sol

Non-custodial ask book for factory listings. Seller `list`s amount + USDC price per share after approving the market. Buyer `fill`s; USDC goes to the seller and shares move seller → buyer so KYC and lockup stay on PropertyShare. Not an AMM.

### Redemption.sol

Sale-exit vault for one share token. Admin `open(amount)` pulls USDC and snapshots `proceeds` / `supplyAtOpen`. Holder `redeem(amount)` burns shares and receives `proceeds * shares / supplyAtOpen`. Rent `pending` on the distributor survives the burn via existing sync hooks. Unclaimed USDC stays in the vault (no sweep).

### PropertyFactory.sol

Shared identity registry + USDC. `createListing(...)` deploys a share token and offering (8-arg form is unsigned immediate-settle; 12-arg form adds max per wallet, min raise, close time, and documents hash). `createDistributor(propertyId)` attaches a rent pool (`getDistributor`). `createRedemption(propertyId)` pauses the offering, freezes transfers, deploys `Redemption`, and grants it `BURNER_ROLE` (`getRedemption`). Requires outstanding supply and no existing redemption.

Hardhat compiles this with `viaIR: true` (stack-too-deep otherwise). Share + offering bytecode lives in the linked `ListingDeployer` library; distributor and redemption go through `PoolDeployer`, so the factory stays under the 24KB size cap. Identity create goes through `IdentityDeployer` for the same reason.

### mocks/MockUSDC.sol

6-decimal ERC-20 with public `mint`. Used on local/test networks when `USDC_ADDRESS` is not set. The app **Get USDC** faucet calls `mint` after KYC; that fails on canonical USDC. This is not a bank or a live card on-ramp.

### AssetFactory.sol (legacy)

The original ETH-priced ERC-1155 factory. Kept for historical tests. The app no longer calls it.

---

## Deploy

```bash
npx hardhat test
npx hardhat run scripts/deploy-property-protocol.js --network sepolia
# Base (canonical USDC required):
# USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 npx hardhat run scripts/deploy-property-protocol.js --network base
```

Or `npm run deploy:protocol`. Optional env: `USDC_ADDRESS` to reuse an existing token. The script prints:

```
VITE_IDENTITY_REGISTRY_ADDRESS=...
VITE_CLAIM_ISSUER_ADDRESS=...
VITE_INVESTOR_ONBOARDER_ADDRESS=...
VITE_USDC_ADDRESS=...
VITE_PROPERTY_FACTORY_ADDRESS=...
VITE_SHARE_MARKET_ADDRESS=...
```

Seed listings are created for property ids **1, 3, 5**. USDC price on-chain is `usd * 1e6`.

The deployer is admin on the identity stack and `REGISTRAR_ROLE` on the onboarder. Use that wallet in Admin → Investors → Register on-chain (`InvestorOnboarder.onboard`). Seed deploy also calls `createDistributor` for each listing and deploys `ShareMarket`.

---

## App wiring

1. Set the `VITE_*` addresses in `.env` (registry, claim issuer, onboarder, USDC, factory, market).
2. Approve KYC in the app, link a wallet, then Register on-chain (ONCHAINID + KYC claims).
3. Buyer approves USDC to the offering, then `buy(amount)` (or `subscribe` if a documents hash is set). Frozen wallets cannot buy. Escrowed raises refund from the dashboard after a failed finalize.
4. Admin deposits net rent USDC into the listing’s distributor; holders claim from the dashboard (frozen wallets cannot claim).
5. Holders list or send shares. Verified, unfrozen buyers fill asks on `/market`.
6. Admin enables exit on a listing with outstanding shares, deposits net sale proceeds, then holders redeem (burn + USDC) from My Dashboard. Frozen holders cannot redeem until an agent unfreezes or recovers them.
7. Admin → Investors: freeze, recover (identity + listing shares), or forced-transfer shares.

ABIs live in `src/contracts/protocolAbi.ts`. Config is `src/contracts/config.ts`.
