#!/usr/bin/env node

const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const envFile = path.join(root, '.env');
const isWindows = process.platform === 'win32';
const npm = isWindows ? 'npm.cmd' : 'npm';
const hardhat = path.join(
  root,
  'node_modules',
  '.bin',
  isWindows ? 'hardhat.cmd' : 'hardhat'
);
const children = new Set();
let stopping = false;

function log(message) {
  console.log(`\n[local] ${message}`);
}

function spawnOptions(options = {}) {
  return {
    cwd: root,
    env: { ...process.env, ...(options.env || {}) },
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    detached: !isWindows,
    // Node 20+ on Windows rejects .cmd/.bat without a shell (spawn EINVAL).
    shell: isWindows,
  };
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, spawnOptions(options));
    children.add(child);

    let output = '';
    if (options.capture) {
      child.stdout.on('data', (chunk) => {
        const text = chunk.toString();
        output += text;
        process.stdout.write(text);
      });
      child.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        output += text;
        process.stderr.write(text);
      });
    }

    child.once('error', reject);
    child.once('exit', (code, signal) => {
      children.delete(child);
      if (code === 0) resolve(output);
      else reject(new Error(`${command} exited with ${signal || `code ${code}`}`));
    });
  });
}

function start(command, args, options = {}) {
  const child = spawn(command, args, spawnOptions(options));
  children.add(child);
  child.once('error', (error) => {
    console.error(`[local] Could not start ${command}:`, error.message);
    shutdown(1);
  });
  child.once('exit', (code, signal) => {
    children.delete(child);
    if (!stopping) {
      console.error(`[local] ${command} stopped unexpectedly (${signal || `code ${code}`}).`);
      shutdown(code || 1);
    }
  });
  return child;
}

function terminate(child) {
  if (!child.pid || child.killed) return;
  try {
    if (isWindows) {
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
    } else {
      process.kill(-child.pid, 'SIGTERM');
    }
  } catch {
    // The process may already have exited.
  }
}

function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) terminate(child);
  setTimeout(() => process.exit(code), 250);
}

async function waitForRpc(timeoutMs = 30_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch('http://127.0.0.1:8545', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_chainId',
          params: [],
        }),
      });
      const body = await response.json();
      if (body.result === '0x7a69') return;
    } catch {
      // Hardhat is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Hardhat did not become ready at http://127.0.0.1:8545.');
}

function assertPortFree(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        reject(new Error(`Port ${port} is already in use. Stop the existing process and run npm start again.`));
      } else {
        reject(error);
      }
    });
    server.listen(port, '127.0.0.1', () => {
      server.close(resolve);
    });
  });
}

async function findFreePort(start, attempts = 20) {
  for (let port = start; port < start + attempts; port += 1) {
    try {
      await assertPortFree(port);
      return port;
    } catch (error) {
      if (!String(error.message).includes('already in use')) throw error;
    }
  }
  throw new Error(`No free API port found between ${start} and ${start + attempts - 1}.`);
}

function addressFrom(output, key) {
  const match = output.match(new RegExp(`${key}=(0x[a-fA-F0-9]{40})`));
  if (!match) throw new Error(`Deployment did not print ${key}.`);
  return match[1];
}

function writeEnv(values) {
  const existing = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
  const lines = existing ? existing.replace(/\r\n/g, '\n').split('\n') : [];

  for (const [key, value] of Object.entries(values)) {
    const prefix = `${key}=`;
    const index = lines.findIndex((line) => line.startsWith(prefix));
    if (index >= 0) lines[index] = `${prefix}${value}`;
    else lines.push(`${prefix}${value}`);
  }

  fs.writeFileSync(envFile, `${lines.filter(Boolean).join('\n')}\n`, 'utf8');
}

async function main() {
  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));

  const nodeMajor = Number(process.versions.node.split('.')[0]);
  if (nodeMajor < 22) {
    throw new Error(`Node.js 22 or newer is required (found ${process.version}). Run "nvm use 22".`);
  }

  await Promise.all([assertPortFree(3000), assertPortFree(8545)]);
  const apiPort = await findFreePort(4000);
  if (apiPort !== 4000) {
    log(`Port 4000 is busy; the API will use port ${apiPort} instead.`);
  }

  if (!fs.existsSync(hardhat)) {
    log('Dependencies are missing. Running npm install…');
    await run(npm, ['install']);
  }

  log('Starting the local Hardhat chain…');
  start(hardhat, ['node']);
  await waitForRpc();

  log('Deploying RealtyChain contracts and seed listings…');
  const deployment = await run(
    hardhat,
    ['run', 'scripts/deploy-property-protocol.js', '--network', 'localhost'],
    {
      capture: true,
      // A local interview run must always deploy MockUSDC, even if .env
      // previously contained a canonical network address.
      env: { USDC_ADDRESS: '' },
    }
  );

  const values = {
    VITE_IDENTITY_REGISTRY_ADDRESS: addressFrom(
      deployment,
      'VITE_IDENTITY_REGISTRY_ADDRESS'
    ),
    VITE_CLAIM_ISSUER_ADDRESS: addressFrom(deployment, 'VITE_CLAIM_ISSUER_ADDRESS'),
    VITE_INVESTOR_ONBOARDER_ADDRESS: addressFrom(
      deployment,
      'VITE_INVESTOR_ONBOARDER_ADDRESS'
    ),
    VITE_USDC_ADDRESS: addressFrom(deployment, 'VITE_USDC_ADDRESS'),
    VITE_PROPERTY_FACTORY_ADDRESS: addressFrom(
      deployment,
      'VITE_PROPERTY_FACTORY_ADDRESS'
    ),
    VITE_SHARE_MARKET_ADDRESS: addressFrom(
      deployment,
      'VITE_SHARE_MARKET_ADDRESS'
    ),
    VITE_ENABLE_TESTNETS: 'true',
    VITE_ALLOWED_CHAINS: 'hardhat',
    VITE_DEMO_MODE: 'true',
    CHAIN_ID: '31337',
    CHAIN_RPC_URL: 'http://127.0.0.1:8545',
    DEMO_MODE: 'true',
    PORT: String(apiPort),
    API_PORT: String(apiPort),
  };
  writeEnv(values);

  log('Contract addresses were written to .env.');
  log('Starting API and frontend. Press Ctrl+C to stop everything.');
  console.log('[local] App: http://localhost:3000');
  console.log(`[local] API: http://localhost:${apiPort}/health\n`);

  start(npm, ['run', 'dev'], { env: values });
}

main().catch((error) => {
  console.error(`\n[local] Startup failed: ${error.message}`);
  shutdown(1);
});
