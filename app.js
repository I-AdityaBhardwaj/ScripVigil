/* ScripVigil — Stock Market Analysis & Surveillance
   Overview and demo-only examples remain clearly labelled. Market Trends, Surveillance,
   Alerts & Reviews, Reports, and chart hover detail use official listing context and
   backend provider analysis when available; unavailable provider data is not fabricated.
*/

const stocks = [
  { symbol:'TCS', name:'Tata Consultancy Services', price:3421.50, change:1.43, volumeRatio:1.2, volatility:2.1, sector:'IT Services', marketCap:'₹12.4L Cr', pe:28.6, beta:0.72, eventProximity:false },
  { symbol:'INFY', name:'Infosys Limited', price:1542.80, change:4.82, volumeRatio:3.9, volatility:4.8, sector:'IT Services', marketCap:'₹6.4L Cr', pe:24.1, beta:0.81, eventProximity:true },
  { symbol:'RELIANCE', name:'Reliance Industries', price:2890.20, change:-0.42, volumeRatio:0.9, volatility:1.8, sector:'Energy', marketCap:'₹19.6L Cr', pe:26.3, beta:0.94, eventProximity:false },
  { symbol:'HDFCBANK', name:'HDFC Bank', price:1718.25, change:0.67, volumeRatio:1.3, volatility:2.4, sector:'Banking', marketCap:'₹13.1L Cr', pe:19.8, beta:0.88, eventProximity:false },
  { symbol:'ICICIBANK', name:'ICICI Bank', price:1284.60, change:1.86, volumeRatio:1.6, volatility:2.6, sector:'Banking', marketCap:'₹9.0L Cr', pe:18.2, beta:0.97, eventProximity:false },
  { symbol:'SUNPHARMA', name:'Sun Pharmaceutical Industries', price:1786.10, change:-1.12, volumeRatio:1.1, volatility:2.0, sector:'Pharma', marketCap:'₹4.3L Cr', pe:32.4, beta:0.58, eventProximity:false },
  { symbol:'MARUTI', name:'Maruti Suzuki India', price:12840.00, change:2.31, volumeRatio:2.2, volatility:3.1, sector:'Automobile', marketCap:'₹4.1L Cr', pe:27.9, beta:1.05, eventProximity:false },
  { symbol:'TATASTEEL', name:'Tata Steel', price:164.35, change:-2.68, volumeRatio:2.8, volatility:4.4, sector:'Metals', marketCap:'₹2.0L Cr', pe:41.6, beta:1.28, eventProximity:false },
  { symbol:'ABC', name:'ABC Industries (Demo)', price:824.40, change:11.24, volumeRatio:5.7, volatility:6.1, sector:'Industrial', marketCap:'₹0.4L Cr', pe:46.8, beta:1.62, eventProximity:true },
  { symbol:'ITC', name:'ITC Limited', price:478.65, change:0.28, volumeRatio:1.0, volatility:1.5, sector:'FMCG', marketCap:'₹6.0L Cr', pe:23.5, beta:0.51, eventProximity:false }
];

const CONFIG = window.SCRIPTVIGIL_CONFIG || { defaultLookbackDays:20, lookbackOptions:[5,10,20,30,60], apiBaseUrl:'http://127.0.0.1:8000/api', dataMode:'demo' };
const state = { page:'dashboard', selected:'RELIANCE', selectedListing:null, timeframe:'1M', lookbackDays:CONFIG.defaultLookbackDays || 20, providerSelection:null, providerChartCandles:null, providerChartKey:null, providerChartUpdatedAt:null, providerChartTicker:null, providerChartSource:null, chartPlotModel:null, chartHoverIndex:null, chartRequestId:0, directoryUniverse:[], directoryUniverseFetchedAt:0, directoryUniverseComplete:false, directoryUniverseError:null, surveillanceView:[], surveillanceQuery:'', surveillanceExchange:'ALL', surveillancePage:0, surveillancePageSize:50, reviewRecords:[] };
const pageContent = document.getElementById('pageContent');
const globalSearch = document.getElementById('globalSearch');
const searchSuggestions = document.getElementById('searchSuggestions');
const modalBackdrop = document.getElementById('modalBackdrop');
const modal = document.getElementById('modal');
const historyCache = new Map();
const providerAnalysisCache = new Map();
const SELECTED_LISTING_STORAGE_KEY = 'scripvigil-selected-listing-v1';
const REVIEW_STORAGE_KEY = 'scripvigil-provider-review-records-v1';

// Company identity: Logo.dev uses a browser-safe publishable key, configured in config.js.
// No secret API key belongs in frontend code. If a provider logo is missing, initials remain.
function companyDisplayName(item) {
  return String(item?.company_name || item?.name || item?.symbol || item?.security_code || 'Company');
}
function companyTickerForLogo(item) {
  const exchange = String(item?.exchange || 'NSE').toUpperCase();
  const symbol = String(item?.symbol || item?.trading_symbol || item?.provider_symbol || '').trim().toUpperCase();
  const existingTicker = String(item?.ticker || item?.provider_ticker || '').trim().toUpperCase();
  const suffix = exchange === 'BSE' ? '.BO' : '.NS';
  const clean = value => value.replace(/\.(NS|BO)$/i, '');
  // Prefer the real trading symbol, not a numeric BSE security code.
  if (symbol && !/^\d+$/.test(clean(symbol))) return /\.(NS|BO)$/.test(symbol) ? symbol : symbol + suffix;
  if (existingTicker && !/^\d+\.(NS|BO)$/.test(existingTicker)) {
    if (/\.(NS|BO)$/.test(existingTicker)) return existingTicker;
    return existingTicker + suffix;
  }
  if (symbol) return /\.(NS|BO)$/.test(symbol) ? symbol : symbol + suffix;
  if (existingTicker) return /\.(NS|BO)$/.test(existingTicker) ? existingTicker : existingTicker + suffix;
  return '';
}
function initialsForCompany(item) {
  const symbol = String(item?.symbol || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
  if (symbol && !/^\d+$/.test(symbol)) return symbol.slice(0, 2);
  const words = companyDisplayName(item).replace(/\b(limited|ltd|private|pvt|incorporated|inc)\b/gi, '').trim().split(/\s+/).filter(Boolean);
  return (words.slice(0, 2).map(word => word[0]).join('') || symbol.slice(0, 2) || 'CO').toUpperCase();
}
function companyLogoUrl(kind, value, size=96) {
  const token = String(CONFIG.logoDevPublishableKey || '').trim();
  if (!token || token.includes('PASTE_') || token.toLowerCase().includes('your_')) return '';
  const encodedValue = encodeURIComponent(String(value || '').trim());
  if (!encodedValue) return '';
  const params = new URLSearchParams({token, size:String(size), format:'webp', fallback:'404'});
  return `https://img.logo.dev/${kind}/${encodedValue}?${params.toString()}`;
}
const COMPANY_LOGO_DOMAINS = {
  TCS: 'tcs.com',
  INFY: 'infosys.com',
  RELIANCE: 'ril.com',
  HDFCBANK: 'hdfcbank.com',
  ICICIBANK: 'icicibank.com',
  SUNPHARMA: 'sunpharma.com',
  MARUTI: 'marutisuzuki.com',
  TATASTEEL: 'tatasteel.com',
  ITC: 'itcportal.com'
};
function companyLogoDomain(item) {
  const symbol = String(item?.symbol || item?.trading_symbol || '').trim().toUpperCase();
  return COMPANY_LOGO_DOMAINS[symbol] || '';
}
function renderCompanyLogo(item, sizeClass='medium', size=96) {
  const name = companyDisplayName(item);
  const initials = initialsForCompany(item);
  const ticker = companyTickerForLogo(item);
  const isin = String(item?.isin || '').trim().toUpperCase();
  const domain = companyLogoDomain(item);
  // Prefer a vetted official domain for known companies. Some logo providers can
  // return an imprecise match for ISIN lookups; domain-first avoids a wrong-brand logo.
  // For other listings, use ISIN and then the exchange ticker as fallbacks.
  const logoKind = domain ? 'domain' : (isin ? 'isin' : 'ticker');
  const logoValue = domain || isin || ticker;
  const logoUrl = companyLogoUrl(logoKind, logoValue, size);
  const image = logoUrl
    ? `<img class="company-logo-image" src="${escapeHtml(logoUrl)}" data-logo-stage="${escapeHtml(logoKind)}" data-logo-attempts="${escapeHtml(logoKind)}" alt="" aria-hidden="true" loading="lazy" decoding="async" />`
    : '';
  return `<span class="company-logo ${escapeHtml(sizeClass)}" role="img" aria-label="${escapeHtml(name)} logo" title="${escapeHtml(name)}" data-logo-ticker="${escapeHtml(ticker)}" data-logo-isin="${escapeHtml(isin)}" data-logo-domain="${escapeHtml(domain)}"><span class="company-logo-fallback" aria-hidden="true">${escapeHtml(initials)}</span>${image}</span>`;
}
// Try each known identity once if Logo.dev doesn't have the preferred lookup.
document.addEventListener('load', event => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || !image.classList.contains('company-logo-image')) return;
  image.closest('.company-logo')?.classList.add('logo-loaded');
}, true);
document.addEventListener('error', event => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || !image.classList.contains('company-logo-image')) return;
  const wrapper = image.closest('.company-logo');
  if (!wrapper) { image.remove(); return; }
  const attempted = new Set(String(image.dataset.logoAttempts || image.dataset.logoStage || '').split(',').filter(Boolean));
  const options = [
    ['domain', wrapper.dataset.logoDomain || ''],
    ['ticker', wrapper.dataset.logoTicker || ''],
    ['isin', wrapper.dataset.logoIsin || '']
  ];
  const next = options.find(([kind, value]) => value && !attempted.has(kind));
  if (next) {
    const [kind, value] = next;
    attempted.add(kind);
    image.dataset.logoAttempts = [...attempted].join(',');
    image.dataset.logoStage = kind;
    image.src = companyLogoUrl(kind, value, 96);
    return;
  }
  wrapper.classList.remove('logo-loaded');
  wrapper.classList.add('logo-unavailable');
  image.remove();
}, true);

try {
  const savedListing = JSON.parse(localStorage.getItem(SELECTED_LISTING_STORAGE_KEY) || 'null');
  if (savedListing && savedListing.symbol && savedListing.exchange) {
    state.selectedListing = savedListing;
    state.selected = savedListing.symbol;
  }
} catch (_) { /* Storage is optional; the app still runs without it. */ }
try {
  const savedReviews = JSON.parse(localStorage.getItem(REVIEW_STORAGE_KEY) || '[]');
  if (Array.isArray(savedReviews)) state.reviewRecords = savedReviews;
} catch (_) { state.reviewRecords = []; }

