from typing import Dict, Any, List, Optional
from .db import db


def list_assets(pid: str) -> List[Dict[str, Any]]:
    return list(db.assets.find({"portfolioId": pid}, {"_id": 0}))


def get_asset(aid: str) -> Optional[Dict[str, Any]]:
    return db.assets.find_one({"id": aid}, {"_id": 0})


def upsert_asset(payload: Dict[str, Any]) -> Dict[str, Any]:
    if not payload.get("id"):
        payload["id"] = __import__("uuid").uuid4().hex
    db.assets.update_one({"id": payload["id"]}, {"$set": payload}, upsert=True)
    return get_asset(payload["id"])


def delete_asset(aid: str) -> None:
    db.assets.delete_one({"id": aid})
