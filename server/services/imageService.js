const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const { skipFsWrites, getBlobStore } = require('../storage/blobs');

const IMAGES_ROOT = path.join(__dirname, '..', 'images');
const SEED_DIR = path.join(IMAGES_ROOT, 'seed');
const ASSET_DIR = path.join(__dirname, '..', 'assets', 'images');
const UPLOAD_DIR = path.join(IMAGES_ROOT, 'uploads');
const MAX_BYTES = 1_500_000;
const NAME_RE = /^[A-Za-z0-9._-]+$/;
const FETCH_MS = 8_000;
const PLACEHOLDER_RE = /^\/api\/images\/seed\/.+\.svg$/i;
const DEFAULT_PHOTO =
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1470&q=80';
const HERO_FILE = 'hero.jpg';
const HERO_URL = `/api/images/seed/${HERO_FILE}`;
const BLOB_STORE = 'listing-images';

const MIME = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
};

const uploadCache = new Map();

function fail(message, status) {
  throw Object.assign(new Error(message), { status });
}

function safeName(file) {
  const base = path.basename(String(file || ''));
  if (!NAME_RE.test(base)) return null;
  return base;
}

function isManaged(url) {
  return String(url || '').startsWith('/api/images/');
}

function isPlaceholder(url) {
  return PLACEHOLDER_RE.test(String(url || ''));
}

function uploadUrl(file) {
  return `/api/images/${file}`;
}

function defaultUrl() {
  return DEFAULT_PHOTO;
}

function mimeFromName(filename) {
  const ext = path.extname(filename || '').slice(1).toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

function resolveUnder(dir, file) {
  const name = safeName(file);
  if (!name) return null;
  const full = path.join(dir, name);
  if (!full.startsWith(dir)) return null;
  return fs.existsSync(full) ? full : null;
}

function seedPath(file) {
  return resolveUnder(SEED_DIR, file) || resolveUnder(ASSET_DIR, file);
}

function uploadPath(file) {
  return resolveUnder(UPLOAD_DIR, file);
}

function detectType(buffer, filename) {
  const head = buffer.slice(0, 16);
  if (head[0] === 0xff && head[1] === 0xd8) return { ext: 'jpg', mime: MIME.jpg };
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) {
    return { ext: 'png', mime: MIME.png };
  }
  if (head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46) return { ext: 'gif', mime: MIME.gif };
  if (head.toString('ascii', 0, 4) === 'RIFF' && head.toString('ascii', 8, 12) === 'WEBP') {
    return { ext: 'webp', mime: MIME.webp };
  }
  const text = buffer.slice(0, 256).toString('utf8').trimStart();
  if (text.startsWith('<svg') || text.startsWith('<?xml')) {
    if (/<script/i.test(text) || /\bon\w+\s*=/i.test(text)) {
      fail('SVG images cannot include scripts.', 400);
    }
    return { ext: 'svg', mime: MIME.svg };
  }
  const ext = path.extname(filename || '').slice(1).toLowerCase();
  if (MIME[ext]) fail('File bytes do not match the image type.', 400);
  fail('Only JPEG, PNG, WebP, GIF, or SVG images are accepted.', 400);
}

function persistUpload(stored, buffer, mime) {
  uploadCache.set(stored, { buffer, contentType: mime });
  if (skipFsWrites()) {
    void getBlobStore(BLOB_STORE).then((store) => {
      if (!store) return;
      return store.set(stored, buffer, { metadata: { contentType: mime } });
    }).catch((err) => {
      console.error('Failed to write listing image to Netlify Blobs:', err.message);
    });
    return;
  }
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOAD_DIR, stored), buffer);
  } catch (err) {
    console.error('Failed to write listing image:', err.message);
    void getBlobStore(BLOB_STORE).then((store) => {
      if (!store) return;
      return store.set(stored, buffer, { metadata: { contentType: mime } });
    }).catch((blobErr) => {
      console.error('Failed to write listing image to Netlify Blobs:', blobErr.message);
    });
  }
}

