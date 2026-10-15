import os
import csv
import io
import json
import re
import statistics
from concurrent.futures import ThreadPoolExecutor
import yfinance as yf
import httpx
from pathlib import Path
from datetime import date, timedelta, datetime, timezone
from urllib.parse import quote
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()



app = FastAPI(
    title="ScripVigil API",
    description="Stock Market Analysis & Surveillance",
    version="0.1.0"
)


# Allow the website to communicate with the backend.

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://i-adityabhardwaj.github.io",
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:5501",
        "http://localhost:5501",
    ],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)



@app.get("/")
def home():
    return {
        "project": "ScripVigil",
        "message": "Backend is running"
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "data_provider": "Yahoo Finance historical development adapter",
        "market_data": "historical only; not guaranteed real-time",
        "directory": "official NSE/BSE directory sync available",
        "message": "Backend is ready; stock directory refresh is performed on first search or manually",
        "directory_status_url": "/api/instruments/directory/status",
        "diagnostics_url": "/api/diagnostics/routes"
    }

@app.get("/api/market/quote")
async def get_market_quote(instrument_key: str):
    # Read the private token from backend/.env
    token = os.getenv("UPSTOX_ACCESS_TOKEN", "").strip()

    if not token:
        raise HTTPException(
            status_code=503,
            detail="Upstox token is not configured yet."
        )

    # Accept NSE and BSE equity instrument keys only
    if not instrument_key.startswith(("NSE_EQ|", "BSE_EQ|")):
        raise HTTPException(
            status_code=400,
            detail="Use an NSE_EQ or BSE_EQ instrument key."
        )

    url = "https://api.upstox.com/v2/market-quote/quotes"

    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {token}"
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                url,
                headers=headers,
                params={"instrument_key": instrument_key}
            )
    except httpx.RequestError:
        raise HTTPException(
            status_code=502,
            detail="Could not connect to Upstox."
        )

    if response.status_code in (401, 403):
        raise HTTPException(
            status_code=502,
            detail="Upstox rejected the token or denied access."
        )

    if response.status_code == 429:
        raise HTTPException(
            status_code=502,
            detail="Upstox rate limit reached. Try again later."
        )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"Upstox returned HTTP {response.status_code}."
        )

    try:
        provider_data = response.json()
    except ValueError:
        raise HTTPException(
            status_code=502,
            detail="Upstox returned an invalid JSON response."
        )

    return {
        "provider": "Upstox",
        "data_status": "provider_response",
        "instrument_key": instrument_key,
        "result": provider_data
    }


@app.get("/api/market/history")
async def get_market_history(
    instrument_key: str,
    lookback_days: int = 20
):
    token = os.getenv("UPSTOX_ACCESS_TOKEN", "").strip()

    if not token:
        raise HTTPException(
            status_code=503,
            detail="Upstox token is not configured yet."
        )

    if not instrument_key.startswith(("NSE_EQ|", "BSE_EQ|")):
        raise HTTPException(
            status_code=400,
            detail="Use an NSE_EQ or BSE_EQ instrument key."
        )

    allowed_windows = {5, 10, 20, 30, 60}

    if lookback_days not in allowed_windows:
        raise HTTPException(
            status_code=400,
            detail="lookback_days must be 5, 10, 20, 30, or 60."
        )

    # Use extra calendar days to account for weekends and holidays.
    end_date = date.today()
    start_date = end_date - timedelta(days=lookback_days * 3)

    encoded_key = quote(instrument_key, safe="")
    url = (
        f"https://api.upstox.com/v3/historical-candle/"
        f"{encoded_key}/days/1/{end_date}/{start_date}"
    )

    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {token}"
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(url, headers=headers)
    except httpx.RequestError:
        raise HTTPException(
            status_code=502,
            detail="Could not connect to Upstox historical-data API."
        )

    if response.status_code in (401, 403):
        raise HTTPException(
            status_code=502,
            detail="Upstox rejected the token or denied access."
        )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"Upstox historical-data API returned HTTP {response.status_code}."
        )

    try:
        provider_data = response.json()
    except ValueError:
        raise HTTPException(
            status_code=502,
            detail="Upstox returned invalid JSON."
        )

    raw_candles = provider_data.get("data", {}).get("candles", [])

    # Upstox candles contain timestamp, open, high, low,
    # close, volume, and open interest.
    candles = [
        {
            "timestamp": candle[0],
            "open": candle[1],
            "high": candle[2],
            "low": candle[3],
            "close": candle[4],
            "volume": candle[5],
            "open_interest": candle[6] if len(candle) > 6 else 0
        }
        for candle in raw_candles
        if len(candle) >= 6
    ]

    # Sort oldest to newest, then keep the requested
    # number of trading-day records.
    candles.sort(key=lambda candle: candle["timestamp"])
    candles = candles[-lookback_days:]

    return {
        "provider": "Upstox",
        "data_status": "historical",
        "instrument_key": instrument_key,
        "lookback_days": lookback_days,
        "records_returned": len(candles),
        "candles": candles
    }


