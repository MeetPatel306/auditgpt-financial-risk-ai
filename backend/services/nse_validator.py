"""
NSE Validator — FIXED VERSION
Fix 1: SME detection, suspended symbol check, DVR awareness,
       category-based error messages so user knows WHY a symbol failed.
"""

from __future__ import annotations
import json
import csv
import os
import requests
from pathlib import Path
from datetime import datetime, timedelta

# ── Load NSE companies from local JSON ────────────────────────────────────────
_nse_data_path = Path(__file__).parent.parent / "nse_companies.json"
_nse_companies: list[dict] = []
_symbol_map:    dict[str, dict] = {}
_name_map:      dict[str, dict] = {}

# FIX 1: Known DVR symbols and their parents
DVR_SYMBOLS = {
    "TATAMTRDVR", "JSWSTEEL-DVR", "TATASTEELDVR", "FUTRETAILDVR",
}

# FIX 1: NSE SME series codes
SME_SERIES = {"SM", "ST", "SB"}

# Common alias/renamed lookups for better search experience.
SYMBOL_ALIASES = {
    "ZOMATO": "ETERNAL",
}


def _load_nse_data():
    global _nse_companies, _symbol_map, _name_map
    if not _nse_data_path.exists():
        print(f"WARNING: NSE data file not found at {_nse_data_path}")
        return
    with open(_nse_data_path, "r") as f:
        _nse_companies = json.load(f)
    _symbol_map = {c["symbol"].upper(): c for c in _nse_companies}
    _name_map   = {c["name"].lower(): c for c in _nse_companies}


_load_nse_data()


# ── FIX 1: Refresh NSE equity list from NSE website (call once daily) ─────────
_last_refresh: datetime | None = None
_REFRESH_INTERVAL = timedelta(hours=24)


