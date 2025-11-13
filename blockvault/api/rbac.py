from __future__ import annotations

import time
from typing import Any, Dict

from bson import ObjectId
from flask import Blueprint, abort, request, jsonify

from ..core.db import get_db
from ..core.security import require_auth
from ..core.rbac import Role, ensure_role, role_name, assign_role_onchain


rbac_bp = Blueprint("rbac", __name__)

_ASSIGNMENTS_COLLECTION = "rbac_role_assignments"
_REQUESTS_COLLECTION = "rbac_role_requests"

_VALID_ROLES = {"viewer", "editor", "admin"}


def _normalize_address(address: str) -> str:
    return address.lower()


def _serialize_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    result = {**doc}
    if "_id" in result:
        result["id"] = str(result.pop("_id"))
    return result


@rbac_bp.get("/members")
@require_auth
def list_members() -> Any:
    ensure_role(Role.VIEWER)
    coll = get_db()[_ASSIGNMENTS_COLLECTION]
    members = [_serialize_doc(doc) for doc in coll.find({})]
    return {"members": members}


@rbac_bp.post("/members")
@require_auth
def upsert_member() -> Any:
    ensure_role(Role.ADMIN)
    data = request.get_json(silent=True) or {}
    address = data.get("address")
    role = (data.get("role") or "").lower()
    assigned_by = getattr(request, "address", "")
    if not address or not isinstance(address, str):
        abort(400, "address required")
    if role not in _VALID_ROLES:
        abort(400, f"role must be one of {sorted(_VALID_ROLES)}")

    now = int(time.time() * 1000)
    db = get_db()
    db[_ASSIGNMENTS_COLLECTION].update_one(
        {"address": _normalize_address(address)},
        {
            "$set": {
                "address": _normalize_address(address),
                "role": role,
                "assigned_by": assigned_by,
                "assigned_at": now,
            }
        },
        upsert=True,
    )
    tx_reference = assign_role_onchain(address, role)
    return {
        "address": _normalize_address(address),
        "role": role,
        "assigned_at": now,
        "assigned_by": assigned_by,
        "tx_reference": tx_reference,
    }


@rbac_bp.get("/requests")
@require_auth
def list_requests() -> Any:
    ensure_role(Role.ADMIN)
    coll = get_db()[_REQUESTS_COLLECTION]
    requests_docs = [_serialize_doc(doc) for doc in coll.find({}).sort("created_at", -1)]
    return {"requests": requests_docs}


@rbac_bp.post("/requests")
@require_auth
def submit_request() -> Any:
    ensure_role(Role.VIEWER)
    data = request.get_json(silent=True) or {}
    requested_role = (data.get("requested_role") or "").lower()
    reason = data.get("reason")
    if requested_role not in _VALID_ROLES:
        abort(400, f"requested_role must be one of {sorted(_VALID_ROLES)}")

    address = getattr(request, "address", "")
    now = int(time.time() * 1000)
    coll = get_db()[_REQUESTS_COLLECTION]
    existing = coll.find_one({"address": _normalize_address(address), "status": "pending"})
    if existing:
        abort(400, "You already have a pending request")

    doc = {
        "address": _normalize_address(address),
        "requested_role": requested_role,
        "reason": reason,
        "status": "pending",
        "created_at": now,
        "updated_at": now,
    }
    inserted = coll.insert_one(doc)
    doc["_id"] = inserted.inserted_id
    return _serialize_doc(doc), 201


def _load_request_or_404(request_id: str) -> Dict[str, Any]:
    coll = get_db()[_REQUESTS_COLLECTION]
    try:
        oid = ObjectId(request_id)
    except Exception:
        abort(404, "request not found")
    doc = coll.find_one({"_id": oid})
    if not doc:
        abort(404, "request not found")
    return doc


@rbac_bp.post("/requests/<request_id>/approve")
@require_auth
def approve_request(request_id: str) -> Any:
    ensure_role(Role.ADMIN)
    doc = _load_request_or_404(request_id)
    if doc.get("status") != "pending":
        abort(400, "request already processed")
    address = doc["address"]
    requested_role = doc["requested_role"]
    now = int(time.time() * 1000)
    handled_by = getattr(request, "address", "")

    db = get_db()
    db[_REQUESTS_COLLECTION].update_one(
        {"_id": doc["_id"]},
        {
            "$set": {
                "status": "approved",
                "handled_by": handled_by,
                "handled_at": now,
                "updated_at": now,
            }
        },
    )
    db[_ASSIGNMENTS_COLLECTION].update_one(
        {"address": address},
        {
            "$set": {
                "address": address,
                "role": requested_role,
                "assigned_by": handled_by,
                "assigned_at": now,
            }
        },
        upsert=True,
    )
    tx_reference = assign_role_onchain(address, requested_role)
    updated_request = db[_REQUESTS_COLLECTION].find_one({"_id": doc["_id"]})
    return {
        "request": _serialize_doc(updated_request),
        "assignment": {
            "address": address,
            "role": requested_role,
            "assigned_by": handled_by,
            "assigned_at": now,
            "tx_reference": tx_reference,
        },
    }


@rbac_bp.post("/requests/<request_id>/deny")
@require_auth
def deny_request(request_id: str) -> Any:
    ensure_role(Role.ADMIN)
    doc = _load_request_or_404(request_id)
    if doc.get("status") != "pending":
        abort(400, "request already processed")
    now = int(time.time() * 1000)
    handled_by = getattr(request, "address", "")
    note = (request.get_json(silent=True) or {}).get("note")

    db = get_db()
    db[_REQUESTS_COLLECTION].update_one(
        {"_id": doc["_id"]},
        {
            "$set": {
                "status": "denied",
                "handled_by": handled_by,
                "handled_at": now,
                "updated_at": now,
                "note": note,
            }
        },
    )
    updated_request = db[_REQUESTS_COLLECTION].find_one({"_id": doc["_id"]})
    return {"request": _serialize_doc(updated_request)}


@rbac_bp.delete("/members/<address>")
@require_auth
def delete_member(address: str) -> Any:
    ensure_role(Role.ADMIN)
    db = get_db()
    res = db[_ASSIGNMENTS_COLLECTION].delete_one({"address": _normalize_address(address)})
    return {"removed": res.deleted_count > 0}





