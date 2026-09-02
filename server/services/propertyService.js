const persistence = require('../mock/persistence');
const images = require('./imageService');

const STATUSES = new Set(['Available', 'Sold Out', 'Coming Soon']);
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

function list() {
  return persistence.data.properties || [];
}

function getById(id) {
  return list().find((p) => String(p.id) === String(id)) || null;
}

function nextId() {
  const ids = list()
    .map((p) => Number(p.id))
    .filter((n) => Number.isFinite(n));
  return String((ids.length ? Math.max(...ids) : 0) + 1);
}

function fail(message, status) {
  throw Object.assign(new Error(message), { status });
}

function asNumber(value, label, { min = 0, max, required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) fail(`${label} is required.`, 400);
    return undefined;
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n < min) fail(`${label} must be a number >= ${min}.`, 400);
  if (max !== undefined && n > max) fail(`${label} must be a number <= ${max}.`, 400);
  return n;
}

function asString(value, label, { required = false, max = 2000 } = {}) {
  if (value === undefined || value === null) {
    if (required) fail(`${label} is required.`, 400);
    return undefined;
  }
  const text = String(value).trim();
  if (required && !text) fail(`${label} is required.`, 400);
  if (text.length > max) fail(`${label} is too long.`, 400);
  return text;
}

function asAddress(value, label) {
  if (value === undefined || value === null || value === '') return undefined;
  const text = String(value).trim();
  if (!ADDRESS_RE.test(text)) fail(`${label} must be a valid EVM address.`, 400);
  return text;
}

function asDocs(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) fail('documents must be an array.', 400);
  return value.slice(0, 20).map((doc) => ({
    name: String(doc?.name || '').trim().slice(0, 120) || 'Document',
    url: String(doc?.url || '#').trim().slice(0, 500),
  }));
}

function asStrings(value, label) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) fail(`${label} must be an array.`, 400);
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 12);
}

function asCount(value, label) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return asNumber(value, label, { min: 0, max: 50 });
}

function asCoord(value, label, { min, max } = {}) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) fail(`${label} must be between ${min} and ${max}.`, 400);
  return n;
}

function asComps(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) fail('comps must be an array.', 400);
  return value.slice(0, 12).map((row) => {
    const address = String(row?.address || '').trim().slice(0, 160);
    const priceUsd = Number(row?.priceUsd);
    if (!address) fail('Each comp needs an address.', 400);
    if (!Number.isFinite(priceUsd) || priceUsd < 1) fail('Each comp needs a sale price of at least 1.', 400);
    const sqftRaw = row?.sqft;
    const sqft =
      sqftRaw === undefined || sqftRaw === null || sqftRaw === '' ? null : Number(sqftRaw);
    if (sqft !== null && (!Number.isFinite(sqft) || sqft < 1)) fail('Comp sqft must be a positive number.', 400);
    return {
      address,
      soldDate: String(row?.soldDate || '').trim().slice(0, 40),
      priceUsd,
      sqft,
      note: String(row?.note || '').trim().slice(0, 240),
    };
  });
}

function asAppraisals(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) fail('appraisals must be an array.', 400);
  return value.slice(0, 24).map((row) => {
    const date = String(row?.date || '').trim().slice(0, 40);
    const valueUsd = Number(row?.valueUsd);
    if (!date) fail('Each appraisal needs a date.', 400);
    if (!Number.isFinite(valueUsd) || valueUsd < 1) fail('Each appraisal needs a value of at least 1.', 400);
    return {
      date,
      valueUsd,
      note: String(row?.note || '').trim().slice(0, 240),
    };
  });
}

function create(input = {}) {
  const title = asString(input.title, 'Title', { required: true, max: 160 });
  const location = asString(input.location, 'Location', { required: true, max: 160 });
  const description = asString(input.description, 'Description', { max: 4000 }) || '';
  const imageUrl = asString(input.imageUrl, 'Image URL', { max: 500 }) || images.defaultUrl();
  const price = asNumber(input.price, 'Price', { min: 1, required: true });
  const totalTokens = asNumber(input.totalTokens, 'Share count', { min: 1, required: true });
  const status = STATUSES.has(input.status) ? input.status : 'Coming Soon';
  const sharePrice =
    asNumber(input.sharePriceUsdc, 'Share price') ||
    Math.round((price / totalTokens) * 100) / 100;
  const property = {
    id: nextId(),
    title,
    description,
    imageUrl,
    location,
    price,
    tokenPrice: sharePrice,
    sharePriceUsdc: sharePrice,
    totalTokens,
    tokensSold: 0,
    status,
    features: asStrings(input.features, 'features') || [],
    documents: asDocs(input.documents) || [],
    returnRate: asNumber(input.returnRate, 'Return rate') || 0,
    occupancyPercent: asNumber(input.occupancyPercent, 'Occupancy', { max: 100 }) ?? null,
    capRate: asNumber(input.capRate, 'Cap rate') ?? null,
    rentRollExcerpt: asString(input.rentRollExcerpt, 'Rent roll', { max: 2000 }) || '',
    galleryUrls: asStrings(input.galleryUrls, 'galleryUrls') || [],
    mapUrl: asString(input.mapUrl, 'Map URL', { max: 500 }) || '',
    lat: asCoord(input.lat, 'Latitude', { min: -90, max: 90 }) ?? null,
    lng: asCoord(input.lng, 'Longitude', { min: -180, max: 180 }) ?? null,
    unitMix: asString(input.unitMix, 'Unit mix', { max: 240 }) || '',
    bedrooms: asCount(input.bedrooms, 'Rooms') ?? null,
    bathrooms: asCount(input.bathrooms, 'WCs') ?? null,
    comps: asComps(input.comps) || [],
    grossRentMonthly: asNumber(input.grossRentMonthly, 'Gross rent') ?? null,
    opexMonthly: asNumber(input.opexMonthly, 'OpEx') ?? null,
    reservesMonthly: asNumber(input.reservesMonthly, 'Reserves') ?? null,
    nextAppraisalAt: asString(input.nextAppraisalAt, 'Next appraisal', { max: 40 }) || '',
    appraisals: asAppraisals(input.appraisals) || [],
    tokenAddress: null,
    offeringAddress: null,
    contractAddress: null,
    distributorAddress: null,
    redemptionAddress: null,
  };
  if (!Array.isArray(persistence.data.properties)) persistence.data.properties = [];
  persistence.data.properties.push(property);
  persistence.save();
  return property;
}

