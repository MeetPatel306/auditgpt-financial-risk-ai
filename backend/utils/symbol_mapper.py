"""
Symbol mapping helpers for NSE financial providers.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class ProviderSymbols:
    nse: str
    yahoo: str


def map_symbol(raw_symbol: str) -> ProviderSymbols:
    """
    Convert an NSE symbol into provider-specific formats.
    """
    base = (raw_symbol or "").upper().strip()
    return ProviderSymbols(
        nse=f"NSE:{base}",
        yahoo=f"{base}.NS",
    )
