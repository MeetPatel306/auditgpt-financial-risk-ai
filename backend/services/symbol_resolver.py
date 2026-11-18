"""
Symbol Resolution Service for AuditGPT.
Handles:
  - Exact NSE tickers
  - Company names (full, partial, normalized)
  - Yahoo Finance tickers (.NS, .BO suffixes)
  - Exchange prefixes (NSE:, BSE:)
  - Corporate actions & demergers (e.g. Tata Motors -> TMCV / TMPV)
  - Common company aliases & abbreviations (RIL, HDFC, SBI, INFY, etc.)
  - Ambiguity detection (e.g. generic query matching multiple distinct companies)
  - Suffix and whitespace normalization
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

logger = logging.getLogger("auditgpt.symbol_resolver")

# ── Data classes ───────────────────────────────────────────────────────────────

@dataclass
class ResolvedSymbol:
    symbol: str                     # Clean NSE symbol used for quotes (e.g. "TMCV", "RELIANCE")
    company_name: str               # Authoritative name
    exchange: str = "NSE"
    yahoo_symbol: str = ""          # Quote ticker, e.g. "TMCV.NS"
    yahoo_financial_symbols: list[str] = field(default_factory=list)
    is_dvr: bool = False
    is_sme: bool = False
    series: str = "EQ"
    resolution_type: str = "exact_symbol"  # "exact_symbol" | "alias" | "demerger" | "name_match" | "partial_match" | "direct_ticker"
    original_query: str = ""
    notes: Optional[str] = None
    alternatives: list[str] = field(default_factory=list)
    listings: list[dict] = field(default_factory=list)
    requested_symbol: str = ""
    valid: bool = True


@dataclass
class AmbiguousResolution:
    original_query: str
    candidates: list[dict]
    message: str
    valid: bool = False


# ── Known corporate action, demerger, and alias maps ──────────────────────────

# Demergers and historical successors.
# Quote symbols are current NSE listings. Financial Yahoo tickers may include
# a discontinued predecessor when the successor has incomplete statement history.
DEMERGER_MAP: dict[str, dict] = {
    "TATAMOTORS": {
        "primary": "TMCV",
        "primary_name": "Tata Motors Limited (Commercial Vehicles)",
        "alternatives": ["TMPV"],
        "yahoo_financial_symbols": ["TMCV.NS", "TATAMOTORS.NS", "TMPV.NS"],
        "listings": [
            {
                "symbol": "TMCV",
                "name": "Tata Motors Limited (Commercial Vehicles)",
                "role": "current_nse_cv",
            },
            {
                "symbol": "TMPV",
                "name": "Tata Motors Passenger Vehicles Limited",
                "role": "current_nse_pv_ev_jlr",
            },
        ],
        "notes": (
            "Tata Motors was demerged on NSE into TMCV (Commercial Vehicles) and "
            "TMPV (Passenger Vehicles, EV & JLR). Quotes use TMCV unless TMPV is selected. "
            "Annual statements may still be published under the historical TATAMOTORS Yahoo ticker."
        ),
    },
    "TATAMTRDVR": {
        "primary": "TMCV",
        "primary_name": "Tata Motors Limited (Commercial Vehicles)",
        "alternatives": ["TMPV"],
        "is_dvr": True,
        "yahoo_financial_symbols": ["TMCV.NS", "TATAMOTORS.NS"],
        "listings": [
            {"symbol": "TMCV", "name": "Tata Motors Limited (Commercial Vehicles)", "role": "current_nse_cv"},
            {"symbol": "TMPV", "name": "Tata Motors Passenger Vehicles Limited", "role": "current_nse_pv_ev_jlr"},
        ],
        "notes": (
            "TATAMTRDVR shares were cancelled after Tata Motors' capital reduction. "
            "Resolved to the current TMCV listing; DVR voting rights no longer apply."
        ),
    },
}

# Common abbreviations, brand names, and renamings
COMMON_ALIASES: dict[str, str] = {
    "RIL": "RELIANCE",
    "RELIANCE INDUSTRIES": "RELIANCE",
    "TCS": "TCS",
    "TATA CONSULTANCY SERVICES": "TCS",
    "HDFC": "HDFCBANK",              # HDFC Ltd merged into HDFC Bank
    "HDFCBANK": "HDFCBANK",
    "HDFC BANK": "HDFCBANK",
    "COALINDIA": "COALINDIA",
    "COAL INDIA": "COALINDIA",
    "WIPRO": "WIPRO",
    "INFY": "INFY",
    "INFOSYS": "INFY",
    "SBI": "SBIN",
    "STATE BANK OF INDIA": "SBIN",
    "L&T": "LT",
    "LARSEN & TOUBRO": "LT",
    "LARSEN AND TOUBRO": "LT",
    "AIRTEL": "BHARTIARTL",
    "BHARTI AIRTEL": "BHARTIARTL",
    "BHARTIARTL": "BHARTIARTL",
    "ZOMATO": "ETERNAL",             # Zomato corporate renaming
    "ETERNAL": "ETERNAL",
    "TMCV": "TMCV",
    "TMPV": "TMPV",
    "JSWSTEEL-DVR": "JSWSTEEL",
    "TATASTEELDVR": "TATASTEEL",
    "FUTRETAILDVR": "FUTRETAIL",
}

# Explicit entity names for special securities
SPECIAL_ENTITIES: dict[str, dict] = {
    "TMCV": {
        "name": "Tata Motors Limited (Commercial Vehicles)",
        "series": "EQ",
        "notes": (
            "Current NSE listing for Tata Motors' Commercial Vehicles business after demerger. "
            "Related listing: TMPV (Passenger Vehicles)."
        ),
        "alternatives": ["TMPV"],
        "yahoo_financial_symbols": ["TMCV.NS", "TATAMOTORS.NS"],
        "listings": [
            {"symbol": "TMCV", "name": "Tata Motors Limited (Commercial Vehicles)", "role": "selected"},
            {"symbol": "TMPV", "name": "Tata Motors Passenger Vehicles Limited", "role": "related"},
        ],
    },
    "TMPV": {
        "name": "Tata Motors Passenger Vehicles Limited",
        "series": "EQ",
        "notes": (
            "Current NSE listing for Tata Motors' Passenger Vehicles, EV and JLR business after demerger. "
            "Related listing: TMCV (Commercial Vehicles)."
        ),
        "alternatives": ["TMCV"],
        "yahoo_financial_symbols": ["TMPV.NS", "TATAMOTORS.NS"],
        "listings": [
            {"symbol": "TMPV", "name": "Tata Motors Passenger Vehicles Limited", "role": "selected"},
            {"symbol": "TMCV", "name": "Tata Motors Limited (Commercial Vehicles)", "role": "related"},
        ],
    },
}

SME_SERIES = {"SM", "ST", "SB"}


class SymbolResolver:
    """Thread-safe, robust symbol resolver for Indian equity markets."""

    def __init__(self, json_path: Optional[Path] = None):
        self._json_path = json_path or (Path(__file__).parent.parent / "nse_companies.json")
        self._symbol_map: dict[str, dict] = {}
        self._name_map: dict[str, dict] = {}
        self._companies: list[dict] = []
        self._load()

    def _load(self):
        if not self._json_path.exists():
            logger.warning("NSE companies file not found at %s", self._json_path)
            return

        try:
            with open(self._json_path, "r", encoding="utf-8") as f:
                self._companies = json.load(f)
        except Exception as e:
            logger.error("Failed to load NSE companies from %s: %s", self._json_path, e)
            self._companies = []

        # Merge special entities (like TMCV and TMPV) into the registry
        for sym, meta in SPECIAL_ENTITIES.items():
            if not any(c.get("symbol") == sym for c in self._companies):
                self._companies.append({
                    "symbol": sym,
                    "name": meta["name"],
                    "series": meta.get("series", "EQ"),
                })

        self._index()

    def reload_companies(self, companies: list[dict]) -> None:
        """Replace the equity registry (used after NSE list refresh)."""
        self._companies = list(companies or [])
        for sym, meta in SPECIAL_ENTITIES.items():
            if not any(c.get("symbol") == sym for c in self._companies):
                self._companies.append({
                    "symbol": sym,
                    "name": meta["name"],
                    "series": meta.get("series", "EQ"),
                })
        self._index()

    def _index(self) -> None:
        self._symbol_map = {c["symbol"].upper(): c for c in self._companies if c.get("symbol")}
        self._name_map = {self._clean_name(c["name"]): c for c in self._companies if c.get("name")}

    def _decorate(self, resolved: ResolvedSymbol) -> ResolvedSymbol:
        if not resolved.yahoo_symbol:
            resolved.yahoo_symbol = f"{resolved.symbol}.NS"
        if not resolved.yahoo_financial_symbols:
            extra = SPECIAL_ENTITIES.get(resolved.symbol, {}).get("yahoo_financial_symbols")
            resolved.yahoo_financial_symbols = list(extra) if extra else [resolved.yahoo_symbol]
        if not resolved.requested_symbol:
            resolved.requested_symbol = self.clean_query(resolved.original_query).upper()
        if not resolved.listings:
            resolved.listings = [{"symbol": resolved.symbol, "name": resolved.company_name, "role": "selected"}]
        return resolved

    def _from_demerger(self, query: str, dem: dict, resolution_type: str) -> ResolvedSymbol:
        target_sym = dem["primary"]
        return self._decorate(ResolvedSymbol(
            symbol=target_sym,
            company_name=dem.get("primary_name", target_sym),
            yahoo_symbol=f"{target_sym}.NS",
            yahoo_financial_symbols=list(dem.get("yahoo_financial_symbols") or [f"{target_sym}.NS"]),
            is_dvr=dem.get("is_dvr", False),
            resolution_type=resolution_type,
            original_query=query,
            notes=dem.get("notes"),
            alternatives=list(dem.get("alternatives", [])),
            listings=list(dem.get("listings", [])),
            requested_symbol=self.clean_query(query).upper(),
        ))

    @staticmethod
    def _clean_name(name: str) -> str:
        """Normalize company name by removing punctuation, extra spaces, and common legal suffixes."""
        n = (name or "").lower().strip()
        n = re.sub(r"[^\w\s]", " ", n)
        n = re.sub(r"\s+", " ", n).strip()
        return n

    @staticmethod
    def clean_query(raw_query: str) -> str:
        """Strip exchange prefixes and suffixes like .NS, .BO, NSE:, BSE:."""
        q = (raw_query or "").strip()
        # Remove prefixes
        for prefix in ("NSE:", "BSE:", "NSE_", "BSE_"):
            if q.upper().startswith(prefix):
                q = q[len(prefix):].strip()
        # Remove suffixes
        for suffix in (".NS", ".BO", ".ns", ".bo"):
            if q.endswith(suffix):
                q = q[:-len(suffix)].strip()
        # Remove multiple internal spaces
        q = re.sub(r"\s+", " ", q).strip()
        return q

    def resolve(self, query: str) -> ResolvedSymbol | AmbiguousResolution | None:
        """
        Resolve a user query to an authoritative ResolvedSymbol.
        Returns:
          - ResolvedSymbol if a clear match is found.
          - AmbiguousResolution if multiple distinct companies match and clarification is needed.
          - None if the query is unsupported or invalid.
        """
        cleaned = self.clean_query(query)
        if not cleaned:
            return None

        upper = cleaned.upper()
        clean_lower = self._clean_name(cleaned)

        # 1. Check demergers / corporate action replacements
        if upper in DEMERGER_MAP:
            return self._from_demerger(query, DEMERGER_MAP[upper], "demerger")

        # 2. Check common aliases / abbreviations
        if upper in COMMON_ALIASES:
            aliased_sym = COMMON_ALIASES[upper]
            if aliased_sym in DEMERGER_MAP:
                return self._from_demerger(query, DEMERGER_MAP[aliased_sym], "alias")
            company_data = self._symbol_map.get(aliased_sym, {})
            name = company_data.get("name") or SPECIAL_ENTITIES.get(aliased_sym, {}).get("name") or aliased_sym
            series = company_data.get("series", "EQ")
            meta = SPECIAL_ENTITIES.get(aliased_sym, {})
            return self._decorate(ResolvedSymbol(
                symbol=aliased_sym,
                company_name=name,
                yahoo_symbol=f"{aliased_sym}.NS",
                is_sme=series in SME_SERIES,
                series=series,
                resolution_type="alias",
                original_query=query,
                notes=meta.get("notes"),
                alternatives=list(meta.get("alternatives", [])),
                listings=list(meta.get("listings", [])),
            ))

        # 3. Check exact symbol match in registry
        if upper in self._symbol_map:
            c = self._symbol_map[upper]
            series = c.get("series", "EQ")
            meta = SPECIAL_ENTITIES.get(upper, {})
            return self._decorate(ResolvedSymbol(
                symbol=upper,
                company_name=meta.get("name") or c.get("name", upper),
                yahoo_symbol=f"{upper}.NS",
                is_sme=series in SME_SERIES,
                series=series,
                resolution_type="exact_symbol",
                original_query=query,
                notes=meta.get("notes"),
                alternatives=list(meta.get("alternatives", [])),
                listings=list(meta.get("listings", [])),
            ))

        # 4. Check exact normalized name match
        if clean_lower in self._name_map:
            c = self._name_map[clean_lower]
            sym = c["symbol"].upper()
            series = c.get("series", "EQ")
            # If the exact name mapped to a demerged symbol, route through demerger
            if sym in DEMERGER_MAP:
                return self._from_demerger(query, DEMERGER_MAP[sym], "demerger")
            meta = SPECIAL_ENTITIES.get(sym, {})
            return self._decorate(ResolvedSymbol(
                symbol=sym,
                company_name=c.get("name", sym),
                yahoo_symbol=f"{sym}.NS",
                is_sme=series in SME_SERIES,
                series=series,
                resolution_type="name_match",
                original_query=query,
                notes=meta.get("notes"),
                alternatives=list(meta.get("alternatives", [])),
                listings=list(meta.get("listings", [])),
            ))

        # 5. Check alias of normalized company name
        alias_match = COMMON_ALIASES.get(upper) or COMMON_ALIASES.get(clean_lower.upper())
        if alias_match and alias_match in self._symbol_map:
            c = self._symbol_map[alias_match]
            return self._decorate(ResolvedSymbol(
                symbol=alias_match,
                company_name=c.get("name", alias_match),
                yahoo_symbol=f"{alias_match}.NS",
                resolution_type="alias",
                original_query=query,
            ))

        # 6. Specific Tata Motors handling
        if "tata motor" in clean_lower:
            return self._from_demerger(query, DEMERGER_MAP["TATAMOTORS"], "demerger")

        # 7. Ambiguity check: if query is a short generic token like "TATA" matching many distinct symbols
        name_matches = [
            c for c in self._companies
            if clean_lower in self._clean_name(c.get("name", ""))
        ]

        if len(name_matches) > 1:
            distinct = {c["symbol"].upper() for c in name_matches if c.get("symbol")}
            if len(clean_lower) <= 8 and len(distinct) >= 3:
                return AmbiguousResolution(
                    original_query=query,
                    candidates=[{"symbol": c["symbol"], "name": c["name"]} for c in name_matches[:8]],
                    message=(
                        f"Query '{query}' matches {len(distinct)} companies. "
                        "Specify the NSE ticker (for example TCS or TATAMOTORS) instead of a group name."
                    ),
                )
            exact_starts = [c for c in name_matches if self._clean_name(c.get("name", "")).startswith(clean_lower)]
            if exact_starts:
                best = min(exact_starts, key=lambda c: len(c.get("name", "")))
            else:
                best = min(name_matches, key=lambda c: len(c.get("name", "")))

            sym = best["symbol"].upper()
            if sym in DEMERGER_MAP:
                return self._from_demerger(query, DEMERGER_MAP[sym], "demerger")
            series = best.get("series", "EQ")
            return self._decorate(ResolvedSymbol(
                symbol=sym,
                company_name=best.get("name", sym),
                yahoo_symbol=f"{sym}.NS",
                is_sme=series in SME_SERIES,
                series=series,
                resolution_type="partial_match",
                original_query=query,
            ))

        if len(name_matches) == 1:
            c = name_matches[0]
            sym = c["symbol"].upper()
            if sym in DEMERGER_MAP:
                return self._from_demerger(query, DEMERGER_MAP[sym], "demerger")
            return self._decorate(ResolvedSymbol(
                symbol=sym,
                company_name=c.get("name", sym),
                yahoo_symbol=f"{sym}.NS",
                resolution_type="partial_match",
                original_query=query,
            ))

        # 8. Partial symbol match (e.g. user entered prefix)
        sym_matches = [c for c in self._companies if upper in c.get("symbol", "").upper()]
        if sym_matches:
            best = min(sym_matches, key=lambda c: len(c.get("symbol", "")))
            sym = best["symbol"].upper()
            return self._decorate(ResolvedSymbol(
                symbol=sym,
                company_name=best.get("name", sym),
                yahoo_symbol=f"{sym}.NS",
                resolution_type="partial_match",
                original_query=query,
            ))

        # If it looks like a clean ticker (3-12 alphanumeric characters), allow it to pass through as candidate
        if re.match(r"^[A-Z0-9\-]{2,14}$", upper):
            return self._decorate(ResolvedSymbol(
                symbol=upper,
                company_name=upper,
                yahoo_symbol=f"{upper}.NS",
                resolution_type="direct_ticker",
                original_query=query,
                notes="Direct symbol lookup — validity will be verified by market data providers.",
            ))

        return None

    def search(self, query: str, limit: int = 8) -> list[dict]:
        """Autocomplete search with series, classification, and demerger alternatives."""
        q = self.clean_query(query).lower()
        if not q or len(q) < 2:
            return []

        q_upper = q.upper()
        results: list[dict] = []
        seen: set[str] = set()

        def _add(entry: dict, note: Optional[str] = None):
            sym = entry.get("symbol", "").upper()
            if sym and sym not in seen:
                seen.add(sym)
                item = dict(entry)
                series = item.get("series", "EQ")
                item["symbol_type"] = "sme" if series in SME_SERIES else ("dvr" if "DVR" in sym else "normal")
                if note:
                    item["note"] = note
                results.append(item)

        # If user searches "tata motors" or "tatamotors", prioritize TMCV and TMPV
        if "tata motor" in q or q in ("tatamotors", "tmcv", "tmpv"):
            _add({"symbol": "TMCV", "name": "Tata Motors Limited (Commercial Vehicles)", "series": "EQ"},
                 note="Demerged Commercial Vehicles entity")
            _add({"symbol": "TMPV", "name": "Tata Motors Passenger Vehicles Limited", "series": "EQ"},
                 note="Demerged Passenger Vehicles, EV & JLR entity")

        # Priority 1: Symbol starts with
        for c in self._companies:
            if c.get("symbol", "").upper().startswith(q_upper):
                _add(c)

        # Priority 2: Name starts with
        for c in self._companies:
            if self._clean_name(c.get("name", "")).startswith(q):
                _add(c)

        # Priority 3: Name contains
        for c in self._companies:
            if q in self._clean_name(c.get("name", "")):
                _add(c)

        return results[:limit]


# Module singleton instance
_resolver = SymbolResolver()

def resolve_symbol(query: str) -> ResolvedSymbol | AmbiguousResolution | None:
    return _resolver.resolve(query)

def search_symbols(query: str, limit: int = 8) -> list[dict]:
    return _resolver.search(query, limit=limit)

def reload_symbol_registry(companies: list[dict]) -> None:
    _resolver.reload_companies(companies)

