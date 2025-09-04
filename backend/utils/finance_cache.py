# backend/utils/finance_cache.py
import os, json, time, zlib
from typing import Callable, Optional
import redis

REDIS_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")
YF_CACHE_TTL = int(os.getenv("YF_CACHE_TTL", "900"))

_redis = None


def _get_redis():
    global _redis
    if _redis is None:
        _redis = redis.Redis.from_url(REDIS_URL)
    return _redis


def cache_json(key: str, fetch: Callable[[], dict], ttl: Optional[int] = None) -> dict:
    r = _get_redis()
    raw = r.get(key)
    if raw:
        try:
            return json.loads(raw)
        except Exception:
            pass
    data = fetch()
    r.setex(key, ttl or YF_CACHE_TTL, json.dumps(data, default=str))
    return data


def cache_bytes(
    key: str, fetch: Callable[[], bytes], ttl: Optional[int] = None
) -> bytes:
    r = _get_redis()
    raw = r.get(key)
    if raw:
        return raw
    data = fetch()
    r.setex(key, ttl or YF_CACHE_TTL, data)
    return data


def cache_pickle_compressed(
    key: str, fetch: Callable[[], bytes], ttl: Optional[int] = None
) -> bytes:
    """
    For larger Python objects serialized to bytes; we zlib compress them.
    """
    r = _get_redis()
    raw = r.get(key)
    if raw:
        return zlib.decompress(raw)
    data = fetch()
    r.setex(key, ttl or YF_CACHE_TTL, zlib.compress(data, level=6))
    return data
