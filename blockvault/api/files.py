from __future__ import annotations

import base64
import io
import os
import time
import traceback
import hashlib
from typing import Dict, Any, List, Optional, Tuple

from flask import Blueprint, request, abort, send_file
from web3 import Web3
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

from ..core.security import require_auth
from ..core.db import get_db
from ..core.crypto_cli import (
    ensure_storage_dir,
    encrypt_file as crypto_encrypt,
    decrypt_file as crypto_decrypt,
    generate_encrypted_filename,
)
from ..core import ipfs as ipfs_mod
from ..core.rbac import Role, ensure_role

bp = Blueprint("files", __name__)


def _files_collection():
    return get_db()["files"]


def _shares_collection():
    return get_db()["shares"]


def _users_collection():
    return get_db()["users"]


def _canonical_file_id(rec: Dict[str, Any], fallback: str) -> str:
    if rec.get("_id") is not None:
        return str(rec["_id"])
    return fallback


def _lookup_file(file_id: str) -> Tuple[Dict[str, Any], str]:
    coll = _files_collection()
    candidates: List[Any] = []
    try:
        from bson import ObjectId  # type: ignore

        candidates.append(ObjectId(file_id))
    except Exception:
        pass
    candidates.append(file_id)
    for candidate in candidates:
        rec = coll.find_one({"_id": candidate})
        if rec:
            return rec, _canonical_file_id(rec, file_id)
    abort(404, "file not found")


def _maybe_get_file(file_id: str) -> Optional[Dict[str, Any]]:
    coll = _files_collection()
    candidates: List[Any] = []
    try:
        from bson import ObjectId  # type: ignore

        candidates.append(ObjectId(file_id))
    except Exception:
        pass
    candidates.append(file_id)
    for candidate in candidates:
        rec = coll.find_one({"_id": candidate})
        if rec:
            return rec
    return None


def _load_public_key(pem: str):
    try:
        return serialization.load_pem_public_key(pem.encode("utf-8"))
    except Exception as exc:
        abort(400, f"invalid recipient public key: {exc}")


def _serialize_share(doc: Dict[str, Any], include_encrypted: bool = True) -> Dict[str, Any]:
    base = {
        "share_id": str(doc.get("_id")),
        "file_id": doc.get("file_id"),
        "owner": doc.get("owner"),
        "recipient": doc.get("recipient"),
        "encrypted_key": doc.get("encrypted_key") if include_encrypted else None,
        "note": doc.get("note"),
        "created_at": doc.get("created_at"),
        "expires_at": doc.get("expires_at"),
    }
    if "file_name" in doc:
        base["file_name"] = doc.get("file_name")
    if "file_size" in doc:
        base["file_size"] = doc.get("file_size")
    if "sha256" in doc:
        base["sha256"] = doc.get("sha256")
    if "cid" in doc:
        base["cid"] = doc.get("cid")
    if "gateway_url" in doc:
        base["gateway_url"] = doc.get("gateway_url")
    return base


@bp.post("/", strict_slashes=False)
@require_auth
def upload_file():  # type: ignore
    ensure_role(Role.OWNER)
    if "file" not in request.files:
        abort(400, "file part required (multipart/form-data)")
    up_file = request.files["file"]
    if up_file.filename == "":
        abort(400, "empty filename")
    key = request.form.get("key")
    if not key:
        abort(400, "key (passphrase) required")
    aad = request.form.get("aad") or None

    original_name = up_file.filename
    data = up_file.read()
    if not data:
        abort(400, "empty file content")

    storage_dir = ensure_storage_dir()
    tmp_plain_path = storage_dir / f"plain_{int(time.time()*1000)}_{original_name}"
    with open(tmp_plain_path, "wb") as f:
        f.write(data)

    enc_filename = generate_encrypted_filename()
    enc_path = storage_dir / enc_filename
    try:
        crypto_encrypt(tmp_plain_path, enc_path, key, aad)
    finally:
        if tmp_plain_path.exists():
            try:
                os.remove(tmp_plain_path)
            except OSError:
                pass

    cid = None
    try:
        cid = ipfs_mod.add_file(enc_path)  # returns None if disabled
    except Exception:
        # Non-fatal: keep local storage only
        cid = None

    sha256 = hashlib.sha256(data).hexdigest()

    record = {
        "owner": getattr(request, "address"),
        "original_name": original_name,
        "enc_filename": enc_filename,
        "size": len(data),
        # millisecond precision for better pagination granularity
        "created_at": int(time.time() * 1000),
        "aad": aad,
        "sha256": sha256,
        "cid": cid,
    }
    ins = _files_collection().insert_one(record)
    resp = {"file_id": str(ins.inserted_id), "name": original_name, "sha256": sha256, "cid": cid, "gateway_url": None}
    if cid:
        resp["gateway_url"] = ipfs_mod.gateway_url(cid)
    return resp


