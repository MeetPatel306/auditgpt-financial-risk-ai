"""
NSE sector mapping for similar companies feature.
Maps Yahoo Finance sector names to curated lists of NSE symbols.
"""

from __future__ import annotations

import random

# Comprehensive sector → NSE symbols mapping
# Sectors match Yahoo Finance's sector field (ticker.info["sector"])
SECTOR_MAP = {
    "Healthcare": [
        "SUNPHARMA", "CIPLA", "DRREDDY", "LUPIN", "AUROPHARMA",
        "TORNTPHARM", "DIVISLAB", "BIOCON", "CADILAHC", "GLENMARK",
        "ALKEM", "IPCALAB", "NATCOPHARMA", "LAURUSLABS", "GRANULES",
        "PFIZER", "ABBOTINDIA", "SANOFI", "GLAXO", "AJANTPHARM",
        "JBCHEPHARM", "STAR", "METROPOLIS", "THYROCARE", "APOLLOHOSP",
        "FORTIS", "MAXHEALTH", "NARAYANHR",
    ],
    "Technology": [
        "TCS", "INFY", "WIPRO", "HCLTECH", "TECHM",
        "LTI", "LTTS", "MINDTREE", "MPHASIS", "COFORGE",
        "PERSISTENT", "TATAELXSI", "NIITTECH", "HEXAWARE", "CYIENT",
        "ZENSAR", "MASTEK", "SONATSOFTW", "BIRLASOFT", "DATAPATTNS",
        "ECLERX", "KPITTECH", "HAPPSTMNDS", "ROUTE",
    ],
    "Financial Services": [
        "HDFCBANK", "ICICIBANK", "KOTAKBANK", "SBIN", "AXISBANK",
        "INDUSINDBK", "BANDHANBNK", "IDFCFIRSTB", "FEDERALBNK", "RBLBANK",
        "BAJFINANCE", "BAJAJFINSV", "HDFCAMC", "SBILIFE", "ICICIGI",
        "HDFCLIFE", "CHOLAFIN", "MANAPPURAM", "MUTHOOTFIN", "M&MFIN",
        "IIFL", "PNB", "BANKBARODA", "CANBK", "UNIONBANK",
        "PNBHOUSING", "LTFH", "RECLTD", "PFC",
    ],
    "Consumer Defensive": [
        "HINDUNILVR", "ITC", "NESTLEIND", "BRITANNIA", "DABUR",
        "MARICO", "GODREJCP", "COLPAL", "EMAMILTD", "TATACONSUM",
        "PGHH", "RADICO", "VGUARD", "JYOTHYLAB", "ZYDUSWELL",
        "MCDOWELL-N", "UBL", "JUBLFOOD", "VSTIND",
    ],
    "Consumer Cyclical": [
        "TITAN", "TRENT", "PAGEIND", "RELAXO", "BATAINDIA",
        "RAJESHEXPO", "CROMPTON", "VOLTAS", "WHIRLPOOL", "BLUESTARCO",
        "HAVELLS", "DIXON", "VMART", "SHOPERSTOP", "RAYMOND",
        "ARVIND", "LAXMIMACH", "ORIENTELEC", "CENTURYPLY",
    ],
    "Energy": [
        "RELIANCE", "ONGC", "IOC", "BPCL", "HINDPETRO",
        "GAIL", "PETRONET", "MGL", "IGL", "GUJGASLTD",
        "CASTROLIND", "MRPL", "CHENNPETRO", "GSPL",
    ],
    "Industrials": [
        "LT", "SIEMENS", "ABB", "HAVELLS", "BHEL",
        "BEL", "HAL", "CUMMINSIND", "THERMAX", "GRINDWELL",
        "AIAENG", "HONAUT", "ELGIEQUIP", "SCHAEFFLER", "TIMKEN",
        "BAJAJELEC", "GRAPHITE", "BLUESTARCO", "KECINTL",
        "ISGEC", "COCHINSHIP",
    ],
    "Basic Materials": [
        "TATASTEEL", "JSWSTEEL", "HINDALCO", "VEDL", "COALINDIA",
        "NMDC", "SAIL", "NATIONALUM", "HINDCOPPER", "MOIL",
        "APLAPOLLO", "RATNAMANI", "WELCORP", "JINDALSAW",
        "PIDILITIND", "ASIANPAINT", "BERGERPAINTS", "KANSAINER",
        "AKZONOBEL", "UPL", "ATUL", "DEEPAKNITRI", "NAVINFLUOR",
        "AARTIIND", "SUDARSCHEM", "FINEORG",
    ],
    "Communication Services": [
        "BHARTIARTL", "IDEA", "TATACOMM", "STERLITE",
        "ZEEL", "SUNTV", "PVRINOX", "NETWORK18", "TV18BRDCST",
        "DISHTV", "NAZARA", "RELMEDIA", "SAREGAMA", "TIPS",
    ],
    "Utilities": [
        "NTPC", "POWERGRID", "TATAPOWER", "ADANIPOWER", "NHPC",
        "SJVN", "CESC", "TORNTPOWER", "JSW ENERGY", "RPOWER",
        "IEX",
    ],
    "Real Estate": [
        "DLF", "GODREJPROP", "OBEROIRLTY", "PRESTIGE", "BRIGADE",
        "PHOENIXLTD", "SOBHA", "SUNTECK", "MAHLIFE", "KOLTEPATIL",
        "IBREALEST",
    ],
    "Consumer Staples": [
        "HINDUNILVR", "ITC", "NESTLEIND", "BRITANNIA", "DABUR",
        "MARICO", "GODREJCP", "COLPAL", "EMAMILTD", "TATACONSUM",
    ],
}

