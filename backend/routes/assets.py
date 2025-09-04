from flask import Blueprint, jsonify, request
from models.assets import list_assets, upsert_asset, get_asset, delete_asset

bp = Blueprint("assets", __name__)


@bp.get("/portfolios/<pid>/assets")
def http_list(pid):
    return jsonify(list_assets(pid))


@bp.post("/portfolios/<pid>/assets")
def http_upsert(pid):
    data = request.get_json() or {}
    data["portfolioId"] = pid
    a = upsert_asset(data)
    return jsonify(a), 201


@bp.get("/assets/<aid>")
def http_get(aid):
    a = get_asset(aid)
    return (jsonify(a), 200) if a else (jsonify({"error": "Not found"}), 404)


@bp.patch("/assets/<aid>")
def http_patch(aid):
    data = request.get_json() or {}
    data["id"] = aid
    a = upsert_asset(data)
    return jsonify(a), 200


@bp.delete("/assets/<aid>")
def http_del(aid):
    delete_asset(aid)
    return ("", 204)
