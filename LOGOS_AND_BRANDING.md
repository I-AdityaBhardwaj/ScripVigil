# ScripVigil logos and company-logo setup

## ScripVigil brand assets

- `assets/scripvigil-mark.svg` — square emblem, header icon and favicon.
- `assets/scripvigil-logo.svg` — horizontal logo lockup for README pages, posters or presentations.

The identity combines a protective shield, stock-market bars and an upward trend arrow, using charcoal and orange.

## Enable company logos

1. Open `config.js`.
2. Replace `PASTE_LOGO_DEV_PUBLISHABLE_KEY_HERE` with your Logo.dev **CDN Publishable Key** (starts with `pk_`).
3. Never put the API Secret Key (starts with `sk_`) in the frontend or this public repository.
4. In the Logo.dev dashboard, restrict allowed domains to the local development hostnames you use (`localhost` and `127.0.0.1`) and your GitHub Pages hostname (`i-adityabhardwaj.github.io`). Include a custom domain if your deployment uses one; follow the precise input format accepted by Logo.dev.
5. Save `config.js`, reload the page, then test several NSE and BSE listings.

The browser first requests a Logo.dev image using the exchange ticker (`.NS` for NSE / `.BO` for BSE). If that lookup fails and the listing has an ISIN, it tries the ISIN lookup. If both are unavailable, a local initials icon remains, avoiding broken-image placeholders.

The publishable key is intended for browser usage and will be visible in frontend code once configured. Restrict it by domain. Never commit an `sk_...` secret key. Logo.dev states that commercial use on its free plan requires attribution; a small footer attribution link is included.

Current provider documentation: https://www.logo.dev/products/stock-ticker-logos