function update(id, input = {}) {
  const property = getById(id);
  if (!property) fail('Property not found', 404);

  const assign = (key, value) => {
    if (value !== undefined) property[key] = value;
  };

  assign('title', asString(input.title, 'Title', { max: 160 }));
  assign('location', asString(input.location, 'Location', { max: 160 }));
  assign('description', asString(input.description, 'Description', { max: 4000 }));
  assign('imageUrl', asString(input.imageUrl, 'Image URL', { max: 500 }));
  assign('price', asNumber(input.price, 'Price', { min: 1 }));
  assign('totalTokens', asNumber(input.totalTokens, 'Share count', { min: 1 }));
  assign('tokensSold', asNumber(input.tokensSold, 'Shares sold', { min: 0 }));
  assign('tokenPrice', asNumber(input.tokenPrice, 'Token price', { min: 0 }));
  assign('sharePriceUsdc', asNumber(input.sharePriceUsdc, 'Share price', { min: 0 }));
  assign('returnRate', asNumber(input.returnRate, 'Return rate', { min: 0 }));
  assign('occupancyPercent', asNumber(input.occupancyPercent, 'Occupancy', { min: 0, max: 100 }));
  assign('capRate', asNumber(input.capRate, 'Cap rate', { min: 0 }));
  assign('rentRollExcerpt', asString(input.rentRollExcerpt, 'Rent roll', { max: 2000 }));
  assign('mapUrl', asString(input.mapUrl, 'Map URL', { max: 500 }));
  assign('lat', asCoord(input.lat, 'Latitude', { min: -90, max: 90 }));
  assign('lng', asCoord(input.lng, 'Longitude', { min: -180, max: 180 }));
  assign('unitMix', asString(input.unitMix, 'Unit mix', { max: 240 }));
  assign('bedrooms', asCount(input.bedrooms, 'Rooms'));
  assign('bathrooms', asCount(input.bathrooms, 'WCs'));
  assign('comps', asComps(input.comps));
  assign('grossRentMonthly', asNumber(input.grossRentMonthly, 'Gross rent', { min: 0 }));
  assign('opexMonthly', asNumber(input.opexMonthly, 'OpEx', { min: 0 }));
  assign('reservesMonthly', asNumber(input.reservesMonthly, 'Reserves', { min: 0 }));
  assign('nextAppraisalAt', asString(input.nextAppraisalAt, 'Next appraisal', { max: 40 }));
  assign('appraisals', asAppraisals(input.appraisals));
  assign('features', asStrings(input.features, 'features'));
  assign('documents', asDocs(input.documents));
  assign('galleryUrls', asStrings(input.galleryUrls, 'galleryUrls'));
  assign('tokenAddress', asAddress(input.tokenAddress, 'Token address'));
  assign('offeringAddress', asAddress(input.offeringAddress, 'Offering address'));
  assign('distributorAddress', asAddress(input.distributorAddress, 'Distributor address'));
  assign('redemptionAddress', asAddress(input.redemptionAddress, 'Redemption address'));

  if (input.contractAddress !== undefined) {
    property.contractAddress = asAddress(input.contractAddress, 'Contract address') || property.tokenAddress;
  } else if (property.tokenAddress) {
    property.contractAddress = property.tokenAddress;
  }

  if (input.status !== undefined) {
    if (!STATUSES.has(input.status)) fail('Invalid status.', 400);
    property.status = input.status;
  }

  persistence.save();
  return property;
}

function remove(id) {
  const properties = list();
  const index = properties.findIndex((p) => String(p.id) === String(id));
  if (index === -1) fail('Property not found', 404);
  const [removed] = properties.splice(index, 1);
  persistence.save();
  return removed;
}

module.exports = { list, getById, create, update, remove };