@bp.get("/<file_id>", strict_slashes=False)
@require_auth
def download_file(file_id: str):  # type: ignore
    key = request.args.get("key") or request.headers.get("X-File-Key")
    if not key:
        abort(400, "key required (query ?key= or X-File-Key header)")

    rec, canonical_id = _lookup_file(file_id)
    owner = rec.get("owner")
    requester = getattr(request, "address")
    if owner == requester:
        ensure_role(Role.OWNER)
    else:
        ensure_role(Role.VIEWER)
        share = _shares_collection().find_one({"file_id": canonical_id, "recipient": requester})
        if not share:
            abort(404, "file not found")
        expires_at = share.get("expires_at")
        if expires_at and int(time.time() * 1000) > int(expires_at):
            abort(403, "share expired")

    storage_dir = ensure_storage_dir()
    enc_path = storage_dir / rec["enc_filename"]
    if not enc_path.exists():
        # Attempt IPFS retrieval if cid present
        cid = rec.get("cid")
        if cid:
            try:
                ipfs_mod.cat_to_path(cid, enc_path)
            except Exception:
                abort(410, "encrypted blob missing (and IPFS fetch failed)")
        else:
            abort(410, "encrypted blob missing")

    tmp_out = storage_dir / f"dec_{int(time.time()*1000)}_{rec['original_name']}"
    try:
        try:
            crypto_decrypt(enc_path, tmp_out, key, rec.get("aad"))
        except Exception as e:  # wrong key / corrupted / binary missing
            abort(400, f"decryption failed (bad key or corrupted data): {type(e).__name__}")

        # Attempt to stream file defensively: load into memory to avoid race
        try:
            with open(tmp_out, 'rb') as fh:
                data = fh.read()
        except Exception as e:
            abort(500, f"failed to read decrypted file: {type(e).__name__}")
        finally:
            try:
                if tmp_out.exists():
                    os.remove(tmp_out)
            except OSError:
                pass

        return send_file(io.BytesIO(data), as_attachment=True, download_name=rec["original_name"])
    except Exception as e:  # unexpected
        # Log stack for diagnostics
        tb = traceback.format_exc(limit=6)
        print(f"[ERROR] download_file id={file_id} owner={getattr(request,'address',None)}: {e}\n{tb}")
        if isinstance(e, SystemExit):
            raise
        # If it's already an HTTPException, let Flask handler format
        from werkzeug.exceptions import HTTPException
        if isinstance(e, HTTPException):
            raise
        # Generic fallback
        abort(500, "download failed (internal error)")


