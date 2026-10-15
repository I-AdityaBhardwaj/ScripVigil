# ScripVigil data-provider setup

## Current integrations in this build

### Exchange listing directory

`GET /api/instruments/directory?query=RELIANCE&exchange=ALL&limit=50&offset=0` searches a local cache of current active equity listings from NSE and BSE. Add `refresh=true` to force a source refresh. `GET /api/instruments/directory/status` reports loaded listing counts, source status, and cache time.

The backend fetches:

- NSE equity: `https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv`
- NSE SME equity: `https://nsearchives.nseindia.com/emerge/corporates/content/SME_EQUITY_L.csv`
- BSE active equity list: `https://api.bseindia.com/BseIndiaAPI/api/ListofScripData/w` with Equity/Active filters

Source payloads are parsed into common fields (`company_name`, `exchange`, `symbol`, `provider_symbol`, `ticker`, `isin`, `security_code`, `series`, `group`, `industry`, `listing_date`, `face_value`, `paid_up_value`, `market_lot`, `status`, `security_type`, and `source`). Optional fields remain null if absent from the source. The cache is stored in `backend/data/security_directory.json`, created at runtime and ignored by version control.

The endpoint does not claim full coverage if either source fails. Use **Refresh official lists** in Company Directory to retry. The list covers active equity listing/security records from these endpoints; it is not a directory of unlisted entities, delisted securities, bonds or every non-equity product.

### Historical prices and analysis

- `GET /api/market/yahoo-history?symbol=RELIANCE&exchange=NSE&lookback_days=20`
- `GET /api/market/yahoo-analyze?symbol=RELIANCE&exchange=NSE&lookback_days=20`
- For BSE, pass the numeric BSE security code as `symbol` and `exchange=BSE` so Yahoo's expected `.BO` identifier can be formed.

Allowed lookback windows: 5, 10, 20, 30 and 60 trading sessions. Yahoo Finance is used for development and historical inspection only, not as a guaranteed licensed real-time feed.

## Upstox preparation

When the Upstox application is approved, put the token in `backend/.env` as `UPSTOX_ACCESS_TOKEN=...`. Do not put credentials in frontend JavaScript or check them into Git. The ZIP includes `.env.example`, not `.env`.

## Interpretation

The anomaly result is a rule-based screen using historical returns and relative volume. It is not a trained model and cannot establish insider trading or wrongdoing. Use it to prioritise human review, and label the source and freshness of every market-data response.


## Chart refresh adapter in this build

The UI can call `GET /api/market/yahoo-chart?symbol=RELIANCE&exchange=NSE&range=1D`. Supported ranges are `1D`, `1W`, `1M`, `6M` and `1Y`. The FastAPI route uses Yahoo Finance candles via `yfinance`, with 1-minute bars for the day range, 5-minute bars for the week range, and daily bars for longer windows where available. The frontend retries the currently selected main chart when opened, when the range changes, on manual refresh, and every 60 seconds while the tab is visible.

This is provider polling, not WebSocket streaming and not a guarantee of real-time exchange prices. Yahoo Finance may delay, omit or throttle particular symbols—especially exchange-specific listings. The interface keeps the demo chart fallback and labels the source state. Index ribbon values, card price labels and mini sparklines remain illustrative unless separately wired to a validated quote endpoint.
