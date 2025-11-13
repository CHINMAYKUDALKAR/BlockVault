from __future__ import annotations
"""Lightweight optional on-chain anchoring utilities.

This module lets the backend emit a transaction (or simulated hash) anchoring
an uploaded file's metadata (sha256, size, optional IPFS CID) to a simple
FileRegistry contract. If a contract address or RPC URL / private key are
missing, functions gracefully no-op.
"""
from typing import Optional, Any
import hashlib
import logging

from flask import current_app

logger = logging.getLogger(__name__)

try:
    from web3 import Web3  # type: ignore
except ImportError:  # backend may not have web3 installed yet
    Web3 = None  # type: ignore

FILE_REGISTRY_ABI = [
    {
        "inputs": [
            {"internalType": "bytes32", "name": "fileHash", "type": "bytes32"},
            {"internalType": "uint256", "name": "size", "type": "uint256"},
            {"internalType": "string", "name": "cid", "type": "string"},
        ],
        "name": "anchorFile",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    }
]


FILE_VERSION_REGISTRY_ABI = [
    {
        "inputs": [
            {"internalType": "bytes32", "name": "fileId", "type": "bytes32"},
            {"internalType": "string", "name": "currentCid", "type": "string"},
            {"internalType": "string", "name": "previousCid", "type": "string"},
        ],
        "name": "recordVersion",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    }
]


def _get_web3() -> Optional[Any]:
    """Return a Web3 client if RPC configuration is available."""
    if Web3 is None:
        return None
    rpc_url = current_app.config.get("ETH_RPC_URL")
    if not rpc_url:
        return None
    try:
        return Web3(Web3.HTTPProvider(rpc_url))  # type: ignore[arg-type]
    except Exception as exc:
        logger.warning("web3 init failed: %s", exc)
        return None


def enabled() -> bool:
    cfg = current_app.config
    return bool(
        cfg.get("ETH_PRIVATE_KEY")
        and cfg.get("FILE_REGISTRY_ADDRESS")
        and _get_web3() is not None
    )


def version_enabled() -> bool:
    cfg = current_app.config
    return bool(
        cfg.get("ETH_PRIVATE_KEY")
        and cfg.get("FILE_VERSION_REGISTRY_ADDRESS")
        and _get_web3() is not None
    )


def _hashed_identifier(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def anchor_file(hash_hex: str, size: int, cid: Optional[str]) -> Optional[str]:
    """Anchor file metadata on-chain.

    Returns transaction hash (hex) or a simulated hash when disabled.
    """
    if not hash_hex or len(hash_hex) != 64:
        logger.debug("anchor_file: invalid hash %s", hash_hex)
        return None
    if not enabled():
        # Return deterministic pseudo-hash for traceability even when disabled
        pseudo = f"simulated::{hash_hex[:16]}::{size}"
        return pseudo
    try:
        w3 = _get_web3()
        if w3 is None:
            return None
        private_key = current_app.config.get("ETH_PRIVATE_KEY")
        if not private_key:
            logger.debug("anchor_file: missing ETH_PRIVATE_KEY; skipping on-chain call")
            return None
        acct = w3.eth.account.from_key(private_key)  # type: ignore
        contract_addr = current_app.config.get("FILE_REGISTRY_ADDRESS")
        if not contract_addr:
            return None
        contract = w3.eth.contract(address=Web3.to_checksum_address(contract_addr), abi=FILE_REGISTRY_ABI)  # type: ignore
        file_hash_bytes = bytes.fromhex(hash_hex)
        # bytes32 => first 32 bytes (sha256 already 32)
        nonce = w3.eth.get_transaction_count(acct.address)
        txn = contract.functions.anchorFile(file_hash_bytes, int(size), cid or "").build_transaction({
            "from": acct.address,
            "nonce": nonce,
            "gas": 180000,
            "maxFeePerGas": w3.to_wei('30', 'gwei'),
            "maxPriorityFeePerGas": w3.to_wei('1', 'gwei'),
            "chainId": w3.eth.chain_id,
        })
        signed = acct.sign_transaction(txn)
        tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
        receipt_hash = tx_hash.hex()
        logger.info("Anchored file sha256=%s size=%s cid=%s tx=%s", hash_hex, size, cid, receipt_hash)
        return receipt_hash
    except Exception as e:
        logger.warning("anchor_file failed: %s", e)
        return None


def record_file_version(file_id: str, current_cid: str, previous_cid: Optional[str]) -> Optional[str]:
    """Record a file version change on-chain (or simulate when disabled)."""
    if not file_id or not current_cid:
        logger.debug("record_file_version: missing required data (file_id=%s, current_cid=%s)", file_id, current_cid)
        return None

    hashed_id = _hashed_identifier(file_id)
    cfg = current_app.config

    if not version_enabled():
        pseudo = f"simulated-version::{hashed_id[:16]}::{_hashed_identifier(current_cid)[:16]}"
        return pseudo
    try:
        w3 = _get_web3()
        if w3 is None:
            return None
        private_key = cfg.get("ETH_PRIVATE_KEY")
        contract_addr = cfg.get("FILE_VERSION_REGISTRY_ADDRESS")
        if not private_key or not contract_addr:
            return None
        acct = w3.eth.account.from_key(private_key)  # type: ignore
        contract = w3.eth.contract(
            address=Web3.to_checksum_address(contract_addr),
            abi=FILE_VERSION_REGISTRY_ABI,
        )
        file_id_bytes = bytes.fromhex(hashed_id)
        nonce = w3.eth.get_transaction_count(acct.address)
        txn = contract.functions.recordVersion(
            file_id_bytes,
            current_cid,
            previous_cid or ""
        ).build_transaction({
            "from": acct.address,
            "nonce": nonce,
            "gas": 220000,
            "maxFeePerGas": w3.to_wei('30', 'gwei'),
            "maxPriorityFeePerGas": w3.to_wei('1', 'gwei'),
            "chainId": w3.eth.chain_id,
        })
        signed = acct.sign_transaction(txn)
        tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
        receipt_hash = tx_hash.hex()
        logger.info(
            "Recorded file version file_id=%s current_cid=%s previous_cid=%s tx=%s",
            file_id,
            current_cid,
            previous_cid,
            receipt_hash,
        )
        return receipt_hash
    except Exception as exc:
        logger.warning("record_file_version failed: %s", exc)
        return None