@bp.get("/", strict_slashes=False)
@require_auth
def list_files():  # type: ignore
    ensure_role(Role.OWNER)
    # Simple listing for the owner; optional limit & after (created_at cursor)
    try:
        limit = int(request.args.get("limit", "50"))
    except ValueError:
        abort(400, "limit must be int")
    limit = max(1, min(limit, 100))
    after = request.args.get("after")
    try:
        after_i = int(after) if after else None
    except ValueError:
        abort(400, "after must be int timestamp")

    owner = getattr(request, "address")
    # Debug trace header optional
    if request.headers.get('X-Debug-Files') == '1':
        print(f"[DEBUG] list_files owner={owner} after={after_i} limit={limit}")
    coll = _files_collection()

    items: List[Dict[str, Any]] = []
    # Memory DB: brute force iteration. Mongo: use find with filter & sort
    try:
        # Detect pymongo by attribute
        from pymongo.collection import Collection  # type: ignore
        if isinstance(coll, Collection):  # type: ignore[arg-type]
            flt = {"owner": owner}
            if after_i is not None:
                flt["created_at"] = {"$gt": after_i}
            cursor = coll.find(flt).sort("created_at", 1).limit(limit + 1)
            for idx, doc in enumerate(cursor):
                if idx >= limit:
                    # over-fetched; indicates has_more
                    items.append({"_extra": True, "_created_at": doc.get("created_at")})
                    break
                items.append({
                    "file_id": str(doc.get("_id")),
                    "name": doc.get("original_name"),
                    "size": doc.get("size"),
                    "created_at": doc.get("created_at"),
                    "aad": doc.get("aad"),
                    "sha256": doc.get("sha256"),
                    "cid": doc.get("cid"),
                    "gateway_url": ipfs_mod.gateway_url(doc.get("cid")) if doc.get("cid") else None,
                })
        else:
            # Memory collection: access underlying store via simple attribute
            store = getattr(coll, '_store', {})  # type: ignore[attr-defined]
            docs = list(store.values())
            docs = [d for d in docs if d.get("owner") == owner]
            if after_i:
                docs = [d for d in docs if d.get("created_at", 0) > after_i]
            docs.sort(key=lambda d: d.get("created_at", 0))
            # Over-fetch technique for memory too
            over_docs = docs[:limit + 1]
            for d in over_docs:
                if len(items) >= limit:
                    items.append({"_extra": True, "_created_at": d.get("created_at")})
                    break
                items.append({
                    "file_id": str(d.get("_id")),
                    "name": d.get("original_name"),
                    "size": d.get("size"),
                    "created_at": d.get("created_at"),
                    "aad": d.get("aad"),
                    "sha256": d.get("sha256"),
                    "cid": d.get("cid"),
                    "gateway_url": ipfs_mod.gateway_url(d.get("cid")) if d.get("cid") else None,
                })
    except Exception as e:  # fallback generic
        abort(500, f"list failed: {e}")
    has_more = False
    # Remove any over-fetch marker
    if items and items[-1].get("_extra"):
        has_more = True
        # Drop marker document
        items = items[:-1]
    next_after = items[-1]["created_at"] if items else None
    return {"items": items, "next_after": next_after, "has_more": has_more}


@bp.delete("/<file_id>", strict_slashes=False)
@require_auth
def delete_file(file_id: str):  # type: ignore
    ensure_role(Role.OWNER)
    owner = getattr(request, "address")
    oid = file_id
    try:
        from bson import ObjectId  # type: ignore
        oid = ObjectId(file_id)  # type: ignore
    except Exception:
        pass
    coll = _files_collection()
    rec = coll.find_one({"_id": oid, "owner": owner})
    if not rec:
        abort(404, "file not found")
    # Delete encrypted blob first
    storage_dir = ensure_storage_dir()
    enc_path = storage_dir / rec["enc_filename"]
    if enc_path.exists():
        try:
            os.remove(enc_path)
        except OSError:
            pass
    # Attempt IPFS unpin (best-effort)
    cid = rec.get("cid")
    if cid:
        try:
            if ipfs_mod.ipfs_enabled():
                client = ipfs_mod._get_client()  # type: ignore[attr-defined]
                client.pin.rm(cid)  # type: ignore
        except Exception:
            pass
    # Delete record
    try:
        coll.delete_one({"_id": oid, "owner": owner})
    except Exception:
        pass
    return {"status": "deleted", "file_id": file_id}