@app.get("/api/market/analyze")
async def analyze_market(
    instrument_key: str,
    lookback_days: int = 20
):
    # Reuse the historical data endpoint.
    history = await get_market_history(
        instrument_key=instrument_key,
        lookback_days=lookback_days
    )

    candles = history["candles"]

    if len(candles) < 2:
        raise HTTPException(
            status_code=422,
            detail="Not enough historical records for analysis."
        )

    closes = [float(c["close"]) for c in candles]
    volumes = [float(c["volume"]) for c in candles]

    latest_close = closes[-1]
    previous_close = closes[-2]
    latest_volume = volumes[-1]

    price_change_pct = (
        ((latest_close - previous_close) / previous_close) * 100
        if previous_close else None
    )

    # Moving averages use the available requested history.
    sma_5 = (
        sum(closes[-5:]) / 5
        if len(closes) >= 5 else None
    )

    sma_20 = (
        sum(closes[-20:]) / 20
        if len(closes) >= 20 else None
    )

    # Compare the latest volume with earlier daily volumes.
    baseline_volumes = [
        volume for volume in volumes[:-1] if volume > 0
    ]

    average_volume = (
        sum(baseline_volumes) / len(baseline_volumes)
        if baseline_volumes else None
    )

    volume_ratio = (
        latest_volume / average_volume
        if average_volume and average_volume > 0 else None
    )

    flags = []

    if price_change_pct is not None and abs(price_change_pct) >= 3:
        flags.append("Large daily price movement")

    if volume_ratio is not None and volume_ratio >= 2:
        flags.append("Unusually high trading volume")

    return {
        "instrument_key": instrument_key,
        "lookback_days": lookback_days,
        "data_status": "historical",
        "latest_close": latest_close,
        "daily_change_percent": round(price_change_pct, 2)
            if price_change_pct is not None else None,
        "sma_5": round(sma_5, 2) if sma_5 is not None else None,
        "sma_20": round(sma_20, 2) if sma_20 is not None else None,
        "latest_volume": latest_volume,
        "average_previous_volume": round(average_volume, 2)
            if average_volume is not None else None,
        "volume_ratio": round(volume_ratio, 2)
            if volume_ratio is not None else None,
        "surveillance_flags": flags,
        "note": (
            "Rule-based screening only. Flags identify unusual "
            "market behaviour and do not establish insider trading."
        )
    }


@app.get("/api/instruments/search")
async def search_instruments(
    query: str,
    exchange: str = "ALL"
):
    token = os.getenv("UPSTOX_ACCESS_TOKEN", "").strip()

    if not token:
        raise HTTPException(
            status_code=503,
            detail="Upstox token is not configured yet."
        )

    query = query.strip()
    exchange = exchange.upper().strip()

    if not query or len(query) > 50:
        raise HTTPException(
            status_code=400,
            detail="Enter a search query of 1–50 characters."
        )

    if exchange not in {"ALL", "NSE", "BSE"}:
        raise HTTPException(
            status_code=400,
            detail="Exchange must be ALL, NSE, or BSE."
        )

    url = "https://api.upstox.com/v2/instruments/search"

    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {token}"
    }

    params = {
        "query": query,
        "exchanges": "NSE,BSE" if exchange == "ALL" else exchange,
        "segments": "EQ",
        "page_number": 1,
        "records": 20
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                url,
                headers=headers,
                params=params
            )
    except httpx.RequestError:
        raise HTTPException(
            status_code=502,
            detail="Could not connect to Upstox instrument search."
        )

    if response.status_code in (401, 403):
        raise HTTPException(
            status_code=502,
            detail="Upstox rejected the token or denied access."
        )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"Upstox returned HTTP {response.status_code}."
        )

    try:
        result = response.json()
    except ValueError:
        raise HTTPException(
            status_code=502,
            detail="Upstox returned invalid JSON."
        )

    instruments = []

    for item in result.get("data", []):
        if item.get("segment") not in {"NSE_EQ", "BSE_EQ"}:
            continue

        instruments.append({
            "name": item.get("name"),
            "trading_symbol": item.get("trading_symbol"),
            "exchange": item.get("exchange"),
            "segment": item.get("segment"),
            "instrument_key": item.get("instrument_key"),
            "isin": item.get("isin")
        })

    return {
        "provider": "Upstox",
        "data_status": "provider_response",
        "query": query,
        "exchange": exchange,
        "count": len(instruments),
        "instruments": instruments
    }

def _resolve_yahoo_ticker(symbol: str, exchange: str) -> str:
    """Resolve a user symbol to Yahoo Finance's usual NSE/BSE ticker format.

    For BSE, Yahoo commonly uses the numeric BSE security code (e.g. 500180.BO),
    not necessarily the trading symbol (e.g. HDFCBANK.BO). Use the exchange
    directory mapping whenever it has been loaded; otherwise allow an explicit
    numeric BSE code and finally fall back to the supplied text.
    """
    cleaned = str(symbol or "").strip().upper()
    market = str(exchange or "NSE").strip().upper()

    if cleaned.endswith(".NS"):
        cleaned = cleaned[:-3]
        market = "NSE"
    elif cleaned.endswith(".BO"):
        cleaned = cleaned[:-3]
        market = "BSE"

    if market == "NSE":
        return f"{cleaned}.NS"

    # BSE tickers usually use the numeric scrip/security code.
    for item in globals().get("_directory_items", []):
        if item.get("exchange") != "BSE":
            continue
        candidates = {
            str(item.get("symbol") or "").strip().upper(),
            str(item.get("provider_symbol") or "").strip().upper(),
            str(item.get("security_code") or "").strip().upper(),
            str(item.get("ticker") or "").strip().upper().removesuffix(".BO"),
        }
        if cleaned in candidates:
            code = str(item.get("security_code") or item.get("provider_symbol") or cleaned).strip().upper()
            return f"{code}.BO"

    return f"{cleaned}.BO"


