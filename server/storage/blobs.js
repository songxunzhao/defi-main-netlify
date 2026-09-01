let stores = new Map();
let unavailable = false;
let lambdaEvent = null;
let connected = false;

function blobsEnabled() {
  return Boolean(process.env.NETLIFY);
}

function skipFsWrites() {
  return Boolean(process.env.NETLIFY && process.env.NETLIFY_DEV !== 'true');
}

// Netlify Functions encode Blobs credentials on the Lambda event. Call this
// at the start of every invocation before getStore() or the write is in-memory
// only and "Allow this IP" will not survive the next request.
function attachLambdaEvent(event) {
  lambdaEvent = event || null;
  connected = false;
  unavailable = false;
  stores.clear();
}

async function loadBlobsModule() {
  require.resolve('@netlify/blobs');
  return import('@netlify/blobs');
}

async function getBlobStore(name) {
  if (!blobsEnabled()) return null;
  if (unavailable) return null;
  if (stores.has(name)) return stores.get(name);
  try {
    const blobs = await loadBlobsModule();
    if (lambdaEvent && typeof blobs.connectLambda === 'function' && !connected) {
      blobs.connectLambda(lambdaEvent);
      connected = true;
    }
    const store = blobs.getStore({ name });
    stores.set(name, store);
    return store;
  } catch (err) {
    unavailable = true;
    console.error('Netlify Blobs unavailable, falling back to in-memory/file storage:', err.message);
    return null;
  }
}

module.exports = { blobsEnabled, skipFsWrites, getBlobStore, attachLambdaEvent };
