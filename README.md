# ScripVigil — Stock Market Analysis & Surveillance

ScripVigil is a student-project prototype built with plain HTML, CSS and JavaScript plus a Python FastAPI backend. It now includes an exchange-listing directory for **active equity listings on NSE and BSE** and historical stock analysis through Yahoo Finance where that provider supports the selected symbol.

## What is included in this update

- **Company Directory page** for NSE + BSE with search by company name, trading symbol, ISIN, or security code.
- Directory result table with exchange, symbol, code, ISIN, NSE series / BSE group, industry when supplied, listing date when supplied, and face value when supplied.
- Backend retrieval of the latest NSE equity CSV, NSE SME equity CSV, and BSE public active-equity list endpoint; a refresh button retries both exchange sources.
- Local cache at `backend/data/security_directory.json` so every keystroke does not download the full exchange lists. The cache is generated on first successful directory request and refreshed after 12 hours, or manually from Company Directory.
- Global header search now searches the exchange directory and lets you open a specific exchange listing.
- A selected listing is shared across Stock Analysis, Market Trends, Surveillance, Alerts & Reviews, and Reports. Its exchange, symbol, ISIN, security code and provider analysis context follow the selected listing when navigating between pages.
- Surveillance has a searchable and paginated view of the full locally cached NSE/BSE listing universe (not just the sample stock array). Listings that have not been analysed are explicitly labelled “not screened”; the app does not issue thousands of Yahoo requests automatically.
- Alerts & Reviews uses saved successful provider-analysis records for real selected listings and stores review status in this browser's local storage. Reports use the selected listing and saved provider analysis history, and can be printed or exported to CSV.
- The main chart supports point hover details showing the returned date and close price; provider candles are used when available.
- Historical `5 / 10 / 20 / 30 / 60` session analysis and closing-price chart remain available where Yahoo Finance returns data.
- Existing overview, demo charting, market trends, surveillance, alerts, reports and methodology pages remain included.
- `.env` files and virtual environments are not packaged, to avoid including local secrets or machine-specific packages.

## Run on Windows (VS Code)

### 1. Extract and open

1. Extract this ZIP.
2. Open the `ScripVigil` folder in VS Code.
3. Open **Terminal → New Terminal**.

### 2. Set up the backend

Run these commands from the `ScripVigil` folder:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Create a file named `backend/.env` (the folder already has `.env.example`) with:

```dotenv
UPSTOX_ACCESS_TOKEN=
```

Leave the token empty until Upstox approves your application. Do not send the token to anyone and do not place it in `app.js` or `config.js`.

Start the API from inside `backend`:

```powershell
python -m uvicorn main:app --reload --port 8000
```

Check `http://127.0.0.1:8000/docs` to see the backend endpoints.

### 3. Run the frontend

Open the top-level `index.html` using VS Code Live Server. The usual local address is `http://127.0.0.1:5500`.

Open **Company Directory**. On the first request, ScripVigil downloads the official directory sources and builds a local cache. Use **Refresh official lists** to request a fresh copy. Search by name (e.g. Reliance), symbol (e.g. TCS), ISIN, or BSE security code.

## Directory fields and coverage

The source masters are exchange security/listing files, not complete company research profiles. Depending on the source, records may include company name, trading symbol, ISIN, security code, exchange, series/group, listing date, paid-up value, face value, market lot, status and industry. Industry or other optional fields are left blank where the exchange source does not supply them; ScripVigil does not guess missing details.

The Company Directory refresh uses internet access on the computer running the backend. NSE publishes current equity and SME equity CSV lists. BSE's active equity list endpoint is also retrieved by the backend. If an exchange blocks or changes its endpoint, the Company Directory shows the source status and keeps the last local cache rather than claiming that an incomplete list is complete. It requires both sources to load before marking the directory complete.

The cache is a **snapshot of active exchange equity listings**, not a static list baked into this ZIP. That makes it easier to update after listings and symbols change. A successful first refresh is necessary before the complete current directory is available. If the BSE source fails, use **Refresh official lists** later; the app will visibly mark it incomplete.

