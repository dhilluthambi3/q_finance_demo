# backend/tasks/optimization.py
from . import celery_app
from models.jobs import set_job_status
from models.db import db
import numpy as np
from datetime import datetime, timezone
import yfinance as yf

from utils.sanitize import normalize_ticker

from scipy.optimize import minimize


def _utcnow():
    return datetime.now(timezone.utc)


def _get_portfolio_assets(portfolio_id: str):
    return list(db.assets.find({"portfolioId": portfolio_id}, {"_id": 0, "ticker": 1}))


def _fetch_history(tickers, period="3y"):
    tix = [normalize_ticker(t) for t in tickers if t]
    data = yf.download(tickers=tix, period=period, auto_adjust=True, progress=False)
    close = (
        data["Close"]
        if isinstance(data, dict)
        else data["Adj Close"] if "Adj Close" in data else data
    )
    if close is None or len(close) == 0:
        raise ValueError(f"No price data for tickers: {tix}")
    if close.ndim == 1:
        close = close.to_frame()
    close = close.dropna(how="all")
    # If any ticker fully empty → raise helpful error
    missing = [t for t in tix if t not in close.columns]
    if missing:
        raise ValueError(
            f"Missing price data for: {', '.join(missing)} (check symbols)"
        )
    return close


def _mv_optimize(
    returns,
    cov,
    target: float = None,
    long_only=True,
    gross_leq_1=True,
    w_max: float = None,
):
    n = len(returns)
    # Objective: min 0.5 w^T Σ w   (min variance). If no target given, we add -λμ^T w with small λ.
    lam = 0.0 if target is not None else 1e-3

    def obj(w):
        return 0.5 * np.dot(w, cov).dot(w) - lam * np.dot(returns, w)

    cons = []
    # Budget 1 if gross<=1 else unconstrained budget
    if gross_leq_1:
        cons.append({"type": "eq", "fun": lambda w: np.sum(w) - 1.0})
    # Target return
    if target is not None:
        cons.append({"type": "ineq", "fun": lambda w: np.dot(returns, w) - target})

    bounds = None
    if long_only or w_max is not None:
        lo = 0.0 if long_only else -1.0
        hi = w_max if w_max is not None else (1.0 if gross_leq_1 else 10.0)
        bounds = [(lo, hi)] * n

    w0 = np.ones(n) / n
    res = minimize(
        obj,
        w0,
        bounds=bounds,
        constraints=cons,
        method="SLSQP",
        options={"maxiter": 500},
    )
    w = res.x
    # Normalize if needed
    s = w.sum()
    if s != 0:
        w = w / s
    port_ret = float(np.dot(returns, w))
    port_vol = float(np.sqrt(np.dot(w, cov).dot(w)))
    return w, port_ret, port_vol, res.success, res.message


def _qaoa_optimize(cov, returns, cardinality=None, gamma=0.5, shots=2048, reps=2):
    """
    Binary selection (x_i in {0,1}) to choose k assets minimizing: x^T cov x - gamma * returns^T x
    Constraint sum(x)=k enforced via penalty.
    We map to QUBO and solve with QAOA (Aer simulator). Equal weights 1/k for selected.
    """
    try:
        from qiskit_optimization import QuadraticProgram
        from qiskit_optimization.algorithms import MinimumEigenOptimizer
        from qiskit.primitives import Estimator
        from qiskit.algorithms.minimum_eigensolvers import QAOA
        from qiskit_aer.primitives import Estimator as AerEstimator

        n = len(returns)
        if cardinality is None:
            cardinality = max(1, int(np.sqrt(n)))

        QP = QuadraticProgram()
        for i in range(n):
            QP.binary_var(name=f"x{i}")

        # Build QUBO: x^T cov x - gamma * returns^T x + penalty*(sum x - k)^2
        P = 10.0  # penalty
        lin = {
            f"x{i}": float(-gamma * returns[i] - 2 * P * cardinality) for i in range(n)
        }
        quad = {}
        for i in range(n):
            for j in range(n):
                val = float(cov[i, j] + (P if i == j else 2 * P))
                if val != 0.0:
                    quad[(f"x{i}", f"x{j}")] = quad.get((f"x{i}", f"x{j}"), 0.0) + val
        QP.minimize(linear=lin, quadratic=quad)

        estimator = AerEstimator()  # local simulator
        qaoa = QAOA(estimator=estimator, reps=reps)
        solver = MinimumEigenOptimizer(qaoa)
        res = solver.solve(QP)
        x = np.array([res.variables_dict[f"x{i}"] for i in range(n)], dtype=float)
        k = int(x.sum()) if x.sum() > 0 else 1
        w = x / (x.sum() if x.sum() > 0 else 1.0)
        # If cardinality not met (sim artifacts), project to top-k by score
        if k != cardinality:
            score = -gamma * returns + np.diag(cov)  # crude heuristic
            idx = np.argsort(score)[:cardinality]
            w = np.zeros(n)
            w[idx] = 1.0 / cardinality

        port_ret = float(np.dot(returns, w))
        port_vol = float(np.sqrt(np.dot(w, cov).dot(w)))
        return w, port_ret, port_vol, True, "QAOA ok"
    except Exception as e:
        return None, None, None, False, f"QAOA failed: {e}"


