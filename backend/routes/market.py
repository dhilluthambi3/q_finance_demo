# backend/routes/market.py
from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
from utils.finance_cache import cache_json
import yfinance as yf

bp = Blueprint("market", __name__)

def _now_utc():
    return datetime.now(timezone.utc)

@bp.get("/market/lookup")
def market_lookup():
    ticker = request.args.get("ticker","").strip().upper()
    if not ticker:
        return jsonify({"error":"ticker required"}), 400

    def fetch():
        t = yf.Ticker(ticker)
        info = t.fast_info or {}
        price = info.get("last_price") or info.get("lastPrice") or info.get("regularMarketPrice")
        currency = info.get("currency") or info.get("currencyCode") or "USD"
        try:
            name = t.info.get("shortName") or t.info.get("longName") or ticker
        except Exception:
            name = ticker
        dy = None
        try:
            dy = t.info.get("dividendYield")
        except Exception:
            dy = None
        return {
            "ticker": ticker,
            "name": name,
            "price": float(price) if price is not None else None,
            "currency": currency,
            "dividendYield": dy,
            "ts": _now_utc().isoformat().replace("+00:00","Z")
        }

    return jsonify(cache_json(f"yf:lookup:{ticker}", fetch))

@bp.get("/market/options/expirations")
def market_option_expirations():
    ticker = request.args.get("ticker","").strip().upper()
    if not ticker:
        return jsonify({"error":"ticker required"}), 400

    def fetch():
        t = yf.Ticker(ticker)
        exps = t.options or []
        return {"ticker": ticker, "expirations": list(exps)}

    return jsonify(cache_json(f"yf:opts:expirations:{ticker}", fetch))

@bp.get("/market/options/chain")
def market_option_chain():
    ticker = request.args.get("ticker","").strip().upper()
    expiry = request.args.get("expiry","").strip()
    if not ticker or not expiry:
        return jsonify({"error":"ticker and expiry required"}), 400

    def fetch():
        t = yf.Ticker(ticker)
        chain = t.option_chain(expiry)
        calls = chain.calls.fillna(0)
        puts = chain.puts.fillna(0)
        def to_rows(df):
            rows = []
            for _, r in df.iterrows():
                rows.append({
                    "strike": float(r.get("strike", 0)),
                    "lastPrice": float(r.get("lastPrice", 0) or 0),
                    "bid": float(r.get("bid", 0) or 0),
                    "ask": float(r.get("ask", 0) or 0),
                    "impliedVol": float(r.get("impliedVolatility", 0) or r.get("impliedVol",0) or 0),
                })
            return rows
        return {"ticker": ticker, "expiry": expiry, "calls": to_rows(calls), "puts": to_rows(puts) }
    
    return jsonify(cache_json(f"yf:opts:chain:{ticker}:{expiry}", fetch))