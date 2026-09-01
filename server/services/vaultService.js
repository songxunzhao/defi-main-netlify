const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { skipFsWrites, getBlobStore } = require('../storage/blobs');

const VAULT_ROOT = path.join(__dirname, '..', 'vault');
const SEED_DIR = path.join(VAULT_ROOT, 'seed');
const MAX_BYTES = 1_500_000;
const NAME_RE = /^[A-Za-z0-9._-]+$/;
const BLOB_STORE = 'vault-files';
const KIND_BY_LABEL = [
  [/deed/i, 'deed'],
  [/financ|ppm|projection/i, 'financials'],
  [/inspect|tenant|agreement/i, 'inspection'],
];

const uploadCache = new Map();

function seedKindForName(name) {
  for (const [pattern, kind] of KIND_BY_LABEL) {
    if (pattern.test(name)) return kind;
  }
  return 'financials';
}

function seedDocUrl(propertyId, kind) {
  return `/api/vault/seed/${propertyId}-${kind}.pdf`;
}

function minimalPdf(title) {
  const label = String(title || 'RealtyChain document').replace(/[()\\]/g, ' ').slice(0, 80);
  const stream = `BT /F1 16 Tf 72 720 Td (${label}) Tj T* /F1 11 Tf (Demo vault file — not a recorded instrument.) Tj ET`;
  const streamLen = Buffer.byteLength(stream, 'utf8');
  const objects = [
    '1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj',
    '2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj',
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj',
    `4 0 obj<< /Length ${streamLen} >>stream\n${stream}\nendstream\nendobj`,
    '5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj',
  ];
  let body = '%PDF-1.1\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(body, 'utf8'));
    body += `${obj}\n`;
  }
  const xrefAt = Buffer.byteLength(body, 'utf8');
  let xref = `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  body += `${xref}trailer<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return Buffer.from(body, 'utf8');
}

function ensureSeedFiles(properties) {
  if (skipFsWrites()) return;
  try {
    fs.mkdirSync(SEED_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create vault seed directory:', err.message);
    return;
  }
  for (const property of properties || []) {
    const id = String(property.id);
    const kinds = [
      ['deed', `${property.title} — Property Deed`],
      ['financials', `${property.title} — Financial projections`],
      ['inspection', `${property.title} — Inspection / leases`],
    ];
    for (const [kind, title] of kinds) {
      const file = path.join(SEED_DIR, `${id}-${kind}.pdf`);
      if (!fs.existsSync(file)) {
        try {
          fs.writeFileSync(file, minimalPdf(title));
        } catch (err) {
          console.error('Failed to write vault seed file:', err.message);
        }
      }
    }
  }
}

function rewritePlaceholderDocs(properties) {
  let changed = false;
  for (const property of properties || []) {
    if (!Array.isArray(property.documents)) continue;
    const next = property.documents.map((doc) => {
      const url = String(doc?.url || '').trim();
      if (url && url !== '#') return doc;
      return { name: doc.name, url: seedDocUrl(property.id, seedKindForName(doc.name)) };
    });
    if (JSON.stringify(next) !== JSON.stringify(property.documents)) {
      property.documents = next;
      changed = true;
    }
  }
  return changed;
}

function safeName(name) {
  const base = path.basename(String(name || ''));
  if (!NAME_RE.test(base)) return null;
  return base;
}

function seedPath(file) {
  const name = safeName(file);
  if (!name) return null;
  const full = path.join(SEED_DIR, name);
  if (!full.startsWith(SEED_DIR) || !fs.existsSync(full)) return null;
  return full;
}

function propertyDir(propertyId) {
  const id = String(propertyId || '').replace(/[^A-Za-z0-9_-]/g, '');
  if (!id) return null;
  return path.join(VAULT_ROOT, id);
}

function propertyFilePath(propertyId, file) {
  const dir = propertyDir(propertyId);
  const name = safeName(file);
  if (!dir || !name) return null;
  const full = path.join(dir, name);
  if (!full.startsWith(dir)) return null;
  return fs.existsSync(full) ? full : null;
}

function blobKey(propertyId, file) {
  return `${propertyId}/${file}`;
}

function persistUpload(propertyId, stored, buffer) {
  const key = blobKey(propertyId, stored);
  uploadCache.set(key, buffer);
  if (skipFsWrites()) {
    void getBlobStore(BLOB_STORE).then((store) => {
      if (!store) return;
      return store.set(key, buffer);
    }).catch((err) => {
      console.error('Failed to write vault file to Netlify Blobs:', err.message);
    });
    return;
  }
  const dir = propertyDir(propertyId);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, stored), buffer);
  } catch (err) {
    console.error('Failed to write vault file:', err.message);
    void getBlobStore(BLOB_STORE).then((store) => {
      if (!store) return;
      return store.set(key, buffer);
    }).catch((blobErr) => {
      console.error('Failed to write vault file to Netlify Blobs:', blobErr.message);
    });
  }
}

