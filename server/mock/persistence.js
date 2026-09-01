const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { blobsEnabled, skipFsWrites, getBlobStore } = require('../storage/blobs');

const DATA_FILE = path.join(__dirname, 'data.json');
const BLOB_STORE = 'app-data';
const BLOB_KEY = 'data.json';

function writeFile(payload) {
  if (skipFsWrites()) return;
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write mock data file:', err);
  }
}

function loadFromDisk() {
  if (!fs.existsSync(DATA_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    console.error('Error reading mock data file, falling back to seed:', err);
    return null;
  }
}

function freshSeed() {
  const initial = require('./data');
  return {
    users: initial.users || [],
    properties: initial.properties || [],
  };
}

function replaceData(next) {
  for (const key of Object.keys(data)) delete data[key];
  Object.assign(data, next);
}

const seedUsers = [
  {
    email: process.env.DEV_SEED_EMAIL || 'test1@gmail.com',
    password: process.env.DEV_SEED_PASSWORD || 'pass1234',
    name: 'Test One',
    role: 'user',
  },
  {
    email: process.env.DEV_ADMIN_EMAIL || 'admin@defi.estate',
    password: process.env.DEV_ADMIN_PASSWORD || 'admin1234',
    name: 'Platform Admin',
    role: 'admin',
  },
];

function ensureSeedUsers() {
  if (!data) return;
  if (!Array.isArray(data.users)) data.users = [];
  let changed = false;
  for (const seed of seedUsers) {
    const existing = data.users.find((u) => u.email === seed.email);
    if (!existing) {
      const nextId = data.users.length > 0 ? Math.max(...data.users.map((u) => u.id)) + 1 : 1;
      data.users.push({
        id: nextId,
        email: seed.email,
        name: seed.name,
        role: seed.role,
        password_hash: bcrypt.hashSync(seed.password, 10),
        kycStatus: 'unverified',
        accredited: false,
        walletAddress: null,
        kyc: null,
      });
      changed = true;
    } else if (!existing.password_hash) {
      existing.password_hash = bcrypt.hashSync(seed.password, 10);
      existing.role = existing.role || seed.role;
      existing.name = existing.name || seed.name;
      changed = true;
    }
  }
  if (changed) writeFile(data);
}

function ensureProperties() {
  if (!data) return;
  if (!Array.isArray(data.properties) || data.properties.length === 0) {
    data.properties = require('./properties').properties;
    writeFile(data);
  }
}

function ensureKycDefaults() {
  if (!data || !Array.isArray(data.users)) return;
  let changed = false;
  for (const user of data.users) {
    if (!user.kycStatus) {
      user.kycStatus = 'unverified';
      changed = true;
    }
    if (typeof user.accredited !== 'boolean') {
      user.accredited = false;
      changed = true;
    }
    if (user.walletAddress === undefined) {
      user.walletAddress = null;
      changed = true;
    }
  }
  if (changed) writeFile(data);
}

function stripLegacyShopData() {
  if (!data) return;
  let changed = false;
  for (const key of ['cryptos', 'purchaseHistory', 'rewardHistory', 'goods', 'cards', 'banks']) {
    if (key in data) {
      delete data[key];
      changed = true;
    }
  }
  if (changed) writeFile(data);
}

function ensureActivity() {
  if (!data) return;
  if (!data.activity || typeof data.activity !== 'object') {
    data.activity = { events: [], cursor: 0, lastSyncAt: null };
    writeFile(data);
    return;
  }
  if (!Array.isArray(data.activity.events)) {
    data.activity.events = [];
    writeFile(data);
  }
}

function ensureDocumentVault() {
  if (!data || !Array.isArray(data.properties)) return;
  const vault = require('../services/vaultService');
  vault.ensureSeedFiles(data.properties);
  if (vault.rewritePlaceholderDocs(data.properties)) writeFile(data);
}

function ensureCatalogImages() {
  if (!data || !Array.isArray(data.properties)) return;
  const images = require('../services/imageService');
  const seeds = require('./properties').properties;
  if (images.restoreCatalogPhotos(data.properties, seeds)) writeFile(data);
}

function ensureOpsDefaults() {
  if (!data || !Array.isArray(data.properties)) return;
  const seedById = Object.fromEntries(
    require('./properties').properties.map((p) => [String(p.id), p])
  );
  const keys = [
    'occupancyPercent',
    'capRate',
    'grossRentMonthly',
    'opexMonthly',
    'reservesMonthly',
    'nextAppraisalAt',
    'appraisals',
  ];
  let changed = false;
  for (const property of data.properties) {
    const seed = seedById[String(property.id)] || {};
    for (const key of keys) {
      if (property[key] === undefined) {
        property[key] = seed[key] !== undefined ? seed[key] : key === 'appraisals' ? [] : key === 'nextAppraisalAt' ? '' : null;
        changed = true;
      }
    }
  }
  if (changed) writeFile(data);
}

function ensureCmsDefaults() {
  if (!data || !Array.isArray(data.properties)) return;
  const seedById = Object.fromEntries(
    require('./properties').properties.map((p) => [String(p.id), p])
  );
  let changed = false;
  for (const property of data.properties) {
    const seed = seedById[String(property.id)] || {};
    if (property.lat === undefined) {
      property.lat = seed.lat !== undefined ? seed.lat : null;
      changed = true;
    }
    if (property.lng === undefined) {
      property.lng = seed.lng !== undefined ? seed.lng : null;
      changed = true;
    }
    if (property.unitMix === undefined) {
      property.unitMix = seed.unitMix || '';
      changed = true;
    }
    if (property.comps === undefined) {
      property.comps = Array.isArray(seed.comps) ? seed.comps : [];
      changed = true;
    }
    if (property.galleryUrls === undefined) {
      property.galleryUrls = Array.isArray(seed.galleryUrls) ? seed.galleryUrls : [];
      changed = true;
    }
  }
  if (changed) writeFile(data);
}

function runEnsures() {
  ensureSeedUsers();
  ensureProperties();
  ensureKycDefaults();
  stripLegacyShopData();
  ensureOpsDefaults();
  ensureCmsDefaults();
  ensureActivity();
  ensureDocumentVault();
  ensureCatalogImages();
}

const data = (blobsEnabled() ? null : loadFromDisk()) || freshSeed();

if (!blobsEnabled()) {
  runEnsures();
}

let readyPromise = null;

async function flushBlobs() {
  const store = await getBlobStore(BLOB_STORE);
  if (!store) return;
  try {
    await store.set(BLOB_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to write app data to Netlify Blobs:', err.message);
  }
}

async function ready() {
  if (!blobsEnabled()) return;
  if (!readyPromise) {
    readyPromise = (async () => {
      const store = await getBlobStore(BLOB_STORE);
      if (store) {
        try {
          const raw = await store.get(BLOB_KEY, { type: 'text' });
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') replaceData(parsed);
          }
        } catch (err) {
          console.error('Error reading blob app data:', err.message);
        }
      }
      runEnsures();
      await flushBlobs();
    })();
  }
  return readyPromise;
}

function save() {
  writeFile(data);
  if (blobsEnabled()) {
    void flushBlobs();
  }
}

module.exports = { data, getData: () => data, save, ready };
