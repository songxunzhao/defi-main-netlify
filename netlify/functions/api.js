const serverless = require('serverless-http');

// Hosted demo defaults. Override in the Netlify UI for a real chain deploy.
if (!process.env.DEMO_MODE) process.env.DEMO_MODE = 'true';
// NETLIFY is a build-time variable and is often missing in the Functions
// runtime. Set it before requiring the app so Blobs/IP persistence is used
// instead of writing settings.json on the read-only Lambda filesystem.
if (process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT) {
  process.env.NETLIFY = process.env.NETLIFY || 'true';
}

const { attachLambdaEvent } = require('../../server/storage/blobs');
const persistence = require('../../server/mock/persistence');
const app = require('../../server/app');

function header(headers, name) {
  if (!headers) return '';
  const raw = headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()];
  if (raw == null || raw === '') return '';
  return String(Array.isArray(raw) ? raw[0] : raw).trim();
}

function clientIpFromEvent(event) {
  const headers = event?.headers || {};
  return (
    header(headers, 'x-nf-client-connection-ip') ||
    header(headers, 'client-ip') ||
    header(headers, 'x-forwarded-for').split(',')[0].trim() ||
    event?.requestContext?.http?.sourceIp ||
    event?.requestContext?.identity?.sourceIp ||
    ''
  );
}

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

    const nfIp = clientIpFromEvent(event);
    if (nfIp && req.headers) {
      req.headers['x-nf-client-connection-ip'] = nfIp;
    }

    if (event && event.body != null) {
      if (typeof event.body === 'object' && !Buffer.isBuffer(event.body)) {
        req.body = event.body;
        return;
      }
      if (typeof event.body === 'string') {
        const raw = event.isBase64Encoded
          ? Buffer.from(event.body, 'base64').toString('utf8')
          : event.body;
        try {
          req.body = raw ? JSON.parse(raw) : undefined;
        } catch {
          // Not valid JSON — leave the body as-is so normal error handling applies.
        }
      }
    }
  },
});

exports.handler = async (event, context) => {
  attachLambdaEvent(event);
  await persistence.ready();
  return handle(event, context);
};
