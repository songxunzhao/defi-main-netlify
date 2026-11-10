const { createHmac, timingSafeEqual } = require('crypto');
const fail = (message, status = 503) => { throw Object.assign(new Error(message), { status }); };
const required = ['DOCUSIGN_ACCESS_TOKEN', 'DOCUSIGN_ACCOUNT_ID', 'DOCUSIGN_CONNECT_SECRET', 'APP_PUBLIC_URL'];
function config() {
  if (required.some((key) => !process.env[key])) fail('DocuSign setup is required before signing.');
  const base = new URL(process.env.DOCUSIGN_BASE_PATH || 'https://demo.docusign.net/restapi');
  const origin = new URL(process.env.APP_PUBLIC_URL);
  if (base.protocol !== 'https:' || !/^[a-z0-9-]+\.docusign\.net$/.test(base.hostname) || !/^\/restapi\/?$/.test(base.pathname) || base.port || base.search || base.hash || base.username || base.password) fail('DocuSign base path must be the account’s HTTPS /restapi URL.');
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') fail('APP_PUBLIC_URL must be the site’s public HTTPS origin.');
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(process.env.DOCUSIGN_ACCOUNT_ID)) fail('DocuSign account ID is invalid.');
  return { basePath: base.href.replace(/\/$/, ''), accountId: process.env.DOCUSIGN_ACCOUNT_ID, publicOrigin: origin.origin, token: process.env.DOCUSIGN_ACCESS_TOKEN };
}
function status() {
  try { const cfg = config(); return { configured: true, environment: cfg.basePath.includes('demo.docusign.net') ? 'sandbox' : 'production' }; }
  catch { return { configured: false, environment: null }; }
}
function accountConfig(signature) {
  const cfg = config();
  if (signature && (signature.accountId !== cfg.accountId || signature.basePath !== cfg.basePath)) fail('This agreement belongs to a different DocuSign account configuration.');
  return cfg;
}
async function request(cfg, path, { method = 'GET', body, binary = false } = {}) {
  let response;
  try {
    response = await fetch(`${cfg.basePath}/v2.1/accounts/${encodeURIComponent(cfg.accountId)}${path}`, {
      method, headers: { Authorization: `Bearer ${cfg.token}`, Accept: binary ? 'application/pdf' : 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000), redirect: 'error',
    });
  } catch { fail('DocuSign could not be reached. Check status before retrying the same agreement.', 502); }
  if (!response.ok) fail(response.status === 401 ? 'DocuSign credentials expired or were rejected. Ask an administrator to renew access.' : 'DocuSign could not complete this request. Check the provider account and agreement status.', 502);
  if (binary) return Buffer.from(await response.arrayBuffer());
  return response.status === 204 ? {} : response.json();
}
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
function envelopeBody(subscription, cfg) {
  const s = subscription;
  const anchor = (role) => `RC_${role}_${s.id}`;
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;font-size:11pt;line-height:1.5;margin:36px">
    <h1>${escapeHtml(s.template.title)}</h1><p>Property: ${escapeHtml(s.propertyTitle)}<br>Issuer: ${escapeHtml(s.template.issuerLegalName)}<br>Terms version: ${s.template.version}<br>Terms SHA-256: ${s.template.sha256}</p>
    <div style="white-space:pre-wrap">${escapeHtml(s.template.terms).replace(/\n/g, '<br>')}</div>
    <h2>Subscriber details</h2><p>${escapeHtml(s.legalName)}<br>${escapeHtml(s.investorEmail)}<br>${escapeHtml(s.address)}<br>Country: ${escapeHtml(s.country)}<br>Subscription amount: USD ${(s.amountCents / 100).toFixed(2)}<br>Reference: ${s.id}</p>
    <p>Submitting or signing this subscription does not by itself confirm payment, acceptance of funds, or issuance of property shares.</p>
    <p style="margin-top:60px">Investor signature</p><p>${anchor('INVESTOR')}</p>
    <p style="margin-top:80px">Issuer representative: ${escapeHtml(s.representative.name)}</p><p>${anchor('REPRESENTATIVE')}</p></body></html>`;
  const signer = (id, name, email, role, routingOrder) => ({ recipientId: id, name, email, clientUserId: `${s.id}:${role}`, routingOrder,
    tabs: { signHereTabs: [{ anchorString: anchor(role.toUpperCase()), anchorUnits: 'pixels', anchorYOffset: '0', anchorXOffset: '0', optional: 'false' }] } });
  return { emailSubject: `Subscription: ${s.propertyTitle}`.slice(0, 100), transactionId: s.id,
    status: 'sent', allowReassign: 'false', recipientsLock: 'true',
    documents: [{ documentId: '1', name: 'Property subscription.html', fileExtension: 'html', documentBase64: Buffer.from(html, 'utf8').toString('base64') }],
    recipients: { signers: [signer('1', s.legalName, s.investorEmail, 'investor', '1'), signer('2', s.representative.name, s.representative.email, 'representative', '2')] },
    eventNotification: { url: `${cfg.publicOrigin}/api/agreements/docusign/webhook/${s.id}`, requireAcknowledgment: 'true', includeHMAC: 'true',
      loggingEnabled: 'true', envelopeEvents: ['sent', 'completed', 'declined', 'voided'].map((envelopeEventStatusCode) => ({ envelopeEventStatusCode })),
      recipientEvents: [{ recipientEventStatusCode: 'Completed' }, { recipientEventStatusCode: 'Declined' }],
      eventData: { version: 'restv2.1', format: 'json', includeData: ['recipients'] } },
  };
}
async function createEnvelope(subscription) {
  const cfg = config();
  // Reconcile an uncertain prior response before attempting the same transaction.
  // DocuSign retains transaction IDs for seven days; never recreate outside that window.
  if (Date.now() - Date.parse(subscription.approvedAt) > 6 * 86400000) fail('The signing-start window expired. Ask the property manager to close this request and submit a new subscription.', 409);
  const found = await request(cfg, `/envelopes?transaction_ids=${encodeURIComponent(subscription.id)}`);
  const previous = [...(found.envelopeTransactionStatuses || []), ...(found.envelopes || [])].find((row) => row.transactionId === subscription.id && row.envelopeId);
  const result = previous || await request(cfg, '/envelopes', { method: 'POST', body: envelopeBody(subscription, cfg) });
  if (!result.envelopeId) fail('DocuSign is still processing this agreement. Check status before retrying.', 502);
  return { envelopeId: result.envelopeId, accountId: cfg.accountId, basePath: cfg.basePath, providerStatus: result.status || 'sent', polledAt: new Date().toISOString() };
}
async function recipientView(subscription, role) {
  const cfg = accountConfig(subscription.signature);
  const investor = role === 'investor';
  const result = await request(cfg, `/envelopes/${encodeURIComponent(subscription.signature.envelopeId)}/views/recipient`, { method: 'POST', body: {
    returnUrl: `${cfg.publicOrigin}/property/${encodeURIComponent(subscription.propertyId)}?agreement=${subscription.id}`,
    authenticationMethod: 'Password', clientUserId: `${subscription.id}:${role}`, recipientId: investor ? '1' : '2',
    userName: investor ? subscription.legalName : subscription.representative.name, email: investor ? subscription.investorEmail : subscription.representative.email,
  } });
  const url = new URL(result.url);
  if (url.protocol !== 'https:' || !/(^|\.)docusign\.(net|com)$/.test(url.hostname)) fail('DocuSign returned an invalid signing URL.', 502);
  return url.href;
}
async function envelopeStatus(signature) {
  const cfg = accountConfig(signature);
  const id = encodeURIComponent(signature.envelopeId);
  const envelope = await request(cfg, `/envelopes/${id}`);
  const recipients = await request(cfg, `/envelopes/${id}/recipients`);
  return { ...envelope, recipients };
}
async function cancel(signature) {
  const cfg = accountConfig(signature);
  return request(cfg, `/envelopes/${encodeURIComponent(signature.envelopeId)}`, { method: 'PUT', body: { status: 'voided', voidedReason: 'Subscription cancelled by the property manager.' } });
}
async function download(signature) {
  const cfg = accountConfig(signature);
  const buffer = await request(cfg, `/envelopes/${encodeURIComponent(signature.envelopeId)}/documents/combined?certificate=true`, { binary: true });
  if (buffer.subarray(0, 5).toString() !== '%PDF-') fail('DocuSign did not return a PDF.', 502);
  return buffer;
}
function verifyWebhook(rawBody, headers) {
  const secret = process.env.DOCUSIGN_CONNECT_SECRET;
  if (!secret) fail('DocuSign webhook setup is required.');
  if (!rawBody || typeof rawBody !== 'string') fail('Original webhook bytes are required.', 400);
  const digest = createHmac('sha256', secret).update(rawBody, 'utf8').digest();
  const matched = Object.entries(headers).some(([key, value]) => {
    if (!/^x-docusign-signature-\d+$/i.test(key) || typeof value !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(value)) return false;
    const signature = Buffer.from(value, 'base64');
    return signature.length === digest.length && timingSafeEqual(signature, digest);
  });
  if (!matched) fail('Invalid DocuSign webhook signature.', 401);
}
module.exports = { status, config, createEnvelope, recipientView, envelopeStatus, cancel, download, verifyWebhook, envelopeBody };
