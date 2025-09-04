# backend/models/jobs.py
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from .db import db
from utils.sanitize import clean_numbers
from utils.json_safe import json_sanitize


def _utcnow() -> datetime:
    # Always timezone-aware UTC
    return datetime.now(timezone.utc)


def _to_iso(dt: datetime) -> str:
    # Always "YYYY-MM-DDTHH:mm:ss.sssZ"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _parse_iso(s: str) -> datetime:
    """
    Parse ISO timestamps we wrote previously. Accepts:
        - '...Z'  -> convert to '+00:00'
        - naive   -> assume UTC
        - offset-aware -> keep offset
    Always returns timezone-aware UTC datetime.
    """
    if not s:
        return _utcnow()
    try:
        s2 = s.replace("Z", "+00:00")
        dt = datetime.fromisoformat(s2)
    except Exception:
        # Fallback: treat as UTC naive
        dt = datetime.strptime(s.split(".")[0], "%Y-%m-%dT%H:%M:%S")
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _name_or(id_value: str, collection, key: str = "name") -> Optional[str]:
    if not id_value:
        return None
    doc = db[collection].find_one({"id": id_value}, {"_id": 0, key: 1})
    return doc.get(key) if doc else None


def new_job(payload: Dict[str, Any]) -> Dict[str, Any]:
    now = _utcnow()
    cid = payload.get("clientId")
    pid = payload.get("portfolioId")
    doc = {
        "id": payload.get("id") or __import__("uuid").uuid4().hex,
        "clientId": cid,
        "clientName": _name_or(cid, "clients"),
        "portfolioId": pid,
        "portfolioName": _name_or(pid, "portfolios"),
        "type": payload["type"],
        "product": payload.get("product"),
        "algo": payload["algo"],
        "priority": payload.get("priority", "Normal"),
        "submitter": payload.get("submitter", "You"),
        "createdAt": _to_iso(now),
        "updatedAt": _to_iso(now),
        "status": "Queued",
        "startedAt": None,
        "finishedAt": None,
        "durationSec": None,
        "params": payload.get("params", {}),
        "result": None,
        "error": None,
    }
    db.jobs.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


def list_jobs(q: Dict[str, Any]) -> List[Dict[str, Any]]:
    filt: Dict[str, Any] = {}
    if q.get("clientId"):
        filt["clientId"] = q["clientId"]
    if q.get("portfolioId"):
        filt["portfolioId"] = q["portfolioId"]
    return list(db.jobs.find(filt, {"_id": 0}).sort("createdAt", -1).limit(200))


def get_job(jid: str) -> Optional[Dict[str, Any]]:
    return db.jobs.find_one({"id": jid}, {"_id": 0})


def set_job_status(
    jid: str,
    status: str,
    result: Optional[Dict[str, Any]] = None,
    error: Optional[str] = None,
) -> None:
    now = _utcnow()
    upd: Dict[str, Any] = {"status": status, "updatedAt": _to_iso(now)}

    # Read existing timestamps and normalize to aware UTC
    doc = db.jobs.find_one({"id": jid}, {"_id": 0, "startedAt": 1, "createdAt": 1})
    started_at = (
        _parse_iso(doc.get("startedAt")) if (doc and doc.get("startedAt")) else None
    )
    created_at = (
        _parse_iso(doc.get("createdAt")) if (doc and doc.get("createdAt")) else None
    )

    if status == "Running" and not started_at:
        upd["startedAt"] = _to_iso(now)

    if status in ("Succeeded", "Failed", "Cancelled"):
        upd["finishedAt"] = _to_iso(now)
        # Use startedAt if present, else createdAt
        base = started_at or created_at or now
        duration = (now - base).total_seconds()
        upd["durationSec"] = max(0, int(duration))
        upd["result"] = result
        upd["error"] = error
    elif result is not None or error is not None:
        # Allow updating result/error mid-flight if caller wants
        upd["result"] = result
        upd["error"] = error
    if "result" in upd and isinstance(upd["result"], dict):
        upd["result"] = clean_numbers(upd["result"])
    db.jobs.update_one({"id": jid}, {"$set": upd})
