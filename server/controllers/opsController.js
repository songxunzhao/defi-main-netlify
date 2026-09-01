const readiness = require('../services/readiness');

function health(_req, res) {
  return res.json({ status: 'ok' });
}

async function ready(_req, res) {
  const snap = await readiness.snapshot();
  const payload = {
    status: snap.ready ? 'ready' : 'degraded',
    demo: snap.demo,
    chainId: snap.chainId,
    rpc: snap.rpc,
  };
  return res.status(snap.ready ? 200 : 503).json(payload);
}

async function report(_req, res) {
  return res.json(await readiness.snapshot());
}

module.exports = { health, ready, report };