@app.get("/api/market/yahoo-history")
def get_yahoo_history(
    symbol: str,
    exchange: str = "NSE",
    lookback_days: int = 20
):
    symbol = symbol.strip().upper()
    exchange = exchange.strip().upper()

    # Validate the requested exchange.
    if exchange not in {"NSE", "BSE"}:
        raise HTTPException(
            status_code=400,
            detail="Exchange must be NSE or BSE."
        )

    # Accept a company symbol, with or without a Yahoo suffix.
    if symbol.endswith(".NS") or symbol.endswith(".BO"):
        symbol = symbol.rsplit(".", 1)[0]

    if (
        not symbol
        or len(symbol) > 30
        or not all(c.isalnum() or c in "&._-" for c in symbol)
    ):
        raise HTTPException(
            status_code=400,
            detail="Enter a valid stock symbol, such as RELIANCE."
        )

    # Only allow the supported analysis windows.
    if lookback_days not in {5, 10, 20, 30, 60}:
        raise HTTPException(
            status_code=400,
            detail="Lookback must be 5, 10, 20, 30, or 60."
        )

    # Resolve BSE trading symbols through the directory so e.g. HDFCBANK
    # can map to Yahoo's numeric BSE ticker when the directory is loaded.
    ticker_symbol = _resolve_yahoo_ticker(symbol, exchange)

    try:
        history = yf.Ticker(ticker_symbol).history(
            period="6mo",
            interval="1d",
            auto_adjust=False,
            actions=False
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Yahoo Finance request failed. Please try again."
        ) from exc

    if history.empty:
        raise HTTPException(
            status_code=502,
            detail=(
                f"No historical data returned for {ticker_symbol}. "
                "Check the symbol or try again later."
            )
        )

    history = (
        history
        .dropna(subset=["Open", "High", "Low", "Close"])
        .sort_index()
        .tail(lookback_days)
    )

    candles = []

    for timestamp, row in history.iterrows():
        volume_value = row.get("Volume", 0)

        candles.append({
            "date": timestamp.strftime("%Y-%m-%d"),
            "open": round(float(row["Open"]), 2),
            "high": round(float(row["High"]), 2),
            "low": round(float(row["Low"]), 2),
            "close": round(float(row["Close"]), 2),
            "volume": (
                int(volume_value)
                if volume_value is not None
                and str(volume_value) != "nan"
                else 0
            )
        })

    return {
        "provider": "Yahoo Finance",
        "data_status": "historical_provider_data",
        "real_time": False,
        "symbol": symbol,
        "exchange": exchange,
        "ticker": ticker_symbol,
        "lookback_days": lookback_days,
        "records_returned": len(candles),
        "candles": candles,
        "notice": (
            "Historical data only. Data freshness and availability "
            "vary; this endpoint does not guarantee real-time quotes."
        )
    }

@app.get("/api/market/yahoo-analyze")
def analyze_yahoo_market(
    symbol: str,
    exchange: str = "NSE",
    lookback_days: int = 20
):
    symbol = symbol.strip().upper()
    exchange = exchange.strip().upper()

    if exchange not in {"NSE", "BSE"}:
        raise HTTPException(
            status_code=400,
            detail="Exchange must be NSE or BSE."
        )

    if lookback_days not in {5, 10, 20, 30, 60}:
        raise HTTPException(
            status_code=400,
            detail="Lookback must be 5, 10, 20, 30, or 60."
        )

    # Normalize the symbol and select the Yahoo ticker.
    if symbol.endswith(".NS") or symbol.endswith(".BO"):
        symbol = symbol.rsplit(".", 1)[0]

    if (
        not symbol
        or len(symbol) > 30
        or not all(c.isalnum() or c in "&._-" for c in symbol)
    ):
        raise HTTPException(
            status_code=400,
            detail="Enter a valid stock symbol."
        )

    ticker = _resolve_yahoo_ticker(symbol, exchange)

    try:
        history = yf.Ticker(ticker).history(
            period="6mo",
            interval="1d",
            auto_adjust=False,
            actions=False
        )
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="Unable to retrieve historical stock data."
        )

    if history.empty:
        raise HTTPException(
            status_code=502,
            detail=f"No historical data returned for {ticker}."
        )

    history = (
        history
        .dropna(subset=["Close"])
        .sort_index()
    )

    # One extra close is needed to calculate the latest daily return.
    window = history.tail(lookback_days + 1)

    if len(window) < 3:
        raise HTTPException(
            status_code=422,
            detail="Insufficient records for anomaly analysis."
        )

    closes = [float(value) for value in window["Close"]]
    volumes = [
        float(value) if value == value else 0.0
        for value in window["Volume"]
    ]

    returns = [
        (closes[i] / closes[i - 1] - 1) * 100
        for i in range(1, len(closes))
        if closes[i - 1] != 0
    ]

    latest_return = returns[-1]
    previous_returns = returns[:-1]

    avg_return = statistics.mean(previous_returns)
    return_std = (
        statistics.stdev(previous_returns)
        if len(previous_returns) >= 2 else 0.0
    )

    # A Z-score compares today's move with previous daily moves.
    z_score = (
        (latest_return - avg_return) / return_std
        if return_std > 0 else None
    )

    previous_volumes = [v for v in volumes[:-1] if v > 0]
    avg_volume = (
        statistics.mean(previous_volumes)
        if previous_volumes else None
    )

    latest_volume = volumes[-1]
    volume_ratio = (
        latest_volume / avg_volume
        if avg_volume and avg_volume > 0 else None
    )

    # A transparent heuristic score, not a trained ML probability.
    anomaly_score = None

    if z_score is not None and volume_ratio is not None:
        return_component = min(abs(z_score) / 4, 1) * 50
        volume_component = (
            min(max(volume_ratio - 1, 0) / 3, 1) * 50
        )
        anomaly_score = round(return_component + volume_component)

    flags = []

    if z_score is not None and abs(z_score) >= 2:
        flags.append("Unusual daily price movement")

    if volume_ratio is not None and volume_ratio >= 1.5:
        flags.append("Elevated trading volume")

    if (
        z_score is not None
        and abs(z_score) >= 2
        and volume_ratio is not None
        and volume_ratio >= 1.5
    ):
        classification = "High"
    elif flags:
        classification = "Watch"
    else:
        classification = "Normal"

    all_closes = [float(value) for value in history["Close"]]

    sma_5 = (
        statistics.mean(all_closes[-5:])
        if len(all_closes) >= 5 else None
    )
    sma_20 = (
        statistics.mean(all_closes[-20:])
        if len(all_closes) >= 20 else None
    )

    return {
        "provider": "Yahoo Finance",
        "data_status": "historical_provider_data",
        "real_time": False,
        "ticker": ticker,
        "lookback_days": lookback_days,
        "records_used": len(window) - 1,
        "latest_close": round(closes[-1], 2),
        "daily_change_percent": round(latest_return, 2),
        "sma_5": round(sma_5, 2) if sma_5 is not None else None,
        "sma_20": round(sma_20, 2) if sma_20 is not None else None,
        "return_z_score": round(z_score, 2) if z_score is not None else None,
        "latest_volume": int(latest_volume),
        "average_previous_volume": (
            round(avg_volume, 2) if avg_volume is not None else None
        ),
        "volume_ratio": (
            round(volume_ratio, 2) if volume_ratio is not None else None
        ),
        "anomaly_score": anomaly_score,
        "classification": classification,
        "surveillance_flags": flags,
        "method": (
            "Rule-based screening using historical return variation "
            "and relative volume. Not a trained ML model."
        ),
        "warning": (
            "Anomaly scores are screening signals, not probabilities "
            "of insider trading or evidence of wrongdoing."
        )
    }


