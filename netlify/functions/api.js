const serverless = require('serverless-http');

// Hosted demo defaults. Override in the Netlify UI for a real chain deploy.
if (!process.env.DEMO_MODE) process.env.DEMO_MODE = 'true';

const persistence = require('../../server/mock/persistence');
const app = require('../../server/app');

function normalizePath(url) {
  const [pathname, search] = String(url || '/').split('?');
  let pathName = pathname || '/';
  pathName = pathName.replace(/^\/\.netlify\/functions\/api(?:\.js)?/, '') || '/';
  if (
    pathName.startsWith('/api') ||
    pathName === '/health' ||
    pathName === '/ready' ||
    pathName.startsWith('/health?') ||
    pathName.startsWith('/ready?')
  ) {
    return search ? `${pathName}?${search}` : pathName;
  }
  const prefixed = pathName === '/' ? '/api' : `/api${pathName}`;
  return search ? `${prefixed}?${search}` : prefixed;
}

const handle = serverless(app, {
  binary: ['image/*', 'application/pdf', 'application/octet-stream'],
  request(req, event) {
    req.url = normalizePath(req.url || event?.path || '/');
    console.log(`[api] ${req.method} ${req.url}`);
    if (event && event.body && typeof event.body === 'string') {
      const raw = event.isBase64Encoded
        ? Buffer.from(event.body, 'base64').toString('utf8')
        : event.body;
      try {
        req.body = raw ? JSON.parse(raw) : undefined;
      } catch {
        // Not valid JSON — leave the body as-is so normal error handling applies.
      }
    }
  },
});

exports.handler = async (event, context) => {
  await persistence.ready();
  return handle(event, context);
};
