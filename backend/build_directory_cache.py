"""Build ScripVigil's local security_directory.json.

Attempts the app's official NSE and BSE fetchers first. If BSE rejects the
live request, uses a public, community-maintained BSE equity-list snapshot as
an explicitly marked fallback so the directory is not empty on deployment.

Run from the project root:
    python backend\\build_directory_cache.py
"""
from __future__ import annotations

import csv
import io
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import httpx

# When run as `python backend\build_directory_cache.py`, backend is sys.path[0].
import main  # noqa: E402

BSE_FALLBACK_CSV = (
    "https://raw.githubusercontent.com/RuchiTanmay/bseindia/"
    "refs/heads/main/bseindia/bse_security_list.csv"
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def fetch_bse_snapshot_fallback() -> list[dict]:
    """Fetch a public CSV snapshot; this is not an official/live BSE feed."""
    headers = {
        "User-Agent": "ScripVigil-directory-cache-builder/1.0",
        "Accept": "text/csv,text/plain,*/*",
    }
    with httpx.Client(timeout=30.0, follow_redirects=True, headers=headers) as client:
        response = client.get(BSE_FALLBACK_CSV)
        response.raise_for_status()

    # Protect against a proxy/error page being mistaken for valid CSV.
    content = response.text.lstrip("\ufeff\r\n ")
    reader = csv.DictReader(io.StringIO(content))
    required = {"security_code", "isin", "symbol", "security_group", "security_name"}
    fields = {str(value or "").strip().lower() for value in (reader.fieldnames or [])}
    if not required.issubset(fields):
        raise RuntimeError(
            "The BSE fallback CSV has an unexpected format. "
            f"Found columns: {reader.fieldnames!r}"
        )

    records: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for row in reader:
        # Normalize keys since CSV readers preserve source capitalization.
        row = {str(k or "").strip().lower(): str(v or "").strip() for k, v in row.items()}
        code = row.get("security_code", "").strip()
        name = row.get("security_name", "").strip()
        symbol = row.get("symbol", "").strip().upper()
        isin = row.get("isin", "").strip().upper()
        group = row.get("security_group", "").strip().upper()
        if not code or not name:
            continue
        if code.isdigit() and len(code) < 6:
            code = code.zfill(6)
        # ISIN can be absent in some records; code still uniquely identifies a scrip.
        key = (code, isin)
        if key in seen:
            continue
        seen.add(key)
        records.append({
            "id": f"BSE:{code}:{isin or symbol or code}",
            "company_name": name,
            "symbol": symbol or code,
            "exchange": "BSE",
            "provider_symbol": code,
            "ticker": f"{code}.BO",
            "isin": isin or None,
            "security_code": code,
            "series": None,
            "group": group or None,
            "industry": None,
            "listing_date": None,
            "face_value": None,
            "paid_up_value": None,
            "market_lot": None,
            "status": "BSE equity listing (community snapshot; verify current status)",
            "security_type": "Equity",
            "source": "Community-maintained BSE security list snapshot (fallback)",
        })

    if len(records) < 1000:
        raise RuntimeError(
            f"BSE fallback CSV yielded only {len(records)} records; refusing to save incomplete cache."
        )
    return records


def main_build() -> None:
    timestamp = utc_now()

    print("Downloading official NSE equity directory...")
    nse_records, nse_note = main._fetch_nse_directory()
    print(f"NSE records: {len(nse_records)}")
    if len(nse_records) < 1000:
        raise RuntimeError("NSE download returned too few records; no cache was written.")

    bse_note = None
    try:
        print("Trying the live BSE directory API...")
        bse_records = main._fetch_bse_directory()
        bse_source = "BSE public active equity security list"
        bse_status = "loaded"
        print(f"Live BSE records: {len(bse_records)}")
    except Exception as exc:
        print(f"Live BSE API failed ({type(exc).__name__}: {str(exc)[:180]})")
        print("Downloading fallback BSE equity-list snapshot from a public mirror...")
        bse_records = fetch_bse_snapshot_fallback()
        bse_source = "Community-maintained BSE security list snapshot (GitHub mirror)"
        bse_status = "loaded_with_warning"
        bse_note = (
            "Live BSE API was unavailable. Using a community-maintained snapshot; "
            "it may be stale or incomplete. Refresh from an official source when available."
        )
        print(f"Fallback BSE records: {len(bse_records)}")

    timestamp = utc_now()
    payload = {
        "updated_at": timestamp,
        "source_status": {
            "NSE": {
                "status": "loaded" if not nse_note else "loaded_with_warning",
                "records": len(nse_records),
                "refreshed_at": timestamp,
                "source": "NSE official equity and SME CSV files",
                "note": nse_note,
            },
            "BSE": {
                "status": bse_status,
                "records": len(bse_records),
                "refreshed_at": timestamp,
                "source": bse_source,
                "note": bse_note,
            },
        },
        "items": nse_records + bse_records,
    }

    output_path: Path = main.DIRECTORY_CACHE_PATH
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = output_path.with_suffix(".tmp")
    temp_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    temp_path.replace(output_path)

    print("\nDirectory cache saved successfully.")
    print(f"File: {output_path}")
    print(f"Total records: {len(payload['items'])}")
    print(f"NSE: {len(nse_records)}")
    print(f"BSE: {len(bse_records)} ({bse_status})")
    print(f"Updated: {timestamp}")
    if bse_note:
        print("WARNING: BSE fallback is a snapshot and may not include every currently listed security.")


if __name__ == "__main__":
    try:
        main_build()
    except Exception as exc:
        print(f"ERROR: {type(exc).__name__}: {exc}", file=sys.stderr)
        sys.exit(1)
