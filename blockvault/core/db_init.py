"""
MongoDB Database Initialization and Schema Setup
Creates collections, indexes, and initial data for BlockVault
"""
from __future__ import annotations
import logging
from typing import Dict, Any, List
from pymongo.database import Database
from pymongo import IndexModel, ASCENDING, DESCENDING, TEXT

logger = logging.getLogger(__name__)


def create_indexes(db: Database) -> None:
    """Create all necessary indexes for optimal query performance"""
    
    logger.info("Creating database indexes...")
    
    # Files Collection Indexes
    files_indexes = [
        IndexModel([("owner", ASCENDING)], name="idx_owner"),
        IndexModel([("created_at", DESCENDING)], name="idx_created_at"),
        IndexModel([("file_hash", ASCENDING)], name="idx_file_hash", unique=True, sparse=True),
        IndexModel([("ipfs_hash", ASCENDING)], name="idx_ipfs_hash", sparse=True),
        IndexModel([("folder", ASCENDING), ("owner", ASCENDING)], name="idx_folder_owner"),
        IndexModel([("owner", ASCENDING), ("created_at", DESCENDING)], name="idx_owner_created"),
        IndexModel([("original_name", TEXT)], name="idx_text_search"),
    ]
    db["files"].create_indexes(files_indexes)
    logger.info(f"Created {len(files_indexes)} indexes for 'files' collection")
    
    # Shares Collection Indexes
    shares_indexes = [
        IndexModel([("file_id", ASCENDING)], name="idx_file_id"),
        IndexModel([("shared_by", ASCENDING)], name="idx_shared_by"),
        IndexModel([("shared_with", ASCENDING)], name="idx_shared_with"),
        IndexModel([("created_at", DESCENDING)], name="idx_created_at"),
        IndexModel([("file_id", ASCENDING), ("shared_with", ASCENDING)], name="idx_file_recipient", unique=True),
    ]
    db["shares"].create_indexes(shares_indexes)
    logger.info(f"Created {len(shares_indexes)} indexes for 'shares' collection")
    
    # Users Collection Indexes
    users_indexes = [
        IndexModel([("address", ASCENDING)], name="idx_address", unique=True),
        IndexModel([("email", ASCENDING)], name="idx_email", sparse=True, unique=True),
        IndexModel([("created_at", DESCENDING)], name="idx_created_at"),
    ]
    db["users"].create_indexes(users_indexes)
    logger.info(f"Created {len(users_indexes)} indexes for 'users' collection")
    
    # Cases Collection Indexes
    cases_indexes = [
        IndexModel([("case_id", ASCENDING)], name="idx_case_id", unique=True),
        IndexModel([("owner", ASCENDING)], name="idx_owner"),
        IndexModel([("created_at", DESCENDING)], name="idx_created_at"),
        IndexModel([("status", ASCENDING)], name="idx_status"),
        IndexModel([("title", TEXT)], name="idx_text_search"),
        IndexModel([("owner", ASCENDING), ("status", ASCENDING)], name="idx_owner_status"),
    ]
    db["cases"].create_indexes(cases_indexes)
    logger.info(f"Created {len(cases_indexes)} indexes for 'cases' collection")
    
    # Legal Documents Collection Indexes
    legal_docs_indexes = [
        IndexModel([("file_id", ASCENDING)], name="idx_file_id"),
        IndexModel([("owner", ASCENDING)], name="idx_owner"),
        IndexModel([("document_type", ASCENDING)], name="idx_doc_type"),
        IndexModel([("notarized", ASCENDING)], name="idx_notarized"),
        IndexModel([("created_at", DESCENDING)], name="idx_created_at"),
    ]
    db["legal_documents"].create_indexes(legal_docs_indexes)
    logger.info(f"Created {len(legal_docs_indexes)} indexes for 'legal_documents' collection")
    
    # Signature Requests Collection Indexes
    signatures_indexes = [
        IndexModel([("request_id", ASCENDING)], name="idx_request_id", unique=True),
        IndexModel([("file_id", ASCENDING)], name="idx_file_id"),
        IndexModel([("requester", ASCENDING)], name="idx_requester"),
        IndexModel([("signer", ASCENDING)], name="idx_signer"),
        IndexModel([("status", ASCENDING)], name="idx_status"),
        IndexModel([("created_at", DESCENDING)], name="idx_created_at"),
        IndexModel([("deadline", ASCENDING)], name="idx_deadline"),
    ]
    db["signature_requests"].create_indexes(signatures_indexes)
    logger.info(f"Created {len(signatures_indexes)} indexes for 'signature_requests' collection")
    
    # Blockchain Transactions Collection Indexes
    transactions_indexes = [
        IndexModel([("tx_hash", ASCENDING)], name="idx_tx_hash", unique=True, sparse=True),
        IndexModel([("user_address", ASCENDING)], name="idx_user_address"),
        IndexModel([("tx_type", ASCENDING)], name="idx_tx_type"),
        IndexModel([("timestamp", DESCENDING)], name="idx_timestamp"),
        IndexModel([("file_id", ASCENDING)], name="idx_file_id", sparse=True),
    ]
    db["blockchain_transactions"].create_indexes(transactions_indexes)
    logger.info(f"Created {len(transactions_indexes)} indexes for 'blockchain_transactions' collection")
    
    # Chain of Custody Collection Indexes
    chain_indexes = [
        IndexModel([("file_id", ASCENDING)], name="idx_file_id"),
        IndexModel([("event_type", ASCENDING)], name="idx_event_type"),
        IndexModel([("timestamp", DESCENDING)], name="idx_timestamp"),
        IndexModel([("actor", ASCENDING)], name="idx_actor"),
    ]
    db["chain_of_custody"].create_indexes(chain_indexes)
    logger.info(f"Created {len(chain_indexes)} indexes for 'chain_of_custody' collection")
    
    # Redactions Collection Indexes
    redactions_indexes = [
        IndexModel([("file_id", ASCENDING)], name="idx_file_id"),
        IndexModel([("redacted_by", ASCENDING)], name="idx_redacted_by"),
        IndexModel([("created_at", DESCENDING)], name="idx_created_at"),
        IndexModel([("proof_hash", ASCENDING)], name="idx_proof_hash", sparse=True),
    ]
    db["redactions"].create_indexes(redactions_indexes)
    logger.info(f"Created {len(redactions_indexes)} indexes for 'redactions' collection")
    
    # Document Analysis Collection Indexes
    analysis_indexes = [
        IndexModel([("file_id", ASCENDING)], name="idx_file_id"),
        IndexModel([("analysis_type", ASCENDING)], name="idx_analysis_type"),
        IndexModel([("created_at", DESCENDING)], name="idx_created_at"),
        IndexModel([("requested_by", ASCENDING)], name="idx_requested_by"),
    ]
    db["document_analysis"].create_indexes(analysis_indexes)
    logger.info(f"Created {len(analysis_indexes)} indexes for 'document_analysis' collection")
    
    logger.info("All indexes created successfully!")


