"""
regulatory_alerts.py — BSE corporate-announcement + SEBI penalty/debarment
scraping for Fix 5.

Endpoints:
  GET /api/regulatory-alerts/{symbol}        → {alerts: [...]}
  GET /api/regulatory-alerts/bulk?symbols=A,B,C → {alerts_by_symbol: {...}}

Alerts schema (consumed by AlertBanner.jsx + SavedPortfolioPage.jsx):
  {
    "type":  "BSE_ALERT" | "SEBI_PENALTY",
    "title": "…",
    "date":  "DD-MM-YYYY" or "" ,
    "source": "BSE" | "SEBI",
    "url":   "https://…",
  }

Defensive design:
  · Each scraper is wrapped in try/except — failures degrade silently
    so the analysis pipeline never breaks.
  · 24-hour in-memory TTL cache per (source, key).
  · 8-second hard timeout on every HTTP call.
  · Both NSE symbols (TCS) and free-text company names are accepted.

If you later add a `regulatory_alerts` field to the analyze() response,
just call get_alerts_for_symbol(symbol, name) inside analysis.py.
"""
from __future__ import annotations

import time
import logging
import urllib.parse
from typing import Optional

import requests
from bs4 import BeautifulSoup
from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/regulatory-alerts", tags=["regulatory-alerts"])

# ── Tunables ─────────────────────────────────────────────────────────
HTTP_TIMEOUT  = 8           # seconds
CACHE_TTL_SEC = 60 * 60 * 24  # 24 h
MAX_RESULTS   = 6

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0 Safari/537.36"
)

# Simple in-process cache: {(source, key): (epoch_seconds, list)}
_cache: dict[tuple[str, str], tuple[float, list[dict]]] = {}


def _cache_get(source: str, key: str) -> Optional[list[dict]]:
    entry = _cache.get((source, key.upper()))
    if not entry:
        return None
    ts, val = entry
    if time.time() - ts > CACHE_TTL_SEC:
        _cache.pop((source, key.upper()), None)
        return None
    return val


def _cache_set(source: str, key: str, value: list[dict]) -> None:
    _cache[(source, key.upper())] = (time.time(), value)


# ════════════════════════════════════════════════════════════════════
# 1. BSE — Corporate Announcements
# ════════════════════════════════════════════════════════════════════
# BSE exposes a JSON API used by their own UI. We need a security/scrip
# code, but for first pass we can search by issuer name freetext.
#
# A more complete impl would resolve NSE symbol → BSE scrip code via
# their listed-equity master.  For now we hit the public AnnSubCategory
# API with a name filter, which the BSE UI also does behind the scenes.
BSE_ANN_URL = (
    "https://api.bseindia.com/BseIndiaAPI/api/AnnSubCategoryGetData/w"
    "?pageno=1&strCat=-1&strPrevDate={d}&strScrip=&strSearch=P"
    "&strToDate={d2}&strType=C"
)


def _bse_headers() -> dict:
    return {
        "User-Agent": UA,
        "Accept": "application/json, text/plain, */*",
        "Origin":  "https://www.bseindia.com",
        "Referer": "https://www.bseindia.com/",
    }


def fetch_bse_announcements(company_name: str, nse_symbol: str) -> list[dict]:
    """Best-effort fetch of recent BSE corporate announcements that
    mention the company. Returns at most MAX_RESULTS items."""
    cache_key = nse_symbol or company_name
    cached = _cache_get("BSE", cache_key)
    if cached is not None:
        return cached

    out: list[dict] = []
    try:
        from datetime import datetime, timedelta
        today = datetime.now()
        d_from = (today - timedelta(days=30)).strftime("%Y%m%d")
        d_to   = today.strftime("%Y%m%d")
        url = BSE_ANN_URL.format(d=d_from, d2=d_to)

        r = requests.get(url, headers=_bse_headers(), timeout=HTTP_TIMEOUT)
        if r.status_code != 200:
            logger.warning("BSE %s → HTTP %s", url, r.status_code)
            _cache_set("BSE", cache_key, [])
            return []

        try:
            payload = r.json()
        except ValueError:
            payload = {}

        # BSE returns {Table: [...], Table1: [...]}
        rows = payload.get("Table") or []
        needle = (company_name or "").lower()
        sym    = (nse_symbol or "").lower()

        for row in rows:
            heading = (row.get("HEADLINE") or row.get("HEAD_LINE") or "").strip()
            company = (row.get("SLONGNAME") or row.get("COMPANYNAME") or "").lower()
            if not heading:
                continue
            if needle and needle.split()[0] in company:
                pass  # match
            elif sym and sym in company:
                pass
            else:
                continue

            attach = row.get("ATTACHMENTNAME") or row.get("PDFFILE") or ""
            url_pdf = (
                f"https://www.bseindia.com/xml-data/corpfiling/AttachLive/{attach}"
                if attach else "https://www.bseindia.com/corporates/ann.html"
            )
            out.append({
                "type":   "BSE_ALERT",
                "title":  heading[:200],
                "date":   (row.get("News_submission_dt") or row.get("NEWS_DT") or "")[:10],
                "source": "BSE",
                "url":    url_pdf,
            })
            if len(out) >= MAX_RESULTS:
                break

    except requests.RequestException as e:
        logger.info("BSE fetch failed for %s: %s", cache_key, e)
    except Exception as e:  # noqa: BLE001 — defensive, never crash analysis
        logger.exception("Unexpected BSE error for %s: %s", cache_key, e)

    _cache_set("BSE", cache_key, out)
    return out


