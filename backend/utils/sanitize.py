# backend/utils/sanitize.py
import math
from typing import Any, Mapping, Sequence

COMMON_TICKER_FIXES = {
    "APPL": "AAPL",  # frequent typo
}


def normalize_ticker(t: str) -> str:
    if not t:
        return t
    t = t.strip().upper()
    if t.startswith("$"):
        t = t[1:]
    return COMMON_TICKER_FIXES.get(t, t)


def _clean_number(x: float):
    if x is None:
        return None
    if isinstance(x, (int,)):
        return int(x)
    if isinstance(x, (float,)):
        if math.isnan(x) or math.isinf(x):
            return None
        return float(x)
    return x


def clean_numbers(obj: Any) -> Any:
    # Deep-clean numbers in dict/list tuples; replace NaN/Inf with None for JSON safety
    if isinstance(obj, Mapping):
        return {k: clean_numbers(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        t = [clean_numbers(v) for v in obj]
        return type(obj)(t) if isinstance(obj, tuple) else t
    return _clean_number(obj)  # numbers or scalar
