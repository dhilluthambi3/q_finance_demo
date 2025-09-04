from typing import Dict, Any, List, Optional
from datetime import datetime
from .db import db


def list_portfolios(cid: str) -> List[Dict[str, Any]]:
    return list(db.portfolios.find({"clientId": cid}, {"_id": 0}).sort("name", 1))


def get_portfolio(pid: str) -> Optional[Dict[str, Any]]:
    return db.portfolios.find_one({"id": pid}, {"_id": 0})


def create_portfolio(payload: Dict[str, Any]) -> Dict[str, Any]:
    now = datetime.utcnow().isoformat()
    doc = {
        "id": payload.get("id") or __import__("uuid").uuid4().hex,
        "clientId": payload["clientId"],
        "name": payload["name"],
        "baseCurrency": payload.get("baseCurrency", "USD"),
        "mandate": payload.get("mandate", "Balanced"),
        "benchmark": payload.get("benchmark", ""),
        "createdAt": now,
        "updatedAt": now,
    }
    db.portfolios.insert_one(doc)
    return doc


def update_portfolio(pid: str, patch: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    patch["updatedAt"] = datetime.utcnow().isoformat()
    db.portfolios.update_one({"id": pid}, {"$set": patch})
    return get_portfolio(pid)


def delete_portfolio(pid: str) -> None:
    db.assets.delete_many({"portfolioId": pid})
    db.portfolios.delete_one({"id": pid})