## Market data and analysis limitations

- Yahoo Finance via `yfinance` is used as a development/testing historical-data source. It is an unofficial interface, data availability can vary, and it is **not a guaranteed real-time feed**.
- Some exchange-listed securities may not have a Yahoo Finance history even if they appear in the official directory. Directory listing and historical data coverage are different things.
- The market-index ribbon and Overview showcase cards remain illustrative sample values. Market Trends and the selected-company sections in Surveillance, Alerts & Reviews, and Reports use provider analysis only when returned successfully. The directory universe is official listing metadata, not price data.
- The historical anomaly score is a transparent rule-based screening score, not a trained ML model and not a probability of insider trading. Alerts are review signals, not evidence of wrongdoing.
- Upstox endpoints remain prepared for later integration, but a valid approved token is required before those endpoints can return Upstox data.

## Files

- `index.html` — page shell and navigation
- `styles.css` — layout and styling
- `app.js` — frontend pages, global exchange search, directory table and historical analysis rendering
- `config.js` — frontend API base URL and lookback settings
- `backend/main.py` — FastAPI endpoints, directory sync/cache, Yahoo Finance history and rule-based analysis
- `backend/requirements.txt` — Python dependencies
- `backend/.env.example` — example private environment configuration
- `DATA_PROVIDER_SETUP.md` — data-provider notes
- `CHANGELOG.md` — changes in this build

## Official directory references

- NSE securities available for trading: https://www.nseindia.com/static/market-data/securities-available-for-trading
- NSE securities available for equity: https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv
- NSE SME equity list: https://nsearchives.nseindia.com/emerge/corporates/content/SME_EQUITY_L.csv
- BSE standardised security master file format reference: https://www.bseindia.com/markets/MarketInfo/DownloadAttach.aspx?attachedId=e99e2ca5-95d7-4173-83da-7774412bbb2d&id=20220531-44


## Market Terminal UI refresh

This build adds a warm orange market-terminal visual design inspired by the general interaction patterns shown in the supplied reference recording: compact market pulse ribbon, searchable discovery hero, stock cards with mini sparklines, primary chart plus watchlist / market-pulse column, responsive layout, and updated typography/colors. Existing pages remain available: Overview/Markets, Stock Analysis, Company Directory, Market Trends, Surveillance, Alerts & Reviews, Reports, About & Method.

### Chart refresh behaviour

The primary chart attempts to fetch provider candles from `GET /api/market/yahoo-chart` when a chart page is opened, on range changes, when the refresh button is clicked, and every 60 seconds while the page is visible. Hovering over the line displays the nearest returned candle date and close price. The backend uses Yahoo Finance via `yfinance`: `1m` candles for 1D, `5m` candles for 1W, and daily candles for 1M/6M/1Y where available. Provider availability and latency vary; this is **not a guaranteed real-time exchange feed**. On a real official listing, a provider-unavailable response is not replaced with an unlabelled synthetic line. Illustrative demo charts remain available for the demo showcase only. The index ribbon and sample stock-card sparklines remain clearly labeled illustrative sample data.

The Surveillance page loads the full cached directory using `GET /api/instruments/directory/universe`, with a paginated API fallback for older servers. It analyses only the selected listing when requested so the browser does not hammer the provider. Alerts/review decisions are browser-local (not shared across devices). For guaranteed intraday streaming, configure an exchange/provider-approved market data feed and integrate its WebSocket through the backend. Never put provider credentials in browser JavaScript.


### Updating an existing ScripVigil folder

To preserve exchange-list cache on computers where the directory has already loaded, stop the backend and copy these updated files into the **existing** project folder: `index.html`, `styles.css`, `app.js`, `config.js`, `backend/main.py`, and the documentation files. Keep `backend/.env` private and retain `backend/data/security_directory.json` if it exists. If extracting into a new folder, copy the existing `backend/data/` cache into the new backend folder before starting it. A fresh install may need to redownload the NSE/BSE directory, and an exchange may temporarily reject automated refresh requests.
