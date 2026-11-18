"""
Symbol mapping helpers for NSE financial providers.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class ProviderSymbols:
    nse: str
    yahoo: str
<<<<<<< HEAD
    fmp: str
    alpha: str
=======
>>>>>>> origin/main


def map_symbol(raw_symbol: str) -> ProviderSymbols:
    """
    Convert an NSE symbol into provider-specific formats.
    """
    base = (raw_symbol or "").upper().strip()
    return ProviderSymbols(
        nse=f"NSE:{base}",
        yahoo=f"{base}.NS",
<<<<<<< HEAD
        fmp=base,
        alpha=f"NSE:{base}",
=======
>>>>>>> origin/main
    )