function saveUpload(propertyId, filename, buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw Object.assign(new Error('File is empty.'), { status: 400 });
  }
  if (buffer.length > MAX_BYTES) {
    throw Object.assign(new Error('File is larger than 1.5 MB.'), { status: 400 });
  }
  const dir = propertyDir(propertyId);
  if (!dir) throw Object.assign(new Error('Invalid property id.'), { status: 400 });
  const ext = path.extname(filename || '').slice(0, 8) || '.bin';
  const stored = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
  if (!NAME_RE.test(stored)) {
    throw Object.assign(new Error('Invalid file name.'), { status: 400 });
  }
  persistUpload(propertyId, stored, buffer);
  return {
    name: path.basename(filename || stored).slice(0, 120) || stored,
    url: `/api/vault/${propertyId}/${stored}`,
  };
}

function removeStoredFile(url) {
  const match = String(url || '').match(/^\/api\/vault\/([^/]+)\/([^/]+)$/);
  if (!match || match[1] === 'seed') return;
  const propertyId = match[1];
  const file = match[2];
  const key = blobKey(propertyId, file);
  uploadCache.delete(key);
  const full = propertyFilePath(propertyId, file);
  if (full) {
    try {
      fs.unlinkSync(full);
    } catch {
      // ignore missing files
    }
  }
  void getBlobStore(BLOB_STORE).then((store) => {
    if (!store || typeof store.delete !== 'function') return;
    return store.delete(key);
  }).catch(() => {
    // ignore missing blobs
  });
}

function generatedSeed(file) {
  const name = safeName(file);
  if (!name) return null;
  const match = name.match(/^([A-Za-z0-9_-]+)-(deed|financials|inspection)\.pdf$/i);
  if (!match) return null;
  const titles = {
    deed: `Property ${match[1]} — Property Deed`,
    financials: `Property ${match[1]} — Financial projections`,
    inspection: `Property ${match[1]} — Inspection / leases`,
  };
  return minimalPdf(titles[match[2].toLowerCase()]);
}

async function readSeed(file) {
  const fromDisk = seedPath(file);
  if (fromDisk) return fs.readFileSync(fromDisk);
  return generatedSeed(file);
}

async function readPropertyFile(propertyId, file) {
  const name = safeName(file);
  if (!name) return null;
  const key = blobKey(propertyId, name);
  if (uploadCache.has(key)) return uploadCache.get(key);
  const fromDisk = propertyFilePath(propertyId, name);
  if (fromDisk) return fs.readFileSync(fromDisk);
  const store = await getBlobStore(BLOB_STORE);
  if (store) {
    try {
      const raw = await store.get(key, { type: 'arrayBuffer' });
      if (raw) {
        const buffer = Buffer.from(raw);
        uploadCache.set(key, buffer);
        return buffer;
      }
    } catch (err) {
      console.error('Error reading vault file from Netlify Blobs:', err.message);
    }
  }
  return null;
}

module.exports = {
  VAULT_ROOT,
  ensureSeedFiles,
  rewritePlaceholderDocs,
  seedDocUrl,
  seedPath,
  propertyFilePath,
  saveUpload,
  removeStoredFile,
  readSeed,
  readPropertyFile,
  MAX_BYTES,
};
