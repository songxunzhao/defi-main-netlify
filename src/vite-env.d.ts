/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_TESTNETS: string
  readonly VITE_WALLETCONNECT_PROJECT_ID: string
  readonly VITE_IDENTITY_REGISTRY_ADDRESS: string
  readonly VITE_CLAIM_ISSUER_ADDRESS: string
  readonly VITE_INVESTOR_ONBOARDER_ADDRESS: string
  readonly VITE_USDC_ADDRESS: string
  readonly VITE_PROPERTY_FACTORY_ADDRESS: string
  readonly VITE_SHARE_MARKET_ADDRESS: string
  readonly VITE_DEMO_MODE: string
  readonly VITE_ALLOWED_CHAINS: string
  readonly VITE_ENABLE_LOCAL: string
  readonly VITE_MOONPAY_PUBLISHABLE_KEY: string
  readonly VITE_MOONPAY_SANDBOX: string
  readonly VITE_SIMULATE_WALLET_EXTENSION_ERROR: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
