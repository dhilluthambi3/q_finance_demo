# backend/utils/json_safe.py
from __future__ import annotations
import math, datetime
from typing import Any, Mapping, Iterable
import numpy as np


def _to_native(x: Any) -> Any:
    # numpy types
    if isinstance(x, (np.generic,)):
        x = x.item()
    elif isinstance(x, (np.ndarray,)):
        return [_to_native(v) for v in x.tolist()]
    # datetimes
    if isinstance(x, (datetime.datetime, datetime.date)):
        # ensure timezone-aware ISO8601
        if isinstance(x, datetime.datetime) and x.tzinfo is None:
            x = x.replace(tzinfo=datetime.timezone.utc)
        return x.isoformat()
    # floats: normalize NaN/Inf
    if isinstance(x, float):
        if math.isnan(x) or math.isinf(x):
            return None
        return float(x)
    # ints/bools/str/None okay
    return x


def json_sanitize(obj: Any) -> Any:
    obj = _to_native(obj)
    if isinstance(obj, Mapping):
        return {str(k): json_sanitize(v) for k, v in obj.items()}
    if isinstance(obj, Iterable) and not isinstance(obj, (str, bytes)):
        return [json_sanitize(v) for v in obj]
    return obj
