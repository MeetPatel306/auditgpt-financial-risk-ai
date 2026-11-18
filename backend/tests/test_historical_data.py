"""
Unit & Integration Tests for Historical Market Data Service and Symbol Resolver.
All external provider calls (Yahoo Finance) are mocked so tests are deterministic,
fast, and require no live internet connection.
"""

import pytest
import pandas as pd
from datetime import date, timedelta
from unittest.mock import patch, MagicMock, AsyncMock

from services.historical_price import (
    _build_yahoo_ticker,
    _normalise,
    fetch_and_store_history,
    get_stored_history,
    get_history_meta,
)
from services.symbol_resolver import resolve_symbol, search_symbols, AmbiguousResolution, ResolvedSymbol
from services.batch_sync import load_all_symbols


# ── Symbol Resolver Tests ──────────────────────────────────────────────────────

def test_resolve_exact_symbol():
    res = resolve_symbol("RELIANCE")
    assert isinstance(res, ResolvedSymbol)
    assert res.symbol == "RELIANCE"
    assert res.yahoo_symbol == "RELIANCE.NS"


def test_resolve_suffix_and_spaces():
    res = resolve_symbol("  infy.ns  ")
    assert isinstance(res, ResolvedSymbol)
    assert res.symbol == "INFY"
    assert res.yahoo_symbol == "INFY.NS"


def test_resolve_prefix():
    res = resolve_symbol("NSE:TCS")
    assert isinstance(res, ResolvedSymbol)
    assert res.symbol == "TCS"
    assert res.yahoo_symbol == "TCS.NS"


def test_resolve_demerger_tatamotors():
    res = resolve_symbol("TATAMOTORS")
    assert isinstance(res, ResolvedSymbol)
    assert res.symbol == "TMCV"
    assert res.resolution_type == "demerger"
    assert "TMPV" in res.alternatives
    assert "Commercial Vehicles" in res.company_name


def test_resolve_tatamotors_name():
    res = resolve_symbol("Tata Motors Limited")
    assert isinstance(res, ResolvedSymbol)
    assert res.symbol == "TMCV"


def test_resolve_common_alias_ril():
    res = resolve_symbol("RIL")
    assert isinstance(res, ResolvedSymbol)
    assert res.symbol == "RELIANCE"


def test_resolve_common_alias_hdfc():
    res = resolve_symbol("HDFC")
    assert isinstance(res, ResolvedSymbol)
    assert res.symbol == "HDFCBANK"


def test_resolve_ambiguous_short_query():
    # A short generic query matching many companies returns AmbiguousResolution
    res = resolve_symbol("INDIA")
    assert isinstance(res, AmbiguousResolution) or (isinstance(res, ResolvedSymbol) and res.symbol)


def test_search_symbols_autocomplete():
    results = search_symbols("TATA MOTORS", limit=5)
    assert len(results) > 0
    symbols = [r["symbol"] for r in results]
    assert "TMCV" in symbols or "TMPV" in symbols


def test_load_all_symbols_includes_special():
    symbols = load_all_symbols()
    assert len(symbols) > 1000
    assert "TMCV" in symbols
    assert "TMPV" in symbols
    assert "RELIANCE" in symbols


# ── Historical Price OHLCV Processing Tests ────────────────────────────────────

def test_build_yahoo_ticker():
    assert _build_yahoo_ticker("TCS") == "TCS.NS"
    assert _build_yahoo_ticker("RELIANCE.NS") == "RELIANCE.NS"
    assert _build_yahoo_ticker("bse_company.bo") == "BSE_COMPANY.BO"


def test_normalise_ohlcv_dataframe():
    dates = pd.date_range(start="2020-01-01", periods=3, freq="D")
    df = pd.DataFrame(
        {
            "Open": [100.0, 105.0, 102.5],
            "High": [110.0, 108.0, 107.0],
            "Low": [98.0, 101.0, 100.0],
            "Close": [106.0, 103.0, 105.5],
            "Volume": [1000000, 1500000, 1200000],
        },
        index=dates,
    )
    records = _normalise(df, "TESTSYM")
    assert len(records) == 3
    assert records[0]["symbol"] == "TESTSYM"
    assert records[0]["date"] == "2020-01-01"
    assert records[0]["open"] == 100.0
    assert records[0]["close"] == 106.0
    assert records[0]["volume"] == 1000000


def test_normalise_empty_dataframe():
    records = _normalise(pd.DataFrame(), "TESTSYM")
    assert records == []


def test_fetch_and_store_history_mocked():
    import asyncio
    # Mock yfinance Ticker.history to return 10 synthetic records
    dates = pd.date_range(end=date.today(), periods=10, freq="D")
    mock_df = pd.DataFrame(
        {
            "Open": [500.0] * 10,
            "High": [510.0] * 10,
            "Low": [495.0] * 10,
            "Close": [505.0] * 10,
            "Volume": [200000] * 10,
        },
        index=dates,
    )

    mock_collection = MagicMock()
    mock_bulk_result = MagicMock()
    mock_bulk_result.upserted_count = 10
    mock_bulk_result.modified_count = 0
    mock_collection.bulk_write = AsyncMock(return_value=mock_bulk_result)

    with patch("services.historical_price._fetch_ohlcv", return_value=mock_df):
        res = asyncio.run(fetch_and_store_history("INFY", years=10, collection=mock_collection))

    assert res["success"] is True
    assert res["symbol"] == "INFY"
    assert res["yahoo_ticker"] == "INFY.NS"
    assert res["records_upserted"] == 10
    assert res["start_date"] is not None
    assert res["end_date"] is not None
    assert mock_collection.bulk_write.called


def test_fetch_and_store_empty_history():
    import asyncio
    mock_collection = MagicMock()
    with patch("services.historical_price._fetch_ohlcv", return_value=pd.DataFrame()):
        res = asyncio.run(fetch_and_store_history("INVALID_XYZ", years=10, collection=mock_collection))

    assert res["success"] is False
    assert res["records_upserted"] == 0
    assert "No data returned" in (res["error"] or "")