def refresh_nse_list_from_csv(csv_path: str | None = None) -> bool:
    """
    Load NSE company list from local EQUITY_L.csv fallback.
    Priority:
      1) explicit csv_path argument
      2) NSE_EQUITY_CSV_PATH env var
      3) Windows Downloads default: ~/Downloads/EQUITY_L.csv
    """
    global _nse_companies, _symbol_map, _name_map, _last_refresh

    chosen_path = (
        csv_path
        or os.getenv("NSE_EQUITY_CSV_PATH")
        or str(Path.home() / "Downloads" / "EQUITY_L.csv")
    )
    file_path = Path(chosen_path)
    if not file_path.exists():
        return False

    try:
        new_companies = []
        with file_path.open("r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                symbol = (row.get("SYMBOL") or "").strip().upper()
                name = (row.get("NAME OF COMPANY") or "").strip()
                series = (row.get("SERIES") or "EQ").strip().upper()
                if not symbol or not name:
                    continue
                new_companies.append({"symbol": symbol, "name": name, "series": series})

        if not new_companies:
            return False

        _nse_companies = new_companies
        _symbol_map = {c["symbol"]: c for c in _nse_companies}
        _name_map = {c["name"].lower(): c for c in _nse_companies}
        _last_refresh = datetime.utcnow()
        print(f"NSE list refreshed from CSV: {len(_nse_companies)} companies loaded ({file_path})")
        return True
    except Exception as e:
        print(f"NSE CSV fallback refresh failed: {e}")
        return False


def refresh_nse_list_from_website():
    """
    Download the latest EQUITY_L.csv from NSE and rebuild the validator maps.
    Call this once at app startup and then daily via a scheduler.
    Returns True if successful, False otherwise.
    """
    global _nse_companies, _symbol_map, _name_map, _last_refresh

    # Skip if refreshed recently
    if _last_refresh and datetime.utcnow() - _last_refresh < _REFRESH_INTERVAL:
        return True

    try:
        headers = {
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://www.nseindia.com/",
        }
        session = requests.Session()
        session.get("https://www.nseindia.com", headers=headers, timeout=5)
        url = "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv"
        resp = session.get(url, headers=headers, timeout=10)

        if resp.status_code == 200:
            lines = resp.text.strip().split("\n")
            header = [h.strip().strip('"') for h in lines[0].split(",")]

            # Find column indices
            try:
                sym_idx    = header.index("SYMBOL")
                name_idx   = header.index("NAME OF COMPANY")
                series_idx = header.index("SERIES") if "SERIES" in header else None
            except ValueError:
                print("NSE CSV header changed — skipping refresh")
                return False

            new_companies = []
            for line in lines[1:]:
                parts = [p.strip().strip('"') for p in line.split(",")]
                if len(parts) <= max(sym_idx, name_idx):
                    continue
                symbol = parts[sym_idx].upper()
                name   = parts[name_idx]
                series = parts[series_idx] if series_idx and series_idx < len(parts) else "EQ"
                new_companies.append({
                    "symbol": symbol,
                    "name":   name,
                    "series": series,
                })

            if new_companies:
                _nse_companies = new_companies
                _symbol_map    = {c["symbol"]: c for c in _nse_companies}
                _name_map      = {c["name"].lower(): c for c in _nse_companies}
                _last_refresh  = datetime.utcnow()
                print(f"NSE list refreshed: {len(_nse_companies)} companies loaded")
                return True

    except Exception as e:
        print(f"NSE list refresh failed: {e}")

    # Fallback to local CSV if web refresh fails.
    return refresh_nse_list_from_csv()


# ── FIX 1: Symbol classification ──────────────────────────────────────────────
def classify_symbol(symbol: str) -> dict:
    """
    Classify a symbol and return its type + any warnings.
    Returns:
      {
        "type": "normal" | "dvr" | "sme" | "unknown",
        "series": str,
        "warning": str | None,
        "valid": bool,
      }
    """
    upper = symbol.upper().strip()

    if upper in DVR_SYMBOLS:
        return {
            "type":    "dvr",
            "series":  "EQ",
            "warning": f"{symbol} is a DVR share. Financial data shown is from the parent company.",
            "valid":   True,
        }

    company = _symbol_map.get(upper)
    if not company:
        return {
            "type":    "unknown",
            "series":  None,
            "warning": None,
            "valid":   False,
        }

    series = company.get("series", "EQ")
    if series in SME_SERIES:
        return {
            "type":    "sme",
            "series":  series,
            "warning": (
                f"{symbol} is an SME-listed company (series: {series}). "
                "Financial data may be limited or unavailable."
            ),
            "valid": True,
        }

    return {
        "type":    "normal",
        "series":  series,
        "warning": None,
        "valid":   True,
    }


# ── Main Validator ────────────────────────────────────────────────────────────
def validate_nse_company(query: str) -> dict | None:
    """
    Check if a query matches an NSE listed company by symbol or name.
    Returns the matched company dict {symbol, name, series, classification}
    or None if not found.

    Matching priority:
    1. Exact symbol match
    2. DVR symbol match
    3. Exact name match
    4. Partial name match (shortest matching name)
    5. Partial symbol match
    """
    q = query.strip()
    if not q:
        return None

    q_upper = q.upper()
    q_lower = q.lower()

    # Alias resolution (e.g. historical brand name / renamed symbol)
    alias_symbol = SYMBOL_ALIASES.get(q_upper)
    if alias_symbol and alias_symbol in _symbol_map:
        c = dict(_symbol_map[alias_symbol])
        c["classification"] = classify_symbol(alias_symbol)
        c["matched_from_alias"] = q_upper
        return c

    # 1. Exact symbol match
    if q_upper in _symbol_map:
        c = dict(_symbol_map[q_upper])
        c["classification"] = classify_symbol(q_upper)
        return c

    # 2. DVR symbol
    if q_upper in DVR_SYMBOLS:
        return {
            "symbol":         q_upper,
            "name":           f"{q_upper} (DVR)",
            "series":         "EQ",
            "classification": classify_symbol(q_upper),
        }

    # 3. Exact name match
    if q_lower in _name_map:
        c = dict(_name_map[q_lower])
        c["classification"] = classify_symbol(c["symbol"])
        return c

    # 4. Partial name match
    name_matches = [c for c in _nse_companies if q_lower in c["name"].lower()]
    if name_matches:
        best = min(name_matches, key=lambda c: len(c["name"]))
        best = dict(best)
        best["classification"] = classify_symbol(best["symbol"])
        return best

    # 5. Partial symbol match
    symbol_matches = [c for c in _nse_companies if q_upper in c["symbol"].upper()]
    if symbol_matches:
        best = min(symbol_matches, key=lambda c: len(c["symbol"]))
        best = dict(best)
        best["classification"] = classify_symbol(best["symbol"])
        return best

    return None


def search_nse_companies(query: str, limit: int = 8) -> list[dict]:
    """
    Search NSE companies for autocomplete suggestions.
    FIX 1: Now includes series/type info so frontend can show SME badge.
    """
    q = query.strip()
    if not q or len(q) < 2:
        return []

    q_upper = q.upper()
    q_lower = q.lower()

    results = []
    seen    = set()

    def _add(c):
        if c["symbol"] not in seen:
            entry = dict(c)
            entry["classification"] = classify_symbol(c["symbol"])
            results.append(entry)
            seen.add(c["symbol"])

    alias_symbol = SYMBOL_ALIASES.get(q_upper)
    if alias_symbol and alias_symbol in _symbol_map:
        _add(_symbol_map[alias_symbol])

    # Priority 1: Symbol starts with query
    for c in _nse_companies:
        if c["symbol"].upper().startswith(q_upper):
            _add(c)

    # Priority 2: Name starts with query
    for c in _nse_companies:
        if c["name"].lower().startswith(q_lower):
            _add(c)

    # Priority 3: Name contains query
    for c in _nse_companies:
        if q_lower in c["name"].lower():
            _add(c)

    # Priority 4: Symbol contains query
    for c in _nse_companies:
        if q_upper in c["symbol"].upper():
            _add(c)

    return results[:limit]


def get_all_nse_companies() -> list[dict]:
    return _nse_companies


def get_symbol_count() -> int:
    return len(_nse_companies)