# ---------------------------------------------------------------------------
# Official NSE/BSE equity directory (cached locally, refreshed on demand)
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
DIRECTORY_DIR = BASE_DIR / "data"
DIRECTORY_CACHE_PATH = DIRECTORY_DIR / "security_directory.json"
DIRECTORY_REFRESH_INTERVAL = timedelta(hours=12)

DIRECTORY_SOURCES = {
    "NSE": "https://www.nseindia.com/static/market-data/securities-available-for-trading",
    "NSE_EQUITY_CSV": "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv",
    "NSE_SME_CSV": "https://nsearchives.nseindia.com/emerge/corporates/content/SME_EQUITY_L.csv",
    "BSE": "https://api.bseindia.com/BseIndiaAPI/api/ListofScripData/w",
}

_directory_items = []
_directory_updated_at = None
_directory_refreshed_at = None
_directory_source_status = {
    "NSE": {"status": "not_loaded", "records": 0},
    "BSE": {"status": "not_loaded", "records": 0},
}
_directory_last_error = None


def _norm_key(value):
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower())


def _safe_number(value):
    text = str(value or "").strip().replace(",", "")
    if not text or text.lower() in {"nan", "none", "null", "-", "na", "n/a"}:
        return None
    try:
        return float(text)
    except (TypeError, ValueError):
        return None


def _first_field(row, aliases):
    indexed = {_norm_key(k): v for k, v in row.items()}
    for alias in aliases:
        value = indexed.get(_norm_key(alias))
        if value is not None and str(value).strip() not in {"", "-", "nan", "None"}:
            return str(value).strip()
    return ""


def _parse_nse_csv(content, source_label):
    text = content.decode("utf-8-sig", errors="replace") if isinstance(content, bytes) else str(content)
    reader = csv.DictReader(io.StringIO(text))
    records = []
    seen = set()
    for row in reader:
        symbol = _first_field(row, ["SYMBOL", "TRADING SYMBOL", "Symbol"]).upper()
        name = _first_field(row, ["NAME OF COMPANY", "COMPANY NAME", "NAME", "Company Name"])
        if not symbol or not name:
            continue
        isin = _first_field(row, ["ISIN NUMBER", "ISIN", "ISIN CODE"]).upper()
        series = _first_field(row, ["SERIES", "SERIES CODE"]).upper()
        listing_date = _first_field(row, ["DATE OF LISTING", "LISTING DATE"])
        face_value = _safe_number(_first_field(row, ["FACE VALUE", "FACEVALUE"]))
        paid_up_value = _safe_number(_first_field(row, ["PAID UP VALUE", "PAIDUP VALUE"]))
        market_lot = _safe_number(_first_field(row, ["MARKET LOT", "MARKETLOT"]))
        key = (symbol, isin)
        if key in seen:
            continue
        seen.add(key)
        records.append({
            "id": f"NSE:{symbol}:{isin or series}",
            "company_name": name,
            "symbol": symbol,
            "exchange": "NSE",
            "provider_symbol": symbol,
            "ticker": f"{symbol}.NS",
            "isin": isin or None,
            "security_code": symbol,
            "series": series or None,
            "group": None,
            "industry": None,
            "listing_date": listing_date or None,
            "face_value": face_value,
            "paid_up_value": paid_up_value,
            "market_lot": int(market_lot) if market_lot is not None else None,
            "status": "Active / available in NSE security file",
            "security_type": "SME equity" if "SME" in source_label.upper() else "Equity",
            "source": source_label,
        })
    return records


def _walk_dict_rows(payload):
    """Yield dict rows from BSE responses whether list- or Table-wrapped."""
    if isinstance(payload, list):
        for item in payload:
            if isinstance(item, dict):
                yield item
            else:
                yield from _walk_dict_rows(item)
    elif isinstance(payload, dict):
        # A security row usually has both a code and a descriptive name.
        has_code = any(_norm_key(k) in {"scripcd", "scripcode", "securitycode", "scrip_code"} for k in payload)
        has_name = any(_norm_key(k) in {"scripname", "scrip_name", "companyname", "securityname", "security_name"} for k in payload)
        if has_code and has_name:
            yield payload
        else:
            for value in payload.values():
                if isinstance(value, (list, dict)):
                    yield from _walk_dict_rows(value)


