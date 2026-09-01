const fs = require('fs');
const path = require('path');
const { getBlobStore, blobsEnabled, skipFsWrites } = require('../storage/blobs');

const SETTINGS_FILE = path.join(__dirname, '..', 'mock', 'settings.json');
const BLOB_STORE = 'server-settings';

const DEFAULT_SETTINGS = {
  // When true the app is in "restricted mode": logged-in users are sent back
  // to the login page until an admin turns the flag off.
  serverFlag: false,
  // IP addresses allowed to sign in (and to use the admin approval flow).
  allowedAdminIps: ['127.0.0.1', '::1', '::ffff:127.0.0.1'],
};

// In-memory copy of the last known settings. Used as a fallback so the flag
// toggle never fails even if the blob store cannot be written (e.g. on Netlify
// when blobs are not provisioned, or during local `netlify dev` runs).
let memorySettings = null;

async function load() {
  const store = await getBlobStore(BLOB_STORE);
  if (store) {
    try {
      const raw = await store.get('settings', { type: 'text' });
      if (raw) {
        memorySettings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
        return { ...memorySettings };
      }
    } catch (err) {
      console.error('Error reading blob settings:', err.message);
    }
    // No blob data (or the read failed): use the last in-memory copy.
    return memorySettings ? { ...memorySettings } : { ...DEFAULT_SETTINGS };
  }

  // Local development: read/write the JSON file.
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      memorySettings = { ...DEFAULT_SETTINGS, ...parsed };
      return { ...memorySettings };
    } catch (err) {
      console.error('Error reading settings file, falling back to defaults:', err);
    }
  }
  if (memorySettings) return { ...memorySettings };
  const fresh = { ...DEFAULT_SETTINGS };
  memorySettings = fresh;
  try {
    fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(fresh, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write initial settings file:', err);
  }
  return fresh;
}

// Never throws: persistence is best-effort and the in-memory copy always
// reflects the latest change so callers keep working.
async function save(settings) {
  memorySettings = { ...settings };
  const store = await getBlobStore(BLOB_STORE);
  if (store) {
    await store.set('settings', JSON.stringify(settings));
    return;
  }
  if (blobsEnabled() && skipFsWrites()) {
    throw new Error(
      'Could not save the IP allowlist on Netlify. Confirm Netlify Blobs is enabled for this site, or set ALLOWED_LOGIN_IPS in Site configuration → Environment variables.'
    );
  }
  try {
    fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write settings file:', err);
    throw new Error('Failed to write settings file.');
  }
}

// Normalize IPv4-mapped IPv6 and loopback aliases so matching is consistent.
function normalizeIp(ip) {
  if (!ip) return '';
  let value = String(ip).trim().toLowerCase();
  if (value.startsWith('::ffff:')) value = value.slice(7);
  if (value === '::1') value = '127.0.0.1';
  return value;
}

function headerValue(req, names) {
  const headers = (req && req.headers) || {};
  for (const name of names) {
    const raw = headers[name] || headers[String(name).toLowerCase()];
    if (raw == null || raw === '') continue;
    return String(Array.isArray(raw) ? raw[0] : raw).trim();
  }
  return '';
}

function getClientIp(req) {
  if (!req) return '';
  const forwarded = headerValue(req, ['x-forwarded-for']);
  const candidates = [
    headerValue(req, ['x-nf-client-connection-ip', 'client-ip', 'true-client-ip', 'cf-connecting-ip']),
    ...(forwarded ? forwarded.split(',').map((part) => part.trim()) : []),
    req.ip,
    req.socket && req.socket.remoteAddress,
  ];
  for (const raw of candidates) {
    const ip = normalizeIp(raw);
    if (ip) return ip;
  }
  return '';
}

function envAllowedIps() {
  const raw = process.env.ALLOWED_LOGIN_IPS || '';
  return [...new Set(raw.split(/[\s,]+/).map(normalizeIp).filter(Boolean))];
}

function storedIps(settings) {
  return [...new Set((settings.allowedAdminIps || []).map(normalizeIp).filter(Boolean))];
}

function effectiveIps(settings) {
  return [...new Set([...envAllowedIps(), ...storedIps(settings)])];
}

function isIpAllowed(ip, settings) {
  const normalized = normalizeIp(ip);
  if (!normalized) return false;
  return effectiveIps(settings).includes(normalized);
}

async function isRequestIpAllowed(req) {
  const s = await load();
  return isIpAllowed(getClientIp(req), s);
}

async function getSettings(req) {
  const s = await load();
  const currentIp = getClientIp(req);
  const envIps = envAllowedIps();
  return {
    serverFlag: !!s.serverFlag,
    allowedAdminIps: effectiveIps(s),
    envAllowedIps: envIps,
    currentIp,
    ipAllowed: isIpAllowed(currentIp, s),
  };
}

async function setServerFlag(flag, req) {
  const s = await load();
  s.serverFlag = !!flag;
  // Ensure whoever enables the flag can immediately use the admin flow.
  if (s.serverFlag) {
    const ip = getClientIp(req);
    if (ip && !isIpAllowed(ip, s)) {
      s.allowedAdminIps = s.allowedAdminIps || [];
      s.allowedAdminIps.push(ip);
    }
  }
  await save(s);
  return getSettings(req);
}

async function setAllowedIps(ips, req) {
  const s = await load();
  const fromEnv = new Set(envAllowedIps());
  // Env IPs stay in ALLOWED_LOGIN_IPS (Netlify / .env). Only extra addresses
  // from this form are persisted to blobs or the local settings file.
  const normalized = [...new Set((ips || []).map(normalizeIp).filter(Boolean))].filter(
    (ip) => !fromEnv.has(ip)
  );
  s.allowedAdminIps = normalized;
  await save(s);
  return getSettings(req);
}

async function allowCurrentIp(req) {
  const current = getClientIp(req);
  if (!current) {
    throw Object.assign(new Error('Could not determine the client IP address.'), { status: 400 });
  }
  const s = await load();
  const next = [...storedIps(s), current];
  return setAllowedIps(next, req);
}

module.exports = {
  getSettings,
  setServerFlag,
  setAllowedIps,
  allowCurrentIp,
  isRequestIpAllowed,
  getClientIp,
};
