from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from .db import db


def list_clients() -> List[Dict[str, Any]]:
    return list(db.clients.find({}, {"_id": 0}).sort("name", 1))


def get_client(cid: str) -> Optional[Dict[str, Any]]:
    return db.clients.find_one({"id": cid}, {"_id": 0})


def create_client(payload: Dict[str, Any]) -> Dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": payload.get("id") or __import__("uuid").uuid4().hex,
        "name": payload["name"],
        "segment": payload.get("segment", "HNI"),
        "owner": payload.get("owner", "You"),
        "notes": payload.get("notes", ""),
        "createdAt": now,
        "updatedAt": now,
    }
    db.clients.insert_one(doc)
    return doc


def update_client(cid: str, patch: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    patch["updatedAt"] = datetime.utcnow().isoformat()
    db.clients.update_one({"id": cid}, {"$set": patch})
    return get_client(cid)


def delete_client(cid: str) -> None:
    pids = [p["id"] for p in db.portfolios.find({"clientId": cid}, {"_id": 0, "id": 1})]
    db.assets.delete_many({"portfolioId": {"$in": pids}})
    db.portfolios.delete_many({"clientId": cid})
    db.clients.delete_one({"id": cid})