def create_collections_with_validation(db: Database) -> None:
    """Create collections with schema validation"""
    
    logger.info("Creating collections with validation rules...")
    
    # Files Collection Validation
    files_validator = {
        "$jsonSchema": {
            "bsonType": "object",
            "required": ["owner", "original_name", "created_at"],
            "properties": {
                "owner": {
                    "bsonType": "string",
                    "description": "Ethereum address of file owner"
                },
                "original_name": {
                    "bsonType": "string",
                    "description": "Original filename"
                },
                "encrypted_name": {
                    "bsonType": "string",
                    "description": "Encrypted filename on disk"
                },
                "size": {
                    "bsonType": "int",
                    "minimum": 0,
                    "description": "File size in bytes"
                },
                "file_hash": {
                    "bsonType": "string",
                    "description": "SHA-256 hash of encrypted file"
                },
                "ipfs_hash": {
                    "bsonType": "string",
                    "description": "IPFS CID"
                },
                "folder": {
                    "bsonType": "string",
                    "description": "Folder path"
                },
                "created_at": {
                    "bsonType": "date",
                    "description": "Creation timestamp"
                }
            }
        }
    }
    
    # Create or update collections
    try:
        db.create_collection("files", validator=files_validator)
        logger.info("Created 'files' collection with validation")
    except Exception as e:
        logger.warning(f"Files collection may already exist: {e}")
    
    # Create other collections (without strict validation for flexibility)
    collections = [
        "shares",
        "users",
        "cases",
        "legal_documents",
        "signature_requests",
        "blockchain_transactions",
        "chain_of_custody",
        "redactions",
        "document_analysis",
        "file_access_roles"
    ]
    
    for collection_name in collections:
        try:
            if collection_name not in db.list_collection_names():
                db.create_collection(collection_name)
                logger.info(f"Created '{collection_name}' collection")
        except Exception as e:
            logger.warning(f"Collection '{collection_name}' may already exist: {e}")


