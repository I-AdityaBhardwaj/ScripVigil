/* ScripVigil configuration
   This file is safe to edit for local project customisation.
   The current build intentionally uses demo data. Live data requires a backend/provider integration;
   do not paste API secrets into a browser-side JavaScript file.
*/
window.SCRIPTVIGIL_CONFIG = {
  appName: 'ScripVigil',
  // Logo.dev browser-safe CDN publishable key. Paste your pk_ key here. Never use the sk_ secret key.
  logoDevPublishableKey: 'pk_V0HyaUN6SQCIpg9r_BTs0A',
  dataMode: 'hybrid', // Demo fallbacks remain; provider-backed chart data is shown only after a successful API response.
  apiBaseUrl: 'https://scripvigil.onrender.com/api',
  defaultLookbackDays: 20,
  lookbackOptions: [5, 10, 20, 30, 60],
  currency: 'INR',
  exchangeTimezone: 'Asia/Kolkata'
};
