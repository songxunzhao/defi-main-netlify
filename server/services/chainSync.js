const { createPublicClient, http } = require('viem');
const {
  factoryAbi,
  boughtEvent,
  claimedEvent,
  redeemedEvent,
  listedEvent,
  filledEvent,
  cancelledEvent,
  transferEvent,
  ZERO,
} = require('../chain/abis');

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

function envAddress(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value && ADDRESS_RE.test(value)) return value;
  }
  return '';
}

function rpcUrl() {
  return process.env.CHAIN_RPC_URL || 'http://127.0.0.1:8545';
}

function isAddress(value) {
  return Boolean(value && ADDRESS_RE.test(value) && value.toLowerCase() !== ZERO.toLowerCase());
}

function makeClient() {
  const chainId = Number(process.env.CHAIN_ID || 31337);
  return createPublicClient({
    chain: {
      id: chainId,
      name: 'local',
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl()] } },
    },
    transport: http(rpcUrl(), { timeout: 2500 }),
  });
}

async function discoverListings(client, catalog) {
  const byId = new Map();
  for (const property of catalog || []) {
    byId.set(String(property.id), {
      propertyId: String(property.id),
      token: isAddress(property.tokenAddress) ? property.tokenAddress : null,
      offering: isAddress(property.offeringAddress) ? property.offeringAddress : null,
      distributor: isAddress(property.distributorAddress) ? property.distributorAddress : null,
      redemption: isAddress(property.redemptionAddress) ? property.redemptionAddress : null,
    });
  }

  const factory = envAddress('PROPERTY_FACTORY_ADDRESS', 'VITE_PROPERTY_FACTORY_ADDRESS');
  if (isAddress(factory)) {
    try {
      const count = Number(await client.readContract({ address: factory, abi: factoryAbi, functionName: 'listingCount' }));
      for (let i = 0; i < count; i += 1) {
        const idRaw = await client.readContract({
          address: factory,
          abi: factoryAbi,
          functionName: 'propertyIds',
          args: [BigInt(i)],
        });
        const propertyId = String(idRaw);
        const listing = await client.readContract({
          address: factory,
          abi: factoryAbi,
          functionName: 'getListing',
          args: [idRaw],
        });
        const distributor = await client.readContract({
          address: factory,
          abi: factoryAbi,
          functionName: 'getDistributor',
          args: [idRaw],
        });
        const redemption = await client.readContract({
          address: factory,
          abi: factoryAbi,
          functionName: 'getRedemption',
          args: [idRaw],
        });
        const token = listing?.token || listing?.[0];
        const offering = listing?.offering || listing?.[1];
        const exists = listing?.exists ?? listing?.[2];
        if (!exists) continue;
        const current = byId.get(propertyId) || { propertyId };
        byId.set(propertyId, {
          ...current,
          token: isAddress(token) ? token : current.token || null,
          offering: isAddress(offering) ? offering : current.offering || null,
          distributor: isAddress(distributor) ? distributor : current.distributor || null,
          redemption: isAddress(redemption) ? redemption : current.redemption || null,
        });
      }
    } catch {
      // Catalog addresses still work if the factory read fails.
    }
  }
  return [...byId.values()];
}

async function collectLogs(client, params) {
  try {
    return await client.getLogs(params);
  } catch {
    return [];
  }
}

function eventId(log) {
  return `${log.transactionHash}-${log.logIndex}`;
}

async function timestampsFor(client, logs, cache) {
  const needed = [...new Set(logs.map((log) => Number(log.blockNumber)))].filter((n) => !cache.has(n));
  await Promise.all(
    needed.map(async (blockNumber) => {
      try {
        const block = await client.getBlock({ blockNumber: BigInt(blockNumber) });
        cache.set(blockNumber, Number(block.timestamp));
      } catch {
        cache.set(blockNumber, 0);
      }
    })
  );
}