# ════════════════════════════════════════════════════════════════════
# 2. SEBI — Debarred entities / orders / penalties
# ════════════════════════════════════════════════════════════════════
# SEBI doesn't expose a clean JSON API; we scrape the public orders
# search page.  We simply search by the company name and capture the
# top results. Failures degrade silently.
SEBI_SEARCH_URL = (
    "https://www.sebi.gov.in/sebiweb/searchresults.jsp?search={q}"
)


def fetch_sebi_actions(company_name: str, nse_symbol: str) -> list[dict]:
    cache_key = nse_symbol or company_name
    cached = _cache_get("SEBI", cache_key)
    if cached is not None:
        return cached

    out: list[dict] = []
    if not company_name:
        _cache_set("SEBI", cache_key, [])
        return []

    try:
        q = urllib.parse.quote_plus(company_name)
        r = requests.get(
            SEBI_SEARCH_URL.format(q=q),
            headers={"User-Agent": UA},
            timeout=HTTP_TIMEOUT,
        )
        if r.status_code != 200:
            _cache_set("SEBI", cache_key, [])
            return []

        soup = BeautifulSoup(r.text, "html.parser")

        # SEBI search returns a list of <a> links inside .search-results
        # We pick those whose text contains "order", "penalty", "debar"
        for a in soup.select("a"):
            txt = (a.get_text() or "").strip()
            href = a.get("href") or ""
            if not txt or not href:
                continue
            tlow = txt.lower()
            if not any(w in tlow for w in ("order", "penalty", "debar", "adjudicat", "ban")):
                continue
            if not href.startswith("http"):
                href = "https://www.sebi.gov.in" + href

            out.append({
                "type":   "SEBI_PENALTY",
                "title":  txt[:200],
                "date":   "",
                "source": "SEBI",
                "url":    href,
            })
            if len(out) >= MAX_RESULTS:
                break

    except requests.RequestException as e:
        logger.info("SEBI fetch failed for %s: %s", cache_key, e)
    except Exception as e:  # noqa: BLE001
        logger.exception("Unexpected SEBI error for %s: %s", cache_key, e)

    _cache_set("SEBI", cache_key, out)
    return out


# ════════════════════════════════════════════════════════════════════
# 3. Aggregator — both sources combined
# ════════════════════════════════════════════════════════════════════
def get_alerts_for_symbol(nse_symbol: str, company_name: str = "") -> list[dict]:
    """Public helper — call from analysis.py to embed alerts in the
    per-company response so the AlertBanner can render them.

    Always returns a list (possibly empty); never raises.
    """
    alerts: list[dict] = []
    try:
        alerts.extend(fetch_bse_announcements(company_name, nse_symbol))
    except Exception:  # noqa: BLE001
        logger.exception("BSE aggregation crashed")
    try:
        alerts.extend(fetch_sebi_actions(company_name, nse_symbol))
    except Exception:  # noqa: BLE001
        logger.exception("SEBI aggregation crashed")
    return alerts


# ════════════════════════════════════════════════════════════════════
# 4. FastAPI endpoints
# ════════════════════════════════════════════════════════════════════
@router.get("/{symbol}")
def regulatory_alerts_for_symbol(symbol: str, name: str = ""):
    """Single-company endpoint. `name` improves SEBI hit-rate."""
    sym = (symbol or "").upper().strip()
    if not sym:
        raise HTTPException(400, "Missing NSE symbol")
    return {
        "symbol": sym,
        "company_name": name,
        "alerts": get_alerts_for_symbol(sym, name),
    }


@router.get("/bulk")
def regulatory_alerts_bulk(
    symbols: str = Query(..., description="Comma-separated NSE symbols"),
):
    """Bulk endpoint for the SavedPortfolioPage so it can paint badges
    next to every saved company in one network round-trip."""
    syms = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    if not syms:
        raise HTTPException(400, "No symbols provided")
    return {
        "symbols": syms,
        "alerts_by_symbol": {
            s: get_alerts_for_symbol(s, "") for s in syms
        },
    }