def initialize_database(db: Database, force: bool = False) -> None:
    """
    Initialize database with collections, indexes, and validation
    
    Args:
        db: MongoDB database instance
        force: If True, drop existing indexes and recreate
    """
    logger.info("Initializing BlockVault database...")
    
    # Create collections with validation
    create_collections_with_validation(db)
    
    # Drop existing indexes if force=True
    if force:
        logger.warning("Force flag set - dropping existing indexes")
        for collection_name in db.list_collection_names():
            try:
                db[collection_name].drop_indexes()
                logger.info(f"Dropped indexes for '{collection_name}'")
            except Exception as e:
                logger.warning(f"Could not drop indexes for '{collection_name}': {e}")
    
    # Create indexes
    create_indexes(db)
    
    logger.info("Database initialization complete!")


def get_database_stats(db: Database) -> Dict[str, Any]:
    """Get database statistics"""
    stats = {
        "database": db.name,
        "collections": {},
        "total_size": 0,
        "total_documents": 0
    }
    
    for collection_name in db.list_collection_names():
        collection = db[collection_name]
        doc_count = collection.count_documents({})
        indexes = list(collection.list_indexes())
        
        stats["collections"][collection_name] = {
            "document_count": doc_count,
            "index_count": len(indexes),
            "indexes": [idx["name"] for idx in indexes]
        }
        stats["total_documents"] += doc_count
    
    return stats


def check_database_health(db: Database) -> Dict[str, Any]:
    """Check database health and return status"""
    health = {
        "status": "healthy",
        "issues": [],
        "warnings": []
    }
    
    try:
        # Test connection
        db.command("ping")
        
        # Check if required collections exist
        required_collections = [
            "files", "shares", "users", "cases", 
            "legal_documents", "signature_requests"
        ]
        existing_collections = db.list_collection_names()
        
        for coll in required_collections:
            if coll not in existing_collections:
                health["issues"].append(f"Missing required collection: {coll}")
                health["status"] = "unhealthy"
        
        # Check if indexes exist
        for coll_name in existing_collections:
            indexes = list(db[coll_name].list_indexes())
            if len(indexes) <= 1:  # Only _id index
                health["warnings"].append(f"Collection '{coll_name}' has no custom indexes")
        
    except Exception as e:
        health["status"] = "unhealthy"
        health["issues"].append(f"Database connection error: {str(e)}")
    
    return health


if __name__ == "__main__":
    # CLI tool for database initialization
    import sys
    from pymongo import MongoClient
    
    mongo_uri = sys.argv[1] if len(sys.argv) > 1 else "mongodb://localhost:27017/blockvault"
    force = "--force" in sys.argv
    
    print(f"Connecting to: {mongo_uri}")
    client = MongoClient(mongo_uri)
    db = client.get_database()
    
    if "--stats" in sys.argv:
        stats = get_database_stats(db)
        print("\nDatabase Statistics:")
        print(f"Database: {stats['database']}")
        print(f"Total Documents: {stats['total_documents']}")
        print(f"\nCollections:")
        for coll_name, coll_stats in stats["collections"].items():
            print(f"  {coll_name}:")
            print(f"    Documents: {coll_stats['document_count']}")
            print(f"    Indexes: {coll_stats['index_count']} - {', '.join(coll_stats['indexes'])}")
    
    elif "--health" in sys.argv:
        health = check_database_health(db)
        print(f"\nDatabase Health: {health['status'].upper()}")
        if health["issues"]:
            print("\nIssues:")
            for issue in health["issues"]:
                print(f"  ❌ {issue}")
        if health["warnings"]:
            print("\nWarnings:")
            for warning in health["warnings"]:
                print(f"  ⚠️  {warning}")
        if health["status"] == "healthy" and not health["warnings"]:
            print("  ✅ All checks passed!")
    
    else:
        initialize_database(db, force=force)
        print("\n✅ Database initialization complete!")
        print("\nRun with --stats to see database statistics")
        print("Run with --health to check database health")
    
    client.close()







