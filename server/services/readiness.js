const { createPublicClient, http } = require('viem');

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const ZERO = '0x0000000000000000000000000000000000000000';
const DEFAULT_JWT = 'jwt_secret';
const LIVE_CHAIN_IDS = new Set([1, 8453]); // Ethereum, Base

function isProduction() {
  return process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production';
}

function isDemo() {
  if (process.env.DEMO_MODE === 'false') return false;
  if (isProduction() && process.env.DEMO_MODE !== 'true') return false;
  return true;
}

function envAddress(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value && ADDRESS_RE.test(value) && value.toLowerCase() !== ZERO) return value;
  }
  return '';
}

function chainId() {
  return Number(process.env.CHAIN_ID || 31337);
}

function rpcUrl() {
  return process.env.CHAIN_RPC_URL || 'http://127.0.0.1:8545';
}

function jwtConfigured() {
  const secret = process.env.JWT_SECRET || DEFAULT_JWT;
  return secret && secret !== DEFAULT_JWT && secret.length >= 24;
}

function check(id, label, status, detail) {
  return { id, label, status, detail };
}

async function pingRpc() {
  const client = createPublicClient({
    chain: {
      id: chainId(),
      name: 'ops',
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl()] } },
    },
    transport: http(rpcUrl(), { timeout: 2500 }),
  });
  const block = await client.getBlockNumber();
  const factory = envAddress('PROPERTY_FACTORY_ADDRESS', 'VITE_PROPERTY_FACTORY_ADDRESS');
  let factoryCode = false;
  if (factory) {
    const code = await client.getCode({ address: factory });
    factoryCode = Boolean(code && code !== '0x');
  }
  return { block: Number(block), factoryCode };
}

function staticChecks() {
  const demo = isDemo();
  const cid = chainId();
  const factory = envAddress('PROPERTY_FACTORY_ADDRESS', 'VITE_PROPERTY_FACTORY_ADDRESS');
  const identity = envAddress('IDENTITY_REGISTRY_ADDRESS', 'VITE_IDENTITY_REGISTRY_ADDRESS');
  const usdc = envAddress('USDC_ADDRESS', 'VITE_USDC_ADDRESS');
  const market = envAddress('SHARE_MARKET_ADDRESS', 'VITE_SHARE_MARKET_ADDRESS');
  const jwtOk = jwtConfigured();
  const bounty = process.env.BUG_BOUNTY_URL || '';
  const firstClose = process.env.FIRST_CLOSE_PROPERTY_ID || '';
  const kycVendor = process.env.KYC_VENDOR === 'true';
  const auditDate = process.env.AUDIT_DATE || '';

  const jwtStatus = jwtOk ? 'pass' : demo ? 'warn' : 'fail';
  const liveChain = LIVE_CHAIN_IDS.has(cid);

  return [
    check('demo', 'Demo mode', demo ? 'warn' : 'pass', demo
      ? 'APP_ENV is not production. Do not take real money. KYC is mock admin review.'
      : 'APP_ENV=production. Confirm legal, KYC vendor, and audit before any close.'),
    check(
      'jwt',
      'JWT secret',
      jwtStatus,
      jwtOk ? 'JWT_SECRET is set and is not the default.' : 'JWT_SECRET is missing or still the default jwt_secret.'
    ),
    check(
      'factory',
      'Property factory',
      factory ? 'pass' : demo ? 'warn' : 'fail',
      factory ? factory : 'PROPERTY_FACTORY_ADDRESS / VITE_PROPERTY_FACTORY_ADDRESS is not set.'
    ),
    check(
      'identity',
      'Identity registry',
      identity ? 'pass' : 'warn',
      identity ? identity : 'Identity registry address is not set.'
    ),
    check(
      'usdc',
      'USDC',
      usdc ? (liveChain ? 'pass' : 'warn') : demo ? 'warn' : 'fail',
      !usdc
        ? 'USDC address is not set.'
        : liveChain
          ? 'USDC address is configured on a live chain. Confirm it is canonical USDC, not MockUSDC.'
          : `Chain ${cid} is not Ethereum or Base. MockUSDC is expected on local/test nets.`
    ),
    check(
      'market',
      'Share market',
      market ? 'pass' : 'warn',
      market ? market : 'Share market address is not set.'
    ),
    check(
      'kyc',
      'KYC vendor',
      kycVendor ? 'pass' : 'open',
      kycVendor
        ? 'KYC_VENDOR=true. Confirm the vendor is actually wired.'
        : 'In-app KYC is still mock admin review. Do not treat this as CIP/AML.'
    ),
    check(
      'audit',
      'Smart-contract audit',
      auditDate ? 'pass' : 'open',
      auditDate ? `AUDIT_DATE=${auditDate}` : 'No audit on file. Do not deploy to mainnet or Base without one.'
    ),
    check(
      'bounty',
      'Bug bounty',
      bounty ? 'pass' : 'open',
      bounty || 'No BUG_BOUNTY_URL. Program is not live.'
    ),
    check(
      'first-close',
      'First real asset',
      firstClose ? 'pass' : 'open',
      firstClose
        ? `FIRST_CLOSE_PROPERTY_ID=${firstClose}`
        : 'No first-close property id. Seed catalog listings are demo photos, not a live SPV.'
    ),
  ];
}

async function snapshot() {
  const checks = staticChecks();
  let rpc = { reachable: false, block: null, factoryCode: false, error: null };
  try {
    const ping = await pingRpc();
    rpc = { reachable: true, block: ping.block, factoryCode: ping.factoryCode, error: null };
    checks.push(
      check('rpc', 'Chain RPC', 'pass', `${rpcUrl()} at block ${ping.block}`)
    );
    const factory = envAddress('PROPERTY_FACTORY_ADDRESS', 'VITE_PROPERTY_FACTORY_ADDRESS');
    if (factory) {
      checks.push(
        check(
          'factory-code',
          'Factory bytecode',
          ping.factoryCode ? 'pass' : 'fail',
          ping.factoryCode ? 'getCode is non-empty.' : 'Factory address has no code on this RPC.'
        )
      );
    }
  } catch (err) {
    rpc.error = err.message || 'RPC unavailable';
    checks.push(check('rpc', 'Chain RPC', isDemo() ? 'warn' : 'fail', `${rpcUrl()} — ${rpc.error}`));
  }

  const blocking = checks.filter((c) => c.status === 'fail');
  const open = checks.filter((c) => c.status === 'open');
  return {
    demo: isDemo(),
    production: isProduction(),
    chainId: chainId(),
    rpcUrl: rpcUrl(),
    ready: blocking.length === 0,
    liveOfferingAllowed: !isDemo() && blocking.length === 0 && open.length === 0,
    checks,
    rpc,
  };
}

function startupBlockers() {
  if (!isProduction()) return [];
  const blockers = [];
  if (!jwtConfigured()) blockers.push('Set JWT_SECRET to a long random value before production.');
  if (!process.env.CHAIN_RPC_URL) blockers.push('Set CHAIN_RPC_URL for production.');
  if (!envAddress('PROPERTY_FACTORY_ADDRESS', 'VITE_PROPERTY_FACTORY_ADDRESS')) {
    blockers.push('Set PROPERTY_FACTORY_ADDRESS for production.');
  }
  return blockers;
}

module.exports = { isProduction, isDemo, snapshot, startupBlockers, jwtConfigured };