@bp.get("/<file_id>/verify", strict_slashes=False)
@require_auth
def verify_file(file_id: str):  # type: ignore
    ensure_role(Role.OWNER)
    owner = getattr(request, "address")
    oid = file_id
    try:
        from bson import ObjectId  # type: ignore
        oid = ObjectId(file_id)  # type: ignore
    except Exception:
        pass
    rec = _files_collection().find_one({"_id": oid, "owner": owner})
    if not rec:
        # Debug assist: if a record exists with that id but different owner, indicate mismatch (only when explicitly requested)
        dbg = request.args.get("debug")
        if dbg == "1":
            any_rec = _files_collection().find_one({"_id": oid})
            if any_rec and any_rec.get("owner") != owner:
                abort(404, "file not found (ownership mismatch)")
        abort(404, "file not found")
    storage_dir = ensure_storage_dir()
    enc_path = storage_dir / rec["enc_filename"]
    exists_local = enc_path.exists()
    if request.headers.get('X-Debug-Files') == '1':
        print(f"[DEBUG] verify_file owner={owner} id={file_id} exists_local={exists_local}")
    result = {
        "file_id": file_id,
        "has_encrypted_blob": exists_local,
        "cid": rec.get("cid"),
        "sha256": rec.get("sha256"),
    }
    return result


@bp.post("/<file_id>/share", strict_slashes=False)
@require_auth
def share_file(file_id: str):  # type: ignore
    ensure_role(Role.OWNER)
    owner = getattr(request, "address")
    file_rec, canonical_id = _lookup_file(file_id)
    if file_rec.get("owner") != owner:
        abort(403, "only the file owner can share")

    data = request.get_json(silent=True) or {}
    recipient = data.get("recipient")
    passphrase = data.get("passphrase")
    note = (data.get("note") or "").strip() or None
    expires_at = data.get("expires_at")

    if not recipient or not isinstance(recipient, str):
        abort(400, "recipient address required")
    if not passphrase or not isinstance(passphrase, str):
        abort(400, "passphrase required")
    if note and len(note) > 280:
        abort(400, "note too long (max 280 chars)")

    try:
        recipient_addr = Web3.to_checksum_address(recipient)
    except Exception:
        abort(400, "invalid recipient address")
    if recipient_addr == owner:
        abort(400, "cannot share with yourself")

    recipient_doc = _users_collection().find_one({"address": recipient_addr})
    pub_pem = recipient_doc.get("sharing_pubkey") if recipient_doc else None
    if not pub_pem:
        abort(400, "recipient has not registered a sharing public key")

    public_key = _load_public_key(pub_pem)
    encrypted_bytes = public_key.encrypt(
        passphrase.encode("utf-8"),
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None,
        ),
    )
    encrypted_b64 = base64.b64encode(encrypted_bytes).decode("utf-8")

    now_ms = int(time.time() * 1000)
    expires_val: Optional[int] = None
    if expires_at is not None:
        try:
            expires_val = int(expires_at)
        except (TypeError, ValueError):
            abort(400, "expires_at must be an integer timestamp (ms)")

    share_filter = {"file_id": canonical_id, "owner": owner, "recipient": recipient_addr}
    share_doc = {
        **share_filter,
        "encrypted_key": encrypted_b64,
        "note": note,
        "expires_at": expires_val,
        "file_name": file_rec.get("original_name"),
        "file_size": file_rec.get("size"),
        "sha256": file_rec.get("sha256"),
        "cid": file_rec.get("cid"),
        "gateway_url": ipfs_mod.gateway_url(file_rec.get("cid")) if file_rec.get("cid") else None,
    }

    coll = _shares_collection()
    existing = coll.find_one(share_filter)
    if existing:
        coll.update_one(share_filter, {"$set": {**share_doc, "updated_at": now_ms}})
        result_doc = coll.find_one(share_filter) or {**existing, **share_doc}
        result_doc.setdefault("created_at", existing.get("created_at", now_ms))
    else:
        share_doc["created_at"] = now_ms
        insert_result = coll.insert_one(share_doc)
        result_doc = coll.find_one({"_id": getattr(insert_result, "inserted_id", None)}) or share_doc

    return _serialize_share(result_doc, include_encrypted=True)


