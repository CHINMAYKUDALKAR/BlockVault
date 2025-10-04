from __future__ import annotations
from flask import Blueprint, request, abort
import secrets
import time
from web3 import Web3
from eth_account.messages import encode_defunct
from ..core.db import get_db
from ..core.security import generate_jwt, require_auth
from ..core.rbac import role_name

bp = Blueprint("auth", __name__)

NONCE_TTL_SECONDS = 300  # 5 minutes


def _nonce_collection():
    return get_db()["nonces"]


def _users_collection():
    return get_db()["users"]


@bp.post("/get_nonce")
def get_nonce():
    data = request.get_json(silent=True) or {}
    address = data.get("address")
    if not address or not isinstance(address, str):
        abort(400, "address required")
    address = Web3.to_checksum_address(address)

    nonce = secrets.token_hex(16)
    now = int(time.time())

    _nonce_collection().update_one(
        {"address": address},
        {"$set": {"nonce": nonce, "created_at": now}},
        upsert=True,
    )

    return {"address": address, "nonce": nonce, "message": f"BlockVault login nonce: {nonce}"}


@bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    address = data.get("address")
    signature = data.get("signature")
    if not address or not signature:
        abort(400, "address and signature required")

    try:
        address = Web3.to_checksum_address(address)
    except ValueError:
        abort(400, "invalid address")

    rec = _nonce_collection().find_one({"address": address})
    if not rec:
        abort(400, "nonce not found; request a new one")

    # Check TTL
    if int(time.time()) - int(rec.get("created_at", 0)) > NONCE_TTL_SECONDS:
        abort(400, "nonce expired; request a new one")

    nonce = rec.get("nonce")
    if not nonce:
        abort(400, "nonce missing; request a new one")

    message = f"BlockVault login nonce: {nonce}"
    encoded = encode_defunct(text=message)

    try:
        recovered = Web3().eth.account.recover_message(encoded, signature=signature)
    except Exception:
        abort(400, "invalid signature")

    if recovered.lower() != address.lower():
        abort(401, "signature does not match address")

    _users_collection().update_one(
        {"address": address},
        {"$setOnInsert": {"created_at": int(time.time())}},
        upsert=True,
    )

    # Invalidate used nonce
    _nonce_collection().delete_one({"address": address})

    token = generate_jwt({"sub": address})
    return {"token": token, "address": address}


@bp.get("/me")
@require_auth
def me():  # type: ignore
    # request.address is set by require_auth
    from flask import request as _req
    role = getattr(_req, "role", None)
    return {
        "address": getattr(_req, "address"),
        "role": role_name(role) if role is not None else "unknown",
        "role_value": int(role) if isinstance(role, int) else None,
    }
