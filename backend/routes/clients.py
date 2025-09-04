# backend/routes/clients.py
from flask import Blueprint, jsonify, request
from models.clients import (
    list_clients,
    create_client,
    get_client,
    update_client,
    delete_client,
)
from models.db import db

bp = Blueprint("clients", __name__)


@bp.get("/clients")
def http_list():
    return jsonify(list_clients())


@bp.post("/clients")
def http_create():
    return jsonify(create_client(request.get_json() or {})), 201


@bp.get("/clients/<cid>")
def http_get(cid):
    c = get_client(cid)
    return (jsonify(c), 200) if c else (jsonify({"error": "Not found"}), 404)


@bp.patch("/clients/<cid>")
def http_patch(cid):
    c = update_client(cid, request.get_json() or {})
    return (jsonify(c), 200) if c else (jsonify({"error": "Not found"}), 404)


@bp.delete("/clients/<cid>")
def http_del(cid):
    delete_client(cid)
    return ("", 204)


@bp.get("/clients/stats")
def clients_stats():
    return jsonify(
        {
            "clients": db.clients.count_documents({}),
            "portfolios": db.portfolios.count_documents({}),
            "assets": db.assets.count_documents({}),
        }
    )