def _collect_shares(filter_query: Dict[str, Any]) -> List[Dict[str, Any]]:
    coll = _shares_collection()
    docs: List[Dict[str, Any]] = []
    try:
        from pymongo.collection import Collection  # type: ignore

        if isinstance(coll, Collection):  # type: ignore[arg-type]
            docs = list(coll.find(filter_query))
        else:
            docs = list(coll.find(filter_query))  # type: ignore[call-arg]
    except Exception as exc:
        abort(500, f"failed to fetch shares: {exc}")
    return docs


def _merge_metadata(doc: Dict[str, Any]) -> Dict[str, Any]:
    metadata = dict(doc)
    if not metadata.get("file_name") or not metadata.get("file_size"):
        rec = _maybe_get_file(metadata.get("file_id", ""))
        if rec:
            metadata.setdefault("file_name", rec.get("original_name"))
            metadata.setdefault("file_size", rec.get("size"))
            metadata.setdefault("sha256", rec.get("sha256"))
            metadata.setdefault("cid", rec.get("cid"))
            metadata.setdefault(
                "gateway_url",
                ipfs_mod.gateway_url(rec.get("cid")) if rec.get("cid") else None,
            )
    return metadata


def _get_share_by_id(share_id: str) -> Optional[Dict[str, Any]]:
    coll = _shares_collection()
    candidates: List[Any] = []
    try:
        from bson import ObjectId  # type: ignore

        candidates.append(ObjectId(share_id))
    except Exception:
        pass
    candidates.append(share_id)
    for candidate in candidates:
        doc = coll.find_one({"_id": candidate})
        if doc:
            return doc
    # Last resort: iterate and compare stringified ids (memory backend)
    try:
        for doc in coll.find({}):
            if str(doc.get("_id")) == share_id:
                return doc
    except Exception:
        pass
    return None


@bp.get("/shared", strict_slashes=False)
@require_auth
def list_shared_with_me():  # type: ignore
    ensure_role(Role.VIEWER)
    address = getattr(request, "address")
    now_ms = int(time.time() * 1000)
    docs = _collect_shares({"recipient": address})
    results: List[Dict[str, Any]] = []
    for doc in docs:
        expires_at = doc.get("expires_at")
        if expires_at and now_ms > int(expires_at):
            continue
        metadata = _merge_metadata(doc)
        results.append(_serialize_share(metadata, include_encrypted=True))
    return {"shares": results}


@bp.get("/shares/outgoing", strict_slashes=False)
@require_auth
def list_outgoing_shares():  # type: ignore
    ensure_role(Role.OWNER)
    owner = getattr(request, "address")
    docs = _collect_shares({"owner": owner})
    results = [_serialize_share(_merge_metadata(doc), include_encrypted=False) for doc in docs]
    return {"shares": results}


@bp.delete("/shares/<share_id>", strict_slashes=False)
@require_auth
def revoke_share(share_id: str):  # type: ignore
    address = getattr(request, "address")
    target = _get_share_by_id(share_id)
    if not target:
        abort(404, "share not found")

    if target.get("owner") != address and target.get("recipient") != address:
        ensure_role(Role.ADMIN)
    coll = _shares_collection()
    delete_filter: Dict[str, Any]
    if target.get("_id") is not None:
        delete_filter = {"_id": target.get("_id")}
    else:
        delete_filter = {
            "file_id": target.get("file_id"),
            "owner": target.get("owner"),
            "recipient": target.get("recipient"),
        }
    coll.delete_one(delete_filter)
    return {
        "status": "revoked",
        "share_id": share_id,
    }
