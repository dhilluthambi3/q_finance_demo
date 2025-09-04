from flask import Blueprint, jsonify, request
from models.portfolios import (
    list_portfolios,
    create_portfolio,
    get_portfolio,
    update_portfolio,
    delete_portfolio,
)

bp = Blueprint("portfolios", __name__)


@bp.get("/clients/<cid>/portfolios")
def http_list(cid):
    return jsonify(list_portfolios(cid))


@bp.post("/clients/<cid>/portfolios")
def http_create(cid):
    data = request.get_json() or {}
    data["clientId"] = cid
    return jsonify(create_portfolio(data)), 201


@bp.get("/portfolios/<pid>")
def http_get(pid):
    p = get_portfolio(pid)
    return (jsonify(p), 200) if p else (jsonify({"error": "Not found"}), 404)


@bp.patch("/portfolios/<pid>")
def http_patch(pid):
    p = update_portfolio(pid, request.get_json() or {})
    return (jsonify(p), 200) if p else (jsonify({"error": "Not found"}), 404)


@bp.delete("/portfolios/<pid>")
def http_del(pid):
    delete_portfolio(pid)
    return ("", 204)