def _parse_bse_payload(payload):
    records = []
    seen = set()
    for row in _walk_dict_rows(payload):
        code = _first_field(row, ["SCRIP_CD", "Scrip_Code", "ScripCode", "Scrip Code", "Security Code", "ScripCd"])
        name = _first_field(row, ["Scrip_Name", "ScripName", "Company Name", "CompanyName", "Security Name", "SecurityName"])
        if not code or not name:
            continue
        code = code.strip()
        if code.isdigit() and len(code) < 6:
            code = code.zfill(6)
        symbol = _first_field(row, ["SCRIP_ID", "Scrip_Id", "ScripID", "Instrument Code", "Trading Symbol", "Symbol", "Scrip Symbol"]).upper()
        if not symbol:
            symbol = code
        isin = _first_field(row, ["ISIN_NUMBER", "ISIN CODE", "ISIN_CODE", "ISIN", "ISINNumber", "ISIN_CD", "ISIN Code"]).upper()
        group = _first_field(row, ["SCRIP_GROUP", "Scrip_Group", "Group Name", "Group", "GROUP"])
        industry = _first_field(row, ["INDUSTRY", "Industry Name", "Industry", "Sector"])
        status = _first_field(row, ["Status", "Scrip Status", "Trading Status"]) or "Active (BSE active-list response)"
        face_value = _safe_number(_first_field(row, ["Face Value", "FaceValue", "FACE_VALUE"]))
        listing_date = _first_field(row, ["DATE OF LISTING", "LISTING DATE", "ListDate", "ListingDate", "Scrip_ListDate"])
        paid_up_value = _safe_number(_first_field(row, ["Paid Up Value", "PaidUpValue", "PaidupValue"]))
        market_lot = _safe_number(_first_field(row, ["Market Lot", "MarketLot", "Lot Size"]))
        key = (code, isin)
        if key in seen:
            continue
        seen.add(key)
        records.append({
            "id": f"BSE:{code}:{isin or symbol}",
            "company_name": name,
            "symbol": symbol,
            "exchange": "BSE",
            # Yahoo Finance's usual BSE ticker convention is the numeric BSE scrip code.
            "provider_symbol": code,
            "ticker": f"{code}.BO",
            "isin": isin or None,
            "security_code": code,
            "series": None,
            "group": group or None,
            "industry": industry or None,
            "listing_date": listing_date or None,
            "face_value": face_value,
            "paid_up_value": paid_up_value,
            "market_lot": int(market_lot) if market_lot is not None else None,
            "status": status,
            "security_type": "Equity",
            "source": "BSE public active equity security list",
        })
    return records


def _directory_http_get(url, *, params=None, headers=None):
    standard_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36",
        "Accept": "text/csv,application/json,text/plain,*/*",
        "Referer": "https://www.nseindia.com/",
    }
    if headers:
        standard_headers.update(headers)
    with httpx.Client(timeout=15.0, follow_redirects=True, headers=standard_headers) as client:
        response = client.get(url, params=params)
        response.raise_for_status()
        return response


def _load_directory_cache():
    global _directory_items, _directory_updated_at, _directory_source_status
    if not DIRECTORY_CACHE_PATH.exists():
        return
    try:
        payload = json.loads(DIRECTORY_CACHE_PATH.read_text(encoding="utf-8"))
        if isinstance(payload.get("items"), list):
            _directory_items = payload["items"]
            _directory_updated_at = payload.get("updated_at")
            _directory_source_status = payload.get("source_status", _directory_source_status)
    except (OSError, ValueError, TypeError):
        pass


def _save_directory_cache():
    DIRECTORY_DIR.mkdir(parents=True, exist_ok=True)
    temp_path = DIRECTORY_CACHE_PATH.with_suffix(".tmp")
    payload = {
        "updated_at": _directory_updated_at,
        "source_status": _directory_source_status,
        "items": _directory_items,
    }
    temp_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    temp_path.replace(DIRECTORY_CACHE_PATH)


def _fetch_nse_directory():
    equity_url = DIRECTORY_SOURCES["NSE_EQUITY_CSV"]
    sme_url = DIRECTORY_SOURCES["NSE_SME_CSV"]
    headers = {"Referer": "https://www.nseindia.com/static/market-data/securities-available-for-trading"}
    # NSE provides separate current CSVs for regular equity and SME equity.
    response = _directory_http_get(equity_url, headers=headers)
    if b"SYMBOL" not in response.content[:3000].upper() and b"COMPANY" not in response.content[:3000].upper():
        raise ValueError("NSE equity CSV did not contain expected column headings")
    results = _parse_nse_csv(response.content, "NSE official equity CSV")
    sme_note = None
    try:
        sme_response = _directory_http_get(sme_url, headers=headers)
        results.extend(_parse_nse_csv(sme_response.content, "NSE official SME equity CSV"))
    except Exception as exc:
        sme_note = f"NSE mainboard loaded; SME list could not be refreshed: {type(exc).__name__}"
    # De-duplicate symbol/ISIN overlaps between mainboard and SME files.
    unique = {}
    for item in results:
        unique[(item["exchange"], item["symbol"], item.get("isin") or "")] = item
    if len(unique) < 100:
        raise ValueError(f"NSE response contained only {len(unique)} parsed securities")
    return list(unique.values()), sme_note


def _fetch_bse_directory():
    """Load BSE active equities with one persistent, warmed-up HTTP session.

    BSE can reject direct one-shot API requests with 403. Reuse one session for
    the site landing page and its listing API, and preserve the reason if the
    exchange still refuses the request. A saved directory cache remains usable.
    """
    params = {
        "Group": "",
        "scripcode": "",
        "industry": "",
        "segment": "Equity",
        "status": "Active",
        "scripName": "",
    }
    headers = {
        "Referer": "https://www.bseindia.com/",
        "Origin": "https://www.bseindia.com",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.8",
    }
    standard_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
        **headers,
    }
    with httpx.Client(timeout=25.0, follow_redirects=True, headers=standard_headers) as client:
        try:
            homepage = client.get("https://www.bseindia.com/", timeout=15.0)
            homepage.raise_for_status()
        except httpx.HTTPError:
            # Some environments block the homepage but permit the data API.
            pass
        response = client.get(DIRECTORY_SOURCES["BSE"], params=params)
        response.raise_for_status()
        try:
            payload = response.json()
        except ValueError as exc:
            raise ValueError(
                f"BSE active-security API returned non-JSON content (HTTP {response.status_code})"
            ) from exc
    records = _parse_bse_payload(payload)
    if len(records) < 100:
        raise ValueError(
            f"BSE response contained only {len(records)} parsed securities; response format may have changed"
        )
    return records


