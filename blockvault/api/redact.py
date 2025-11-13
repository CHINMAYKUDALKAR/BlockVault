"""REST endpoint implementing secure document redaction."""

from __future__ import annotations

import hashlib
import os
import time
from pathlib import Path
from typing import Any, Dict, List

from flask import Blueprint, abort, current_app, request

from ..core.crypto_cli import (
    decrypt_file as crypto_decrypt,
    encrypt_file as crypto_encrypt,
    ensure_storage_dir,
    generate_encrypted_filename,
)
from ..core.db import get_db
from ..core.security import require_auth
from ..core import ipfs as ipfs_mod
from ..core import onchain as onchain_mod
from ..services.redaction_service import (
    BaseRedactor,
    DOCXRedactor,
    PDFRedactor,
    RedactionRegion,
    RedactionRequest,
)
from .files import _lookup_file


redact_bp = Blueprint("redact", __name__)


def _redacted_collection():
    return get_db()["files"]


def _build_regions(payload: Dict[str, Any]) -> List[RedactionRegion]:
    regions_raw = payload.get("redaction_regions") or []
    regions: List[RedactionRegion] = []
    for region in regions_raw:
        try:
            regions.append(
                RedactionRegion(
                    page=int(region["page"]),
                    x=float(region["x"]),
                    y=float(region["y"]),
                    w=float(region["w"]),
                    h=float(region["h"]),
                )
            )
        except (KeyError, TypeError, ValueError):
            abort(400, "invalid redaction region data")
    return regions


def _create_redactor(request_obj: RedactionRequest) -> BaseRedactor:
    suffix = request_obj.source_path.suffix.lower()
    if suffix == ".pdf":
        return PDFRedactor(request_obj)
    if suffix in {".docx"}:
        return DOCXRedactor(request_obj)
    abort(415, "unsupported file type for redaction")


@redact_bp.post("/redact")
@require_auth
def redact_file():  # type: ignore
    data: Dict[str, Any] = request.get_json(force=True, silent=False) or {}
    file_id = data.get("file_id")
    if not file_id:
        abort(400, "file_id required")

    passphrase = data.get("passphrase")
    if not passphrase:
        abort(400, "passphrase required for redaction")

    rec, canonical_id = _lookup_file(file_id)
    owner = rec.get("owner")
    requester = getattr(request, "address").lower()
    if owner != requester:
        abort(403, "only file owner may request redaction")

    storage_dir = ensure_storage_dir()
    enc_path = storage_dir / rec["enc_filename"]
    if not enc_path.exists():
        abort(410, "encrypted blob missing")

    tmp_plain = storage_dir / f"dec_{int(time.time()*1000)}_{rec['original_name']}"
    tmp_redacted = storage_dir / f"redacted_{int(time.time()*1000)}_{rec['original_name']}"
    try:
        crypto_decrypt(enc_path, tmp_plain, passphrase, rec.get("aad"))

        regions = _build_regions(data)
        patterns = data.get("patterns_applied") or []
        custom_terms = data.get("custom_terms") or []

        matched_texts = data.get("matched_texts") or []

        redaction_request = RedactionRequest(
            file_id=canonical_id,
            source_path=tmp_plain,
            output_path=tmp_redacted,
            regions=regions,
            patterns_applied=list(map(str, patterns)),
            custom_terms=list(map(str, custom_terms)),
            matched_texts=list({str(t) for t in matched_texts if t}),
            requested_by=requester,
        )
        redactor = _create_redactor(redaction_request)
        result = redactor.apply_redactions()

        new_enc_name = generate_encrypted_filename()
        relative_enc_name = os.path.join("redacted", new_enc_name)
        new_enc_path = storage_dir / relative_enc_name
        new_enc_path.parent.mkdir(parents=True, exist_ok=True)
        crypto_encrypt(tmp_redacted, new_enc_path, passphrase, rec.get("aad"))

        size = os.path.getsize(tmp_redacted)
        cid = None
        try:
            cid = ipfs_mod.add_file(new_enc_path)
        except Exception:
            cid = None

        anchor_tx = None
        try:
            anchor_tx = onchain_mod.anchor_file(result.sha256, size, cid)
        except Exception:
            anchor_tx = None

        record = {
            "owner": owner,
            "original_name": rec.get("original_name"),
            "enc_filename": relative_enc_name,
            "size": size,
            "created_at": int(time.time() * 1000),
            "aad": rec.get("aad"),
            "sha256": result.sha256,
            "cid": cid,
            "anchor_tx": anchor_tx,
            "folder": rec.get("folder"),
            "parent_file_id": canonical_id,
            "redaction_meta": {
                "patterns": redaction_request.patterns_applied,
                "custom_terms": redaction_request.custom_terms,
                "regions": [region.__dict__ for region in redaction_request.regions],
                "removed_terms": result.removed_terms,
            },
        }
        inserted = _redacted_collection().insert_one(record)

        return {
            "status": "success",
            "file_id": str(inserted.inserted_id),
            "new_cid": cid,
            "hash": result.sha256,
            "redacted_by": requester,
            "anchor_tx": anchor_tx,
        }
    finally:
        for path in (tmp_plain, tmp_redacted):
            try:
                if path.exists():
                    os.remove(path)
            except OSError:
                current_app.logger.warning("Failed to cleanup temp file %s", path)