function saveBuffer(buffer, filename) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) fail('File is empty.', 400);
  if (buffer.length > MAX_BYTES) fail('File is larger than 1.5 MB.', 400);
  const kind = detectType(buffer, filename);
  const stored = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${kind.ext}`;
  persistUpload(stored, buffer, kind.mime);
  return {
    url: uploadUrl(stored),
    contentType: kind.mime,
    bytes: buffer.length,
    filename: stored,
  };
}

function decodeUpload(data) {
  const raw = String(data || '').replace(/^data:[^;]+;base64,/, '');
  if (!raw) fail('File data is required.', 400);
  let buffer;
  try {
    buffer = Buffer.from(raw, 'base64');
  } catch {
    fail('File data must be base64.', 400);
  }
  return buffer;
}

function blockedHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  if (!host) return true;
  if (host === 'localhost' || host === '::1' || host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (/^(127|0|10|169\.254)\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  return false;
}

async function ingestRemote(sourceUrl) {
  let parsed;
  try {
    parsed = new URL(String(sourceUrl || ''));
  } catch {
    fail('Image URL is invalid.', 400);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    fail('Image URL must be http or https.', 400);
  }
  if (blockedHost(parsed.hostname)) fail('That image host is not allowed.', 400);

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_MS);
  let res;
  try {
    res = await fetch(parsed.href, {
      signal: ac.signal,
      redirect: 'follow',
      headers: { Accept: 'image/*,*/*;q=0.8' },
    });
  } catch {
    fail('Could not fetch that image URL.', 400);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) fail(`Image URL returned ${res.status}.`, 400);
  const length = Number(res.headers.get('content-length') || 0);
  if (length > MAX_BYTES) fail('File is larger than 1.5 MB.', 400);
  const buffer = Buffer.from(await res.arrayBuffer());
  const name = path.basename(parsed.pathname) || 'remote.jpg';
  return saveBuffer(buffer, name);
}

function restoreCatalogPhotos(properties, seeds) {
  const seedById = Object.fromEntries((seeds || []).map((row) => [String(row.id), row]));
  let changed = false;
  for (const property of properties || []) {
    const seed = seedById[String(property.id)];
    if (isPlaceholder(property.imageUrl)) {
      property.imageUrl = seed?.imageUrl || DEFAULT_PHOTO;
      changed = true;
    }
    const gallery = Array.isArray(property.galleryUrls) ? property.galleryUrls : [];
    if (gallery.some(isPlaceholder)) {
      property.galleryUrls = Array.isArray(seed?.galleryUrls)
        ? seed.galleryUrls
        : gallery.filter((url) => !isPlaceholder(url));
      changed = true;
    }
  }
  return changed;
}

function asPayload(filePath, name) {
  return {
    buffer: fs.readFileSync(filePath),
    contentType: mimeFromName(name || filePath),
  };
}

async function readSeed(file) {
  const name = safeName(file);
  if (!name) return null;
  const fromDisk = seedPath(name);
  if (fromDisk) return asPayload(fromDisk, name);
  const alt = name.includes('.')
    ? null
    : seedPath(`${name}.jpg`) || seedPath(`${name}.svg`);
  if (alt) return asPayload(alt, alt);
  if (name === HERO_FILE || name === 'hero.svg') {
    const hero = seedPath(HERO_FILE) || seedPath('hero.svg');
    if (hero) return asPayload(hero, hero);
  }
  return null;
}

async function readUpload(file) {
  const name = safeName(file);
  if (!name) return null;
  if (uploadCache.has(name)) return uploadCache.get(name);
  const fromDisk = uploadPath(name);
  if (fromDisk) return asPayload(fromDisk, name);
  const store = await getBlobStore(BLOB_STORE);
  if (store) {
    try {
      const raw = await store.get(name, { type: 'arrayBuffer' });
      if (raw) {
        const payload = { buffer: Buffer.from(raw), contentType: mimeFromName(name) };
        uploadCache.set(name, payload);
        return payload;
      }
    } catch (err) {
      console.error('Error reading listing image from Netlify Blobs:', err.message);
    }
  }
  return null;
}

module.exports = {
  IMAGES_ROOT,
  ASSET_DIR,
  MAX_BYTES,
  MIME,
  DEFAULT_PHOTO,
  HERO_URL,
  defaultUrl,
  isManaged,
  isPlaceholder,
  seedPath,
  uploadPath,
  saveBuffer,
  decodeUpload,
  ingestRemote,
  restoreCatalogPhotos,
  readSeed,
  readUpload,
};
