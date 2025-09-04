# backend/tasks/option_pricing.py
from . import celery_app
from models.jobs import set_job_status
from storage.paths import save_paths_npz
from utils.finance_cache import cache_json
from utils.sanitize import normalize_ticker
import numpy as np
from math import log, sqrt, exp
from datetime import datetime, timezone
from scipy.stats import norm
import yfinance as yf


def _utcnow():
    return datetime.now(timezone.utc)


def black_scholes(S0, K, T, r, sigma, otype="CALL", q=0.0):
    if T <= 0 or sigma <= 0 or S0 <= 0 or K <= 0:
        return 0.0
    d1 = (log(S0 / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrt(T))
    d2 = d1 - sigma * sqrt(T)
    if otype == "CALL":
        return S0 * exp(-q * T) * norm.cdf(d1) - K * exp(-r * T) * norm.cdf(d2)
    else:
        return K * exp(-r * T) * norm.cdf(-d2) - S0 * exp(-q * T) * norm.cdf(-d1)


def european_mc_paths(S0, T, r, q, sigma, paths=10000, steps=252, otype="CALL"):
    dt = T / steps
    mu = (r - q - 0.5 * sigma * sigma) * dt
    sdt = sigma * np.sqrt(dt)
    X = np.empty((paths, steps + 1), dtype=np.float32)
    X[:, 0] = S0
    z = np.random.normal(size=(paths, steps)).astype(np.float32)
    for j in range(1, steps + 1):
        X[:, j] = X[:, j - 1] * np.exp(mu + sdt * z[:, j - 1])
    ST = X[:, -1]
    payoff0 = np.maximum(ST - 0 if otype == "CALL" else 0 - ST, 0)
    return X, ST, payoff0


def european_mc_price(
    S0,
    K,
    T,
    r,
    sigma,
    otype="CALL",
    q=0.0,
    paths=100000,
    steps=252,
    save_paths=False,
    job_id=None,
):
    X, ST, _ = european_mc_paths(
        S0, T, r, q, sigma, paths=paths, steps=steps, otype=otype
    )
    payoff = np.maximum(ST - K, 0.0) if otype == "CALL" else np.maximum(K - ST, 0.0)
    disc = exp(-r * T)
    price = disc * payoff.mean()
    stderr = disc * payoff.std(ddof=1) / np.sqrt(paths)
    paths_meta = None
    if save_paths and job_id:
        t = np.linspace(0.0, T, steps + 1, dtype=np.float32)
        file_id = save_paths_npz(job_id, t, X)
        paths_meta = {
            "gridfs_id": file_id,
            "n_paths": int(X.shape[0]),
            "steps": int(X.shape[1]),
        }
    return float(price), float(stderr), paths_meta


def american_binomial(S0, K, T, r, sigma, steps=200, otype="CALL", q=0.0):
    dt = T / steps
    u = exp(sigma * sqrt(dt))
    d = 1.0 / u
    p = (exp((r - q) * dt) - d) / (u - d)
    disc = exp(-r * dt)
    ST = np.array([S0 * (u**j) * (d ** (steps - j)) for j in range(steps + 1)])
    vals = np.maximum(ST - K, 0.0) if otype == "CALL" else np.maximum(K - ST, 0.0)
    for i in range(steps - 1, -1, -1):
        ST = ST[: i + 1] / u
        cont = disc * (p * vals[1 : i + 2] + (1 - p) * vals[: i + 1])
        ex = np.maximum(ST - K, 0.0) if otype == "CALL" else np.maximum(K - ST, 0.0)
        vals = np.maximum(ex, cont)
    return float(vals[0])


def asian_arithmetic_mc(
    S0, K, T, r, sigma, otype="CALL", q=0.0, paths=100000, steps=252
):
    dt = T / steps
    nudt = (r - q - 0.5 * sigma * sigma) * dt
    sigsdt = sigma * np.sqrt(dt)
    disc = exp(-r * T)
    pay = np.empty(paths, dtype=float)
    for i in range(paths):
        S = S0
        sumS = 0.0
        for _ in range(steps):
            S *= exp(nudt + sigsdt * np.random.normal())
            sumS += S
        A = sumS / steps
        pay[i] = max(0.0, A - K) if otype == "CALL" else max(0.0, K - A)
    price = disc * pay.mean()
    stderr = disc * pay.std(ddof=1) / np.sqrt(paths)
    return float(price), float(stderr)


def barrier_mc(
    S0,
    K,
    T,
    r,
    sigma,
    otype="CALL",
    q=0.0,
    barrier=100.0,
    barrier_type="down-and-out",
    paths=100000,
    steps=252,
):
    dt = T / steps
    nudt = (r - q - 0.5 * sigma * sigma) * dt
    sigsdt = sigma * np.sqrt(dt)
    disc = exp(-r * T)
    pay = np.empty(paths, dtype=float)
    for i in range(paths):
        S = S0
        lo = S0
        hi = S0
        for _ in range(steps):
            S *= exp(nudt + sigsdt * np.random.normal())
            lo = min(lo, S)
            hi = max(hi, S)
        if "out" in barrier_type:
            knocked = ("down" in barrier_type and lo <= barrier) or (
                "up" in barrier_type and hi >= barrier
            )
            payoff = (
                0.0
                if knocked
                else (max(0.0, S - K) if otype == "CALL" else max(0.0, K - S))
            )
        else:
            knocked = ("down" in barrier_type and lo <= barrier) or (
                "up" in barrier_type and hi >= barrier
            )
            payoff = (
                (max(0.0, S - K) if otype == "CALL" else max(0.0, K - S))
                if knocked
                else 0.0
            )
        pay[i] = payoff
    price = disc * pay.mean()
    stderr = disc * pay.std(ddof=1) / np.sqrt(paths)
    return float(price), float(stderr)


def _yf_price_and_vol_from_chain(ticker: str, expiry: str, strike: float, otype: str):
    tkr = normalize_ticker(ticker)

    # spot
    def fetch_lookup():
        t = yf.Ticker(tkr)
        fi = t.fast_info or {}
        px = fi.get("last_price") or fi.get("regularMarketPrice")
        cur = fi.get("currency") or "USD"
        return {"price": float(px) if px else None, "currency": cur}

    look = cache_json(f"yf:lk:{tkr}", fetch_lookup)
    S0 = look.get("price")

    # option chain row
    def fetch_chain():
        t = yf.Ticker(tkr)
        try:
            ch = t.option_chain(expiry)
        except Exception:
            return {"impliedVol": 0.0, "lastPrice": 0.0, "empty": True}
        df = ch.calls if otype == "CALL" else ch.puts
        if df is None or df.empty:
            return {"impliedVol": 0.0, "lastPrice": 0.0, "empty": True}
        df = df.fillna(0)
        idx = (df["strike"] - strike).abs().astype(float).sort_values().index[0]
        row = df.loc[idx]
        return {
            "impliedVol": float(
                row.get("impliedVolatility", 0) or row.get("impliedVol", 0) or 0
            ),
            "lastPrice": float(row.get("lastPrice", 0) or 0),
            "empty": False,
        }

    chain = cache_json(f"yf:chainrow:{tkr}:{expiry}:{otype}:{strike}", fetch_chain)
    iv = chain.get("impliedVol") or 0.0
    return tkr, S0, iv, bool(chain.get("empty", False))


def _infer_T(expiry: str) -> float:
    # expiry from yfinance is "YYYY-MM-DD"
    try:
        T = (
            datetime.fromisoformat(expiry).replace(tzinfo=timezone.utc) - _utcnow()
        ).days / 365.0
        return max(1e-6, T)
    except Exception:
        return 0.5


@celery_app.task(name="option_pricing.run_option_job")
def run_option_job(job_id: str, product: str, algo: str, params: dict):
    set_job_status(job_id, "Running")
    try:
        # MULTI-LEG support: params.legs = [{ticker, expiry, strike, option_type, qty?, num_paths?, num_steps?}, ...]
        legs = params.get("legs")
        if legs and product in (None, "", "European"):
            results = []
            total_price = 0.0
            total_qty = 0.0
            for idx, leg in enumerate(legs):
                otype = str(leg.get("option_type", "CALL")).upper()
                tkr = normalize_ticker(str(leg.get("ticker", "")))
                expiry = str(leg.get("expiry", ""))
                strike = float(leg.get("strike"))
                qty = float(leg.get("qty", 1.0))
                if not tkr or not expiry or not strike:
                    raise ValueError(f"Leg {idx+1}: ticker, expiry, strike required")
                T = _infer_T(expiry)
                r = float(params.get("r", 0.01))
                q = float(params.get("q", 0.0))
                tkr, S0, sigma, empty = _yf_price_and_vol_from_chain(
                    tkr, expiry, strike, otype
                )
                if not S0:
                    raise ValueError(
                        f"{tkr}: no spot price from yfinance (symbol bad or market closed?)"
                    )
                if empty:
                    raise ValueError(
                        f"{tkr} {expiry}: empty option chain; try a different expiry"
                    )
                if sigma <= 0:
                    # Fallback to 1y hist vol
                    hist = (
                        yf.Ticker(tkr)
                        .history(period="1y")["Close"]
                        .pct_change()
                        .dropna()
                    )
                    if len(hist) == 0:
                        raise ValueError(f"{tkr}: no historical data for IV fallback")
                    sigma = float(hist.std() * np.sqrt(252))

                steps = int(leg.get("num_steps", params.get("num_steps", 252)))
                paths = int(leg.get("num_paths", params.get("num_paths", 50000)))
                save_paths = str(params.get("save_paths", "false")).lower() in (
                    "1",
                    "true",
                    "yes",
                    "on",
                )

                if algo == "BlackScholes":
                    price = black_scholes(
                        float(S0), strike, T, r, float(sigma), otype, q
                    )
                    stderr = 0.0
                    paths_meta = None
                elif algo == "MonteCarlo":
                    price, stderr, paths_meta = european_mc_price(
                        float(S0),
                        strike,
                        T,
                        r,
                        float(sigma),
                        otype,
                        q,
                        paths=paths,
                        steps=steps,
                        save_paths=save_paths and (idx == 0),
                        job_id=job_id if (idx == 0) else None,
                    )
                else:
                    price = None
                    stderr = None
                    paths_meta = None

                results.append(
                    {
                        "leg": idx + 1,
                        "ticker": tkr,
                        "expiry": expiry,
                        "strike": strike,
                        "otype": otype,
                        "qty": qty,
                        "S0": S0,
                        "sigma": sigma,
                        "T": T,
                        "algo": algo,
                        "price": price,
                        "stderr": stderr,
                        "paths": paths_meta,
                    }
                )
                if price is not None:
                    total_price += price * qty
                    total_qty += qty

            set_job_status(
                job_id,
                "Succeeded",
                result={
                    "product": "European",
                    "algo": algo,
                    "legs": results,
                    "totals": {
                        "notional": total_price,
                        "weightedAvg": (
                            total_price / total_qty if total_qty > 0 else None
                        ),
                    },
                },
            )
            return

        # Single-instrument path (existing form)
        otype = str(params.get("option_type", "CALL")).upper()
        use_chain = str(params.get("use_chain", "false")).lower() in (
            "1",
            "true",
            "yes",
            "on",
        )

        if product in (None, "", "European") and use_chain:
            ticker = normalize_ticker(str(params.get("ticker", "")))
            expiry = str(params.get("expiry", ""))
            strike = float(params.get("strike"))
            if not ticker or not expiry or not strike:
                raise ValueError(
                    "ticker, expiry and strike are required when use_chain=true"
                )

            T = _infer_T(expiry)
            r = float(params.get("r", 0.01))
            q = float(params.get("q", 0.0))
            ticker, S0, sigma, empty = _yf_price_and_vol_from_chain(
                ticker, expiry, strike, otype
            )
            if not S0:
                raise ValueError(f"{ticker}: no spot price from yfinance")
            if empty:
                raise ValueError(f"{ticker} {expiry}: empty option chain")

            steps = int(params.get("num_steps", 252))
            paths = int(params.get("num_paths", 50000))
            save_paths = str(params.get("save_paths", "false")).lower() in (
                "1",
                "true",
                "yes",
                "on",
            )

            res = {
                "source": "yfinance_chain",
                "ticker": ticker,
                "expiry": expiry,
                "strike": strike,
                "inferred": {"S0": S0, "T": T, "sigma": sigma, "r": r, "q": q},
            }

            if algo == "BlackScholes":
                price = black_scholes(float(S0), strike, T, r, float(sigma), otype, q)
                res.update({"price": price, "stderr": 0.0})
            elif algo == "MonteCarlo":
                price, stderr, paths_meta = european_mc_price(
                    float(S0),
                    strike,
                    T,
                    r,
                    float(sigma),
                    otype,
                    q,
                    paths=paths,
                    steps=steps,
                    save_paths=save_paths,
                    job_id=job_id,
                )
                res.update({"price": price, "stderr": stderr})
                if paths_meta:
                    res["paths"] = paths_meta
            else:
                res.update({"price": None, "stderr": None, "note": "QAE placeholder"})

            res["product"] = product
            res["algo"] = algo
            set_job_status(job_id, "Succeeded", result=res)
            return
        # --- European historical (no option-chain), single instrument ---
        if product in (None, "", "European") and str(
            params.get("use_chain", "false")
        ).lower() in ("0", "false", "no", "off"):
            from utils.sanitize import normalize_ticker
            import yfinance as yf
            from datetime import datetime, timezone

            otype = str(params.get("option_type", "CALL")).upper()
            ticker = normalize_ticker(str(params.get("ticker", "")))
            K = float(params.get("strike"))
            r = float(params.get("r", 0.01))
            q = float(params.get("q", 0.0))
            algo = algo  # keep

            # Get S0
            tkr = yf.Ticker(ticker)
            fi = tkr.fast_info or {}
            S0 = fi.get("last_price") or fi.get("regularMarketPrice")
            if not S0:
                hist = tkr.history(period="5d")["Close"].dropna()
                if hist.empty:
                    raise ValueError(f"{ticker}: no recent price for S0")
                S0 = float(hist.iloc[-1])

            # T from expiry or T
            if "expiry" in params and params["expiry"]:
                dt = datetime.fromisoformat(params["expiry"]).replace(
                    tzinfo=timezone.utc
                )
                T = max(1e-6, (dt - datetime.now(timezone.utc)).days / 365.0)
            else:
                T = float(params.get("T", 0.5))

            # sigma: provided or estimate from 1y hist
            if "sigma" in params and params["sigma"] not in (None, ""):
                sigma = float(params["sigma"])
            else:
                hist = tkr.history(period="1y")["Close"].pct_change().dropna()
                if len(hist) == 0:
                    raise ValueError(f"{ticker}: no historical data for sigma")
                sigma = float(hist.std() * np.sqrt(252))

            steps = int(params.get("num_steps", 252))
            paths = int(params.get("num_paths", 50000))
            save_paths = str(params.get("save_paths", "false")).lower() in (
                "1",
                "true",
                "yes",
                "on",
            )

            if algo == "BlackScholes":
                price = black_scholes(float(S0), K, T, r, float(sigma), otype, q)
                res = {
                    "source": "historical",
                    "ticker": ticker,
                    "inferred": {"S0": S0, "T": T, "sigma": sigma, "r": r, "q": q},
                    "price": float(price),
                    "stderr": 0.0,
                    "product": "European",
                    "algo": algo,
                }
            elif algo == "MonteCarlo":
                price, stderr, paths_meta = european_mc_price(
                    float(S0),
                    K,
                    T,
                    r,
                    float(sigma),
                    otype,
                    q,
                    paths=paths,
                    steps=steps,
                    save_paths=save_paths,
                    job_id=job_id,
                )
                res = {
                    "source": "historical",
                    "ticker": ticker,
                    "inferred": {"S0": S0, "T": T, "sigma": sigma, "r": r, "q": q},
                    "price": float(price),
                    "stderr": float(stderr),
                    "paths": paths_meta,
                    "product": "European",
                    "algo": algo,
                }
            else:
                res = {"note": "QAE placeholder", "product": "European", "algo": algo}

            set_job_status(job_id, "Succeeded", result=res)
            return

        # ... keep your existing non-chain branches (American/Asian/Barrier etc.) ...
        raise ValueError("Unsupported combination or missing parameters.")

    except Exception as e:
        set_job_status(job_id, "Failed", error=str(e))