def refresh_security_directory(force=False):
    """Refresh exchange master lists. Failure on one source preserves its cached rows."""
    global _directory_items, _directory_updated_at, _directory_refreshed_at
    global _directory_source_status, _directory_last_error

    now = datetime.now(timezone.utc)
    if not force and _directory_refreshed_at:
        if now - _directory_refreshed_at < timedelta(minutes=15):
            return
    if not force and _directory_items and _directory_updated_at:
        try:
            updated = datetime.fromisoformat(_directory_updated_at.replace("Z", "+00:00"))
            if now - updated < DIRECTORY_REFRESH_INTERVAL:
                return
        except (ValueError, TypeError):
            pass

    old_items = list(_directory_items)
    new_items = {"NSE": None, "BSE": None}
    new_status = dict(_directory_source_status)
    errors = []

    def refresh_nse():
        records, note = _fetch_nse_directory()
        return records, note

    def refresh_bse():
        return _fetch_bse_directory()

    # Request NSE and BSE concurrently so the first directory load is quicker.
    with ThreadPoolExecutor(max_workers=2) as pool:
        future_nse = pool.submit(refresh_nse)
        future_bse = pool.submit(refresh_bse)
        try:
            nse_records, nse_note = future_nse.result()
            new_items["NSE"] = nse_records
            new_status["NSE"] = {
                "status": "loaded" if not nse_note else "loaded_with_warning",
                "records": len(nse_records),
                "refreshed_at": now.isoformat().replace("+00:00", "Z"),
                "source": "NSE official equity and SME CSV files",
                "note": nse_note,
            }
        except Exception as exc:
            new_status["NSE"] = {
                **new_status.get("NSE", {}),
                "status": "refresh_failed_using_cache" if any(x.get("exchange") == "NSE" for x in old_items) else "unavailable",
                "error": f"{type(exc).__name__}: {str(exc)[:180]}",
            }
            errors.append("NSE directory refresh failed")
        try:
            bse_records = future_bse.result()
            new_items["BSE"] = bse_records
            new_status["BSE"] = {
                "status": "loaded",
                "records": len(bse_records),
                "refreshed_at": now.isoformat().replace("+00:00", "Z"),
                "source": "BSE public active equity security list",
                "note": None,
            }
        except Exception as exc:
            new_status["BSE"] = {
                **new_status.get("BSE", {}),
                "status": "refresh_failed_using_cache" if any(x.get("exchange") == "BSE" for x in old_items) else "unavailable",
                "error": f"{type(exc).__name__}: {str(exc)[:180]}",
            }
            errors.append("BSE directory refresh failed")

    merged = []
    for exchange in ("NSE", "BSE"):
        source_items = new_items[exchange]
        if source_items is None:
            source_items = [x for x in old_items if x.get("exchange") == exchange]
        merged.extend(source_items)

    # Retain only normalized, useful company/security records and stable order.
    by_id = {}
    for item in merged:
        if item.get("id") and item.get("company_name") and item.get("symbol"):
            by_id[item["id"]] = item
    _directory_items = sorted(by_id.values(), key=lambda x: (x.get("exchange", ""), x.get("symbol", ""), x.get("company_name", "")))
    _directory_source_status = new_status
    _directory_refreshed_at = now
    if _directory_items and any(new_items[exchange] is not None for exchange in new_items):
        _directory_updated_at = now.isoformat().replace("+00:00", "Z")
        _save_directory_cache()
    elif _directory_items and not _directory_updated_at:
        _directory_updated_at = now.isoformat().replace("+00:00", "Z")
    _directory_last_error = "; ".join(errors) if errors else None


@app.get("/api/instruments/directory")
def search_security_directory(
    query: str = "",
    exchange: str = "ALL",
    limit: int = 50,
    offset: int = 0,
    refresh: bool = False,
):
    """Search cached current NSE/BSE equity listings by name, symbol, ISIN, or code."""
    q = query.strip().casefold()
    market = exchange.strip().upper()
    if market not in {"ALL", "NSE", "BSE"}:
        raise HTTPException(status_code=400, detail="exchange must be ALL, NSE, or BSE")
    if not 1 <= limit <= 100:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 100")
    if offset < 0:
        raise HTTPException(status_code=400, detail="offset must be zero or higher")

    if not _directory_items:
        _load_directory_cache()

    # Refresh on first search or when requested from the UI. The refresh
    # function records per-exchange errors and preserves cached rows on failure.
    refresh_security_directory(force=refresh)

    if not _directory_items:
        raise HTTPException(
            status_code=503,
            detail={
                "message": "The exchange directory could not be loaded yet.",
                "hint": "Open /api/instruments/directory/status to inspect the NSE/BSE source status.",
                "sources": _directory_source_status,
                "refresh_error": _directory_last_error,
            },
        )

    items = [x for x in _directory_items if market == "ALL" or x.get("exchange") == market]
    counts = {
        "ALL": len(_directory_items),
        "NSE": sum(1 for x in _directory_items if x.get("exchange") == "NSE"),
        "BSE": sum(1 for x in _directory_items if x.get("exchange") == "BSE"),
    }
    if q:
        def rank(item):
            symbol = str(item.get("symbol", "")).casefold()
            code = str(item.get("security_code", "")).casefold()
            name = str(item.get("company_name", "")).casefold()
            isin = str(item.get("isin") or "").casefold()
            if symbol == q or code == q or isin == q:
                return 0
            if symbol.startswith(q) or code.startswith(q):
                return 1
            if name.startswith(q):
                return 2
            if q in symbol or q in code:
                return 3
            return 4
        items = [x for x in items if q in " ".join(str(x.get(k) or "") for k in (
            "company_name", "symbol", "security_code", "isin", "industry", "series", "group"
        )).casefold()]
        items.sort(key=lambda x: (rank(x), x.get("company_name", "").casefold(), x.get("exchange", "")))

    total = len(items)
    results = items[offset:offset + limit]
    sources_loaded = all(_directory_source_status.get(ex, {}).get("status") == "loaded" for ex in ("NSE", "BSE"))
    return {
        "provider": "Official exchange security directory",
        "data_status": "directory_cached" if _directory_items else "directory_unavailable",
        "query": query,
        "exchange": market,
        "offset": offset,
        "limit": limit,
        "count": len(results),
        "total_filtered": total,
        "directory_total": counts["ALL"],
        "exchange_totals": {"NSE": counts["NSE"], "BSE": counts["BSE"]},
        "updated_at": _directory_updated_at,
        "sources": _directory_source_status,
        "is_complete": bool(sources_loaded and counts["NSE"] > 100 and counts["BSE"] > 100),
        "refresh_error": _directory_last_error,
        "notice": "Directory metadata is exchange listing information, not live prices or a guarantee that every security has Yahoo Finance price coverage.",
        "results": results,
    }


