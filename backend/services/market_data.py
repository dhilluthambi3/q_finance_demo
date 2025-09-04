import os, json
import yfinance as yf
from redis import Redis
from dotenv import load_dotenv

load_dotenv()
REDIS_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")
YF_CACHE_TTL = int(os.getenv("YF_CACHE_TTL", "900"))
r = Redis.from_url(REDIS_URL)


def get_history(ticker: str, period: str = "1y", interval: str = "1d") -> dict:
    key = f"yf:{ticker}:{period}:{interval}"
    c = r.get(key)
    if c:
        return json.loads(c)
    df = yf.download(ticker, period=period, interval=interval, progress=False)
    data = {
        "ticker": ticker,
        "points": [
            {"t": str(ts), "c": float(row["Close"])} for ts, row in df.iterrows()
        ],
    }
    r.setex(key, YF_CACHE_TTL, json.dumps(data))
    return data
