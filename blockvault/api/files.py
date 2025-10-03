from __future__ import annotations
import os
import time
import hashlib
from typing import List, Dict, Any
from pathlib import Path
from flask import Blueprint, request, abort, send_file
import io, os, traceback
from ..core.security import require_auth
from ..core.db import get_db
from ..core.crypto_cli import (
    ensure_storage_dir,
    encrypt_file as crypto_encrypt,
    decrypt_file as crypto_decrypt,
    generate_encrypted_filename,
)
from ..core import ipfs as ipfs_mod

bp = Blueprint("files", __name__)


def _files_collection():
    return get_db()["files"]


@bp.post("/", strict_slashes=False)
@require_auth
def upload_file():  # type: ignore
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

    # Support memory DB (string id) and real Mongo ObjectId
    oid = file_id
    try:  # attempt to convert; if fail, keep string
        from bson import ObjectId  # type: ignore
        oid = ObjectId(file_id)  # type: ignore
    except Exception:
        pass

    rec = _files_collection().find_one({"_id": oid, "owner": getattr(request, "address")})
    if not rec:
        abort(404, "file not found")

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