@app.get("/api/instruments/directory/status")
def security_directory_status():
    if not _directory_items:
        _load_directory_cache()
    return {
        "data_status": "directory_cached" if _directory_items else "directory_not_loaded",
        "directory_total": len(_directory_items),
        "exchange_totals": {
            "NSE": sum(1 for x in _directory_items if x.get("exchange") == "NSE"),
            "BSE": sum(1 for x in _directory_items if x.get("exchange") == "BSE"),
        },
        "updated_at": _directory_updated_at,
        "sources": _directory_source_status,
        "is_complete": all(_directory_source_status.get(ex, {}).get("status") == "loaded" for ex in ("NSE", "BSE")),
        "refresh_error": _directory_last_error,
    }



@app.get("/api/instruments/directory/universe")
def get_directory_universe(exchange: str = "ALL", refresh: bool = False, query: str = ""):
    """Return the complete cached NSE/BSE security universe for local filtering."""
    market = str(exchange or "ALL").strip().upper()
    if market not in {"ALL", "NSE", "BSE"}:
        raise HTTPException(status_code=400, detail="exchange must be ALL, NSE, or BSE")
    if not _directory_items:
        _load_directory_cache()
    try:
        refresh_security_directory(force=refresh)
    except Exception:
        # The status fields below explain source failures; preserve cached rows.
        pass
    if not _directory_items:
        raise HTTPException(status_code=503, detail={
            "message": "The exchange directory has not loaded yet.",
            "sources": _directory_source_status,
            "refresh_error": _directory_last_error,
        })
    q = str(query or "").strip().casefold()
    items = [item for item in _directory_items if market == "ALL" or item.get("exchange") == market]
    if q:
        items = [item for item in items if q in " ".join(str(item.get(k) or "") for k in (
            "company_name", "symbol", "security_code", "isin", "industry", "series", "group"
        )).casefold()]
        items.sort(key=lambda item: (
            0 if q in {str(item.get("symbol") or "").casefold(), str(item.get("security_code") or "").casefold(), str(item.get("isin") or "").casefold()} else 1,
            str(item.get("company_name") or "").casefold(),
            str(item.get("exchange") or ""),
        ))
    totals = {ex: sum(1 for item in _directory_items if item.get("exchange") == ex) for ex in ("NSE", "BSE")}
    complete = all(_directory_source_status.get(ex, {}).get("status") == "loaded" for ex in ("NSE", "BSE"))
    return {
        "provider": "Official exchange security directory",
        "data_status": "directory_cached",
        "exchange": market,
        "query": query,
        "directory_total": len(_directory_items),
        "exchange_totals": totals,
        "count": len(items),
        "updated_at": _directory_updated_at,
        "sources": _directory_source_status,
        "is_complete": complete,
        "refresh_error": _directory_last_error,
        "results": items,
    }


# Load a previous local cache into memory immediately; first directory request refreshes if stale.
_load_directory_cache()


@app.get("/api/market/yahoo-search")
def search_yahoo_stocks(
    query: str,
    exchange: str = "ALL",
    limit: int = 30
):
    query = query.strip()
    exchange = exchange.strip().upper()

    if not query or len(query) > 50:
        raise HTTPException(
            status_code=400,
            detail="Enter a search query of 1–50 characters."
        )

    if exchange not in {"ALL", "NSE", "BSE"}:
        raise HTTPException(
            status_code=400,
            detail="Exchange must be ALL, NSE, or BSE."
        )

    if not 1 <= limit <= 50:
        raise HTTPException(
            status_code=400,
            detail="Limit must be between 1 and 50."
        )

    try:
        search = yf.Search(
            query,
            max_results=limit,
            news_count=0,
            lists_count=0,
            include_cb=False,
            include_nav_links=False,
            timeout=15
        )

        quotes = search.quotes or []

    except Exception:
        raise HTTPException(
            status_code=502,
            detail="Stock search is temporarily unavailable. Try again."
        )

    stocks = []
    seen = set()

    for item in quotes:
        ticker = str(item.get("symbol", "")).strip().upper()

        # Only include NSE and BSE Yahoo-listed equities.
        if ticker.endswith(".NS"):
            market = "NSE"
            symbol = ticker[:-3]
        elif ticker.endswith(".BO"):
            market = "BSE"
            symbol = ticker[:-3]
        else:
            continue

        if exchange != "ALL" and market != exchange:
            continue

        if item.get("quoteType") not in (None, "EQUITY"):
            continue

        if ticker in seen:
            continue

        seen.add(ticker)

        stocks.append({
            "name": (
                item.get("longname")
                or item.get("shortname")
                or symbol
            ),
            "symbol": symbol,
            "exchange": market,
            "ticker": ticker,
            "provider": "Yahoo Finance"
        })

    return {
        "provider": "Yahoo Finance",
        "data_status": "search_results",
        "query": query,
        "exchange": exchange,
        "count": len(stocks),
        "results": stocks,
        "notice": (
            "Search results are not a complete official exchange "
            "listing directory. Price data availability varies."
        )
    }


