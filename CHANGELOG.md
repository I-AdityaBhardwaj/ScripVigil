# Changelog

## ScripVigil NSE/BSE directory update

- Added a Company Directory page with search, exchange filters, paging, source counts, and refresh status.
- Connected the global header search to the backend's exchange-directory search.
- Added normalized exchange metadata fields: company name, symbol, ISIN, security code, series/group, industry when available, listing date, face value, market lot and source.
- Added backend download/parse/cache logic for current NSE equity and SME security CSVs plus BSE's active equity security list endpoint.
- Added manual refresh and daily-ish cache freshness handling; source failures preserve cached rows and are reported rather than hidden.
- Added a selected listing profile that passes the appropriate exchange and provider symbol to the Yahoo historical-analysis endpoints.
- Added yfinance to `requirements.txt` and updated setup documentation.
- Excluded `.venv` and `.env` from the deliverable ZIP. Local credentials must be created separately.

## Earlier build features retained

- ScripVigil branding and professional light-theme dashboard.
- Overview, Stock Analysis, Market Trends, Surveillance, Alerts, Reports, and Methodology pages.
- Variable-period 5/10/20/30/60-session analysis options.
- Separate historical-analysis panel and illustrative demo dashboard values.


## Market Terminal UI refresh
- Reworked the overview into a market discovery hero, searchable equities, sector chips, mini-sparkline stock cards, primary chart and watchlist/market-pulse sidebar.
- Added compact index/mkt pulse strip across the app shell. Values are marked sample, not live quotes.
- Restyled existing modules in a warm orange palette; preserved the current navigation, directory, analysis, trends, surveillance, alerts/reviews, reports and methodology views.
- Added `/api/market/yahoo-chart` for range-sensitive chart data and auto-refresh attempts every 60 seconds while the main chart is visible. Provider data is not guaranteed real-time; demo fallback remains.
- Updated provider-error handling so structured JSON errors do not display as `[object Object]`.


## Selected-company workflows and full-universe surveillance
- Added a bulk directory-universe endpoint so Surveillance can load the cached NSE/BSE directory in a single request and paginate/filter it in the UI.
- Connected the selected official exchange listing and provider analysis to Market Trends, Surveillance, Alerts & Reviews, and Reports; successful analyses create/update the local review log.
- Alerts & Reviews now displays saved results for actual selected listings and stores review statuses locally; Reports include selected-listing metrics and recent analysis history with print/CSV export.
- Added a company/exchange search and pagination controls to the Surveillance directory table. Only the selected listing is screened on demand; remaining directory records are marked not screened until analysed.
- Main chart hover displays the candle date and close price; historical provider data remains clearly distinguished from illustrative sample data.
- Updated the BSE directory request to use the newer `ListofScripData_new` endpoint and a warmed-up persistent session, preserving cached records when BSE blocks refresh requests.