async function pullEvents(client, listings, fromBlock, toBlock) {
  const events = [];
  const listedByAsk = new Map();
  const filledTx = new Set();
  const timeCache = new Map();

  async function stamp(logs) {
    await timestampsFor(client, logs, timeCache);
    return logs;
  }

  for (const listing of listings) {
    if (listing.offering) {
      const logs = await stamp(
        await collectLogs(client, {
          address: listing.offering,
          event: boughtEvent,
          fromBlock,
          toBlock,
        })
      );
      for (const log of logs) {
        events.push({
          id: eventId(log),
          type: 'buy',
          propertyId: listing.propertyId,
          wallet: String(log.args.buyer).toLowerCase(),
          counterparty: null,
          shares: String(log.args.amount),
          usdc: String(log.args.cost),
          txHash: log.transactionHash,
          logIndex: Number(log.logIndex),
          blockNumber: Number(log.blockNumber),
          timestamp: timeCache.get(Number(log.blockNumber)) || 0,
        });
      }
    }

    if (listing.distributor) {
      const logs = await stamp(
        await collectLogs(client, {
          address: listing.distributor,
          event: claimedEvent,
          fromBlock,
          toBlock,
        })
      );
      for (const log of logs) {
        events.push({
          id: eventId(log),
          type: 'claim',
          propertyId: listing.propertyId,
          wallet: String(log.args.account).toLowerCase(),
          counterparty: null,
          shares: '0',
          usdc: String(log.args.amount),
          txHash: log.transactionHash,
          logIndex: Number(log.logIndex),
          blockNumber: Number(log.blockNumber),
          timestamp: timeCache.get(Number(log.blockNumber)) || 0,
        });
      }
    }

    if (listing.redemption) {
      const logs = await stamp(
        await collectLogs(client, {
          address: listing.redemption,
          event: redeemedEvent,
          fromBlock,
          toBlock,
        })
      );
      for (const log of logs) {
        events.push({
          id: eventId(log),
          type: 'redeem',
          propertyId: listing.propertyId,
          wallet: String(log.args.account).toLowerCase(),
          counterparty: null,
          shares: String(log.args.shares),
          usdc: String(log.args.payout),
          txHash: log.transactionHash,
          logIndex: Number(log.logIndex),
          blockNumber: Number(log.blockNumber),
          timestamp: timeCache.get(Number(log.blockNumber)) || 0,
        });
      }
    }
  }

  const market = envAddress('SHARE_MARKET_ADDRESS', 'VITE_SHARE_MARKET_ADDRESS');
  if (isAddress(market)) {
    const listedLogs = await stamp(
      await collectLogs(client, { address: market, event: listedEvent, fromBlock: 0n, toBlock })
    );
    for (const log of listedLogs) {
      listedByAsk.set(String(log.args.id), {
        seller: String(log.args.seller).toLowerCase(),
        propertyId: String(log.args.propertyId),
      });
      if (Number(log.blockNumber) >= Number(fromBlock)) {
        events.push({
          id: eventId(log),
          type: 'list',
          propertyId: String(log.args.propertyId),
          wallet: String(log.args.seller).toLowerCase(),
          counterparty: null,
          shares: String(log.args.amount),
          usdc: String(log.args.price),
          txHash: log.transactionHash,
          logIndex: Number(log.logIndex),
          blockNumber: Number(log.blockNumber),
          timestamp: timeCache.get(Number(log.blockNumber)) || 0,
        });
      }
    }

    const filledLogs = await stamp(
      await collectLogs(client, { address: market, event: filledEvent, fromBlock, toBlock })
    );
    for (const log of filledLogs) {
      const meta = listedByAsk.get(String(log.args.id));
      if (!meta) continue;
      filledTx.add(log.transactionHash.toLowerCase());
      const ts = timeCache.get(Number(log.blockNumber)) || 0;
      events.push({
        id: `${eventId(log)}-buy`,
        type: 'fill_buy',
        propertyId: meta.propertyId,
        wallet: String(log.args.buyer).toLowerCase(),
        counterparty: meta.seller,
        shares: String(log.args.amount),
        usdc: String(log.args.cost),
        txHash: log.transactionHash,
        logIndex: Number(log.logIndex),
        blockNumber: Number(log.blockNumber),
        timestamp: ts,
      });
      events.push({
        id: `${eventId(log)}-sell`,
        type: 'fill_sell',
        propertyId: meta.propertyId,
        wallet: meta.seller,
        counterparty: String(log.args.buyer).toLowerCase(),
        shares: String(log.args.amount),
        usdc: String(log.args.cost),
        txHash: log.transactionHash,
        logIndex: Number(log.logIndex),
        blockNumber: Number(log.blockNumber),
        timestamp: ts,
      });
    }

    const cancelLogs = await stamp(
      await collectLogs(client, { address: market, event: cancelledEvent, fromBlock, toBlock })
    );
    for (const log of cancelLogs) {
      const meta = listedByAsk.get(String(log.args.id));
      if (!meta) continue;
      events.push({
        id: eventId(log),
        type: 'cancel',
        propertyId: meta.propertyId,
        wallet: meta.seller,
        counterparty: null,
        shares: '0',
        usdc: '0',
        txHash: log.transactionHash,
        logIndex: Number(log.logIndex),
        blockNumber: Number(log.blockNumber),
        timestamp: timeCache.get(Number(log.blockNumber)) || 0,
      });
    }
  }

  for (const listing of listings) {
    if (!listing.token) continue;
    const logs = await stamp(
      await collectLogs(client, {
        address: listing.token,
        event: transferEvent,
        fromBlock,
        toBlock,
      })
    );
    for (const log of logs) {
      const from = String(log.args.from).toLowerCase();
      const to = String(log.args.to).toLowerCase();
      if (from === ZERO.toLowerCase() || to === ZERO.toLowerCase()) continue;
      if (filledTx.has(log.transactionHash.toLowerCase())) continue;
      const ts = timeCache.get(Number(log.blockNumber)) || 0;
      events.push({
        id: `${eventId(log)}-out`,
        type: 'transfer_out',
        propertyId: listing.propertyId,
        wallet: from,
        counterparty: to,
        shares: String(log.args.value),
        usdc: '0',
        txHash: log.transactionHash,
        logIndex: Number(log.logIndex),
        blockNumber: Number(log.blockNumber),
        timestamp: ts,
      });
      events.push({
        id: `${eventId(log)}-in`,
        type: 'transfer_in',
        propertyId: listing.propertyId,
        wallet: to,
        counterparty: from,
        shares: String(log.args.value),
        usdc: '0',
        txHash: log.transactionHash,
        logIndex: Number(log.logIndex),
        blockNumber: Number(log.blockNumber),
        timestamp: ts,
      });
    }
  }

  return events;
}

async function syncFromChain(catalog, store) {
  const client = makeClient();
  let latest;
  try {
    latest = await client.getBlockNumber();
  } catch (err) {
    return { synced: false, reason: 'rpc_unavailable', error: err.message || 'RPC unavailable' };
  }

  const fromBlock = BigInt(store.cursor || 0);
  const listings = await discoverListings(client, catalog);
  const events = await pullEvents(client, listings, fromBlock, latest);
  return { synced: true, latest: Number(latest), events, listings: listings.length };
}

module.exports = { syncFromChain, envAddress, isAddress };