@app.get("/api/diagnostics/routes")
def diagnostics_routes():
    """Return registered API routes and directory status for local debugging."""
    paths = sorted({getattr(route, "path", "") for route in app.routes if getattr(route, "path", "")})
    return {
        "project": "ScripVigil",
        "loaded_file": str(Path(__file__).resolve()),
        "directory_routes_registered": (
            "/api/instruments/directory" in paths
            and "/api/instruments/directory/status" in paths
        ),
        "directory_total": len(_directory_items),
        "directory_updated_at": _directory_updated_at,
        "directory_sources": _directory_source_status,
        "directory_refresh_error": _directory_last_error,
        "routes": paths,
    }


@app.get("/api/market/yahoo-chart")
def get_yahoo_chart(
    symbol: str,
    exchange: str = "NSE",
    range: str = "1M",
):
    """Return chart candles for the selected range, polling Yahoo data when available.

    Intraday intervals are unofficial/provider-dependent and may be delayed. This
    endpoint does not promise an exchange-certified real-time feed.
    """
    market = str(exchange or "NSE").strip().upper()
    if market not in {"NSE", "BSE"}:
        raise HTTPException(status_code=400, detail="Exchange must be NSE or BSE.")

    chart_range = str(range or "1M").strip().upper()
    periods = {
        "1D": ("1d", "1m"),
        "1W": ("5d", "5m"),
        "1M": ("1mo", "1d"),
        "6M": ("6mo", "1d"),
        "1Y": ("1y", "1d"),
    }
    if chart_range not in periods:
        raise HTTPException(status_code=400, detail="range must be 1D, 1W, 1M, 6M, or 1Y.")

    cleaned = str(symbol or "").strip().upper()
    if cleaned.endswith(".NS"):
        cleaned, market = cleaned[:-3], "NSE"
    elif cleaned.endswith(".BO"):
        cleaned, market = cleaned[:-3], "BSE"
    if not cleaned or len(cleaned) > 60 or not all(ch.isalnum() or ch in "&._- " for ch in cleaned):
        raise HTTPException(status_code=400, detail="Enter a valid company symbol or security code.")

    if not _directory_items:
        _load_directory_cache()

    candidates = []
    def add_candidate(value):
        value = str(value or "").strip().upper()
        if not value:
            return
        if value.endswith((".NS", ".BO")):
            ticker = value
        else:
            ticker = value + (".NS" if market == "NSE" else ".BO")
        if ticker not in candidates:
            candidates.append(ticker)

    # Directory-driven tickers first; actual support varies by Yahoo listing.
    for item in _directory_items:
        if item.get("exchange") != market:
            continue
        identifiers = {
            str(item.get(k) or "").strip().upper()
            for k in ("symbol", "provider_symbol", "security_code", "ticker")
        }
        identifiers |= {v.removesuffix(".NS").removesuffix(".BO") for v in list(identifiers)}
        if cleaned in identifiers:
            add_candidate(item.get("symbol"))
            add_candidate(item.get("ticker"))
            add_candidate(item.get("provider_symbol"))
            # Preserve the current provider mapping as a fallback.
            try:
                add_candidate(_resolve_yahoo_ticker(cleaned, market))
            except Exception:
                pass
            add_candidate(item.get("security_code"))

    try:
        add_candidate(_resolve_yahoo_ticker(cleaned, market))
    except Exception:
        add_candidate(cleaned)

    if not candidates:
        add_candidate(cleaned)

    period, interval = periods[chart_range]
    attempts = []
    selected_ticker = None
    history = None

    for ticker in candidates:
        try:
            frame = yf.Ticker(ticker).history(
                period=period,
                interval=interval,
                auto_adjust=False,
                actions=False,
                prepost=False,
            )
            if frame is not None and not frame.empty and "Close" in frame.columns:
                frame = frame.dropna(subset=["Close"]).sort_index()
            count = len(frame) if frame is not None else 0
            attempts.append({"ticker": ticker, "records": count})
            best_count = len(history) if history is not None else -1
            if count > best_count:
                selected_ticker, history = ticker, frame
            if count >= 2:
                break
        except Exception as exc:
            attempts.append({"ticker": ticker, "records": 0, "error": f"{type(exc).__name__}: {str(exc)[:100]}"})

    if history is None or history.empty or len(history) < 2:
        raise HTTPException(
            status_code=502,
            detail={
                "message": "The provider did not return enough chart records for this listing.",
                "exchange": market,
                "range": chart_range,
                "ticker_attempts": attempts,
                "note": "Provider intraday/history coverage varies by listing; demo fallback remains available.",
            },
        )

    candles = []
    for timestamp, row in history.iterrows():
        close = row.get("Close")
        if close is None:
            continue
        try:
            close_float = float(close)
        except (TypeError, ValueError):
            continue
        if not (close_float == close_float):
            continue
        try:
            open_value = float(row.get("Open"))
            high_value = float(row.get("High"))
            low_value = float(row.get("Low"))
        except (TypeError, ValueError):
            open_value = high_value = low_value = close_float
        stamp = timestamp.isoformat() if hasattr(timestamp, "isoformat") else str(timestamp)
        candles.append({
            "timestamp": stamp,
            "date": stamp[:10],
            "open": round(open_value, 4),
            "high": round(high_value, 4),
            "low": round(low_value, 4),
            "close": round(close_float, 4),
        })

    return {
        "provider": "Yahoo Finance",
        "data_status": "provider_chart_data",
        "real_time": False,
        "exchange": market,
        "symbol": cleaned,
        "ticker": selected_ticker,
        "range": chart_range,
        "interval": interval,
        "records_returned": len(candles),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "refresh_interval_seconds": 60,
        "delay_notice": "Yahoo Finance data may be delayed or unavailable; this is not a guaranteed live exchange feed.",
        "ticker_attempts": attempts,
        "candles": candles,
    }
