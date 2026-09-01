const persistence = require('../mock/persistence');
const { indexWallet, taxPack, taxCsv } = require('./activityIndex');
const { syncFromChain } = require('./chainSync');

function activityStore() {
  if (!persistence.data.activity) {
    persistence.data.activity = { events: [], cursor: 0, lastSyncAt: null };
  }
  if (!Array.isArray(persistence.data.activity.events)) persistence.data.activity.events = [];
  return persistence.data.activity;
}

function titlesById() {
  const map = {};
  for (const property of persistence.data.properties || []) {
    map[String(property.id)] = property.title;
  }
  return map;
}

function mergeEvents(incoming) {
  const store = activityStore();
  const seen = new Set(store.events.map((event) => event.id));
  let added = 0;
  for (const event of incoming || []) {
    if (!event?.id || seen.has(event.id)) continue;
    store.events.push(event);
    seen.add(event.id);
    added += 1;
  }
  return added;
}

async function sync() {
  const store = activityStore();
  const result = await syncFromChain(persistence.data.properties || [], store);
  if (!result.synced) return result;
  const added = mergeEvents(result.events);
  store.cursor = result.latest + 1;
  store.lastSyncAt = new Date().toISOString();
  persistence.save();
  return { synced: true, added, total: store.events.length, lastSyncAt: store.lastSyncAt };
}

function forWallet(wallet) {
  const store = activityStore();
  return {
    lastSyncAt: store.lastSyncAt,
    ...indexWallet(store.events, wallet, titlesById()),
  };
}

function taxForWallet(wallet, year) {
  const store = activityStore();
  const y = Number(year) || new Date().getUTCFullYear();
  return taxPack(store.events, wallet, y, titlesById());
}

function taxCsvForWallet(wallet, year) {
  return taxCsv(taxForWallet(wallet, year));
}

module.exports = { activityStore, sync, forWallet, taxForWallet, taxCsvForWallet, mergeEvents };