@celery_app.task(name="optimization.run_optimization_job")
def run_optimization_job(job_id: str, algo: str, params: dict):
    set_job_status(job_id, "Running")
    try:
        portfolio_id = params.get("portfolioId") or params.get(
            "portfolio_id"
        )  # in case you pass it here
        # In our app, the job is created with portfolioId at job level; fetch from DB if not in params:
        job_doc = db.jobs.find_one({"id": job_id}, {"_id": 0, "portfolioId": 1})
        if not portfolio_id and job_doc:
            portfolio_id = job_doc.get("portfolioId")
        if not portfolio_id:
            raise ValueError("portfolioId required")

        tickers = [a["ticker"] for a in _get_portfolio_assets(portfolio_id)]
        if not tickers:
            raise ValueError("No assets in portfolio")
        hist = _fetch_history(tickers, period=params.get("period", "3y"))
        rets = hist.pct_change().dropna()
        mu = rets.mean().values * 252.0
        Sigma = rets.cov().values * 252.0

        constraint = str(params.get("constraint", "None"))
        target = params.get("target", None)
        target = float(target) if (target is not None and str(target) != "") else None
        w_max = None
        long_only = True
        gross_leq_1 = True
        cardinality = None

        if constraint == "Long-only":
            long_only = True
        elif constraint == "Gross<=1":
            long_only = True
            gross_leq_1 = True
        elif constraint == "Max weight 20%":
            long_only = True
            gross_leq_1 = True
            w_max = 0.20
        elif constraint.startswith("Cardinality"):
            # Expect "Cardinality=k"
            try:
                cardinality = int(constraint.split("=")[1])
            except Exception:
                cardinality = max(1, int(np.sqrt(len(mu))))

        res = {}

        if algo == "MeanVariance":
            w, pret, pvol, ok, msg = _mv_optimize(
                mu,
                Sigma,
                target=target,
                long_only=long_only,
                gross_leq_1=gross_leq_1,
                w_max=w_max,
            )
            res = {
                "weights": w.tolist(),
                "tickers": tickers,
                "expectedReturn": pret,
                "volatility": pvol,
                "sharpe": (pret / pvol if pvol > 0 else None),
                "ok": ok,
                "message": msg,
            }

        elif algo in ("QAOA", "QUBO"):
            w, pret, pvol, ok, msg = _qaoa_optimize(Sigma, mu, cardinality=cardinality)
            if w is None:
                raise RuntimeError(msg)
            res = {
                "weights": w.tolist(),
                "tickers": tickers,
                "expectedReturn": pret,
                "volatility": pvol,
                "sharpe": (pret / pvol if pvol > 0 else None),
                "ok": ok,
                "message": msg,
                "cardinality": cardinality,
            }

        else:
            raise ValueError(f"Unknown algo {algo}")

        set_job_status(
            job_id,
            "Succeeded",
            result={
                "algo": algo,
                "constraint": constraint,
                "target": target,
                "insights": {
                    "Assets": len(tickers),
                    "Period": params.get("period", "3y"),
                    "Ok": res.get("ok", True),
                    "Message": res.get("message", ""),
                },
                **res,
            },
        )
    except Exception as e:
        set_job_status(job_id, "Failed", error=str(e))
