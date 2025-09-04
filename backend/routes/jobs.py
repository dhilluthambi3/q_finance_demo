# # backend/routes/jobs.py
# from flask import Blueprint, jsonify, request
# from models.jobs import new_job, list_jobs, get_job
# from tasks import option_pricing, optimization
# from models.db import db

# bp = Blueprint("jobs", __name__)


# @bp.get("/jobs")
# def http_list():
#     q = {
#         "clientId": request.args.get("clientId"),
#         "portfolioId": request.args.get("portfolioId"),
#     }
#     return jsonify(list_jobs(q))


# @bp.post("/jobs")
# def http_submit():
#     job = new_job(request.get_json() or {})
#     if job["type"] == "OptionPricing":
#         option_pricing.run_option_job.apply_async(
#             args=[job["id"], job["product"], job["algo"], job["params"]]
#         )
#     elif job["type"] == "PortfolioOptimization":
#         optimization.run_optimization_job.apply_async(
#             args=[job["id"], job["algo"], job["params"]]
#         )
#     return jsonify(job), 201


# @bp.get("/jobs/<jid>")
# def http_get(jid):
#     j = get_job(jid)
#     return (jsonify(j), 200) if j else (jsonify({"error": "Not found"}), 404)


# @bp.get("/jobs/stats")
# def jobs_stats():
#     statuses = ["Queued", "Running", "Succeeded", "Failed", "Cancelled"]
#     by_status = {s: db.jobs.count_documents({"status": s}) for s in statuses}
#     total = sum(by_status.values())
#     recent = list(db.jobs.find({}, {"_id": 0}).sort("createdAt", -1).limit(10))
#     running = list(
#         db.jobs.find({"status": "Running"}, {"_id": 0}).sort("updatedAt", -1).limit(10)
#     )
#     return jsonify(
#         {"total": total, "byStatus": by_status, "recent": recent, "running": running}
#     )


# backend/routes/jobs.py
from flask import Blueprint, jsonify, request
from models.jobs import new_job, list_jobs, get_job
from tasks import option_pricing, optimization
from models.db import db
from storage.paths import load_paths_subset

bp = Blueprint("jobs", __name__)


@bp.get("/jobs")
def http_list():
    q = {
        "clientId": request.args.get("clientId"),
        "portfolioId": request.args.get("portfolioId"),
    }
    return jsonify(list_jobs(q))


@bp.post("/jobs")
def http_submit():
    job = new_job(request.get_json() or {})
    if job["type"] == "OptionPricing":
        option_pricing.run_option_job.apply_async(
            args=[job["id"], job["product"], job["algo"], job["params"]]
        )
    elif job["type"] == "PortfolioOptimization":
        optimization.run_optimization_job.apply_async(
            args=[job["id"], job["algo"], job["params"]]
        )
    return jsonify(job), 201


@bp.get("/jobs/<jid>")
def http_get(jid):
    j = get_job(jid)
    return (jsonify(j), 200) if j else (jsonify({"error": "Not found"}), 404)


@bp.get("/jobs/stats")
def jobs_stats():
    statuses = ["Queued", "Running", "Succeeded", "Failed", "Cancelled"]
    by_status = {s: db.jobs.count_documents({"status": s}) for s in statuses}
    total = sum(by_status.values())
    recent = list(db.jobs.find({}, {"_id": 0}).sort("createdAt", -1).limit(10))
    running = list(
        db.jobs.find({"status": "Running"}, {"_id": 0}).sort("updatedAt", -1).limit(10)
    )
    return jsonify(
        {"total": total, "byStatus": by_status, "recent": recent, "running": running}
    )


@bp.get("/jobs/<jid>/paths")
def job_paths(jid):
    j = get_job(jid)
    if not j:
        return jsonify({"error": "Not found"}), 404
    paths_meta = (j.get("result") or {}).get("paths")
    if not paths_meta:
        return jsonify({"error": "No paths stored for this job"}), 404
    fid = paths_meta.get("gridfs_id")
    limit = int(request.args.get("limit", "100"))
    stride = int(request.args.get("stride", "1"))
    t_sub, X_sub, n_total, steps_total = load_paths_subset(
        fid, limit=limit, stride=stride
    )
    # Convert to a friendly JSON (time vector + list of series)
    return jsonify(
        {
            "n_total": int(n_total),
            "steps_total": int(steps_total),
            "t": t_sub.tolist(),
            "series": [row.tolist() for row in X_sub],
        }
    )
