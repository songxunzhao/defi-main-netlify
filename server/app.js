require('dotenv').config();
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
const opsController = require('./controllers/opsController');
const readiness = require('./services/readiness');
const persistence = require('./mock/persistence');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
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
  if (req.body && typeof req.body === 'object') return next();
  return express.json({ limit: '3mb' })(req, res, next);
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
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

module.exports = app;