# Reverse map: symbol → sector (for quick lookup)
_SYMBOL_TO_SECTOR = {}
for sector, symbols in SECTOR_MAP.items():
    for sym in symbols:
        _SYMBOL_TO_SECTOR[sym] = sector


def get_similar_companies(nse_symbol: str, sector: str, count: int = 5) -> list[dict]:
    """
    Find similar NSE companies in the same sector.
    
    Args:
        nse_symbol: The NSE symbol of the current company (to exclude)
        sector: Yahoo Finance sector string
        count: Number of similar companies to return
    
    Returns:
        List of dicts with {symbol, name} for similar companies.
    """
    from services.nse_validator import validate_nse_company

    # Normalize: try exact sector match first, then fuzzy
    sector_key = _find_sector_key(sector)
    if not sector_key:
        return []

    candidates = SECTOR_MAP.get(sector_key, [])
    
    # Exclude the input company
    candidates = [s for s in candidates if s.upper() != nse_symbol.upper()]
    
    if not candidates:
        return []

    # Pick up to `count` companies (random selection for variety)
    selected = random.sample(candidates, min(count, len(candidates)))

    results = []
    for sym in selected:
        matched = validate_nse_company(sym)
        if matched:
            results.append({
                "symbol": matched["symbol"],
                "name": matched["name"],
                "sector": sector_key,
            })
        else:
            # Symbol exists in our map but not in NSE JSON — use symbol as name
            results.append({
                "symbol": sym,
                "name": sym,
                "sector": sector_key,
            })

    return results[:count]


def _find_sector_key(sector: str) -> str | None:
    """Find the matching sector key in SECTOR_MAP, with fuzzy matching."""
    if not sector or sector == "N/A":
        return None

    # Exact match
    if sector in SECTOR_MAP:
        return sector

    # Case-insensitive match
    sector_lower = sector.lower()
    for key in SECTOR_MAP:
        if key.lower() == sector_lower:
            return key

    # Partial / keyword match
    keyword_map = {
        "pharma": "Healthcare",
        "health": "Healthcare",
        "drug": "Healthcare",
        "biotech": "Healthcare",
        "hospital": "Healthcare",
        "diagnostic": "Healthcare",
        "tech": "Technology",
        "software": "Technology",
        "information": "Technology",
        "it service": "Technology",
        "computer": "Technology",
        "bank": "Financial Services",
        "financ": "Financial Services",
        "insurance": "Financial Services",
        "nbfc": "Financial Services",
        "lending": "Financial Services",
        "fmcg": "Consumer Defensive",
        "consumer": "Consumer Defensive",
        "food": "Consumer Defensive",
        "beverage": "Consumer Defensive",
        "household": "Consumer Defensive",
        "personal": "Consumer Defensive",
        "tobacco": "Consumer Defensive",
        "energy": "Energy",
        "oil": "Energy",
        "gas": "Energy",
        "petroleum": "Energy",
        "refin": "Energy",
        "auto": "Consumer Cyclical",
        "textile": "Consumer Cyclical",
        "apparel": "Consumer Cyclical",
        "retail": "Consumer Cyclical",
        "luxury": "Consumer Cyclical",
        "industrial": "Industrials",
        "capital goods": "Industrials",
        "engineering": "Industrials",
        "defense": "Industrials",
        "aerospace": "Industrials",
        "machinery": "Industrials",
        "metal": "Basic Materials",
        "mining": "Basic Materials",
        "steel": "Basic Materials",
        "chemical": "Basic Materials",
        "cement": "Basic Materials",
        "paint": "Basic Materials",
        "material": "Basic Materials",
        "telecom": "Communication Services",
        "media": "Communication Services",
        "entertainment": "Communication Services",
        "communication": "Communication Services",
        "power": "Utilities",
        "electric": "Utilities",
        "utilit": "Utilities",
        "real estate": "Real Estate",
        "property": "Real Estate",
        "construction": "Real Estate",
        "housing": "Real Estate",
    }

    for keyword, mapped_sector in keyword_map.items():
        if keyword in sector_lower:
            return mapped_sector

    return None
