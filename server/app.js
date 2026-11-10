require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const propertyRoutes = require('./routes/properties');
const kycRoutes = require('./routes/kyc');
const settingsRoutes = require('./routes/settings');
const activityRoutes = require('./routes/activity');
const vaultRoutes = require('./routes/vault');
const imageRoutes = require('./routes/images');
const opsRoutes = require('./routes/ops');
const searchRoutes = require('./routes/searches');
const governanceRoutes = require('./routes/governance');
const marketRoutes = require('./routes/market');
const adminRoutes = require('./routes/admin');
const lendingRoutes = require('./routes/lending');
const bridgeRoutes = require('./routes/bridge');
const opsController = require('./controllers/opsController');
const readiness = require('./services/readiness');
const persistence = require('./mock/persistence');
const { usesVercelStorage } = require('./storage/blobs');
const { usesPostgresStorage } = require('./storage/postgres');

const app = express();
const PORT = process.env.PORT || 4000;

// Honor X-Forwarded-For from Netlify (and other reverse proxies) so login IP
// filtering sees the visitor address rather than the edge node.
app.set('trust proxy', true);
app.use(cors());
if (usesVercelStorage() || usesPostgresStorage()) {
  app.use(require('./middleware/persistentStorage').createStorageMiddleware(persistence));
}
app.use(async (_req, _res, next) => {
  try {
    await persistence.ready();
    next();
  } catch (err) {
    next(err);
  }
});
// Parse JSON request bodies — but skip when a serverless wrapper (e.g. the
// Netlify Function) has already parsed req.body. express.json() reads the
// request stream, which is empty in serverless environments, so it would
// otherwise return 400 on every POST that carries a body.
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return next();
  return express.json({
    limit: '3mb',
    verify(incoming, _res, buf) {
      incoming.rawBody = buf.toString('utf8');
    },
  })(req, res, next);
});

app.get('/health', opsController.health);
app.get('/ready', opsController.ready);

app.use((req, res, next) => {
  if (process.env.LOG_REQUESTS !== '1') return next();
  const start = Date.now();
  res.on('finish', () => {
    console.log(
      JSON.stringify({
        method: req.method,
        path: req.originalUrl || req.path,
        status: res.statusCode,
        ms: Date.now() - start,
      })
    );
  });
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/ops', opsRoutes);
app.use('/api/searches', searchRoutes);
app.use('/api/governance', governanceRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/lend', lendingRoutes);
app.use('/api/income', require('./routes/income'));
app.use('/api/investment-plans', require('./routes/investmentPlans'));
app.use('/api/institutional-quotes', require('./routes/institutionalQuotes'));
app.use('/api/fundraising', require('./routes/fundraising'));
app.use('/api/data-rooms', require('./routes/dataRooms'));
app.use('/api/bridge', bridgeRoutes);
app.use('/api/admin', adminRoutes);

const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(path.join(distDir, 'index.html'))) {
  app.use(express.static(distDir, { index: false }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api') || req.path === '/health' || req.path === '/ready') return next();
    res.sendFile(path.join(distDir, 'index.html'), (err) => (err ? next(err) : undefined));
  });
}

app.use((err, _req, res, _next) => {
  console.error('API request failed:', err.message);
  res.status(err.status || 503).json({ error: 'The service is temporarily unavailable. Please try again.' });
});

// Start the HTTP listener only when run directly (node server/app.js).
// When imported (e.g. by a Netlify Function via serverless-http) the app is
// exported instead and the platform owns the listener.
if (require.main === module) {
  const blockers = readiness.startupBlockers();
  if (blockers.length) {
    console.error('Production startup blocked:');
    for (const line of blockers) console.error(`- ${line}`);
    process.exit(1);
  }
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

module.exports = app;
