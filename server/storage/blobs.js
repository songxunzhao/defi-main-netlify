let stores = new Map();
let unavailable = false;

function blobsEnabled() {
  return Boolean(process.env.NETLIFY);
}

function skipFsWrites() {
  return Boolean(process.env.NETLIFY && process.env.NETLIFY_DEV !== 'true');
}

async function getBlobStore(name) {
  if (!blobsEnabled()) return null;
  if (unavailable) return null;
  if (stores.has(name)) return stores.get(name);
  try {
    // Keep a resolvable reference so Netlify's NFT bundler includes the package
    // even though the runtime import is ESM-only.
    require.resolve('@netlify/blobs');
    const { getStore } = await import('@netlify/blobs');
    const store = getStore({ name });
    stores.set(name, store);
    return store;
  } catch (err) {
    unavailable = true;
    console.error('Netlify Blobs unavailable, falling back to in-memory/file storage:', err.message);
    return null;
  }
}

module.exports = { blobsEnabled, skipFsWrites, getBlobStore };
