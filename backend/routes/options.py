# backend/routes/options.py
from flask import Blueprint, request, jsonify
from models.jobs import create_job, get_job
from tasks import option_pricing as opt_tasks
from utils.json_safe import json_sanitize

bp = Blueprint("options", __name__, url_prefix="/api/options")


def _mk_job(
    type_,
    product,
    algo,
    params,
    clientId=None,
    portfolioId=None,
    priority="Normal",
    submitter="API",
):
    job = create_job(
        type_=type_,
        product=product,
        algo=algo,
        params=params,
        clientId=clientId,
        portfolioId=portfolioId,
        priority=priority,
        submitter=submitter,
    )
    return job


# ---- Black-Scholes ----
@bp.post("/european/bs")
def post_bs():
    body = request.get_json(force=True) or {}
    job = _mk_job(
        "OptionPricing",
        "European",
        "BlackScholes",
        body,
        body.get("clientId"),
        body.get("portfolioId"),
        body.get("priority", "Normal"),
        body.get("submitter", "API"),
    )
    opt_tasks.run_option_job.delay(job["id"], body)
    return jsonify({"jobId": job["id"]})


@bp.get("/european/bs/<job_id>")
def get_bs(job_id):
    j = get_job(job_id)
    return jsonify(json_sanitize(j or {}))


# ---- Monte Carlo ----
@bp.post("/european/mc")
def post_mc():
    body = request.get_json(force=True) or {}
    job = _mk_job(
        "OptionPricing",
        "European",
        "MonteCarlo",
        body,
        body.get("clientId"),
        body.get("portfolioId"),
        body.get("priority", "Normal"),
        body.get("submitter", "API"),
    )
    opt_tasks.run_option_job.delay(job["id"], body)
    return jsonify({"jobId": job["id"]})


@bp.get("/european/mc/<job_id>")
def get_mc(job_id):
    j = get_job(job_id)
    return jsonify(json_sanitize(j or {}))


@bp.get("/european/mc/<job_id>/paths")
def get_mc_paths(job_id):
    # existing storage endpoints: delegate to tasks/helpers
    from storage.paths import load_paths_subset

    limit = int(request.args.get("limit", 50))
    stride = int(request.args.get("stride", 1))
    data = load_paths_subset(job_id, limit=limit, stride=stride)
    return jsonify(json_sanitize(data or {}))


# ---- QAE ----
@bp.post("/european/qae")
def post_qae():
    body = request.get_json(force=True) or {}
    job = _mk_job(
        "OptionPricing",
        "European",
        "QAE",
        body,
        body.get("clientId"),
        body.get("portfolioId"),
        body.get("priority", "Normal"),
        body.get("submitter", "API"),
    )
    opt_tasks.run_option_job.delay(job["id"], body)
    return jsonify({"jobId": job["id"]})


@bp.get("/european/qae/<job_id>")
def get_qae(job_id):
    j = get_job(job_id)
    return jsonify(json_sanitize(j or {}))