function listingKey(listing) {
  return listing ? `${String(listing.exchange || 'NSE').toUpperCase()}:${String(listing.symbol || listing.security_code || '').toUpperCase()}` : '';
}
function analysisKey(listing, days=state.lookbackDays) {
  return `${listingKey(listing)}:${Number(days)}`;
}
function activeListing() {
  const listing = state.selectedListing || null;
  // A previous directory selection must never override a different stock selected
  // in the demo/dashboard view.
  if (listing && state.selected && String(listing.symbol || '').toUpperCase() !== String(state.selected).toUpperCase()) return null;
  return listing;
}
function currentAnalysisEntry() {
  const listing = activeListing();
  return listing ? (providerAnalysisCache.get(analysisKey(listing, state.lookbackDays)) || null) : null;
}
function currentProviderAnalysis() {
  const entry = currentAnalysisEntry();
  return entry && entry.data ? entry.data : null;
}
function saveReviews() {
  try { localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(state.reviewRecords.slice(0, 100))); } catch (_) {}
}
function cacheProviderAnalysis(listing, days, data) {
  if (!listing || !data) return;
  const key = analysisKey(listing, days);
  providerAnalysisCache.set(key, {data, error:null, fetchedAt:Date.now()});
  const id = key;
  const previous = state.reviewRecords.find(item => item.id === id);
  const flags = Array.isArray(data.surveillance_flags) ? data.surveillance_flags : [];
  const record = {
    id,
    company_name: listing.company_name || listing.name || listing.symbol,
    symbol: listing.symbol,
    exchange: listing.exchange,
    isin: listing.isin || null,
    security_code: listing.security_code || null,
    ticker: data.ticker || listing.ticker || null,
    provider: data.provider || 'Yahoo Finance',
    data_status: data.data_status || 'historical_provider_data',
    analyzed_at: new Date().toISOString(),
    lookback_days: Number(days),
    latest_close: data.latest_close ?? null,
    daily_change_percent: data.daily_change_percent ?? null,
    sma_5: data.sma_5 ?? null,
    sma_20: data.sma_20 ?? null,
    return_z_score: data.return_z_score ?? null,
    volume_ratio: data.volume_ratio ?? null,
    anomaly_score: data.anomaly_score ?? null,
    classification: data.classification || 'Unknown',
    surveillance_flags: flags,
    records_used: data.records_used ?? null,
    review_status: previous ? previous.review_status : (['High','Watch'].includes(data.classification) ? 'Open' : 'No alert'),
    reviewed_at: previous ? previous.reviewed_at || null : null
  };
  state.reviewRecords = [record, ...state.reviewRecords.filter(item => item.id !== id)]
    .sort((a,b) => String(b.analyzed_at || '').localeCompare(String(a.analyzed_at || '')))
    .slice(0, 100);
  saveReviews();
}
function cacheProviderAnalysisError(listing, days, message) {
  if (!listing) return;
  providerAnalysisCache.set(analysisKey(listing, days), {data:null, error:String(message || 'Provider analysis unavailable'), fetchedAt:Date.now()});
}
function setSelectedListing(listing) {
  if (!listing || !listing.symbol || !listing.exchange) return;
  const changed = listingKey(state.selectedListing) !== listingKey(listing) || String(state.selectedListing?.security_code || '') !== String(listing.security_code || '');
  state.selectedListing = listing;
  state.selected = listing.symbol;
  state.providerSelection = listing;
  if (changed) {
    // Invalidate any request still in flight for the previous selection immediately.
    state.chartRequestId += 1;
    state.providerChartCandles = null;
    state.providerChartKey = null;
    state.providerChartTicker = null;
    state.providerChartSource = null;
    state.providerChartUpdatedAt = null;
    state.chartHoverIndex = null;
  }
  try { localStorage.setItem(SELECTED_LISTING_STORAGE_KEY, JSON.stringify(listing)); } catch (_) {}
}
function formatMetric(value, digits=2) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString('en-IN', {minimumFractionDigits:digits, maximumFractionDigits:digits});
}
function classificationLevel(value) {
  const v = String(value || '').toLowerCase();
  return v === 'high' ? 'high' : v === 'watch' ? 'watch' : v === 'normal' ? 'normal' : 'unknown';
}
function classificationBadge(value) {
  const v = value || 'Not screened';
  const level = classificationLevel(v);
  const cls = level === 'high' ? 'red' : level === 'watch' ? 'amber' : level === 'normal' ? 'green' : 'blue';
  return `<span class="badge ${cls}">${escapeHtml(v)}</span>`;
}
async function fetchJson(url) {
  const response = await fetch(url, {cache:'no-store'});
  let data;
  try { data = await response.json(); } catch (_) { data = {}; }
  if (!response.ok) {
    const detail = data && data.detail;
    let message = typeof detail === 'string' ? detail : detail && typeof detail === 'object' ? (detail.message || JSON.stringify(detail)) : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return data;
}
async function lookupListingForCurrentSymbol() {
  const query = String(state.selected || '').trim();
  if (!query) return null;
  const url = new URL(`${CONFIG.apiBaseUrl}/instruments/directory`);
  url.searchParams.set('query', query);
  url.searchParams.set('exchange', 'ALL');
  url.searchParams.set('limit', '20');
  url.searchParams.set('offset', '0');
  const data = await fetchJson(url.toString());
  const results = Array.isArray(data.results) ? data.results : [];
  const exact = results.filter(item => String(item.symbol || '').toUpperCase() === query.toUpperCase());
  return exact.find(item => item.exchange === 'NSE') || exact[0] || results[0] || null;
}
async function hydrateCompanyPage(expectedPage, {force=false}={}) {
  if (state.page !== expectedPage) return;
  let listing = activeListing();
  if (!listing) {
    const selectedAtStart = state.selected;
    try { listing = await lookupListingForCurrentSymbol(); } catch (_) { return; }
    if (state.page !== expectedPage || state.selected !== selectedAtStart || !listing) return;
    setSelectedListing(listing);
    render();
    return;
  }
  const key = analysisKey(listing, state.lookbackDays);
  const cached = providerAnalysisCache.get(key);
  const maxAge = cached && cached.error ? 45000 : 180000;
  if (!force && cached && Date.now() - cached.fetchedAt < maxAge) return;
  const url = new URL(`${CONFIG.apiBaseUrl}/market/yahoo-analyze`);
  url.searchParams.set('symbol', listing.symbol || listing.security_code);
  url.searchParams.set('exchange', listing.exchange);
  url.searchParams.set('lookback_days', String(state.lookbackDays));
  try {
    const data = await fetchJson(url.toString());
    if (state.page !== expectedPage || listingKey(state.selectedListing) !== listingKey(listing)) return;
    cacheProviderAnalysis(listing, state.lookbackDays, data);
    render();
  } catch (error) {
    if (state.page !== expectedPage || listingKey(state.selectedListing) !== listingKey(listing)) return;
    cacheProviderAnalysisError(listing, state.lookbackDays, error.message);
    render();
  }
}
async function loadRealDirectoryUniverse(expectedPage='surveillance', {force=false}={}) {
  if (state.page !== expectedPage || expectedPage !== 'surveillance') return;
  if (!force && state.directoryUniverse.length && Date.now() - state.directoryUniverseFetchedAt < 300000) return;
  try {
    let universe = [];
    let complete = false;
    const url = new URL(`${CONFIG.apiBaseUrl}/instruments/directory/universe`);
    url.searchParams.set('exchange', 'ALL');
    url.searchParams.set('refresh', force ? 'true' : 'false');
    try {
      const data = await fetchJson(url.toString());
      universe = Array.isArray(data.results) ? data.results : [];
      complete = Boolean(data.is_complete);
    } catch (universeError) {
      // Compatibility fallback for older backends without the bulk endpoint.
      if (!String(universeError.message || '').includes('404') && !String(universeError.message || '').toLowerCase().includes('not found')) throw universeError;
      const fetchExchange = async exchange => {
        const all = [];
        let offset = 0;
        let total = Infinity;
        while (offset < total && offset < 20000) {
          const pageUrl = new URL(`${CONFIG.apiBaseUrl}/instruments/directory`);
          pageUrl.searchParams.set('query', '');
          pageUrl.searchParams.set('exchange', exchange);
          pageUrl.searchParams.set('limit', '100');
          pageUrl.searchParams.set('offset', String(offset));
          const page = await fetchJson(pageUrl.toString());
          const rows = Array.isArray(page.results) ? page.results : [];
          total = Number(page.total_filtered ?? page.directory_total ?? offset + rows.length);
          all.push(...rows);
          if (!rows.length) break;
          offset += rows.length;
        }
        return all;
      };
      const [nse, bse] = await Promise.all([fetchExchange('NSE'), fetchExchange('BSE')]);
      universe = [...nse, ...bse];
      complete = universe.length > 0;
    }
    if (state.page !== expectedPage) return;
    const merged = [];
    const seen = new Set();
    const add = item => {
      if (!item) return;
      const key = listingKey(item) + ':' + String(item.security_code || '');
      if (!seen.has(key)) { seen.add(key); merged.push(item); }
    };
    add(state.selectedListing);
    universe.forEach(add);
    state.directoryUniverse = merged;
    state.directoryUniverseComplete = complete;
    state.directoryUniverseError = null;
    state.directoryUniverseFetchedAt = Date.now();
    state.surveillancePage = Math.min(state.surveillancePage, Math.max(0, Math.ceil(merged.length / state.surveillancePageSize) - 1));
    render();
  } catch (error) {
    state.directoryUniverseError = error.message;
    if (state.page === expectedPage) render();
  }
}
function currentUniverseView() {
  const items = [];
  const seen = new Set();
  const add = item => {
    if (!item) return;
    const key = listingKey(item) + ':' + String(item.security_code || '');
    if (!seen.has(key)) { seen.add(key); items.push(item); }
  };
  add(state.selectedListing);
  (state.directoryUniverse || []).forEach(add);
  const q = String(state.surveillanceQuery || '').trim().toLowerCase();
  const exchange = state.surveillanceExchange || 'ALL';
  const filtered = items.filter(item => {
    if (exchange !== 'ALL' && item.exchange !== exchange) return false;
    if (!q) return true;
    return [item.company_name, item.symbol, item.exchange, item.isin, item.security_code, item.industry]
      .some(value => String(value || '').toLowerCase().includes(q));
  });
  const pages = Math.max(1, Math.ceil(filtered.length / state.surveillancePageSize));
  state.surveillancePage = clamp(Number(state.surveillancePage || 0), 0, pages - 1);
  state.surveillanceTotalFiltered = filtered.length;
  state.surveillancePageCount = pages;
  state.surveillanceView = filtered.slice(state.surveillancePage * state.surveillancePageSize, (state.surveillancePage + 1) * state.surveillancePageSize);
  return state.surveillanceView;
}
function markReviewRecordReviewed(id) {
  const now = new Date().toISOString();
  state.reviewRecords = state.reviewRecords.map(record => record.id === id ? {...record, review_status:'Reviewed', reviewed_at:now} : record);
  saveReviews();
}

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function average(values) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function standardDeviation(values) {
  if (values.length < 2) return 1;
  const m = average(values);
  return Math.sqrt(average(values.map(v => (v - m) ** 2))) || 1;
}
function money(n) { return '₹' + Number(n).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2}); }
function signed(n) { return `${n >= 0 ? '+' : ''}${Number(n).toFixed(2)}%`; }
function findStock(symbol) { return stocks.find(s => s.symbol.toLowerCase() === String(symbol || '').toLowerCase()) || stocks[0]; }
function trendLabel(s) {
  if (s.change >= 2) return { label:'Positive momentum', cls:'green', arrow:'↗' };
  if (s.change >= .25) return { label:'Mildly positive', cls:'green', arrow:'↗' };
  if (s.change <= -2) return { label:'Negative momentum', cls:'red', arrow:'↘' };
  if (s.change <= -.25) return { label:'Mildly negative', cls:'red', arrow:'↘' };
  return { label:'Mixed / sideways', cls:'amber', arrow:'→' };
}
function badge(score) {
  if (score >= 75) return '<span class="badge red">● High anomaly</span>';
  if (score >= 50) return '<span class="badge amber">● Review</span>';
  return '<span class="badge green">● Within baseline</span>';
}
function trendBadge(s) {
  const trend = trendLabel(s);
  return `<span class="badge ${trend.cls}">${trend.arrow} ${trend.label}</span>`;
}
function toast(message) {
  const host = document.getElementById('toastContainer');
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = message;
  host.appendChild(el); window.setTimeout(() => el.remove(), 3400);
}
function openModal(title, body, actions='') {
  modal.innerHTML = `<div class="modal-head"><div><div class="eyebrow">ScripVigil</div><h3>${title}</h3></div><button class="close-btn" id="closeModal" aria-label="Close dialog">✕</button></div><div class="modal-body">${body}</div>${actions ? `<div class="modal-actions">${actions}</div>`:''}`;
  modalBackdrop.classList.remove('hidden');
  document.getElementById('closeModal').onclick = closeModal;
}
function closeModal() { modalBackdrop.classList.add('hidden'); }
modalBackdrop.addEventListener('click', e => { if (e.target === modalBackdrop) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

function demoHistory(stock) {
  if (historyCache.has(stock.symbol)) return historyCache.get(stock.symbol);
  const seed = stock.symbol.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const returns = [];
  const volume = [];
  for (let i=0; i<60; i++) {
    const waveA = Math.sin((i + seed) * .73) * (0.52 + stock.volatility * .045);
    const waveB = Math.cos((i + seed) * .29) * .34;
    const drift = Math.sin((i + seed) * .11) * .08;
    returns.push(waveA + waveB + drift);
    volume.push(1 + Math.sin((i + seed) * .41) * .17 + Math.cos((i + seed) * .19) * .075);
  }
  // Normalise the synthetic last-20-session volumes to a baseline of 1.0.
  const last20Mean = average(volume.slice(-20));
  const normalizedVolume = volume.map(v => v / (last20Mean || 1));
  const record = { returns, volume:normalizedVolume };
  historyCache.set(stock.symbol, record);
  return record;
}

function getWindowMetrics(stock, days=state.lookbackDays) {
  const lookback = clamp(Number(days) || 20, 5, 60);
  const history = demoHistory(stock);
  const returns = history.returns.slice(-lookback);
  const historicalVolumes = history.volume.slice(-lookback);
  const averageReturn = average(returns);
  const returnStd = standardDeviation(returns);
  const returnZ = (stock.change - averageReturn) / returnStd;
  // Current demo volume is expressed relative to the normalised 20-session average.
  const currentVolume = stock.volumeRatio;
  const volumeBaseline = average(historicalVolumes) || 1;
  const volumeRatio = currentVolume / volumeBaseline;
  const priceSignal = clamp((Math.abs(returnZ) - 1.5) * 17, 0, 100);
  const volumeSignal = clamp((volumeRatio - 1) * 22, 0, 100);
  const volatilitySignal = clamp((stock.volatility - 1.5) * 17, 0, 100);
  const marketSignal = clamp(Math.abs(stock.change - 0.7) * 6, 0, 100);
  const eventSignal = stock.eventProximity ? 80 : 0;
  const score = Math.round(clamp(priceSignal*.30 + volumeSignal*.30 + volatilitySignal*.18 + marketSignal*.12 + eventSignal*.10, 0, 100));
  const avgAbsReturn = average(returns.map(Math.abs));
  return {
    days:lookback, averageReturn, returnStd, returnZ, priceSignal:Math.round(priceSignal),
    volumeBaseline, volumeRatio, volumeSignal:Math.round(volumeSignal),
    volatilitySignal:Math.round(volatilitySignal), marketSignal:Math.round(marketSignal),
    eventSignal, avgAbsReturn, score
  };
}
function getAlertStocks(days=state.lookbackDays) {
  return stocks.map(stock => ({ stock, metrics:getWindowMetrics(stock, days) })).sort((a,b) => b.metrics.score-a.metrics.score);
}

function header(eyebrow, title, subtitle, actions='') {
  return `<div class="page-head"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p class="subtitle">${subtitle}</p></div><div class="page-actions">${actions}</div></div>`;
}
function pageFooter() {
  return '<div class="footer-note">Sample cards and index snapshots are illustrative. The selected chart attempts provider refresh every 60 seconds where available; data may be delayed and is not a guaranteed live feed. Surveillance flags are review signals, not proof of insider trading.</div>';
}

function render() {
  const pages = {
    dashboard:renderDashboard,
    stocks:renderStocks,
    directory:renderDirectory,
    forecast:renderMarketTrends,
    surveillance:renderSurveillance,
    alerts:renderAlerts,
    reports:renderReports,
    methodology:renderMethodology
  };
  pageContent.innerHTML = (pages[state.page] || renderDashboard)();
  document.querySelectorAll('.nav-item[data-page]').forEach(btn => btn.classList.toggle('active', btn.dataset.page === state.page));
  bindCommon();
  if (['dashboard','stocks','forecast'].includes(state.page)) window.setTimeout(() => { drawChart(); refreshMainChartData({quiet:true}); }, 35);
  if (state.page === 'directory') window.setTimeout(() => loadDirectoryPage(), 25);
  if (['forecast','surveillance','alerts','reports'].includes(state.page)) {
    const activePage = state.page;
    window.setTimeout(() => hydrateCompanyPage(activePage), 30);
    if (activePage === 'surveillance') window.setTimeout(() => loadRealDirectoryUniverse(activePage), 45);
  }
}
function go(page, selected=null) {
  state.page = page;
  if (selected) {
    state.selected = selected;
    if (state.selectedListing && String(state.selectedListing.symbol).toUpperCase() !== String(selected).toUpperCase()) {
      state.selectedListing = null;
      try { localStorage.removeItem(SELECTED_LISTING_STORAGE_KEY); } catch (_) {}
    }
    state.providerSelection = page === 'stocks' ? state.selectedListing : null;
  } else if (page !== 'stocks') state.providerSelection = null;
  render();
  document.getElementById('sidebar').classList.remove('open');
  window.scrollTo({top:0, behavior:'smooth'});
}
function bindCommon() {
  document.querySelectorAll('[data-go]').forEach(el => el.onclick = () => go(el.dataset.go, el.dataset.stock || null));
  document.querySelectorAll('tr[data-stock]').forEach(el => el.onclick = () => go('stocks', el.dataset.stock));
  document.querySelectorAll('.segment').forEach(el => el.onclick = () => {
    state.timeframe = el.dataset.range;
    document.querySelectorAll('.segment').forEach(x => x.classList.toggle('active', x.dataset.range === state.timeframe));
    drawChart();
    refreshMainChartData({quiet:true});
  });
  document.querySelectorAll('[data-action="alert-detail"]').forEach(el => el.onclick = e => { e.stopPropagation(); openAlert(el.dataset.symbol); });
  const lookback = document.getElementById('lookbackDays');
  if (lookback) lookback.onchange = () => {
    state.lookbackDays = Number(lookback.value);
    render();
    toast(`Analysis window changed to ${state.lookbackDays} trading sessions. Provider data will be requested where available.`);
  };
}

function miniSparkline(stock) {
  const hist = demoHistory(stock).returns.slice(-18);
  let value = 100;
  const values = [value];
  hist.forEach(change => { value += change * 0.22; values.push(value); });
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
  const pts = values.map((v, i) => `${3 + i * 154 / (values.length - 1)},${34 - ((v - min) / range) * 28}`).join(' ');
  const color = stock.change >= 0 ? '#29a681' : '#dc6478';
  const first = pts.split(' ')[0], last = pts.split(' ').at(-1);
  const fillPath = `M ${first} L ${pts.replaceAll(' ', ' L ')} L 157,38 L 3,38 Z`;
  return `<svg class="sparkline ${stock.change >= 0 ? 'positive' : 'negative'}" viewBox="0 0 160 42" aria-label="Illustrative ${escapeHtml(stock.symbol)} sparkline"><path class="spark-fill" d="${fillPath}" fill="${color}" opacity=".10"></path><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline><circle cx="${last.split(',')[0]}" cy="${last.split(',')[1]}" r="2.6" fill="${color}"></circle></svg>`;
}

function renderDashboard() {
  const topAlert = getAlertStocks()[0];
  const scan = getAlertStocks();
  const high = scan.filter(x => x.metrics.score >= 75).length;
  const watch = scan.filter(x => x.metrics.score >= 50 && x.metrics.score < 75).length;
  const featured = ['RELIANCE','TCS','HDFCBANK','INFY','ICICIBANK','MARUTI'].map(findStock);
  const selected = findStock(state.selected);
  const positiveCount = stocks.filter(s => s.change >= 0).length;
  const negativeCount = stocks.length - positiveCount;
  return `
    <section class="market-hero">
      <div class="hero-kicker"><span class="hero-kicker-mark">✦</span> FREE MARKET DISCOVERY <span class="hero-kicker-line"></span><span class="hero-kicker-note">NSE + BSE EQUITIES</span></div>
      <h1>See every scrip.<br><span>Spot what matters.</span></h1>
      <p>Explore Indian equities with intuitive charts, historical analysis, and explainable market-surveillance signals — all in one workspace.</p>
      <div class="hero-search-row">
        <span class="hero-search-icon">⌕</span>
        <input id="heroSearch" type="search" placeholder="Search stocks by company, symbol, ISIN or BSE code…" aria-label="Search Indian stock listings" autocomplete="off" />
        <button class="btn primary" id="heroSearchBtn" type="button">Search market <span>→</span></button>
      </div>
      <div class="hero-browse"><span>Browse sectors</span>
        <button class="sector-pill active" data-sector-filter="all">All equities</button>
        <button class="sector-pill" data-sector-filter="IT Services">Technology</button>
        <button class="sector-pill" data-sector-filter="Banking">Banking</button>
        <button class="sector-pill" data-sector-filter="Energy">Energy</button>
        <button class="sector-pill" data-sector-filter="Automobile">Automobile</button>
      </div>
    </section>

    <div class="market-section-head">
      <div><div class="eyebrow">MARKET OVERVIEW</div><h2>Markets at a glance</h2><p>Sample watchlist and illustrative snapshots. Choose a scrip to open its analysis.</p></div>
      <div class="market-section-tools"><span class="data-state-tag"><i class="pulse-dot"></i> Sample snapshots</span><button class="btn" id="refreshBtn">↻ Refresh view</button></div>
    </div>

    <div class="market-stocks-grid" id="marketStocksGrid">
      ${featured.map(s => `<button class="market-stock-card" data-go="stocks" data-stock="${s.symbol}" data-sector="${escapeHtml(s.sector)}" type="button">
        <div class="market-card-top"><div class="market-card-identity">${renderCompanyLogo({...s, exchange: 'NSE', ticker: s.symbol + '.NS'}, 'market-stock-avatar', 64)}<span><strong>${escapeHtml(s.symbol)}</strong><small>${escapeHtml(s.name)}</small></span></div><span class="market-favourite" aria-hidden="true">☆</span></div>
        <div class="market-card-chart">${miniSparkline(s)}</div>
        <div class="market-card-bottom"><strong>${money(s.price)}</strong><span class="${s.change>=0?'up':'down'}">${s.change>=0?'↗':'↘'} ${signed(s.change)}</span></div>
      </button>`).join('')}
    </div>

    <div class="market-terminal-grid">
      <section class="card terminal-chart-card">
        <div class="terminal-chart-head">
          <div class="terminal-security-title">${renderCompanyLogo(activeListing() || {...selected, exchange: 'NSE', ticker: selected.symbol + '.NS'}, 'market-stock-avatar large', 96)}<div><div class="terminal-symbol-line"><strong>${escapeHtml(selected.symbol)}</strong><span class="badge ${trendLabel(selected).cls}">${trendLabel(selected).label}</span></div><small>${escapeHtml(selected.name)} · NSE illustrative listing</small></div></div>
          <div class="terminal-quick-actions"><button class="icon-button chart-refresh-button" id="refreshChartBtn" title="Refresh selected chart" aria-label="Refresh chart">↻</button><button class="btn" data-go="stocks" data-stock="${selected.symbol}">Full analysis ↗</button></div>
        </div>
        <div class="terminal-price-row"><div><strong class="terminal-price">${money(selected.price)}</strong><span class="terminal-change ${selected.change>=0?'up':'down'}">${signed(selected.change)} <small>sample session</small></span></div><div class="chart-provider-status" id="chartDataStatus"><span class="status-dot idle"></span> Connecting to historical provider…</div></div>
        <div class="chart-wrap terminal-main-chart"><canvas id="mainChart" aria-label="Selected stock price chart with provider auto-refresh when available"></canvas></div>
        <div class="chart-axis-hints"><span id="chartStartLabel">Earlier</span><span id="chartSourceLabel">Sample chart until provider data is available</span><span id="chartEndLabel">Latest</span></div>
        <div class="terminal-chart-footer"><div class="chart-toolbar"><button class="segment ${state.timeframe==='1D'?'active':''}" data-range="1D">1D</button><button class="segment ${state.timeframe==='1W'?'active':''}" data-range="1W">1W</button><button class="segment ${state.timeframe==='1M'?'active':''}" data-range="1M">1M</button><button class="segment ${state.timeframe==='6M'?'active':''}" data-range="6M">6M</button><button class="segment ${state.timeframe==='1Y'?'active':''}" data-range="1Y">1Y</button></div><div class="legend"><div class="legend-item"><span class="legend-dot"></span>Price path</div><div class="legend-item"><span class="legend-dot alt"></span>Rolling average</div></div></div>
        <div class="chart-refresh-footnote"><span class="pulse-dot"></span> Auto-refresh attempts every 60 seconds when the selected provider returns chart data. Yahoo Finance may be delayed or unavailable; this is not a guaranteed live feed.</div>
      </section>

      <aside class="terminal-side-column">
        <section class="card side-watchlist-card">
          <div class="side-card-head"><div><span class="eyebrow">YOUR WATCHLIST</span><h3>Keep an eye on</h3></div><button class="icon-button small-action" data-go="stocks" data-stock="RELIANCE" title="Open stock analysis">＋</button></div>
          <div class="side-watchlist-list">
            ${['RELIANCE','TCS','ICICIBANK'].map(sym => {const s=findStock(sym);return `<button class="side-watchlist-item" type="button" data-go="stocks" data-stock="${s.symbol}"><span class="side-stock-icon">${s.symbol.slice(0,1)}</span><span class="side-stock-name"><strong>${s.symbol}</strong><small>${s.name}</small></span><span class="side-stock-price"><strong>${money(s.price).replace('.00','')}</strong><small class="${s.change>=0?'up':'down'}">${signed(s.change)}</small></span></button>`}).join('')}
          </div>
          <button class="btn side-full-btn" data-go="surveillance">Open surveillance queue <span>→</span></button>
        </section>
        <section class="card market-pulse-card">
          <div class="side-card-head"><div><span class="eyebrow">MARKET PULSE</span><h3>Broad market mood</h3></div><span class="pulse-chip">DEMO</span></div>
          <div class="pulse-headline"><strong>${positiveCount >= negativeCount ? 'Bulls hold the edge' : 'Bears lead the session'}</strong><small>Illustrative universe · ${stocks.length} sample stocks</small></div>
          <div class="pulse-split"><span>Positive <strong>${positiveCount}</strong></span><span>Negative <strong>${negativeCount}</strong></span></div>
          <div class="pulse-bar"><span style="width:${positiveCount / stocks.length * 100}%"></span></div>
          <div class="pulse-legend"><span><i class="pulse-up"></i>Positive ${Math.round(positiveCount/stocks.length*100)}%</span><span><i class="pulse-down"></i>Negative ${Math.round(negativeCount/stocks.length*100)}%</span></div>
          <div class="notice warn pulse-disclaimer">Sample breadth only. No live index/market breadth feed is connected.</div>
        </section>
      </aside>
    </div>

    <div class="market-section-head compact-head"><div><div class="eyebrow">SURVEILLANCE SNAPSHOT</div><h2>What deserves a closer look?</h2><p>Screening signals help prioritise review; they do not establish misconduct.</p></div><button class="btn" data-go="surveillance">Explore surveillance →</button></div>
    <div class="grid grid-4 dashboard-kpis">
      <div class="card metric-card"><div class="metric-top"><span class="metric-label">Stocks in demo universe</span><span class="metric-icon">▦</span></div><div class="metric-value">${stocks.length}</div><div class="metric-sub">Representative sample symbols</div></div>
      <div class="card metric-card"><div class="metric-top"><span class="metric-label">High anomalies</span><span class="metric-icon">⚑</span></div><div class="metric-value">${high}</div><div class="metric-sub">Current ${state.lookbackDays}-session baseline</div></div>
      <div class="card metric-card"><div class="metric-top"><span class="metric-label">Review queue</span><span class="metric-icon">◎</span></div><div class="metric-value">${watch + high}</div><div class="metric-sub">High + watch classifications</div></div>
      <div class="card metric-card"><div class="metric-top"><span class="metric-label">Data connection</span><span class="metric-icon">⌁</span></div><div class="metric-value" style="font-size:20px">Provider polling</div><div class="metric-sub">Yahoo history · auto-refresh attempts</div></div>
    </div>

    <div class="card pad monitored-securities-card">
      <div class="card-title"><div><h3>Monitored securities</h3><small>Click a row to inspect the stock · demo metrics until provider data is loaded</small></div><button class="btn" data-go="directory">Search all NSE + BSE listings →</button></div>
      <div class="table-wrap"><table><thead><tr><th>Stock</th><th>Price (demo)</th><th>Change</th><th>Volume ratio</th><th>Trend</th><th>Anomaly status</th></tr></thead><tbody>
        ${stocks.map(s=>{const m=getWindowMetrics(s);return `<tr data-stock="${s.symbol}"><td><div class="stock-cell">${renderCompanyLogo({...s, exchange: 'NSE', ticker: s.symbol + '.NS'}, 'stock-logo', 64)}<div class="stock-name"><strong>${s.symbol}</strong><span>${s.name}</span></div></div></td><td>${money(s.price)}</td><td class="${s.change>=0?'up':'down'}">${signed(s.change)}</td><td>${m.volumeRatio.toFixed(1)}×</td><td>${trendBadge(s)}</td><td>${badge(m.score)}</td></tr>`}).join('')}
      </tbody></table></div>
    </div>
    <div class="notice warn dashboard-disclaimer"><strong>Data integrity:</strong> index values, stock cards and surveillance sample metrics remain illustrative. Provider-backed chart points are labelled separately. Anomaly signals are review aids, not proof of insider trading.</div>
    ${pageFooter()}`;
}

async function loadProviderAnalysis() {
  const button = document.getElementById("loadProviderAnalysis");
  const output = document.getElementById("providerAnalysisResult");
  const exchange = document.getElementById("historicalExchange").value;
  const lookback = document.getElementById("historicalLookback").value;

  // Use the chosen exchange-directory listing when a company was selected from search.
  const directoryInstrument = state.selectedListing || (state.providerSelection && state.page === 'stocks' ? state.providerSelection : null);
  const stock = directoryInstrument || findStock(state.selected);
  const analysisSymbol = directoryInstrument ? (directoryInstrument.symbol || directoryInstrument.provider_symbol || directoryInstrument.security_code) : stock.symbol;
  state.lookbackDays = Number(lookback) || state.lookbackDays;

  button.disabled = true;
  button.textContent = "Loading historical data...";
  output.innerHTML =
    '<div class="notice info">Requesting historical analysis...</div>';

  try {
    const url = new URL(
      `${CONFIG.apiBaseUrl}/market/yahoo-analyze`
    );

    url.searchParams.set("symbol", analysisSymbol);
    url.searchParams.set("exchange", directoryInstrument ? directoryInstrument.exchange : exchange);
    url.searchParams.set("lookback_days", lookback);

    const response = await fetch(url.toString(), {
      cache: "no-store"
    });

    const data = await response.json();

    if (!response.ok) {
      const detail = data?.detail;
      throw new Error(typeof detail === 'string' ? detail : (detail && typeof detail === 'object' ? (detail.message || JSON.stringify(detail)) : `HTTP ${response.status}`));
    }
    if (directoryInstrument) cacheProviderAnalysis(directoryInstrument, Number(lookback), data);

const historyUrl = new URL(
  `${CONFIG.apiBaseUrl}/market/yahoo-history`
);

historyUrl.searchParams.set("symbol", analysisSymbol);
historyUrl.searchParams.set("exchange", directoryInstrument ? directoryInstrument.exchange : exchange);
historyUrl.searchParams.set("lookback_days", lookback);

const historyResponse = await fetch(historyUrl.toString(), {
  cache: "no-store"
});

const historyData = await historyResponse.json();

if (!historyResponse.ok) {
  throw new Error(
    (typeof historyData.detail === 'string' ? historyData.detail : JSON.stringify(historyData.detail || `History HTTP ${historyResponse.status}`))
  );
}

    const number = (value, digits = 2) => {
      if (
        value === null ||
        value === undefined ||
        !Number.isFinite(Number(value))
      ) {
        return "—";
      }

      return Number(value).toFixed(digits);
    };

    const safe = value => String(value ?? "").replace(
      /[&<>"']/g,
      ch => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[ch]
    );

    const classification = data.classification || "Unknown";
    const badgeClass = classification === "High"
      ? "red"
      : classification === "Watch"
        ? "amber"
        : "green";

    const flags = Array.isArray(data.surveillance_flags)
      ? data.surveillance_flags
      : [];

const chartCandles = Array.isArray(historyData.candles)
  ? historyData.candles.filter(
      candle => Number.isFinite(Number(candle.close))
    )
  : [];

const chartValues = chartCandles.map(
  candle => Number(candle.close)
);

let chartHtml = `
  <div class="notice info" style="margin-top:14px">
    Not enough historical price records to draw a chart.
  </div>
`;

if (chartValues.length >= 2) {
  const minPrice = Math.min(...chartValues);
  const maxPrice = Math.max(...chartValues);
  const priceRange = maxPrice - minPrice || 1;

  const chartPoints = chartValues.map((price, index) => {
    const x = 24 + (index / (chartValues.length - 1)) * 672;
    const y = 140 - ((price - minPrice) / priceRange) * 112;
    return {x, y, price, date: chartCandles[index].date || chartCandles[index].timestamp || 'Date unavailable'};
  });
  const coordinates = chartPoints.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");

  chartHtml = `
    <div class="card pad" style="margin-top:14px">
      <h3>Historical Closing Prices</h3>
      <p style="color:var(--muted);font-size:12px">
        ${safe(data.ticker)} · ${chartCandles.length} daily records
        · Historical data, not real-time
      </p>

      <svg
        viewBox="0 0 720 175"
        role="img"
        aria-label="Historical closing price chart"
        style="width:100%;height:auto;display:block"
      >
        <line x1="24" y1="28" x2="696" y2="28"
          stroke="#dce6df" stroke-dasharray="4 4" />
        <line x1="24" y1="84" x2="696" y2="84"
          stroke="#dce6df" stroke-dasharray="4 4" />
        <line x1="24" y1="140" x2="696" y2="140"
          stroke="#dce6df" />

        <polyline
          points="${coordinates}"
          fill="none"
          stroke="#e96b43"
          stroke-width="3"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
        ${chartPoints.map(point => `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="3.2" fill="#e96b43" tabindex="0" aria-label="${safe(point.date)} close ${number(point.price)}"><title>${safe(point.date)} · Close ₹${number(point.price)}</title></circle>`).join('')}
      </svg>

      <div style="
        display:flex;
        justify-content:space-between;
        gap:12px;
        font-size:12px;
        color:var(--muted)
      ">
        <span>${safe(chartCandles[0].date)}</span>
        <span>Latest: ₹${number(chartValues[chartValues.length - 1])}</span>
        <span>${safe(chartCandles[chartCandles.length - 1].date)}</span>
      </div>
    </div>
  `;
}

    output.innerHTML = `
      <div class="grid grid-3" style="margin-top:14px">
        <div class="stat-box">
          <span>Latest close</span>
          <strong>₹${number(data.latest_close)}</strong>
        </div>
        <div class="stat-box">
          <span>Daily change</span>
          <strong>${number(data.daily_change_percent)}%</strong>
        </div>
        <div class="stat-box">
          <span>Anomaly score</span>
          <strong>${data.anomaly_score == null
            ? "—"
            : number(data.anomaly_score, 0) + "/100"}</strong>
        </div>
        <div class="stat-box">
          <span>SMA 5</span>
          <strong>₹${number(data.sma_5)}</strong>
        </div>
        <div class="stat-box">
          <span>SMA 20</span>
          <strong>₹${number(data.sma_20)}</strong>
        </div>
        <div class="stat-box">
          <span>Return Z-score</span>
          <strong>${number(data.return_z_score)}</strong>
        </div>
        <div class="stat-box">
          <span>Volume ratio</span>
          <strong>${number(data.volume_ratio)}×</strong>
        </div>
        <div class="stat-box">
          <span>Sessions analysed</span>
          <strong>${number(data.records_used, 0)}</strong>
        </div>
        <div class="stat-box">
          <span>Classification</span>
          <strong>
            <span class="badge ${badgeClass}">
              ${safe(classification)}
            </span>
          </strong>
        </div>
      </div>
            ${chartHtml}
      <div class="notice info" style="margin-top:14px">
       
        <strong>Data source:</strong> Yahoo Finance historical daily data.
        ${safe(data.ticker)} · ${safe(data.lookback_days)}-day lookback.
        This is not a real-time feed.
      </div>

      <div class="reason-list" style="margin-top:14px">
        <div class="reason">
          <i>1</i>
          <span><strong>Surveillance flags:</strong>
          ${flags.length
            ? flags.map(safe).join("; ")
            : "No configured flags triggered."}</span>
        </div>
        <div class="reason">
          <i>2</i>
          <span>This score is a rule-based screening result, not a
          probability of insider trading or proof of wrongdoing.</span>
        </div>
      </div>
    `;
  } catch (error) {
    const notice = document.createElement("div");
    notice.className = "notice warn";
    notice.textContent =
      `Unable to load analysis: ${error.message}. Check that the backend is running and retry.`;
    output.replaceChildren(notice);
  } finally {
    button.disabled = false;
    button.textContent = "Load historical analysis";
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[ch]);
}

function renderHistoricalAnalysisPanel(defaultExchange = 'NSE', lockExchange = false) {
  const selectedExchange = ['NSE', 'BSE'].includes(defaultExchange) ? defaultExchange : 'NSE';
  return `
    <div class="card pad" style="margin-bottom:15px">
      <div class="card-title">
        <div>
          <h3>Historical Provider Analysis</h3>
          <small>Yahoo Finance · Historical daily data · Not real-time</small>
        </div>
        <span class="badge blue">Backend connected</span>
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:end;margin-top:14px">
        <label>
          <span class="filter-label">Exchange</span>
          <select id="historicalExchange" class="filter-select" ${lockExchange ? 'disabled' : ''}>
            <option value="NSE" ${selectedExchange === 'NSE' ? 'selected' : ''}>NSE</option>
            <option value="BSE" ${selectedExchange === 'BSE' ? 'selected' : ''}>BSE</option>
          </select>
        </label>
        <label>
          <span class="filter-label">Lookback period</span>
          <select id="historicalLookback" class="filter-select">
            ${[5,10,20,30,60].map(n => `<option value="${n}" ${Number(n) === Number(state.lookbackDays) ? 'selected' : ''}>${n} sessions</option>`).join('')}
          </select>
        </label>
        <button class="btn primary" id="loadProviderAnalysis" type="button">Load historical analysis</button>
      </div>
      <div id="providerAnalysisResult" style="margin-top:12px">
        <div class="notice info">Load historical data to view price indicators, a closing-price chart, and surveillance screening outputs.</div>
      </div>
    </div>`;
}

function renderDirectoryInstrumentProfile(instrument) {
  const fields = [
    ['Exchange', instrument.exchange],
    ['Trading symbol', instrument.symbol],
    ['Security code', instrument.security_code],
    ['ISIN', instrument.isin],
    ['Series', instrument.series],
    ['Group', instrument.group],
    ['Industry', instrument.industry],
    ['Listing date', instrument.listing_date],
    ['Face value', instrument.face_value == null ? null : `₹${instrument.face_value}`],
    ['Paid-up value', instrument.paid_up_value == null ? null : `₹${instrument.paid_up_value}`],
    ['Market lot', instrument.market_lot],
    ['Listing status', instrument.status],
    ['Security type', instrument.security_type],
    ['Provider ticker', instrument.ticker],
    ['Directory source', instrument.source]
  ];
  const tiles = fields.filter(([_, value]) => value !== null && value !== undefined && String(value).trim() !== '')
    .map(([label, value]) => `<div class="stat-box"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
  return `
    ${header('Company directory', escapeHtml(instrument.company_name || instrument.name || instrument.symbol),
      `${escapeHtml(instrument.exchange)} listing · ${escapeHtml(instrument.symbol)} · directory metadata`,
      '<button class="btn" data-go="directory">← Company directory</button><button class="btn" data-go="forecast">Market trends</button><button class="btn" data-go="surveillance">Surveillance</button><button class="btn" data-go="alerts">Alerts &amp; Reviews</button><button class="btn" data-go="reports">Reports</button>')}
    <div class="card pad" style="margin-bottom:15px">
      <div class="stock-head">
        <div class="stock-title">${renderCompanyLogo(instrument, 'stock-big-logo', 128)}<div><strong style="font-size:17px">${escapeHtml(instrument.company_name || instrument.name || instrument.symbol)}</strong><div class="stock-symbol">${escapeHtml(instrument.symbol)} · ${escapeHtml(instrument.exchange)}${instrument.industry ? ' · ' + escapeHtml(instrument.industry) : ''}</div></div></div>
        <span class="badge blue">Exchange directory record</span>
      </div>
      <div class="stats-6" style="margin-top:16px">${tiles || '<div class="notice info">No additional listing metadata was returned for this record.</div>'}</div>
      <div class="notice info" style="margin-top:14px">These fields describe the exchange listing. Price and volume fields are not included in the listing directory; use the historical analysis panel below to request Yahoo Finance history. Coverage varies by symbol and exchange.</div>
    </div>
    ${renderHistoricalAnalysisPanel(instrument.exchange, true)}
    <div class="notice warn">Historical market data is provided separately from the listing directory. The directory record does not imply a live quote or guaranteed Yahoo Finance coverage.</div>
    ${pageFooter()}`;
}

const directoryState = {
  query: '', exchange: 'ALL', offset: 0, limit: 50,
  results: [], totalFiltered: 0, directoryTotal: 0,
  exchangeTotals: {NSE:0, BSE:0}, sources: {}, updatedAt: null,
  isComplete: false, loading: false, error: null
};

function renderDirectory() {
  return `
    ${header('Exchange listings', 'NSE + BSE Company Directory', 'Search equity listings by company name, trading symbol, ISIN, or exchange security code.', '<button class="btn" id="directoryRefreshBtn" type="button">↻ Refresh official lists</button>')}
    <div class="notice info" style="margin-bottom:14px">The directory is downloaded from official exchange listing sources and cached locally by the backend. It is listing metadata, not live prices. On first use, allow a short time for the latest exchange files to load.</div>
    <div class="card pad">
      <div class="directory-controls">
        <label class="directory-query"><span class="filter-label">Search listings</span><input class="input" id="directoryQuery" value="${escapeHtml(directoryState.query)}" placeholder="Company, symbol, ISIN, or security code" /></label>
        <label><span class="filter-label">Exchange</span><select class="select" id="directoryExchange"><option value="ALL" ${directoryState.exchange==='ALL'?'selected':''}>NSE + BSE</option><option value="NSE" ${directoryState.exchange==='NSE'?'selected':''}>NSE only</option><option value="BSE" ${directoryState.exchange==='BSE'?'selected':''}>BSE only</option></select></label>
        <button class="btn primary" id="directorySearchBtn" type="button">Search directory</button>
      </div>
      <div id="directorySummary" class="directory-summary"><span>Loading official exchange listings…</span></div>
      <div id="directorySourceNotes" class="directory-source-notes"></div>
      <div class="table-wrap" id="directoryTable"><div class="notice info">Preparing directory search…</div></div>
      <div id="directoryPagination" class="directory-pagination"></div>
    </div>
    <div class="card pad" style="margin-top:15px">
      <div class="card-title"><div><h3>Listing fields included</h3><small>Field availability varies by official exchange file.</small></div></div>
      <div class="directory-field-grid">
        <div><strong>Identity</strong><span>Company name, exchange, trading symbol, security code, ISIN</span></div>
        <div><strong>Classification</strong><span>NSE series, BSE group, industry where published, security type</span></div>
        <div><strong>Listing attributes</strong><span>Listing date, face value, paid-up value, market lot where published</span></div>
        <div><strong>Analysis mapping</strong><span>Yahoo Finance ticker mapping where supported, for historical-data requests</span></div>
      </div>
    </div>
    ${pageFooter()}`;
}

function renderDirectoryResponse(data) {
  directoryState.results = Array.isArray(data.results) ? data.results : [];
  directoryState.totalFiltered = Number(data.total_filtered || 0);
  directoryState.directoryTotal = Number(data.directory_total || 0);
  directoryState.exchangeTotals = data.exchange_totals || {NSE:0,BSE:0};
  directoryState.sources = data.sources || {};
  directoryState.updatedAt = data.updated_at || null;
  directoryState.isComplete = Boolean(data.is_complete);
  directoryState.error = data.refresh_error || null;

  const summary = document.getElementById('directorySummary');
  const table = document.getElementById('directoryTable');
  const pagination = document.getElementById('directoryPagination');
  const sourceNotes = document.getElementById('directorySourceNotes');
  if (!summary || !table || !pagination || !sourceNotes) return;

  const nseStatus = directoryState.sources.NSE?.status || 'not_loaded';
  const bseStatus = directoryState.sources.BSE?.status || 'not_loaded';
  const updatedText = directoryState.updatedAt ? new Date(directoryState.updatedAt).toLocaleString() : 'not yet synced';
  summary.innerHTML = `
    <div class="directory-counts"><span><strong>${directoryState.directoryTotal.toLocaleString('en-IN')}</strong> total listings</span><span><strong>${Number(directoryState.exchangeTotals.NSE || 0).toLocaleString('en-IN')}</strong> NSE</span><span><strong>${Number(directoryState.exchangeTotals.BSE || 0).toLocaleString('en-IN')}</strong> BSE</span><span><strong>${directoryState.totalFiltered.toLocaleString('en-IN')}</strong> matching this search</span></div>
    <small>Last successful cache update: ${escapeHtml(updatedText)}</small>`;

  const statusLine = `NSE source: ${nseStatus.replaceAll('_',' ')} · BSE source: ${bseStatus.replaceAll('_',' ')}`;
  sourceNotes.innerHTML = `<div class="notice ${directoryState.isComplete ? 'success' : 'warn'}">${escapeHtml(statusLine)}${directoryState.isComplete ? '. Both exchange sources were loaded.' : '. Some exchange data may be unavailable or stale; use Refresh official lists to retry.'}${directoryState.error ? '<br>' + escapeHtml(directoryState.error) : ''}</div>`;

  if (!directoryState.results.length) {
    table.innerHTML = `<div class="notice ${directoryState.directoryTotal ? 'info' : 'warn'}">${directoryState.directoryTotal ? 'No listings match this search. Try another company name, symbol, ISIN, or security code.' : 'No exchange records are available yet. Check your internet connection and click “Refresh official lists”.'}</div>`;
  } else {
    table.innerHTML = `<table class="directory-table"><thead><tr><th>Company</th><th>Exchange</th><th>Symbol</th><th>Security code</th><th>ISIN</th><th>Series / group</th><th>Industry</th><th>Listing date</th><th>Face value</th><th>Paid-up value</th><th>Market lot</th><th>Action</th></tr></thead><tbody>${directoryState.results.map((x,i)=>`<tr>
      <td><div class="stock-cell">${renderCompanyLogo(x, 'stock-logo', 64)}<div class="stock-name"><strong>${escapeHtml(x.company_name)}</strong><span>${escapeHtml(x.security_type || 'Equity')}</span></div></div></td>
      <td><span class="badge ${x.exchange==='NSE'?'green':'blue'}">${escapeHtml(x.exchange)}</span></td>
      <td class="mono">${escapeHtml(x.symbol)}</td>
      <td class="mono">${escapeHtml(x.security_code || '—')}</td>
      <td class="mono">${escapeHtml(x.isin || '—')}</td>
      <td>${escapeHtml(x.series || x.group || '—')}</td>
      <td>${escapeHtml(x.industry || '—')}</td>
      <td>${escapeHtml(x.listing_date || '—')}</td>
      <td>${x.face_value == null ? '—' : '₹' + escapeHtml(x.face_value)}</td>
      <td>${x.paid_up_value == null ? '—' : '₹' + escapeHtml(x.paid_up_value)}</td>
      <td>${x.market_lot == null ? '—' : escapeHtml(x.market_lot)}</td>
      <td><button class="btn btn-small" data-directory-index="${i}" type="button">Analyse</button></td>
    </tr>`).join('')}</tbody></table>`;
  }
  const first = directoryState.totalFiltered ? directoryState.offset + 1 : 0;
  const last = Math.min(directoryState.offset + directoryState.limit, directoryState.totalFiltered);
  const previousDisabled = directoryState.offset <= 0 ? 'disabled' : '';
  const nextDisabled = directoryState.offset + directoryState.limit >= directoryState.totalFiltered ? 'disabled' : '';
  pagination.innerHTML = `<span>Showing ${first.toLocaleString('en-IN')}–${last.toLocaleString('en-IN')} of ${directoryState.totalFiltered.toLocaleString('en-IN')}</span><div><button class="btn btn-small" id="directoryPrevBtn" type="button" ${previousDisabled}>← Previous</button><button class="btn btn-small" id="directoryNextBtn" type="button" ${nextDisabled}>Next →</button></div>`;
}

async function loadDirectoryPage({refresh = false, resetOffset = false} = {}) {
  const queryEl = document.getElementById('directoryQuery');
  const exchangeEl = document.getElementById('directoryExchange');
  const table = document.getElementById('directoryTable');
  if (!table) return;
  if (queryEl) directoryState.query = queryEl.value.trim();
  if (exchangeEl) directoryState.exchange = exchangeEl.value;
  if (resetOffset) directoryState.offset = 0;
  directoryState.loading = true;
  table.innerHTML = `<div class="notice info">${refresh ? 'Refreshing official NSE and BSE security files…' : 'Searching the cached exchange directory…'}</div>`;
  const searchButton = document.getElementById('directorySearchBtn');
  const refreshButton = document.getElementById('directoryRefreshBtn');
  if (searchButton) searchButton.disabled = true;
  if (refreshButton) refreshButton.disabled = true;
  try {
    const url = new URL(`${CONFIG.apiBaseUrl}/instruments/directory`);
    url.searchParams.set('query', directoryState.query);
    url.searchParams.set('exchange', directoryState.exchange);
    url.searchParams.set('limit', String(directoryState.limit));
    url.searchParams.set('offset', String(directoryState.offset));
    if (refresh) url.searchParams.set('refresh', 'true');
    const response = await fetch(url.toString(), {cache:'no-store'});
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
    renderDirectoryResponse(data);
  } catch (error) {
    table.innerHTML = `<div class="notice warn">Unable to load the exchange directory: ${escapeHtml(error.message)}. Confirm the backend is running, then retry.</div>`;
  } finally {
    directoryState.loading = false;
    if (searchButton) searchButton.disabled = false;
    if (refreshButton) refreshButton.disabled = false;
  }
}

function openDirectoryInstrument(instrument) {
  if (!instrument) return;
  setSelectedListing(instrument);
  state.page = 'stocks';
  globalSearch.value = instrument.symbol;
  searchSuggestions.classList.add('hidden');
  render();
  document.getElementById('sidebar').classList.remove('open');
  window.scrollTo({top:0, behavior:'smooth'});
}


function renderStocks() {
  if (state.selectedListing) return renderDirectoryInstrumentProfile(state.selectedListing);
  const s = findStock(state.selected);
  const m = getWindowMetrics(s);
  const rsi = clamp(50 + s.change * 2.1, 18, 82);
  const sma20 = s.price * (1 - s.change * .0008);
  const sma50 = s.price * (1 - s.change * .0014);
  const trend = trendLabel(s);
  return `
    ${header('Stock analysis',s.name,`${s.symbol} · ${s.sector} · sample market session`, '<button class="btn" data-go="dashboard">← Market overview</button><button class="btn primary" data-go="forecast" data-stock="'+s.symbol+'">View market trends</button>')}
    <div class="notice warn" style="margin-bottom:14px">The stock card and technical snapshot below remain illustrative. The chart can request provider candles, but Yahoo Finance data may be delayed or unavailable and is not a guaranteed live exchange feed.</div>
    
${renderHistoricalAnalysisPanel('NSE')}

    <div class="detail-grid">
      <div class="card pad">
        <div class="stock-head"><div class="stock-title">${renderCompanyLogo({...s, exchange: 'NSE', ticker: s.symbol + '.NS'}, 'stock-big-logo', 128)}<div><strong style="font-size:16px">${s.symbol}</strong><div class="stock-symbol">${s.name}</div></div></div><div>${trendBadge(s)}</div></div>
        <div class="price-big">${money(s.price)}</div><div class="price-change ${s.change>=0?'up':'down'}">${signed(s.change)} on the sample session</div>
        <div class="chart-wrap"><canvas id="mainChart" aria-label="Illustrative stock price chart"></canvas></div>
        <div class="chart-toolbar"><button class="segment ${state.timeframe==='1D'?'active':''}" data-range="1D">1D</button><button class="segment ${state.timeframe==='1W'?'active':''}" data-range="1W">1W</button><button class="segment ${state.timeframe==='1M'?'active':''}" data-range="1M">1M</button><button class="segment ${state.timeframe==='6M'?'active':''}" data-range="6M">6M</button><button class="segment ${state.timeframe==='1Y'?'active':''}" data-range="1Y">1Y</button></div>
        <div class="legend"><div class="legend-item"><span class="legend-dot"></span>Illustrative price path</div><div class="legend-item"><span class="legend-dot alt"></span>Rolling-average guide</div></div>
      </div>
      <div class="card pad">
        <div class="card-title"><div><h3>Market statistics</h3><small>Sample fields for the future data pipeline</small></div></div>
        <div class="stats-6">
          <div class="stat-box"><span>Reference open</span><strong>${money(s.price * .991)}</strong></div><div class="stat-box"><span>Reference high</span><strong>${money(s.price * 1.012)}</strong></div><div class="stat-box"><span>Reference low</span><strong>${money(s.price * .984)}</strong></div>
          <div class="stat-box"><span>Volume ratio</span><strong>${m.volumeRatio.toFixed(2)}×</strong></div><div class="stat-box"><span>Volatility feature</span><strong>${s.volatility.toFixed(1)}%</strong></div><div class="stat-box"><span>RSI (illustrative)</span><strong>${rsi.toFixed(1)}</strong></div>
        </div>
        <div style="margin-top:17px"><div class="card-title"><h4>Technical snapshot</h4><small>Illustrative scores</small></div><div class="mini-bars">
          ${[['Trend strength',clamp(50 + s.change*3,8,94)],['Momentum',clamp(50 + s.change*3.6,8,94)],['Volume normality',clamp(100 - Math.max(0,m.volumeRatio-1)*15,8,96)],['Market-relative movement',clamp(50 + Math.abs(s.change-.7)*3,8,94)]].map(x=>`<div class="bar-row"><span>${x[0]}</span><div class="bar-bg"><div class="bar-fill" style="width:${x[1]}%"></div></div><strong>${Math.round(x[1])}</strong></div>`).join('')}
        </div></div>
        <div class="notice info" style="margin-top:16px">Indicators become authoritative only after the frontend is connected to validated historical/intraday records and the calculations are implemented against that feed.</div>
      </div>
    </div>
    <div class="grid grid-4" style="margin-top:15px;">
      <div class="card pad"><div class="card-title"><h3>Trend assessment</h3>${trendBadge(s)}</div><div class="kpi-number">${s.change>=0?'+':''}${s.change.toFixed(2)}%</div><p class="subtitle" style="margin-top:6px">Current sample movement, not a future-price prediction.</p><button class="btn primary" data-go="forecast" data-stock="${s.symbol}">Open trend analysis</button></div>
      <div class="card pad"><div class="card-title"><h3>Surveillance</h3>${badge(m.score)}</div><div class="kpi-number">${m.score}/100</div><p class="subtitle">Variable-period demo score using ${m.days} sessions.</p><button class="btn" data-go="surveillance">Review activity</button></div>
      <div class="card pad"><div class="card-title"><h3>Reference fundamentals</h3><small>Demo figures</small></div><div class="stats-6" style="grid-template-columns:repeat(2,1fr);margin-top:12px"><div class="stat-box"><span>Market cap</span><strong>${s.marketCap}</strong></div><div class="stat-box"><span>P/E</span><strong>${s.pe.toFixed(1)}×</strong></div><div class="stat-box"><span>Beta</span><strong>${s.beta.toFixed(2)}</strong></div><div class="stat-box"><span>Sector</span><strong>${s.sector}</strong></div></div></div>
      <div class="card pad"><div class="card-title"><h3>Data status</h3><span class="badge amber">Demo</span></div><div class="kpi-number" style="font-size:18px">Provider pending</div><p class="subtitle">No external quote API is connected in this version.</p><button class="btn" id="providerInfoBtn">Connection details</button></div>
    </div>
    ${pageFooter()}`;
}

function renderMarketTrends() {
  const listing = activeListing();
  const entry = currentAnalysisEntry();
  const a = entry && entry.data ? entry.data : null;
  const title = listing ? `${escapeHtml(listing.company_name || listing.symbol)} market trends` : 'Market trends for a listed company';
  const subtitle = listing ? `${escapeHtml(listing.symbol)} · ${escapeHtml(listing.exchange)} · provider-backed historical analysis` : 'Search for a listed company in the header or Company Directory to generate its trends.';
  const value = v => v == null ? '—' : formatMetric(v, 2);
  const change = a && a.daily_change_percent != null ? Number(a.daily_change_percent) : null;
  const trendText = !a ? (entry?.error ? 'Provider data unavailable' : 'Loading provider analysis…') : (change >= 2 ? 'Positive momentum' : change >= 0.25 ? 'Mildly positive' : change <= -2 ? 'Negative momentum' : change <= -0.25 ? 'Mildly negative' : 'Mixed / sideways');
  const trendClass = !a ? 'blue' : change >= 0.25 ? 'green' : change <= -0.25 ? 'red' : 'amber';
  const statusNotice = !listing
    ? '<div class="notice info" style="margin-bottom:14px">Select a real NSE/BSE company using the header search or Company Directory. No synthetic company metrics are shown on this page.</div>'
    : entry?.error
      ? `<div class="notice warn" style="margin-bottom:14px">Provider analysis unavailable for ${escapeHtml(listing.symbol)} · ${escapeHtml(listing.exchange)}: ${escapeHtml(entry.error)}. Try a shorter lookback or select another listed security.</div>`
      : '<div class="notice info" style="margin-bottom:14px">Trend metrics below use Yahoo Finance historical records when available. Provider data may be delayed and is not a guaranteed live exchange feed.</div>';
  return `
    ${header('Price & market trend analysis', title, subtitle, '<button class="btn" data-go="stocks">← Company details</button><button class="btn primary" data-go="surveillance">Review surveillance</button>')}
    ${listing ? `<div class="selected-company-logo-row">${renderCompanyLogo(listing, 'company-logo-feature', 128)}<div><strong>${escapeHtml(listing.company_name || listing.symbol)}</strong><small>${escapeHtml(listing.symbol)} · ${escapeHtml(listing.exchange)}${listing.isin ? ' · ISIN ' + escapeHtml(listing.isin) : ''}</small></div></div>` : ''}
    ${statusNotice}
    <div class="grid grid-4" id="trendMetricCards">
      <div class="card metric-card"><div class="metric-top"><span class="metric-label">Latest close</span><span class="metric-icon">₹</span></div><div class="metric-value">${a ? '₹' + value(a.latest_close) : '—'}</div><div class="metric-sub">${listing ? escapeHtml(listing.exchange + ' · ' + listing.symbol) : 'No listing selected'}</div></div>
      <div class="card metric-card"><div class="metric-top"><span class="metric-label">Latest daily change</span><span class="metric-icon">↕</span></div><div class="metric-value ${change == null ? '' : change >= 0 ? 'up' : 'down'}">${change == null ? '—' : signed(change)}</div><div class="metric-sub">Based on returned daily closes</div></div>
      <div class="card metric-card"><div class="metric-top"><span class="metric-label">Trend classification</span><span class="metric-icon">⌁</span></div><div class="metric-value" style="font-size:18px">${escapeHtml(trendText)}</div><div class="metric-sub">Rule-based descriptive label</div></div>
      <div class="card metric-card"><div class="metric-top"><span class="metric-label">Analysis window</span><span class="metric-icon">◷</span></div><div class="metric-value">${state.lookbackDays} sessions</div><div class="metric-sub">Change from Surveillance</div></div>
    </div>
    <div class="grid grid-2" style="margin-top:15px">
      <div class="card pad"><div class="card-title"><div><h3>Historical price movement</h3><small>${listing ? escapeHtml(listing.symbol + ' · ' + listing.exchange) : 'Select a directory listing'} · chart data from provider when available</small></div><span class="badge ${trendClass}">${escapeHtml(trendText)}</span></div>
        <div class="terminal-price-row"><div><strong class="terminal-price">${a && a.latest_close != null ? money(a.latest_close) : '—'}</strong><span class="terminal-change ${change == null ? '' : change >= 0 ? 'up' : 'down'}">${change == null ? 'No provider change' : signed(change)}</span></div><div class="chart-provider-status" id="chartDataStatus"><span class="status-dot idle"></span> ${listing ? 'Checking provider…' : 'Select a listing'}</div></div>
        <div class="chart-wrap"><canvas id="mainChart" aria-label="Provider-backed historical price chart. Hover points to inspect date and price."></canvas></div>
        <div class="chart-axis-hints"><span id="chartStartLabel">Earlier</span><span id="chartSourceLabel">Provider history not loaded</span><span id="chartEndLabel">Latest</span></div>
        <div class="chart-toolbar"><button class="segment ${state.timeframe==='1D'?'active':''}" data-range="1D">1D</button><button class="segment ${state.timeframe==='1W'?'active':''}" data-range="1W">1W</button><button class="segment ${state.timeframe==='1M'?'active':''}" data-range="1M">1M</button><button class="segment ${state.timeframe==='6M'?'active':''}" data-range="6M">6M</button><button class="segment ${state.timeframe==='1Y'?'active':''}" data-range="1Y">1Y</button><button class="btn" id="refreshChartBtn">↻ Refresh chart</button></div>
        <small class="subtitle">Hover a point on the line to see the exact returned date and close. Auto-refresh attempts run every 60 seconds while this page is visible; this is not guaranteed real-time data.</small>
      </div>
      <div class="card pad"><div class="card-title"><div><h3>Technical indicators</h3><small>Calculated from provider-returned historical records</small></div></div>
        <div class="stats-6" style="grid-template-columns:repeat(2,minmax(0,1fr))">
          <div class="stat-box"><span>SMA 5</span><strong>${a ? '₹' + value(a.sma_5) : '—'}</strong></div>
          <div class="stat-box"><span>SMA 20</span><strong>${a ? '₹' + value(a.sma_20) : '—'}</strong></div>
          <div class="stat-box"><span>Return Z-score</span><strong>${a ? value(a.return_z_score) : '—'}</strong></div>
          <div class="stat-box"><span>Volume ratio</span><strong>${a && a.volume_ratio != null ? value(a.volume_ratio) + '×' : '—'}</strong></div>
          <div class="stat-box"><span>Anomaly score</span><strong>${a && a.anomaly_score != null ? `${a.anomaly_score}/100` : '—'}</strong></div>
          <div class="stat-box"><span>Sessions used</span><strong>${a ? escapeHtml(a.records_used ?? '—') : '—'}</strong></div>
        </div>
        <div class="reason-list" style="margin-top:14px"><div class="reason"><i>1</i> Moving averages summarise recent observed closing-price levels.</div><div class="reason"><i>2</i> Return Z-score compares the latest movement with prior returns in the selected baseline.</div><div class="reason"><i>3</i> Volume ratio compares the latest returned volume with the preceding baseline.</div></div>
        ${a ? `<div class="notice ${classificationLevel(a.classification)==='high'?'warn':'info'}" style="margin-top:14px">${classificationBadge(a.classification)} ${escapeHtml((a.surveillance_flags || []).join('; ') || 'No configured surveillance thresholds were triggered.')}</div>` : `<div class="notice ${entry?.error?'warn':'info'}" style="margin-top:14px">${entry?.error ? escapeHtml(entry.error) : 'Waiting for provider data for the selected listing.'}</div>`}
      </div>
    </div>
    <div class="card pad" style="margin-top:15px"><div class="card-title"><div><h3>Trend interpretation</h3><small>Selected official listing</small></div><button class="btn" data-go="reports">Create report</button></div>
      <div class="grid grid-3" style="margin-top:13px"><div class="stat-box"><span>Company</span><strong>${listing ? escapeHtml(listing.company_name || listing.symbol) : 'Not selected'}</strong></div><div class="stat-box"><span>Listing</span><strong>${listing ? escapeHtml(listing.exchange + ' · ' + listing.symbol) : '—'}</strong></div><div class="stat-box"><span>Screening result</span><strong>${a ? classificationBadge(a.classification) : '—'}</strong></div></div>
      <div class="notice warn" style="margin-top:14px">Historical trend labels and surveillance scores are screening aids only. They are not price predictions, investment recommendations, or evidence of wrongdoing.</div>
    </div>
    ${pageFooter()}`;
}

function renderSurveillance() {
  const listing = activeListing();
  const entry = currentAnalysisEntry();
  const a = entry && entry.data ? entry.data : null;
  const view = currentUniverseView();
  const allRecords = [...(state.directoryUniverse || [])];
  const flaggedRecords = state.reviewRecords.filter(record => ['High','Watch'].includes(record.classification));
  const openRecords = flaggedRecords.filter(record => record.review_status !== 'Reviewed');
  const options = (CONFIG.lookbackOptions || [5,10,20,30,60]).map(n => `<option value="${n}" ${Number(n)===Number(state.lookbackDays)?'selected':''}>${n} trading days</option>`).join('');
  const currentKey = listingKey(listing) + ':' + String(listing?.security_code || '');
  const tableRows = view.map((item, index) => {
    const isCurrent = listing && listingKey(item) + ':' + String(item.security_code || '') === currentKey;
    const itemAnalysis = isCurrent ? a : null;
    const itemLevel = itemAnalysis ? classificationLevel(itemAnalysis.classification) : 'unknown';
    return `<tr data-level="${itemLevel}">
      <td><div class="stock-cell">${renderCompanyLogo(item, 'stock-logo', 64)}<div class="stock-name"><strong>${escapeHtml(item.company_name || item.symbol)}</strong><span>${escapeHtml(item.symbol)}${item.industry ? ' · ' + escapeHtml(item.industry) : ''}</span></div></div></td>
      <td>${escapeHtml(item.exchange)}</td><td>${escapeHtml(item.isin || '—')}</td>
      <td>${itemAnalysis && itemAnalysis.return_z_score != null ? formatMetric(itemAnalysis.return_z_score) + 'σ' : '—'}</td>
      <td>${itemAnalysis && itemAnalysis.volume_ratio != null ? formatMetric(itemAnalysis.volume_ratio) + '×' : '—'}</td>
      <td>${itemAnalysis && itemAnalysis.anomaly_score != null ? itemAnalysis.anomaly_score + '/100' : 'Not screened'}</td>
      <td>${itemAnalysis ? classificationBadge(itemAnalysis.classification) : '<span class="badge blue">Listed · not screened</span>'}</td>
      <td><button class="btn" data-universe-index="${index}" type="button">${isCurrent ? 'Selected' : 'Select & analyse'}</button></td>
    </tr>`;
  }).join('');
  const totalFiltered = Number(state.surveillanceTotalFiltered || 0);
  const pageCount = Number(state.surveillancePageCount || 1);
  const pageStart = totalFiltered ? state.surveillancePage * state.surveillancePageSize + 1 : 0;
  const pageEnd = Math.min(totalFiltered, (state.surveillancePage + 1) * state.surveillancePageSize);
  const sourcesNote = state.directoryUniverseError
    ? `<div class="notice warn" style="margin-top:12px">Could not load full directory universe: ${escapeHtml(state.directoryUniverseError)}. Search the Company Directory to choose a listing.</div>`
    : `<div class="notice info" style="margin-top:12px">Loaded ${allRecords.length.toLocaleString('en-IN')} exchange-listing records. Only the selected company is analysed on request; other rows are not screened until selected. Provider history is not guaranteed real-time.</div>`;
  return `
    ${header('NSE + BSE market surveillance', listing ? `${escapeHtml(listing.company_name || listing.symbol)} surveillance review` : 'Listed company surveillance', 'Search the official NSE/BSE directory, select a security, and review its provider-backed screening response.', '<button class="btn" id="scanMarket">↻ Refresh selected analysis</button><button class="btn primary" data-go="alerts">Open Alerts & Reviews</button>')}
    ${listing ? `<div class="selected-company-logo-row">${renderCompanyLogo(listing, 'company-logo-feature', 128)}<div><strong>${escapeHtml(listing.company_name || listing.symbol)}</strong><small>${escapeHtml(listing.symbol)} · ${escapeHtml(listing.exchange)}${listing.isin ? ' · ISIN ' + escapeHtml(listing.isin) : ''}</small></div></div>` : ''}
    ${sourcesNote}
    <div class="grid grid-4" id="surveillanceSummary">
      <div class="card metric-card"><div class="metric-top"><span class="metric-label">Open review flags</span><span class="metric-icon">⚑</span></div><div class="metric-value ${openRecords.length ? 'down' : ''}">${openRecords.length}</div><div class="metric-sub">Saved provider analyses</div></div>
      <div class="card metric-card"><div class="metric-top"><span class="metric-label">High / watch results</span><span class="metric-icon">!</span></div><div class="metric-value warn">${flaggedRecords.length}</div><div class="metric-sub">Saved provider analyses</div></div>
      <div class="card metric-card"><div class="metric-top"><span class="metric-label">Official listings</span><span class="metric-icon">▦</span></div><div class="metric-value">${allRecords.length.toLocaleString('en-IN')}</div><div class="metric-sub">NSE + BSE directory records</div></div>
      <div class="card metric-card"><div class="metric-top"><span class="metric-label">Lookback window</span><span class="metric-icon">◷</span></div><div class="metric-value">${state.lookbackDays} days</div><div class="metric-sub">Used for selected stock analysis</div></div>
    </div>
    <div class="card pad" style="margin-top:15px;">
      <div class="card-title"><div><h3>Official listing surveillance queue</h3><small>${listing ? `Selected: ${escapeHtml(listing.company_name || listing.symbol)} · ${escapeHtml(listing.exchange)} · ${a ? 'provider analysis loaded' : entry?.error ? 'provider history unavailable' : 'analysis loading / not available'}` : 'Select any real listing to generate its provider-backed result'}</small></div>
        <div class="filter-row"><label for="lookbackDays" class="filter-label">Baseline</label><select class="select" id="lookbackDays" aria-label="Select anomaly lookback period">${options}</select></div>
      </div>
      <div class="directory-controls" style="margin-bottom:12px;grid-template-columns:minmax(220px,1fr) auto auto auto;">
        <label><span class="filter-label">Find a listed company</span><input class="input" id="surveillanceQuery" value="${escapeHtml(state.surveillanceQuery)}" placeholder="Company, symbol, ISIN or code" /></label>
        <label><span class="filter-label">Exchange</span><select class="select" id="surveillanceExchangeFilter"><option value="ALL" ${state.surveillanceExchange==='ALL'?'selected':''}>NSE + BSE</option><option value="NSE" ${state.surveillanceExchange==='NSE'?'selected':''}>NSE</option><option value="BSE" ${state.surveillanceExchange==='BSE'?'selected':''}>BSE</option></select></label>
        <label><span class="filter-label">Rows</span><select class="select" id="surveillancePageSize"><option value="25" ${state.surveillancePageSize===25?'selected':''}>25</option><option value="50" ${state.surveillancePageSize===50?'selected':''}>50</option><option value="100" ${state.surveillancePageSize===100?'selected':''}>100</option></select></label>
        <button class="btn" id="surveillanceSearchBtn" type="button">Search listings</button>
      </div>
      <div class="table-wrap"><table><thead><tr><th>Company / symbol</th><th>Exchange</th><th>ISIN</th><th>Return Z-score</th><th>Volume ratio</th><th>Anomaly score</th><th>Screening status</th><th>Action</th></tr></thead><tbody id="surveillanceRows">
        ${tableRows || '<tr><td colspan="8">No matching official listings. Change the company query or exchange filter.</td></tr>'}
      </tbody></table></div>
      <div class="directory-pagination"><span>Showing ${pageStart.toLocaleString('en-IN')}–${pageEnd.toLocaleString('en-IN')} of ${totalFiltered.toLocaleString('en-IN')} listings · Page ${state.surveillancePage + 1} of ${pageCount}</span><div><button class="btn" id="surveillancePrevBtn" ${state.surveillancePage<=0?'disabled':''}>← Previous</button> <button class="btn" id="surveillanceNextBtn" ${state.surveillancePage+1>=pageCount?'disabled':''}>Next →</button></div></div>
      ${entry?.error ? `<div class="notice warn" style="margin-top:14px">Selected provider analysis could not be loaded: ${escapeHtml(entry.error)}</div>` : !a ? '<div class="notice info" style="margin-top:14px">Select a listing to request its historical data. A security is not marked screened unless provider analysis returned successfully.</div>' : `<div class="notice ${classificationLevel(a.classification)==='high'?'warn':'info'}" style="margin-top:14px">Selected result: ${classificationBadge(a.classification)} ${escapeHtml((a.surveillance_flags || []).join('; ') || 'No configured screening threshold was triggered.')}. ${a.records_used ?? '—'} historical sessions returned.</div>`}
    </div>
    <div class="grid grid-2" style="margin-top:15px">
      <div class="card pad"><div class="card-title"><div><h3>Detection method</h3><small>Provider-backed screening</small></div></div><div class="timeline">${[['01 · Baseline','Select historical window','Use returned daily records for the chosen 5/10/20/30/60-session baseline.'],['02 · Measure deviation','Calculate signals','Compute return Z-score, relative volume and moving averages where enough history exists.'],['03 · Record provenance','Show data source','Keep ticker, exchange and provider status visible.'],['04 · Human review','Inspect potential anomalies','A person reviews contextual information; scores are not legal conclusions.']].map(x=>`<div class="timeline-item"><div class="timeline-date">${x[0]}</div><div class="timeline-track"><div class="timeline-dot"></div></div><div class="timeline-content"><strong>${x[1]}</strong><p>${x[2]}</p></div></div>`).join('')}</div></div>
      <div class="card pad"><div class="card-title"><div><h3>Selected listing scorecard</h3><small>${listing ? escapeHtml(listing.company_name || listing.symbol) : 'No listing selected'}</small></div><button class="btn" data-go="stocks">Company details</button></div>
        ${a ? `<div class="score" style="margin-top:18px"><div class="score-ring"><span>${a.anomaly_score == null ? '—' : Number(a.anomaly_score)}</span></div><div class="score-meta"><strong>${escapeHtml(listing.symbol)} · ${state.lookbackDays}-session baseline</strong><small>${classificationBadge(a.classification)}</small></div></div><div class="mini-bars">${[['Return deviation',Math.min(100,Math.abs(Number(a.return_z_score || 0))*25)],['Volume deviation',Math.min(100,Math.max(0,(Number(a.volume_ratio || 0)-1)*33))],['Anomaly score',Number(a.anomaly_score || 0)]].map(x=>`<div class="bar-row"><span>${x[0]}</span><div class="bar-bg"><div class="bar-fill" style="width:${clamp(x[1],0,100)}%"></div></div><strong>${Math.round(x[1])}</strong></div>`).join('')}</div><div class="reason-list" style="margin-top:12px">${(a.surveillance_flags || []).length ? a.surveillance_flags.map((flag,index)=>`<div class="reason"><i>${index+1}</i>${escapeHtml(flag)}</div>`).join('') : '<div class="reason"><i>✓</i>No configured screening flags were triggered by returned data.</div>'}</div>` : `<div class="notice ${entry?.error?'warn':'info'}" style="margin-top:14px">${entry?.error ? escapeHtml(entry.error) : 'Provider-backed scorecard will appear when historical data is returned.'}</div>`}
      </div>
    </div>
    <div class="notice warn" style="margin-top:15px">Anomaly scores are review priorities, not probabilities of insider trading or proof of wrongdoing.</div>
    ${pageFooter()}`;
}
function renderAlerts() {
  const listing = activeListing();
  const entry = currentAnalysisEntry();
  const a = entry && entry.data ? entry.data : null;
  const records = [...state.reviewRecords].sort((x,y) => String(y.analyzed_at || '').localeCompare(String(x.analyzed_at || '')));
  const flagged = records.filter(record => ['High','Watch'].includes(record.classification));
  const open = flagged.filter(record => record.review_status !== 'Reviewed');
  const currentLevel = a ? classificationLevel(a.classification) : 'unknown';
  const currentCard = listing ? `
    <div class="card pad" style="margin-top:15px">
      <div class="card-title"><div><h3>Selected company screening</h3><small>${escapeHtml(listing.company_name || listing.symbol)} · ${escapeHtml(listing.exchange)} · ${state.lookbackDays}-session window</small></div>${a ? classificationBadge(a.classification) : '<span class="badge blue">Loading</span>'}</div>
      ${a ? `<div class="grid grid-4" style="margin-top:13px"><div class="stat-box"><span>Latest close</span><strong>₹${formatMetric(a.latest_close)}</strong></div><div class="stat-box"><span>Daily change</span><strong>${a.daily_change_percent == null ? '—' : signed(a.daily_change_percent)}</strong></div><div class="stat-box"><span>Volume ratio</span><strong>${a.volume_ratio == null ? '—' : formatMetric(a.volume_ratio) + '×'}</strong></div><div class="stat-box"><span>Anomaly score</span><strong>${a.anomaly_score == null ? '—' : a.anomaly_score + '/100'}</strong></div></div><div class="reason-list" style="margin-top:13px">${(a.surveillance_flags || []).length ? a.surveillance_flags.map((flag,i)=>`<div class="reason"><i>${i+1}</i>${escapeHtml(flag)}</div>`).join('') : '<div class="reason"><i>✓</i>No configured alert threshold was triggered for this provider response.</div>'}</div><small class="subtitle">Source: ${escapeHtml(a.provider || 'Yahoo Finance')} · ${escapeHtml(a.ticker || listing.ticker || listing.symbol)} · historical data only</small>` : `<div class="notice ${entry?.error?'warn':'info'}" style="margin-top:12px">${entry?.error ? escapeHtml(entry.error) : 'Fetching historical analysis for the selected listing…'}</div>`}
    </div>` : '<div class="notice info" style="margin-top:15px">Search for a listed company using the header or Company Directory. Alerts will be generated only after provider history is retrieved.</div>';
  const reviewCards = records.length ? records.map(record => {
    const flags = Array.isArray(record.surveillance_flags) ? record.surveillance_flags : [];
    const isFlagged = ['High','Watch'].includes(record.classification);
    return `<div class="card report-card"><div class="report-main"><div class="report-company-identity">${renderCompanyLogo(record, 'stock-logo', 64)}<div><strong>${escapeHtml(record.company_name || record.symbol)} — ${escapeHtml(record.symbol)} (${escapeHtml(record.exchange)})</strong><small>${escapeHtml(record.ticker || 'Provider ticker unavailable')} · ${Number(record.lookback_days || 0)}-session baseline · ${record.analyzed_at ? escapeHtml(new Date(record.analyzed_at).toLocaleString()) : 'Timestamp unavailable'}</small></div></div><div style="margin-top:8px;display:flex;gap:7px;flex-wrap:wrap">${classificationBadge(record.classification)}<span class="badge ${record.review_status==='Reviewed'?'green':'blue'}">${escapeHtml(record.review_status || 'Open')}</span>${isFlagged ? `<span class="badge amber">${flags.length} flag(s)</span>` : ''}</div><small>${flags.length ? escapeHtml(flags.join('; ')) : 'No configured screening flags returned.'} · Close ${record.latest_close == null ? '—' : '₹'+formatMetric(record.latest_close)} · Change ${record.daily_change_percent == null ? '—' : signed(record.daily_change_percent)} · Volume ${record.volume_ratio == null ? '—' : formatMetric(record.volume_ratio)+'×'}</small></div><div style="display:flex;gap:7px;flex-wrap:wrap"><button class="btn" data-review-open="${escapeHtml(record.id)}" type="button">View company</button><button class="btn" data-review-record="${escapeHtml(record.id)}" type="button">${record.review_status==='Reviewed'?'Reviewed':'Mark reviewed'}</button></div></div>`;
  }).join('') : '<div class="card pad">No provider-backed company analyses have been saved yet. Choose a company and load its historical analysis; results will be recorded here.</div>';
  return `
    ${header('Alert centre','Alerts & Reviews','Review screening outputs for the currently selected NSE/BSE listing and all saved provider analyses. Select any company from the header search or Company Directory; this page follows that selection. Review status is stored locally in this browser.', '<button class="btn" id="markAllReviewed">Mark visible as reviewed</button><button class="btn primary" data-go="surveillance">Back to surveillance</button>')}
    ${listing ? `<div class="selected-company-logo-row">${renderCompanyLogo(listing, 'company-logo-feature', 128)}<div><strong>${escapeHtml(listing.company_name || listing.symbol)}</strong><small>${escapeHtml(listing.symbol)} · ${escapeHtml(listing.exchange)}</small></div></div>` : ''}
    <div class="grid grid-3">
      <div class="card metric-card"><div class="metric-top"><span class="metric-label">High / watch flags</span><span class="metric-icon">⚑</span></div><div class="metric-value down">${flagged.length}</div><div class="metric-sub">From saved provider analyses</div></div>
      <div class="card metric-card"><div class="metric-top"><span class="metric-label">Awaiting review</span><span class="metric-icon">◐</span></div><div class="metric-value warn">${open.length}</div><div class="metric-sub">Flagged records not marked reviewed</div></div>
      <div class="card metric-card"><div class="metric-top"><span class="metric-label">Saved analyses</span><span class="metric-icon">▤</span></div><div class="metric-value">${records.length}</div><div class="metric-sub">Provider results in local review log</div></div>
    </div>
    ${currentCard}
    <div class="card pad" style="margin-top:15px"><div class="card-title"><div><h3>Review log</h3><small>Real listed companies and recorded provider analysis only; no synthetic demo alerts.</small></div><span class="badge blue">Local review history</span></div><div style="display:grid;gap:10px;margin-top:13px">${reviewCards}</div></div>
    <div class="notice warn" style="margin-top:14px">A statistical alert is a prompt for human review. It is not proof of insider trading or evidence of wrongdoing.</div>
    ${pageFooter()}`;
}

function renderReports() {
  const listing = activeListing();
  const entry = currentAnalysisEntry();
  const a = entry && entry.data ? entry.data : null;
  const records = [...state.reviewRecords].sort((x,y) => String(y.analyzed_at || '').localeCompare(String(x.analyzed_at || ''))).slice(0,30);
  const recentRows = records.map(record => `<tr><td><div class="stock-cell">${renderCompanyLogo(record, 'stock-logo', 64)}<span>${escapeHtml(record.company_name || record.symbol)}</span></div></td><td>${escapeHtml(record.symbol)}</td><td>${escapeHtml(record.exchange)}</td><td>${Number(record.lookback_days || 0)} sessions</td><td>${record.latest_close == null ? '—' : '₹'+formatMetric(record.latest_close)}</td><td>${record.daily_change_percent == null ? '—' : signed(record.daily_change_percent)}</td><td>${record.anomaly_score == null ? '—' : Number(record.anomaly_score) + '/100'}</td><td>${classificationBadge(record.classification)}</td><td>${escapeHtml(record.review_status || 'Open')}</td></tr>`).join('');
  const previewState = !listing ? 'No official listing selected' : entry?.error ? `Provider response unavailable: ${entry.error}` : a ? `Provider analysis loaded · ${a.ticker || listing.ticker || listing.symbol}` : 'Loading provider analysis…';
  return `
    ${header('Reporting','Market analysis reports','Prepare a print-ready report for the currently selected official NSE/BSE listing and its saved provider-backed surveillance history. Search for a company in the header or Company Directory; its selected listing follows you here.', '<button class="btn" id="exportReportCsv">Export review log CSV</button><button class="btn primary" id="printReport">Print / save as PDF</button>')}
    ${listing ? `<div class="selected-company-logo-row">${renderCompanyLogo(listing, 'company-logo-feature', 128)}<div><strong>${escapeHtml(listing.company_name || listing.symbol)}</strong><small>${escapeHtml(listing.symbol)} · ${escapeHtml(listing.exchange)}${listing.isin ? ' · ISIN ' + escapeHtml(listing.isin) : ''}</small></div></div>` : ''}
    <div class="grid grid-3">
      <div class="card report-card"><div class="report-main"><strong>Company trend report</strong><small>${listing ? escapeHtml(listing.company_name || listing.symbol) + ' · ' + escapeHtml(listing.exchange) : 'Select a company to prepare report content.'}</small></div><button class="btn" data-action="generate-report">Prepare</button></div>
      <div class="card report-card"><div class="report-main"><strong>Surveillance result</strong><small>${a ? escapeHtml(a.classification || 'Unknown') + ' · ' + (a.anomaly_score == null ? 'No score' : a.anomaly_score + '/100') : 'Awaiting provider-backed analysis'}</small></div><button class="btn" data-action="generate-report">Prepare</button></div>
      <div class="card report-card"><div class="report-main"><strong>Review history</strong><small>${records.length} saved provider analysis record(s)</small></div><button class="btn" data-go="alerts">Open review log</button></div>
    </div>
    <div class="card pad report-print-area" style="margin-top:15px;">
      <div class="card-title"><div><h3>ScripVigil — Company Market & Surveillance Report</h3><small>Generated ${escapeHtml(new Date().toLocaleString('en-IN'))}</small></div><span class="badge ${a ? 'blue' : 'amber'}">${a ? 'Provider-backed report' : 'Awaiting provider data'}</span></div>
      <div style="margin-top:15px;padding:19px;border:1px solid var(--line);border-radius:12px;background:var(--surface-sunken)">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><strong style="font-size:16px">${escapeHtml(listing ? listing.company_name || listing.symbol : 'ScripVigil')}</strong><div class="subtitle" style="margin-top:4px">${listing ? `${escapeHtml(listing.symbol)} · ${escapeHtml(listing.exchange)} · ISIN ${escapeHtml(listing.isin || 'not provided')}` : 'Choose an actual NSE/BSE listing to populate this report.'}</div></div><strong>SV-${escapeHtml(listing ? listing.exchange : 'REPORT')}-${String(state.lookbackDays).padStart(2,'0')}</strong></div>
        <div class="notice ${entry?.error?'warn':'info'}" style="margin-top:14px">${escapeHtml(previewState)}. Data source is historical Yahoo Finance when available; it is not guaranteed live data.</div>
        <div class="grid grid-4" style="margin-top:16px"><div class="stat-box"><span>Latest close</span><strong>${a && a.latest_close != null ? '₹'+formatMetric(a.latest_close) : '—'}</strong></div><div class="stat-box"><span>Daily change</span><strong>${a && a.daily_change_percent != null ? signed(a.daily_change_percent) : '—'}</strong></div><div class="stat-box"><span>Anomaly score</span><strong>${a && a.anomaly_score != null ? Number(a.anomaly_score)+'/100' : '—'}</strong></div><div class="stat-box"><span>Window / sessions</span><strong>${state.lookbackDays} / ${a ? escapeHtml(a.records_used ?? '—') : '—'}</strong></div></div>
        <div class="grid grid-4" style="margin-top:10px"><div class="stat-box"><span>SMA 5</span><strong>${a && a.sma_5 != null ? '₹'+formatMetric(a.sma_5) : '—'}</strong></div><div class="stat-box"><span>SMA 20</span><strong>${a && a.sma_20 != null ? '₹'+formatMetric(a.sma_20) : '—'}</strong></div><div class="stat-box"><span>Return Z-score</span><strong>${a && a.return_z_score != null ? formatMetric(a.return_z_score) : '—'}</strong></div><div class="stat-box"><span>Volume ratio</span><strong>${a && a.volume_ratio != null ? formatMetric(a.volume_ratio)+'×' : '—'}</strong></div></div>
        <div style="margin-top:15px"><strong>Surveillance screening result:</strong> ${a ? classificationBadge(a.classification) : '—'} <span class="subtitle">${a ? escapeHtml((a.surveillance_flags || []).join('; ') || 'No configured flags were triggered.') : 'No provider analysis yet.'}</span></div>
        <h3 style="margin-top:22px">Recent provider analyses and review status</h3>
        <div class="table-wrap"><table><thead><tr><th>Company</th><th>Symbol</th><th>Exchange</th><th>Baseline</th><th>Close</th><th>Change</th><th>Score</th><th>Classification</th><th>Review</th></tr></thead><tbody>${recentRows || '<tr><td colspan="9">No provider analysis records saved yet.</td></tr>'}</tbody></table></div>
        <div class="notice warn" style="margin-top:14px"><strong>Scope note:</strong> This report contains provider responses returned by this prototype. Historical data can be delayed or unavailable. Anomaly scores prioritise human review; they do not establish insider trading.</div>
      </div>
    </div>
    ${pageFooter()}`;
}

function renderMethodology() {
  return `
    ${header('About ScripVigil','Market analysis with context','ScripVigil is an academic prototype that brings stock-market trend analysis and unusual-activity surveillance into one readable workflow.', '<button class="btn primary" data-go="dashboard">← Return to overview</button>')}
    <div class="card pad" style="background:#eef5ef;border-color:#dce9de;margin-bottom:15px"><div class="grid grid-2" style="align-items:center"><div><div class="eyebrow">Project purpose</div><h2 style="font-family:var(--font-display);font-size:27px;font-weight:600;line-height:1.2;margin:8px 0;color:#284b35">Understand market movement. Investigate unusual activity.</h2><p class="subtitle">The aim is to make relevant price, volume and event context easier to review from a single interface.</p></div><div class="grid grid-2"><div class="stat-box"><span>Primary module</span><strong>Price &amp; Trend Analysis</strong></div><div class="stat-box"><span>Surveillance module</span><strong>Variable-day anomaly</strong></div><div class="stat-box"><span>Current build</span><strong>Frontend + demo data</strong></div><div class="stat-box"><span>Backend plan</span><strong>FastAPI + PostgreSQL</strong></div></div></div></div>
    <div class="grid grid-2">
      <div class="card pad"><div class="card-title"><h3>Market data workflow</h3><small>Backend integration planned</small></div><div class="timeline">${[['01','Data ingestion','Retrieve quote and historical OHLCV data from a provider approved for the intended use.'],['02','Data validation','Check timestamps, missing values, duplicate rows and market-session rules.'],['03','Feature calculations','Compute daily return, moving averages, RSI, volatility and volume ratios.'],['04','Market trend view','Show price history and indicator interpretation without promising future prices.']].map(x=>`<div class="timeline-item"><div class="timeline-date">Step ${x[0]}</div><div class="timeline-track"><div class="timeline-dot"></div></div><div class="timeline-content"><strong>${x[1]}</strong><p>${x[2]}</p></div></div>`).join('')}</div></div>
      <div class="card pad"><div class="card-title"><h3>Unusual-activity workflow</h3><small>Proposed methodology</small></div><div class="timeline">${[['01','Choose lookback','Use 5, 10, 20, 30 or 60 trading sessions for the baseline.'],['02','Calculate deviations','Measure return Z-score, volume ratio and volatility relative to history.'],['03','Compare context','Add market/sector movement and reliable public-event information.'],['04','Score and explain','Create a review priority score and expose the factors that contributed.'],['05','Human review','A person checks evidence; the system does not make legal conclusions.']].map(x=>`<div class="timeline-item"><div class="timeline-date">Step ${x[0]}</div><div class="timeline-track"><div class="timeline-dot"></div></div><div class="timeline-content"><strong>${x[1]}</strong><p>${x[2]}</p></div></div>`).join('')}</div></div>
    </div>
    <div class="card pad" style="margin-top:15px"><div class="card-title"><h3>System architecture</h3><small>Current work and next components</small></div><div class="grid grid-4" style="margin-top:13px"><div class="stat-box"><span>Frontend</span><strong>HTML · CSS · JavaScript</strong></div><div class="stat-box"><span>Backend (planned)</span><strong>Python · FastAPI</strong></div><div class="stat-box"><span>Storage (planned)</span><strong>PostgreSQL / cache</strong></div><div class="stat-box"><span>Analytics (planned)</span><strong>Statistics + Isolation Forest</strong></div></div><div class="notice info" style="margin-top:14px">Recommended flow: approved market-data provider → backend ingestion and validation → feature calculations → trend/anomaly services → database/cache → frontend. Keep provider API secrets in the backend, never in public browser JavaScript.</div></div>
    <div class="grid grid-2" style="margin-top:15px">
      <div class="card pad"><div class="card-title"><h3>Quick glossary</h3><small>Terms used in the website</small></div><div class="reason-list"><div class="reason"><i>Return Z-score</i> How far a current return is from its selected historical average, measured in standard deviations.</div><div class="reason"><i>Volume ratio</i> Current volume divided by the average volume for the chosen baseline window.</div><div class="reason"><i>RSI</i> A momentum indicator commonly expressed on a 0–100 scale.</div><div class="reason"><i>Volatility</i> A measure of how much returns vary over a time window.</div><div class="reason"><i>Isolation Forest</i> A candidate unsupervised model for identifying observations that differ from learned historical patterns.</div></div></div>
      <div class="card pad"><div class="card-title"><h3>Data connection status</h3><span class="badge amber">Not connected</span></div><div class="reason-list"><div class="reason"><i>✓</i> Current website runs locally with sample stock records.</div><div class="reason"><i>→</i> Choose a permitted market-data provider and confirm its quote frequency/licensing.</div><div class="reason"><i>→</i> Implement FastAPI routes and keep credentials on the server.</div><div class="reason"><i>→</i> Replace demo arrays with backend responses and display a real source timestamp.</div></div><button class="btn primary" id="providerInfoBtn" style="margin-top:15px">View integration checklist</button></div>
    </div>
    <div class="notice warn" style="margin-top:15px"><strong>Important limitation:</strong> An unusual price/volume pattern is not proof of insider trading. ScripVigil is designed to prioritise activity for further review. Demo scores and prices must not be represented as real market signals or investment advice.</div>
    ${pageFooter()}`;
}

function openAlert(symbol) {
  const s = findStock(symbol);
  const m = getWindowMetrics(s);
  const body = `<div class="grid grid-3"><div class="stat-box"><span>Demo anomaly score</span><strong>${m.score}/100</strong></div><div class="stat-box"><span>Volume ratio</span><strong>${m.volumeRatio.toFixed(2)}×</strong></div><div class="stat-box"><span>Return Z-score</span><strong>${m.returnZ.toFixed(2)}σ</strong></div></div>
    <div class="reason-list" style="margin-top:15px"><div class="reason"><i>1</i> Return deviation: ${m.returnZ.toFixed(2)} standard deviations from the synthetic ${m.days}-session sample baseline.</div><div class="reason"><i>2</i> Volume ratio: ${m.volumeRatio.toFixed(2)}× the average in the selected baseline window.</div><div class="reason"><i>3</i> Volatility field: ${s.volatility.toFixed(1)}% in the demo stock record.</div><div class="reason"><i>4</i> Event context: ${s.eventProximity?'a public-event marker is included in this synthetic example.':'no public-event marker supplied in this synthetic example.'}</div></div>
    <div class="timeline" style="margin-top:17px">${[['Baseline','Historical reference','Use comparable trading sessions to define normal behaviour.'],['Price scan','Measure return deviation','Compare current return with the selected synthetic return distribution.'],['Volume scan','Compare activity','Compare current volume with the selected rolling volume baseline.'],['Context check','Public information','A real implementation should retrieve dated and attributable public disclosures.']].map(x=>`<div class="timeline-item"><div class="timeline-date">${x[0]}</div><div class="timeline-track"><div class="timeline-dot"></div></div><div class="timeline-content"><strong>${x[1]}</strong><p>${x[2]}</p></div></div>`).join('')}</div>
    <div class="notice warn" style="margin-top:8px">This is a synthetic demonstration record. The score is not a probability of insider trading and is not a legal finding.</div>`;
  openModal(`${s.symbol} — Activity review`, body, '<button class="btn" id="closeModal2">Close</button><button class="btn primary" id="reviewModal">Mark reviewed</button>');
  document.getElementById('closeModal2').onclick = closeModal;
  document.getElementById('reviewModal').onclick = () => { closeModal(); toast(`${s.symbol} marked as reviewed in the demo workflow.`); };
}

function showProviderInfo() {
  const body = `<p class="subtitle">ScripVigil currently shows sample data. To connect quotes, select a provider with the market coverage, latency and usage rights required for your project.</p><div class="reason-list"><div class="reason"><i>1</i> Create a backend endpoint such as <code>GET /api/market/quotes?symbols=TCS,INFY</code>.</div><div class="reason"><i>2</i> Store API credentials as environment variables on the backend. Do not place secrets in <code>app.js</code> or <code>config.js</code>.</div><div class="reason"><i>3</i> Return JSON fields for symbol, price, change, volume, source, timestamp and delayed/live status.</div><div class="reason"><i>4</i> Update the UI only from this validated response and display the returned timestamp and data status.</div><div class="reason"><i>5</i> Confirm provider licensing and whether quotes are real-time or delayed.</div></div><div class="notice info" style="margin-top:14px">See DATA_PROVIDER_SETUP.md in the ZIP for the integration plan and sample response shape.</div>`;
  openModal('Market-data integration checklist', body, '<button class="btn primary" id="closeProviderModal">Got it</button>');
  document.getElementById('closeProviderModal').onclick = closeModal;
}

function currentChartSelection() {
  const listing = activeListing();
  if (listing) {
    return {
      symbol: listing.symbol || listing.provider_symbol || listing.security_code,
      exchange: listing.exchange || 'NSE',
      key: `${listing.exchange || 'NSE'}:${listing.symbol || listing.security_code}`
    };
  }
  const stock = findStock(state.selected);
  return { symbol: stock.symbol, exchange: 'NSE', key: `NSE:${stock.symbol}` };
}

async function refreshMainChartData({quiet = true} = {}) {
  const canvas = document.getElementById('mainChart');
  if (!canvas) return;
  // Never let an older response from a previously selected company overwrite the
  // current chart. New selections may start a request even while an old one runs.
  const requestId = ++state.chartRequestId;
  const pageAtStart = state.page;
  const selection = currentChartSelection();
  const status = document.getElementById('chartDataStatus');
  const sourceLabel = document.getElementById('chartSourceLabel');
  const key = `${selection.key}:${state.timeframe}`;
  const changedKey = state.providerChartKey !== key;

  if (changedKey) {
    state.providerChartCandles = null;
    state.providerChartKey = null;
    state.providerChartTicker = null;
    state.providerChartSource = null;
    state.chartHoverIndex = null;
  }
  canvas.dataset.refreshing = '1';
  if (status && !state.providerChartCandles) status.innerHTML = '<span class="status-dot idle"></span> Checking provider…';

  const stillCurrent = () => requestId === state.chartRequestId && pageAtStart === state.page && key === `${currentChartSelection().key}:${state.timeframe}`;
  try {
    const url = new URL(`${CONFIG.apiBaseUrl}/market/yahoo-chart`);
    url.searchParams.set('symbol', selection.symbol);
    url.searchParams.set('exchange', selection.exchange);
    url.searchParams.set('range', state.timeframe);
    const response = await fetch(url.toString(), {cache:'no-store'});
    const data = await response.json();
    if (!response.ok) {
      const detail = data?.detail;
      throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail ?? `HTTP ${response.status}`));
    }
    if (!stillCurrent()) return;

    // Fail closed if the provider returns candles belonging to a different symbol.
    // This prevents a stale or misrouted response (for example JIOFIN.NS while TCS
    // is selected) from changing the displayed company price and chart labels.
    const requestedSymbol = String(selection.symbol || '').trim().toUpperCase().replace(/\.(NS|BO)$/i, '');
    const responseSymbol = String(data.symbol || '').trim().toUpperCase().replace(/\.(NS|BO)$/i, '');
    const responseTicker = String(data.ticker || '').trim().toUpperCase();
    if (responseSymbol && responseSymbol !== requestedSymbol) {
      throw new Error(`Provider symbol mismatch: requested ${requestedSymbol}, received ${responseSymbol}.`);
    }
    if (String(selection.exchange || '').toUpperCase() === 'NSE' && responseTicker) {
      const tickerBase = responseTicker.replace(/\.NS$/i, '');
      if (!responseTicker.endsWith('.NS') || tickerBase !== requestedSymbol) {
        throw new Error(`Provider ticker mismatch: requested ${requestedSymbol}.NS, received ${responseTicker}.`);
      }
    }

    const candles = Array.isArray(data.candles) ? data.candles.filter(c => Number.isFinite(Number(c.close))) : [];
    if (candles.length < 2) throw new Error('Provider returned fewer than two chart records.');
    state.providerChartCandles = candles;
    state.providerChartKey = key;
    state.providerChartTicker = data.ticker || selection.symbol;
    state.providerChartSource = data.provider || 'Yahoo Finance';
    state.providerChartUpdatedAt = new Date();
    const latestCandle = candles[candles.length - 1];
    const priorCandle = candles.length > 1 ? candles[candles.length - 2] : null;
    const latestClose = Number(latestCandle.close);
    const priorClose = priorCandle ? Number(priorCandle.close) : Number(latestCandle.open);
    const percentMove = Number.isFinite(priorClose) && priorClose !== 0 ? ((latestClose / priorClose) - 1) * 100 : null;
    const activePrice = document.querySelector('.terminal-price, .price-big');
    const activeChange = document.querySelector('.terminal-change, .price-change');
    if (activePrice && Number.isFinite(latestClose)) activePrice.textContent = money(latestClose);
    if (activeChange && percentMove !== null) {
      activeChange.textContent = `${signed(percentMove)} ${state.timeframe === '1D' || state.timeframe === '1W' ? 'on latest provider interval' : 'between latest daily records'}`;
      activeChange.classList.toggle('up', percentMove >= 0);
      activeChange.classList.toggle('down', percentMove < 0);
    }
    if (status) status.innerHTML = '<span class="status-dot ok"></span> Provider data · refresh attempt every 60s';
    if (status) status.title = `Latest response: ${state.providerChartUpdatedAt.toLocaleString()} · ${data.delay_notice || 'Availability and latency depend on the provider.'}`;
    if (sourceLabel) sourceLabel.textContent = `${state.providerChartTicker} · ${data.interval || state.timeframe} · ${state.providerChartUpdatedAt.toLocaleTimeString()}`;
    const first = document.getElementById('chartStartLabel');
    const last = document.getElementById('chartEndLabel');
    if (first) first.textContent = candles[0].timestamp || candles[0].date || 'Earlier';
    if (last) last.textContent = candles[candles.length - 1].timestamp || candles[candles.length - 1].date || 'Latest';
    drawChart();
  } catch (error) {
    if (!stillCurrent()) return;
    if (!state.providerChartCandles) {
      if (status) status.innerHTML = '<span class="status-dot idle"></span> Sample chart · provider unavailable';
      if (status) status.title = error.message;
      if (sourceLabel) sourceLabel.textContent = 'Illustrative demo line · no provider candles received';
    } else if (status) {
      status.innerHTML = '<span class="status-dot stale"></span> Showing last provider response';
      status.title = `Refresh failed: ${error.message}`;
    }
    if (!quiet) toast(`Chart refresh: ${error.message}`);
    drawChart();
  } finally {
    if (requestId === state.chartRequestId) delete canvas.dataset.refreshing;
  }
}

function drawChart() {
  const canvas = document.getElementById('mainChart');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const ratio = window.devicePixelRatio || 1;
  const w = Math.max(20, canvas.clientWidth);
  const h = Math.max(20, canvas.clientHeight);
  canvas.width = w * ratio;
  canvas.height = h * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  canvas.style.cursor = 'crosshair';

  let tooltip = canvas.parentElement.querySelector('.chart-hover-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.className = 'chart-hover-tooltip';
    tooltip.setAttribute('role', 'status');
    tooltip.setAttribute('aria-live', 'polite');
    canvas.parentElement.appendChild(tooltip);
  }

  const hasProvider = Array.isArray(state.providerChartCandles) && state.providerChartCandles.length > 1;
  let records = [];
  if (hasProvider) {
    records = state.providerChartCandles
      .filter(candle => Number.isFinite(Number(candle.close)))
      .map(candle => ({
        close: Number(candle.close),
        date: candle.timestamp || candle.date || 'Date unavailable',
        open: candle.open,
        high: candle.high,
        low: candle.low,
        source: 'Yahoo Finance historical data'
      }));
  } else if (state.selectedListing && ['stocks','forecast','dashboard'].includes(state.page)) {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#f1e7e2';
    ctx.lineWidth = 1;
    for (let g = 0; g < 5; g++) {
      const y = 18 + g * (h - 38) / 4;
      ctx.beginPath(); ctx.moveTo(24, y); ctx.lineTo(w - 24, y); ctx.stroke();
    }
    ctx.fillStyle = '#9b8f88';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Provider history unavailable for this listing', w / 2, h / 2 - 5);
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText('No illustrative price line is substituted for a real company', w / 2, h / 2 + 16);
    tooltip.style.display = 'none';
    state.chartPlotModel = null;
    canvas.onmousemove = null;
    canvas.onmouseleave = null;
    return;
  } else {
    const seed = state.selected.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    const range = state.timeframe;
    const count = range === '1D' ? 38 : range === '1W' ? 48 : range === '6M' ? 85 : range === '1Y' ? 105 : 65;
    let value = 100 + seed % 19;
    for (let i = 0; i < count; i++) {
      value += Math.sin(i * .47 + seed) * .72 + Math.cos(i * .19 + seed) * .34 + .13;
      records.push({close:value, date:`Illustrative sample point ${i + 1}`, source:'Illustrative sample data'});
    }
  }

  const sourceValues = records.map(record => record.close);
  if (sourceValues.length < 2) {
    state.chartPlotModel = null;
    tooltip.style.display = 'none';
    return;
  }
  const minValue = Math.min(...sourceValues), maxValue = Math.max(...sourceValues), rangeValue = maxValue - minValue || 1;
  const pad = {left:24, right:24, top:18, bottom:20};
  const plotW = Math.max(1, w - pad.left - pad.right);
  const plotH = Math.max(1, h - pad.top - pad.bottom);
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = '#f1e7e2';
  ctx.lineWidth = 1;
  for (let g = 0; g < 5; g++) {
    const y = pad.top + g * plotH / 4;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
  }

  const point = (value, index) => ({
    x: pad.left + (index / Math.max(1, sourceValues.length - 1)) * plotW,
    y: pad.top + plotH - ((value - minValue) / rangeValue) * plotH
  });
  const coords = sourceValues.map(point);
  state.chartPlotModel = {coords, records, width:w, height:h, pad, plotW, hasProvider};

  const gradient = ctx.createLinearGradient(0, pad.top, 0, h - pad.bottom);
  gradient.addColorStop(0, hasProvider ? 'rgba(235, 102, 62, .24)' : 'rgba(235, 102, 62, .13)');
  gradient.addColorStop(1, 'rgba(235, 102, 62, 0)');
  ctx.beginPath();
  ctx.moveTo(coords[0].x, coords[0].y);
  coords.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(coords[coords.length - 1].x, h - pad.bottom);
  ctx.lineTo(coords[0].x, h - pad.bottom);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath(); ctx.strokeStyle = '#e96b43'; ctx.lineWidth = 2.6; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  coords.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
  ctx.stroke();

  const rolling = sourceValues.map((_, i) => average(sourceValues.slice(Math.max(0, i - 7), i + 1)));
  ctx.beginPath(); ctx.strokeStyle = 'rgba(222, 160, 123, .9)'; ctx.lineWidth = 1.45; ctx.setLineDash([4, 5]);
  rolling.forEach((value, i) => {
    const p = point(value, i);
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  });
  ctx.stroke(); ctx.setLineDash([]);

  const last = coords[coords.length - 1];
  ctx.beginPath(); ctx.fillStyle = '#e96b43'; ctx.arc(last.x, last.y, 4.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.arc(last.x, last.y, 4.3, 0, Math.PI * 2); ctx.stroke();

  if (Number.isInteger(state.chartHoverIndex) && state.chartHoverIndex >= 0 && state.chartHoverIndex < coords.length) {
    const hoverPoint = coords[state.chartHoverIndex];
    const record = records[state.chartHoverIndex];
    ctx.beginPath(); ctx.strokeStyle = 'rgba(133,91,68,.55)'; ctx.lineWidth = 1; ctx.setLineDash([3,3]);
    ctx.moveTo(hoverPoint.x, pad.top); ctx.lineTo(hoverPoint.x, h - pad.bottom); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.fillStyle = '#ffffff'; ctx.arc(hoverPoint.x, hoverPoint.y, 5.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.fillStyle = '#e96b43'; ctx.arc(hoverPoint.x, hoverPoint.y, 3.4, 0, Math.PI * 2); ctx.fill();
    const rawDate = String(record.date || 'Date unavailable');
    let dateLabel = rawDate;
    if (rawDate.includes('T')) {
      const parsed = new Date(rawDate);
      if (!Number.isNaN(parsed.getTime())) dateLabel = parsed.toLocaleString('en-IN', {timeZone:CONFIG.exchangeTimezone || 'Asia/Kolkata'});
    }
    tooltip.innerHTML = `<strong>${money(record.close)}</strong><span>${escapeHtml(dateLabel)}</span><small>${hasProvider ? 'Yahoo Finance · historical' : 'Illustrative sample · not market data'}</small>`;
    const x = hoverPoint.x > w * .70 ? hoverPoint.x - 175 : hoverPoint.x + 12;
    const y = Math.max(5, Math.min(h - 78, hoverPoint.y - 62));
    tooltip.style.left = `${Math.max(5, Math.min(w - 175, x))}px`;
    tooltip.style.top = `${y}px`;
    tooltip.style.display = 'grid';
  } else {
    tooltip.style.display = 'none';
  }

  canvas.onmousemove = event => {
    const model = state.chartPlotModel;
    if (!model || !model.coords.length) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    if (x < model.pad.left || x > model.width - model.pad.right) {
      if (state.chartHoverIndex !== null) { state.chartHoverIndex = null; drawChart(); }
      return;
    }
    const index = clamp(Math.round(((x - model.pad.left) / model.plotW) * (model.coords.length - 1)), 0, model.coords.length - 1);
    if (state.chartHoverIndex !== index) { state.chartHoverIndex = index; drawChart(); }
  };
  canvas.onmouseleave = () => {
    if (state.chartHoverIndex !== null) { state.chartHoverIndex = null; drawChart(); }
    else if (tooltip) tooltip.style.display = 'none';
  };
}

window.addEventListener('resize', () => window.setTimeout(drawChart, 50));

// Global stock search: search the official exchange directory through the backend.
let headerSearchTimer = null;
let headerSearchResults = [];
globalSearch.addEventListener('input', () => {
  const query = globalSearch.value.trim();
  if (!query) { searchSuggestions.classList.add('hidden'); headerSearchResults = []; return; }
  clearTimeout(headerSearchTimer);
  searchSuggestions.innerHTML = '<div class="suggestion"><small>Searching NSE + BSE listings…</small></div>';
  searchSuggestions.classList.remove('hidden');
  headerSearchTimer = setTimeout(async () => {
    try {
      const url = new URL(`${CONFIG.apiBaseUrl}/instruments/directory`);
      url.searchParams.set('query', query);
      url.searchParams.set('exchange', 'ALL');
      url.searchParams.set('limit', '8');
      const response = await fetch(url.toString(), {cache:'no-store'});
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
      headerSearchResults = Array.isArray(data.results) ? data.results : [];
      if (headerSearchResults.length) {
        searchSuggestions.innerHTML = headerSearchResults.map((item, index) => `
          <div class="suggestion" data-header-directory-index="${index}" role="button" tabindex="0">
            <div class="suggestion-main">${renderCompanyLogo(item, 'symbol-box', 64)}<div><strong>${escapeHtml(item.company_name)}</strong><small>${escapeHtml(item.symbol)} · ${escapeHtml(item.exchange)}${item.isin ? ' · ' + escapeHtml(item.isin) : ''}</small></div></div><span>→</span>
          </div>`).join('');
        searchSuggestions.querySelectorAll('[data-header-directory-index]').forEach(el => {
          const choose = () => {
            const item = headerSearchResults[Number(el.dataset.headerDirectoryIndex)];
            if (item && item.demo) go('stocks', item.symbol); else openDirectoryInstrument(item);
          };
          el.onclick = choose;
          el.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(); } };
        });
      } else {
        const demoMatches = stocks.filter(item => item.symbol.toLowerCase().includes(query.toLowerCase()) || item.name.toLowerCase().includes(query.toLowerCase())).slice(0, 5);
        headerSearchResults = demoMatches.map(item => ({
          company_name: item.name, name: item.name, symbol: item.symbol, exchange: 'NSE',
          provider_symbol: item.symbol, ticker: `${item.symbol}.NS`, source: 'bundled demo list', demo: true
        }));
        searchSuggestions.innerHTML = headerSearchResults.length ? headerSearchResults.map((item, index) => `
          <div class="suggestion" data-header-directory-index="${index}"><div class="suggestion-main">${renderCompanyLogo({...item, exchange: 'NSE', ticker: item.symbol + '.NS'}, 'symbol-box', 64)}<div><strong>${escapeHtml(item.symbol)}</strong><small>${escapeHtml(item.company_name)} · Illustrative demo entry</small></div></div><span>→</span></div>`).join('') : '<div class="suggestion"><small style="padding:12px;display:block">No matching listing found. Open Company Directory to check source status.</small></div>';
        searchSuggestions.querySelectorAll('[data-header-directory-index]').forEach(el => el.onclick = () => go('stocks', headerSearchResults[Number(el.dataset.headerDirectoryIndex)].symbol));
      }
      searchSuggestions.classList.remove('hidden');
    } catch (error) {
      const demoMatches = stocks.filter(item => item.symbol.toLowerCase().includes(query.toLowerCase()) || item.name.toLowerCase().includes(query.toLowerCase())).slice(0, 5);
      headerSearchResults = demoMatches.map(item => ({ company_name:item.name, symbol:item.symbol, exchange:'NSE', provider_symbol:item.symbol, demo:true }));
      searchSuggestions.innerHTML = demoMatches.length ? demoMatches.map((item, index) => `<div class="suggestion" data-header-directory-index="${index}"><div class="suggestion-main">${renderCompanyLogo({...item, exchange: 'NSE', ticker: item.symbol + '.NS'}, 'symbol-box', 64)}<div><strong>${escapeHtml(item.symbol)}</strong><small>${escapeHtml(item.company_name)} · Directory offline</small></div></div><span>→</span></div>`).join('') : `<div class="suggestion"><small style="padding:12px;display:block">Directory unavailable: ${escapeHtml(error.message)}</small></div>`;
      searchSuggestions.querySelectorAll('[data-header-directory-index]').forEach(el => el.onclick = () => go('stocks', headerSearchResults[Number(el.dataset.headerDirectoryIndex)].symbol));
    }
  }, 250);
});

globalSearch.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (headerSearchResults.length) {
    const item = headerSearchResults[0];
    if (item.demo) go('stocks', item.symbol); else openDirectoryInstrument(item);
    return;
  }
  if (globalSearch.value.trim()) go('directory');
});

document.addEventListener('click', e => { if (!e.target.closest('.search-wrap')) searchSuggestions.classList.add('hidden'); });
document.addEventListener('keydown', e => { if (e.target.id === 'heroSearch' && e.key === 'Enter') { e.preventDefault(); document.getElementById('heroSearchBtn')?.click(); } });

// Company Directory controls and selection.
document.addEventListener('click', event => {
  if (event.target.closest('#directorySearchBtn')) loadDirectoryPage({resetOffset:true});
  if (event.target.closest('#directoryRefreshBtn')) loadDirectoryPage({refresh:true, resetOffset:true});
  if (event.target.closest('#directoryPrevBtn')) {
    directoryState.offset = Math.max(0, directoryState.offset - directoryState.limit);
    loadDirectoryPage();
  }
  if (event.target.closest('#directoryNextBtn')) {
    directoryState.offset += directoryState.limit;
    loadDirectoryPage();
  }
  const rowButton = event.target.closest('[data-directory-index]');
  if (rowButton) openDirectoryInstrument(directoryState.results[Number(rowButton.dataset.directoryIndex)]);
});
document.addEventListener('keydown', event => {
  if (event.target.id === 'directoryQuery' && event.key === 'Enter') {
    event.preventDefault(); loadDirectoryPage({resetOffset:true});
  }
});
document.addEventListener('change', event => {
  if (event.target.id === 'directoryExchange') loadDirectoryPage({resetOffset:true});
});

const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
  const savedTheme = localStorage.getItem('scripvigil-theme');
  if (savedTheme === 'dark') document.body.classList.add('theme-dark');
  themeToggle.textContent = document.body.classList.contains('theme-dark') ? '☀' : '☾';
  themeToggle.onclick = () => {
    document.body.classList.toggle('theme-dark');
    const dark = document.body.classList.contains('theme-dark');
    themeToggle.textContent = dark ? '☀' : '☾';
    localStorage.setItem('scripvigil-theme', dark ? 'dark' : 'light');
    drawChart();
  };
}

document.getElementById('notificationBtn').onclick = () => go('alerts');
document.getElementById('mobileMenu').onclick = () => document.getElementById('sidebar').classList.toggle('open');
document.querySelectorAll('.nav-item[data-page]').forEach(btn => btn.addEventListener('click', () => go(btn.dataset.page)));

document.addEventListener('click', e => {
  if (e.target.closest('#heroSearchBtn')) {
    const q = document.getElementById('heroSearch')?.value.trim();
    if (q) { directoryState.query = q; directoryState.exchange = 'ALL'; directoryState.offset = 0; go('directory'); }
    else toast('Enter a company name, symbol, ISIN or security code first.');
  }
  if (e.target.closest('#refreshChartBtn')) refreshMainChartData({quiet:false});
  const sectorButton = e.target.closest('[data-sector-filter]');
  if (sectorButton) {
    const sector = sectorButton.dataset.sectorFilter;
    document.querySelectorAll('[data-sector-filter]').forEach(btn => btn.classList.toggle('active', btn === sectorButton));
    document.querySelectorAll('.market-stock-card').forEach(card => { card.style.display = sector === 'all' || card.dataset.sector === sector ? '' : 'none'; });
  }
  if (e.target.id === 'refreshBtn') { refreshMainChartData({quiet:false}); toast('Market view refreshed; provider data will be used where available.'); }
  if (e.target.closest('#markAllReviewed')) {
    const now = new Date().toISOString();
    state.reviewRecords = state.reviewRecords.map(record => ({...record, review_status:'Reviewed', reviewed_at:now}));
    saveReviews();
    render();
    toast('Saved review records marked as reviewed.');
    return;
  }
  const universeButton = e.target.closest('[data-universe-index]');
  if (universeButton) {
    const item = state.surveillanceView[Number(universeButton.dataset.universeIndex)];
    if (item) openDirectoryInstrument(item);
    return;
  }
  const reviewButton = e.target.closest('[data-review-record]');
  if (reviewButton) {
    markReviewRecordReviewed(reviewButton.dataset.reviewRecord);
    render();
    toast('Review status saved in this browser.');
    return;
  }
  const reviewOpenButton = e.target.closest('[data-review-open]');
  if (reviewOpenButton) {
    const record = state.reviewRecords.find(item => item.id === reviewOpenButton.dataset.reviewOpen);
    if (record) {
      const url = new URL(`${CONFIG.apiBaseUrl}/instruments/directory`);
      url.searchParams.set('query', record.symbol);
      url.searchParams.set('exchange', record.exchange);
      url.searchParams.set('limit', '20');
      fetchJson(url.toString()).then(data => {
        const entries = Array.isArray(data.results) ? data.results : [];
        const selected = entries.find(item => String(item.symbol).toUpperCase() === String(record.symbol).toUpperCase()) || entries[0];
        if (selected) openDirectoryInstrument(selected); else toast('Listing not found in the current directory cache.');
      }).catch(error => toast(`Unable to open listing: ${error.message}`));
    }
    return;
  }
  if (e.target.dataset && e.target.dataset.reviewed) toast(`${e.target.dataset.symbol || 'Alert'} marked as reviewed.`);
  if (e.target.id === 'providerInfoBtn') showProviderInfo();
  if (e.target.id === 'printReport') window.print();
  if (e.target.id === 'exportReportCsv') {
    const rows = [['Company','Symbol','Exchange','Ticker','Lookback sessions','Latest close','Daily change %','Anomaly score','Classification','Review status','Analysed at']];
    state.reviewRecords.forEach(record => rows.push([record.company_name, record.symbol, record.exchange, record.ticker, record.lookback_days, record.latest_close, record.daily_change_percent, record.anomaly_score, record.classification, record.review_status, record.analyzed_at]));
    const csv = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `scripvigil-review-log-${new Date().toISOString().slice(0,10)}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }
  if (e.target.dataset && e.target.dataset.action === 'generate-report') toast('Report preview uses the selected listing and saved provider analyses. Use Print / save as PDF to export it.');
});
document.addEventListener('input', event => {
  if (event.target.id === 'surveillanceQuery') {
    state.surveillanceQuery = event.target.value;
    state.surveillancePage = 0;
    const cursor = event.target.selectionStart;
    render();
    const restored = document.getElementById('surveillanceQuery');
    if (restored) { restored.focus(); restored.setSelectionRange(cursor, cursor); }
  }
});
document.addEventListener('change', event => {
  if (event.target.id === 'surveillanceExchangeFilter') {
    state.surveillanceExchange = event.target.value;
    state.surveillancePage = 0;
    render();
  }
  if (event.target.id === 'surveillancePageSize') {
    state.surveillancePageSize = Number(event.target.value) || 50;
    state.surveillancePage = 0;
    render();
  }
});
document.addEventListener('click', event => {
  if (event.target.closest('#surveillanceSearchBtn')) {
    state.surveillanceQuery = document.getElementById('surveillanceQuery')?.value || '';
    state.surveillanceExchange = document.getElementById('surveillanceExchangeFilter')?.value || 'ALL';
    state.surveillancePage = 0;
    render();
  }
  if (event.target.closest('#surveillancePrevBtn')) {
    state.surveillancePage = Math.max(0, state.surveillancePage - 1);
    render();
  }
  if (event.target.closest('#surveillanceNextBtn')) {
    state.surveillancePage = state.surveillancePage + 1;
    render();
  }
  if (event.target.closest('#scanMarket')) {
    hydrateCompanyPage(state.page, {force:true});
    if (state.page === 'surveillance') loadRealDirectoryUniverse('surveillance', {force:true});
  }
});

async function checkBackendConnection() {
  const statusText = document.getElementById("dataModeText");
  const statusPill = document.getElementById("dataModePill");

  try {
    const response = await fetch(
      `${CONFIG.apiBaseUrl}/health`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error("Backend returned an error");
    }

    await response.json();

    statusText.textContent = "API connected · chart auto-refresh";
    statusPill.title =
      "Provider chart data is attempted every 60 seconds. Yahoo Finance may be delayed or unavailable; sample cards and index snapshots remain illustrative.";
  } catch (error) {
    statusText.textContent = "API offline · sample fallback";
    statusPill.title =
      "Backend is unreachable. Start the FastAPI server and check the connection.";
  }
}

checkBackendConnection();

document.addEventListener("click", event => {
  const button = event.target.closest("#loadProviderAnalysis");

  if (button) {
    loadProviderAnalysis();
  }
});

// Auto-refresh selected chart from provider data every 60 seconds while visible.
window.setInterval(() => {
  if (document.visibilityState === 'visible' && ['dashboard','stocks','forecast'].includes(state.page)) {
    refreshMainChartData({quiet:true});
  }
}, 60000);

render();
